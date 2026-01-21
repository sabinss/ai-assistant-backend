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
});

module.exports = mongoose.model('AgentCronLog', AgentCronLogSchema);
