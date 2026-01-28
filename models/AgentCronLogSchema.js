// models/AgentCronLog.js
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
  status: {
    type: String,
    enum: ['success', 'failure', 'triggered'],
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
  cronExecutionTime: {
    type: String, // The actual time when cron ran (e.g., "06:00", "09:00")
    required: false,
  },
  agentScheduledHour: {
    type: Number, // The parsed hour from scheduleTime (e.g., 4 for "4:00", 9 for "09:00")
    required: false,
  },
  windowCheckResult: {
    type: Boolean, // Whether the agent's scheduled hour was in the cron window
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
});

module.exports = mongoose.model('AgentCronLog', AgentCronLogSchema);
