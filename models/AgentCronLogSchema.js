// models/AgentCronLogSchema.js
// models/AgentCronLogSchema.js
const mongoose = require('mongoose');

const AgentCronLogSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: false,
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: false,
  },
  agentName: {
    type: String,
    required: false,
  },
  agentName: {
    type: String,
    required: false,
  },
  status: {
    type: String,
    enum: ['cron_started', 'cron_completed', 'selected', 'triggered', 'skipped', 'success', 'failure'],
    required: false,
  },
  frequency: {
    type: String, // Daily, Weekly, Monthly
    required: false,
  },
  dayTime: {
    type: String, // The scheduled dayTime value
    required: false,
  },
  scheduleTime: {
    type: String, // For Weekly/Monthly (e.g., "09:00", "14:30")
    required: false,
  },
  timezone: {
    type: String, // Agent's timezone (e.g., "America/New_York", "UTC")
    required: false,
  },
  apiUrl: {
    type: String, // The API URL that was called
    required: false,
  },
  sessionId: {
    type: String, // Session ID used for the API call
    required: false,
  },
  cronWindow: {
    type: String, // e.g., "06:00 - 09:00"
    required: false,
  },
  skipReason: {
    type: String, // Why agent was skipped
    required: false,
  },
  message: {
    type: String,
    required: false,
  },
  totalAgentsChecked: {
    type: Number,
    required: false,
  },
  totalAgentsTriggered: {
    type: Number,
    required: false,
  },
  totalAgentsSkipped: {
    type: Number,
    required: false,
  },
  executedAt: {
    type: Date,
    default: Date.now,
  },
  cronExecutionTime: {
    type: String, // When the cron job ran (e.g., "2026-01-28 06:00:00")
    required: false,
  },
  cronExecutionHour: {
    type: Number, // The hour when cron ran (0-23)
    required: false,
  },
  agentScheduledHour: {
    type: Number, // The hour the agent is scheduled for (0-23, parsed from scheduleTime)
    required: false,
  },
  windowCheckResult: {
    type: String, // Result of window check (e.g., "IN_WINDOW", "OUT_OF_WINDOW")
    required: false,
  },
});

module.exports = mongoose.model('AgentCronLog', AgentCronLogSchema);
