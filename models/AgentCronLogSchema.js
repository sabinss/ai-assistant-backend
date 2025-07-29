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
  message: { type: String, required: false }, // error message or success note
  executedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AgentCronLog', AgentCronLogSchema);
