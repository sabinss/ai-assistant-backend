const axios = require("axios");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Twilio inbound SMS webhook.
 * URL: POST /webhook/sms/:orgId?token=<org_jwt>
 * Responds with empty TwiML immediately, then forwards to the agent SMS door.
 */
async function handleInboundSms(req, res) {
  const { orgId } = req.params;
  const { token } = req.query;
  const from = req.body.From;
  const to = req.body.To;
  const body = req.body.Body || "";
  const messageSid = req.body.MessageSid;

  // Ack Twilio before agent work so Twilio does not retry on slow LLM calls.
  res.type("text/xml").status(200).send("<Response></Response>");

  try {
    if (!token || !orgId) {
      console.log("SMS webhook missing token or orgId");
      return;
    }
    if (!from || !to) {
      console.log("SMS webhook missing From/To");
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (!user || user.organization.toString() !== orgId.toString()) {
      console.log("SMS webhook auth failed for org", orgId);
      return;
    }

    const url = `${process.env.AI_AGENT_SERVER_URI}/ask/sms`;
    console.log("Forwarding inbound SMS to agent", {
      orgId,
      from,
      to,
      messageSid,
    });
    await axios.post(url, {
      org_id: orgId,
      from_phone: from,
      to_phone: to,
      body,
      message_sid: messageSid,
    });
  } catch (err) {
    console.error("SMS webhook error", err.message);
  }
}

module.exports = { handleInboundSms };
