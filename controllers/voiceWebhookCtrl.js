const { isValidTelnyxRequest } = require("./smsWebhookCtrl");

// Placeholder brief from the legal advice agent. The webhook returns it as
// is. Later, the webhook builds the brief from our exposed API calls.
const LEGAL_ADVICE_AGENT_BRIEF = {
  call_goal:
    "Response to Call from a lead to get legal service from Free Injury Legal Advice. " +
    "Generally provide some common legal answers not specific like lawyer.",
  opening_line:
    "Hi, this is the virtual assistant for Free Injury Legal Advice, how can I help you?",
  stop_rule:
    "End the call once a date/time is confirmed, or the lead says they're not interested. " +
    "When either condition is met: thank them for their time, say goodbye, and immediately " +
    "call the hangup tool in the same turn. Do not wait for the lead to speak again. " +
    "Do not continue the conversation after saying goodbye.",
  known_facts: "NA",
  questions_to_ask: "What day and time works best for a call with our lawyer?",
};

/**
 * Telnyx AI assistant webhook (per org).
 * URL: POST /api/webhook/telnyx-voice/:orgId
 *
 * Telnyx calls this URL two ways:
 * - When an inbound call starts (the assistant's dynamic variables webhook).
 *   The body has data.event_type "assistant.initialization".
 * - During a call, when the assistant calls the ask_legal_advice_agent
 *   webhook tool. The body has the caller's question.
 *
 * Both get the same brief. Telnyx signs both kinds of request.
 */
async function handleTelnyxVoiceBrief(req, res) {
  const orgId = (req.params.orgId || "").trim();
  const validRequest = await isValidTelnyxRequest(req, orgId);
  if (!validRequest) {
    console.log("[Voice] Rejected voice webhook: invalid Telnyx signature", { orgId });
    return res.sendStatus(403);
  }

  console.log("[Voice] Voice webhook", {
    orgId,
    kind: req.body?.data?.event_type || "tool call",
    callControlId:
      req.body?.data?.payload?.call_control_id ||
      req.headers["x-telnyx-call-control-id"] ||
      "none",
    question: req.body?.question || "",
  });
  return res.json({ dynamic_variables: LEGAL_ADVICE_AGENT_BRIEF });
}

module.exports = { handleTelnyxVoiceBrief };
