const axios = require("axios");
const { isValidTelnyxRequest } = require("./smsWebhookCtrl");

// Telnyx waits 1.5 s for the brief. Keep a margin for the network.
const AGENT_TIMEOUT_MS = 1200;

/**
 * Telnyx AI assistant dynamic variables webhook (per org).
 * URL: POST /api/webhook/telnyx-voice/:orgId
 *
 * Telnyx calls this when an inbound call starts. The AI agent builds the call
 * brief, and we return it unchanged. Unlike the SMS webhook, we must not ack
 * first: Telnyx reads the brief from this response.
 *
 * On any failure, return an empty object. Telnyx then uses the assistant's
 * default variables, so the call still goes on.
 */
async function handleTelnyxVoiceBrief(req, res) {
  const orgId = (req.params.orgId || "").trim();
  const validRequest = await isValidTelnyxRequest(req, orgId);
  if (!validRequest) {
    console.log("[Voice] Rejected voice webhook: invalid Telnyx signature", { orgId });
    return res.sendStatus(403);
  }

  const agentBase = process.env.AI_AGENT_SERVER_URI;
  if (!agentBase) {
    console.error("[Voice] AI_AGENT_SERVER_URI is not set", { orgId });
    return res.json({});
  }

  try {
    const agentRes = await axios.post(`${agentBase}/voice/inbound-brief`, req.body, {
      params: { org_id: orgId },
      timeout: AGENT_TIMEOUT_MS,
    });
    return res.json(agentRes.data || {});
  } catch (err) {
    console.error("[Voice] Agent brief request failed", { orgId, error: err.message });
    return res.json({});
  }
}

module.exports = { handleTelnyxVoiceBrief };
