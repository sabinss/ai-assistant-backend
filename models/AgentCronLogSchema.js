// models/AgentCronLog.js
const mongoose = require('mongoose');

const AgentCronLogSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
    required: true,
  },
  status: { type: String, enum: ['success', 'failure'], required: true },
  message: { type: String }, // error message or success note
  executedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AgentCronLog', AgentCronLogSchema);
