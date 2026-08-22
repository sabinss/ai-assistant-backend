const axios = require("axios");
const twilio = require("twilio");
const Organization = require("../models/Organization");
const AgentModel = require("../models/AgentModel");

const SMS_REPLY_AGENT_NAME = "SMS_Reply_Agent";

function twimlMessage(text) {
  const safe = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<Response><Message>${safe}</Message></Response>`;
}

function emptyTwiml() {
  return "<Response></Response>";
}

/**
 * Public URL Twilio called — must match webhook config exactly for signature checks.
 * Prefer TWILIO_WEBHOOK_BASE (origin only, e.g. https://xxx.ngrok-free.dev) behind proxies.
 */
function getTwilioWebhookUrl(req) {
  const path = req.originalUrl;
  const base = (process.env.TWILIO_WEBHOOK_BASE || "").replace(/\/$/, "");
  if (base) return `${base}${path}`;

  const proto = (req.headers["x-forwarded-proto"] || req.protocol || "https")
    .toString()
    .split(",")[0]
    .trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "")
    .toString()
    .split(",")[0]
    .trim();
  const url = `${proto}://${host}${path}`;
  if (/localhost|127\.0\.0\.1/i.test(url)) {
    console.warn(
      "Twilio webhook URL resolved to localhost — set TWILIO_WEBHOOK_BASE to your public HTTPS origin or signature checks will fail:",
      url
    );
  }
  return url;
}

function isValidTwilioRequest(req) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("TWILIO_AUTH_TOKEN is not set — rejecting webhook");
    return false;
  }
  const signature = req.headers["x-twilio-signature"];
  if (!signature) return false;
  const webhookUrl = getTwilioWebhookUrl(req);
  console.log("Twilio signature check URL:", webhookUrl);
  return twilio.validateRequest(authToken, signature, webhookUrl, req.body || {});
}

/**
 * Twilio inbound SMS webhook (per org).
 * URL: POST /api/webhook/send-twilio/:orgId
 * Requires custom agent SMS_Reply_Agent for that org.
 */
async function handleInboundSms(req, res) {
  console.lop("Request in twilio webhook", req.body);
  console.log("is valid twilio requet", isValidTwilioRequest(req));
  if (!isValidTwilioRequest(req)) {
    console.log("Rejected SMS webhook: invalid Twilio signature");
    return res.sendStatus(403);
  }

  const orgId = (req.params.orgId || "").trim();
  const from = req.body.From;
  const to = req.body.To;
  const body = req.body.Body || "";
  const messageSid = req.body.MessageSid;

  try {
    if (!orgId) {
      console.log("SMS webhook missing orgId in URL");
      return res
        .type("text/xml")
        .status(200)
        .send(twimlMessage("Invalid webhook URL: organization is required."));
    }

    if (!from || !to) {
      console.log("SMS webhook missing From/To");
      return res.type("text/xml").status(200).send(twimlMessage("Invalid SMS payload."));
    }

    const organization = await Organization.findById(orgId);
    if (!organization) {
      console.log("No organization found for orgId", orgId);
      return res
        .type("text/xml")
        .status(200)
        .send(twimlMessage("This organization was not found. Please contact support."));
    }

    const smsAgent = await AgentModel.findOne({
      organization: organization._id,
      name: SMS_REPLY_AGENT_NAME,
    });

    if (!smsAgent) {
      console.log(`SMS_Reply_Agent missing for org ${orgId} (${organization.name})`);
      return res
        .type("text/xml")
        .status(200)
        .send(
          twimlMessage(
            "SMS reply is not configured for this organization. Please add the SMS_Reply_Agent."
          )
        );
    }

    // Ack Twilio before slower agent work.
    res.type("text/xml").status(200).send(emptyTwiml());

    const agentBase = process.env.AI_AGENT_SERVER_URI;
    if (!agentBase) {
      console.error("AI_AGENT_SERVER_URI is not set");
      return;
    }

    // Save inbound + load thread context (agent repo / Messages table).
    let historyText = "(no prior messages)";
    try {
      const inboundRes = await axios.post(`${agentBase}/sms/inbound`, {
        org_id: orgId,
        from_phone: from,
        to_phone: to,
        body,
        message_sid: messageSid,
      });
      const history = inboundRes.data?.history || [];
      if (history.length) {
        historyText = history
          .map((row) => {
            const label = (row.direction || "").toLowerCase() === "inbound" ? "Customer" : "Agent";
            return `${label}: ${row.body || ""}`;
          })
          .join("\n");
      }
    } catch (err) {
      console.error("Failed to save inbound SMS:", err.message);
      // Continue — still try to run the agent on the latest message.
    }

    const question = [
      "You are handling an inbound SMS reply.",
      `Our Twilio number: ${to}`,
      `Customer phone: ${from}`,
      "",
      "Conversation so far:",
      historyText,
      "",
      `Latest customer SMS: ${body}`,
      "",
      "Reply to the customer using send_sms_tool.",
      `Use from_phone_number=${to} and to_phone_number=${from}.`,
    ].join("\n");

    // Same session_id style as chat/custom-agent conversations (not phone-derived).
    const sessionId = Math.floor(100000 + Math.random() * 900000);
    const agentUrl =
      `${agentBase}/ask/agent` +
      `?agent_name=${encodeURIComponent(SMS_REPLY_AGENT_NAME)}` +
      `&query=${encodeURIComponent(question)}` +
      `&org_id=${encodeURIComponent(orgId)}` +
      `&session_id=${encodeURIComponent(String(sessionId))}`;

    console.log("Forwarding inbound SMS to SMS_Reply_Agent", {
      orgId,
      from,
      to,
      messageSid,
      agent: SMS_REPLY_AGENT_NAME,
    });

    const pythonResponse = await axios({
      method: "get",
      url: agentUrl,
      responseType: "stream",
      timeout: 180000,
    });

    await new Promise((resolve, reject) => {
      pythonResponse.data.on("data", () => {});
      pythonResponse.data.on("end", resolve);
      pythonResponse.data.on("error", reject);
    });
  } catch (err) {
    console.error("SMS webhook error", err.message);
    // If headers not sent yet, return an error TwiML; otherwise Twilio already got empty Response.
    if (!res.headersSent) {
      return res
        .type("text/xml")
        .status(200)
        .send(twimlMessage("Sorry, we could not process your message right now."));
    }
  }
}

module.exports = {
  handleInboundSms,
  SMS_REPLY_AGENT_NAME,
};
