const axios = require("axios");
const Organization = require("../models/Organization");
const { isValidTelnyxRequest } = require("./smsWebhookCtrl");

// Telnyx waits about 1.5 s for the dynamic variables. The AI agent stops its
// history lookup at 1 s.
const KNOWN_FACTS_TIMEOUT_MS = 1200;
const NO_HISTORY = "No prior history with this customer.";

// The query_database tool takes about 4 s, and about 7 s on the first call
// for an org. The Telnyx tool waits 20 s, so stop 1 s before that.
const QUERY_TOOL_TIMEOUT_MS = 19000;

// The pilot tools answer in less than 10 s. The agent stops at 9 s.
const PILOT_TOOL_TIMEOUT_MS = 9500;

// Pilot webhook tools (the ?tool= value) and their AI agent routes.
// The Telnyx tool sends the caller's number in the x-caller-phone header
// ({{telnyx_end_user_target}}), so the assistant cannot change it.
const PILOT_TOOL_ROUTES = {
  recent_messages: "/voice/tools/recent-messages",
  open_slots: "/voice/tools/open-slots",
  book_appointment: "/voice/tools/book-appointment",
};

/**
 * Telnyx AI assistant webhook (per org).
 * URL: POST /api/webhook/telnyx-voice/:orgId
 *
 * Telnyx calls this URL these ways:
 * - When an inbound call starts (the assistant's dynamic variables webhook).
 *   The body has data.event_type "assistant.initialization".
 *
 * - During a call, when the assistant calls the query_database webhook
 *   tool. The URL has ?tool=query_database, and the body has the question.
 *
 * - During a call, when the assistant calls a pilot webhook tool
 *   (recent_messages, open_slots, book_appointment). The URL has the
 *   ?tool= value, and the AI agent runs the tool.
 *
 * The call start gets one dynamic_prompt variable: the org's
 * email_reply_prompt and the caller's known facts. The generic prompt stays
 * on the Telnyx assistant. query_database goes to the AI agent, which runs
 * the org's database query.
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

  if (PILOT_TOOL_ROUTES[req.query.tool]) {
    return handlePilotTool(req, res, orgId, req.query.tool);
  }

  console.log("[Voice] Voice webhook", {
    orgId,
    kind: req.body?.data?.event_type || "tool call",
    callControlId:
      req.body?.data?.payload?.call_control_id ||
      req.headers["x-telnyx-call-control-id"] ||
      "none",
  });
  const dynamicPrompt = await buildDynamicPrompt(req, orgId);
  return res.json({ dynamic_variables: { dynamic_prompt: dynamicPrompt } });
}

/**
 * Join the org's email_reply_prompt and the caller's known facts from the AI
 * agent. On any failure, send the prompt with no facts, so the call starts.
 */
async function buildDynamicPrompt(req, orgId) {
  const [org, knownFacts] = await Promise.all([
    Organization.findById(orgId)
      .select("email_reply_prompt")
      .lean()
      .catch((err) => {
        console.error("[Voice] Org prompt lookup failed", { orgId, error: err.message });
        return null;
      }),
    fetchKnownFacts(req, orgId),
  ]);
  const parts = [];
  const instructions = (org?.email_reply_prompt || "").trim();
  if (instructions) parts.push(instructions);
  parts.push(`## Known facts\n${knownFacts}`);
  return parts.join("\n\n");
}

async function fetchKnownFacts(req, orgId) {
  const agentBase = process.env.AI_AGENT_SERVER_URI;
  if (!agentBase) {
    console.error("[Voice] AI_AGENT_SERVER_URI is not set", { orgId });
    return NO_HISTORY;
  }

  try {
    const agentRes = await axios.post(`${agentBase}/voice/known-facts`, req.body || {}, {
      params: { org_id: orgId },
      timeout: KNOWN_FACTS_TIMEOUT_MS,
    });
    return agentRes.data?.known_facts || NO_HISTORY;
  } catch (err) {
    console.error("[Voice] Known facts lookup failed", { orgId, error: err.message });
    return NO_HISTORY;
  }
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

/**
 * Send a pilot tool call to the AI agent and return the result. The caller
 * phone comes from the x-caller-phone header, not from the assistant. On any
 * failure, return a clear error, so the call goes on.
 */
async function handlePilotTool(req, res, orgId, tool) {
  const body = {
    ...(req.body || {}),
    caller_phone: req.headers["x-caller-phone"] || "",
  };
  console.log("[Voice] Pilot tool called", {
    orgId,
    tool,
    callControlId: req.headers["x-telnyx-call-control-id"] || "none",
    callerPhone: body.caller_phone || "none",
  });

  const agentBase = process.env.AI_AGENT_SERVER_URI;
  if (!agentBase) {
    console.error("[Voice] AI_AGENT_SERVER_URI is not set", { orgId });
    return res.json({ ok: false, error: "The records cannot be reached now." });
  }

  try {
    const agentRes = await axios.post(`${agentBase}${PILOT_TOOL_ROUTES[tool]}`, body, {
      params: { org_id: orgId },
      timeout: PILOT_TOOL_TIMEOUT_MS,
    });
    return res.json(agentRes.data);
  } catch (err) {
    console.error("[Voice] Pilot tool failed", { orgId, tool, error: err.message });
    return res.json({ ok: false, error: "The records cannot be reached now." });
  }
}

module.exports = { handleTelnyxVoiceBrief };
