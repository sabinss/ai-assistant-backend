const axios = require("axios");
const crypto = require("crypto");
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
  console.log("url", url);
  return url;
}

async function isValidTwilioRequest(req, orgId) {
  let authToken = process.env.TWILIO_AUTH_TOKEN;

  if (orgId) {
    const org = await Organization.findById(orgId).select("twilioAuthToken");
    if (org?.twilioAuthToken) {
      authToken = org.twilioAuthToken;
    }
  }

  if (!authToken) {
    console.error("Twilio auth token is not set for this organization — rejecting webhook");
    return false;
  }
  const signature = req.headers["x-twilio-signature"];
  if (!signature) return false;
  const webhookUrl = getTwilioWebhookUrl(req);
  console.log("Twilio signature check URL:", webhookUrl);
  const valid = twilio.validateRequest(authToken, signature, webhookUrl, req.body || {});

  if (!valid) {
    const variants = new Set([
      webhookUrl,
      webhookUrl.replace(/\/$/, ""),
      webhookUrl + "/",
      webhookUrl.replace(/^https:/, "http:"),
      webhookUrl.replace(/^http:/, "https:"),
      webhookUrl.replace("://mycowrkr.cloud", "://www.mycowrkr.cloud"),
      webhookUrl.replace("://www.mycowrkr.cloud", "://mycowrkr.cloud"),
    ]);
    for (const candidate of variants) {
      const ok = twilio.validateRequest(authToken, signature, candidate, req.body || {});
      console.log(`Twilio signature debug — candidate="${candidate}" valid=${ok}`);
    }
    console.log("Twilio signature debug — req.body:", JSON.stringify(req.body || {}));
  }

  return valid;
}

const TELNYX_TIMESTAMP_TOLERANCE_SECONDS = 300; // matches Telnyx's own SDK default

/**
 * Builds an Ed25519 public key object from Telnyx's base64 raw public key
 * (Mission Control Portal > Keys & Credentials > Public Key).
 */
function getTelnyxPublicKey(rawKey) {
  const raw = (rawKey || "").trim();
  if (!raw) return null;
  try {
    const keyBytes = Buffer.from(raw, "base64");
    if (keyBytes.length !== 32) {
      console.error("Telnyx public key must decode to 32 raw bytes (Ed25519 public key)");
      return null;
    }
    return crypto.createPublicKey({
      key: { kty: "OKP", crv: "Ed25519", x: keyBytes.toString("base64url") },
      format: "jwk",
    });
  } catch (err) {
    console.error("Invalid Telnyx public key:", err.message);
    return null;
  }
}

/**
 * Telnyx signs webhooks with Ed25519 over `${timestamp}|${rawBody}`.
 * Telnyx is migrating from the `telnyx-signature-ed25519`/`telnyx-timestamp` headers
 * to the Standard Webhooks style `webhook-signature`/`webhook-timestamp` (still Ed25519,
 * value optionally prefixed "v1," and possibly space-separated for key rotation) — accept both.
 */
async function isValidTelnyxRequest(req, orgId) {
  if (!orgId) {
    console.error("Telnyx webhook missing orgId — rejecting webhook");
    return false;
  }

  const org = await Organization.findById(orgId).select("telnyx_public_key");
  if (!org?.telnyx_public_key) {
    console.error(`Telnyx public key not found for organization ${orgId} — rejecting webhook`);
    return false;
  }

  const publicKey = getTelnyxPublicKey(org.telnyx_public_key);
  if (!publicKey) {
    console.error(`Invalid Telnyx public key for organization ${orgId} — rejecting webhook`);
    return false;
  }

  const timestamp = req.headers["telnyx-timestamp"] || req.headers["webhook-timestamp"];
  const signatureHeader =
    req.headers["telnyx-signature-ed25519"] || req.headers["webhook-signature"];
  if (!timestamp || !signatureHeader) return false;

  const tsSeconds = parseInt(timestamp, 10);
  if (
    !Number.isFinite(tsSeconds) ||
    Math.abs(Date.now() / 1000 - tsSeconds) > TELNYX_TIMESTAMP_TOLERANCE_SECONDS
  ) {
    console.log("Rejected Telnyx webhook: timestamp outside tolerance");
    return false;
  }

  const rawBody = req.rawBody;
  if (!rawBody) {
    console.error("Missing raw request body for Telnyx signature verification");
    return false;
  }

  const message = Buffer.concat([Buffer.from(`${timestamp}|`), rawBody]);
  const candidateSignatures = signatureHeader
    .split(" ")
    .map((part) => (part.includes(",") ? part.split(",")[1] : part))
    .filter(Boolean);

  return candidateSignatures.some((sig) => {
    try {
      return crypto.verify(null, message, publicKey, Buffer.from(sig, "base64"));
    } catch {
      return false;
    }
  });
}

/**
 * Shared org/agent lookup for an inbound SMS, independent of the SMS provider.
 * Returns { ok: true } when the org is ready to receive replies, otherwise
 * { ok: false, replyText } with a message suitable for showing back to the customer.
 */
async function resolveSmsAgent(orgId, from, to) {
  if (!orgId) {
    console.log("SMS webhook missing orgId in URL");
    return { ok: false, replyText: "Invalid webhook URL: organization is required." };
  }

  if (!from || !to) {
    console.log("SMS webhook missing From/To");
    return { ok: false, replyText: "Invalid SMS payload." };
  }

  const organization = await Organization.findById(orgId);
  if (!organization) {
    console.log("No organization found for orgId", orgId);
    return { ok: false, replyText: "This organization was not found. Please contact support." };
  }

  const smsAgent = await AgentModel.findOne({
    organization: organization._id,
    name: SMS_REPLY_AGENT_NAME,
  });

  console.log("smsAgent", smsAgent);

  if (!smsAgent) {
    console.log(`SMS_Reply_Agent missing for org ${orgId} (${organization.name})`);
    return {
      ok: false,
      replyText:
        "SMS reply is not configured for this organization. Please add the SMS_Reply_Agent.",
    };
  }

  return { ok: true };
}

/**
 * Forwards the inbound SMS (already known to belong to a configured org) to the
 * SMS_Reply_Agent, which replies to the customer itself via send_sms_tool.
 *
 * The actual Telnyx/Twilio send happens inside the Python agent, not here — this
 * function's job is to surface whether that round-trip completed and what the agent
 * said it did, via one greppable "[SMS <provider>] SEND SUCCESS|FAILED" log line.
 */
async function forwardInboundSmsToAgent({ orgId, from, to, body, messageSid, provider }) {
  const tag = `[SMS ${provider || "unknown"}]`;
  console.log("forwardInboundSmsToAgent", { orgId, from, to, body, messageSid, provider });
  const agentBase = process.env.AI_AGENT_SERVER_URI;
  if (!agentBase) {
    console.error(
      `${tag} SEND FAILED — AI_AGENT_SERVER_URI is not set org=${orgId} messageSid=${messageSid}`
    );
    return { ok: false, error: "AI_AGENT_SERVER_URI not set" };
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
    `Our SMS number: ${to}`,
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

  console.log(`${tag} Forwarding inbound SMS to SMS_Reply_Agent`, {
    orgId,
    from,
    to,
    messageSid,
    agent: SMS_REPLY_AGENT_NAME,
  });

  try {
    const pythonResponse = await axios({
      method: "get",
      url: agentUrl,
      responseType: "stream",
      timeout: 180000,
    });

    // Agent streams SSE ("data: {...}\n\n"). Accumulate its text reply and watch
    // for an explicit error field so the outcome log below reflects what actually happened.
    let completeMessage = "";
    let sawError = false;
    let sseBuffer = "";

    await new Promise((resolve, reject) => {
      pythonResponse.data.on("data", (chunk) => {
        sseBuffer += chunk.toString();
        const isComplete = sseBuffer.endsWith("\n\n");
        const parts = sseBuffer.split("\n\n");
        const messagesToProcess = isComplete ? parts : parts.slice(0, -1);
        sseBuffer = isComplete ? "" : parts[parts.length - 1];

        for (const msgText of messagesToProcess) {
          const trimmed = msgText.trim();
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(trimmed.slice("data: ".length));
            if (data.message) completeMessage += data.message;
            if (data.error) sawError = true;
          } catch {
            // Ignore an unparsable SSE fragment — doesn't affect the overall outcome.
          }
        }
      });
      pythonResponse.data.on("end", resolve);
      pythonResponse.data.on("error", reject);
    });

    const ok = !sawError;
    console.log(
      `${tag} SEND ${ok ? "SUCCESS" : "FAILED"} org=${orgId} messageSid=${messageSid} from=${from} to=${to}`
    );
    console.log(`${tag} agent response: ${completeMessage || "(empty)"}`);
    return { ok, message: completeMessage };
  } catch (err) {
    console.error(
      `${tag} SEND FAILED (agent request error) org=${orgId} messageSid=${messageSid} from=${from} to=${to}: ${err.message}`
    );
    return { ok: false, error: err.message };
  }
}

/**
 * Twilio inbound SMS webhook (per org).
 * URL: POST /api/webhook/send-twilio/:orgId
 * Requires custom agent SMS_Reply_Agent for that org.
 */
async function handleInboundSms(req, res) {
  console.log("Request in twilio webhook", req.body);
  console.log("header info", req.headers);

  const orgId = (req.params.orgId || "").trim();
  const validRequest = await isValidTwilioRequest(req, orgId);
  console.log("is valid twilio request", validRequest);
  if (!validRequest) {
    console.log("Rejected SMS webhook: invalid Twilio signature");
    return res.sendStatus(403);
  }

  const from = req.body.From;
  const to = req.body.To;
  const body = req.body.Body || "";
  const messageSid = req.body.MessageSid;

  try {
    const check = await resolveSmsAgent(orgId, from, to);
    if (!check.ok) {
      return res.type("text/xml").status(200).send(twimlMessage(check.replyText));
    }

    // Ack Twilio before slower agent work.
    res.type("text/xml").status(200).send(emptyTwiml());

    await forwardInboundSmsToAgent({ orgId, from, to, body, messageSid, provider: "Twilio" });
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

/**
 * Telnyx inbound SMS webhook (per org).
 * URL: POST /api/webhook/send-telnyx/:orgId
 * Requires custom agent SMS_Reply_Agent for that org.
 */
async function handleInboundTelnyxSms(req, res) {
  console.log("Request in telnyx webhook", req.body);
  console.log("header info", req.headers);

  const orgId = (req.params.orgId || "").trim();
  const validRequest = await isValidTelnyxRequest(req, orgId);
  console.log("is valid telnyx request", validRequest);
  if (!validRequest) {
    console.log("Rejected SMS webhook: invalid Telnyx signature");
    return res.sendStatus(403);
  }

  const payload = req.body?.data?.payload || {};
  const from = payload.from?.phone_number;
  const to = payload.to?.[0]?.phone_number;
  const body = payload.text || "";
  const messageSid = payload.id;
  console.log("from", from);
  console.log("to", to);
  console.log("messageSid", messageSid);
  console.log("orgId", orgId);
  try {
    const check = await resolveSmsAgent(orgId, from, to);
    console.log("check", check);
    if (!check.ok) {
      // Telnyx webhooks have no TwiML-style auto-reply channel — just ack the webhook.
      console.log("Telnyx inbound SMS not processed:", check.replyText);
      return res.sendStatus(200);
    }

    // Ack Telnyx before slower agent work.
    res.sendStatus(200);

    await forwardInboundSmsToAgent({ orgId, from, to, body, messageSid, provider: "Telnyx" });
  } catch (err) {
    console.error("Telnyx SMS webhook error", err.message);
    if (!res.headersSent) {
      return res.sendStatus(200);
    }
  }
}

module.exports = {
  handleInboundSms,
  handleInboundTelnyxSms,
  SMS_REPLY_AGENT_NAME,
};
