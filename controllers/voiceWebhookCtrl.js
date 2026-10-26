const axios = require("axios");
const { isValidTelnyxRequest } = require("./smsWebhookCtrl");

// The query_database tool takes about 4 s, and about 7 s on the first call
// for an org. The Telnyx tool waits 20 s, so stop 1 s before that.
const QUERY_TOOL_TIMEOUT_MS = 19000;

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
 * - During a call, when the assistant calls the query_database webhook
 *   tool. The URL has ?tool=query_database, and the body has the question.
 *
 * The call start and ask_legal_advice_agent get the same brief.
 * query_database goes to the AI agent, which runs the org's database query.
 * Telnyx signs all of these requests.
 */
async function handleTelnyxVoiceBrief(req, res) {
  const orgId = (req.params.orgId || "").trim();
  const validRequest = await isValidTelnyxRequest(req, orgId);
  if (!validRequest) {
    console.log("[Voice] Rejected voice webhook: invalid Telnyx signature", { orgId });
    return res.sendStatus(403);
  }

  if (req.query.tool === "query_database") {
    return handleQueryDatabaseTool(req, res, orgId);
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

/**
 * Send the assistant's query_database question to the AI agent and return
 * the result. On any failure, return a clear error, so the call goes on.
 */
async function handleQueryDatabaseTool(req, res, orgId) {
  const question = req.body?.question || "";
  console.log("[Voice] query_database tool called", {
    orgId,
    callControlId: req.headers["x-telnyx-call-control-id"] || "none",
    question,
  });

  const agentBase = process.env.AI_AGENT_SERVER_URI;
  if (!agentBase) {
    console.error("[Voice] AI_AGENT_SERVER_URI is not set", { orgId });
    return res.json({ ok: false, error: "The records cannot be reached now." });
  }

  try {
    const agentRes = await axios.post(
      `${agentBase}/voice/tools/query-database`,
      { question },
      { params: { org_id: orgId }, timeout: QUERY_TOOL_TIMEOUT_MS }
    );
    return res.json(agentRes.data);
  } catch (err) {
    console.error("[Voice] query_database tool failed", { orgId, error: err.message });
    return res.json({ ok: false, error: "The records cannot be reached now." });
  }
}

module.exports = { handleTelnyxVoiceBrief };
