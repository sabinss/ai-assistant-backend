const mongoose = require('mongoose');

const agentModel = new mongoose.Schema(
  {
    name: { type: String, default: null },
    objective: { type: String, default: null },
    routing_instruction: { type: String },
    greeting: { type: String },
    routing_examples: { type: String },
    tools_used: {
      type: String,
    },
    primary_instruction: {
      type: String,
    },
    isAgent: {
      type: Boolean,
      default: false,
    },
    frequency: {
      type: String,
    },
    dayTime: {
      type: String,
    },
    scheduleTime: {
      type: String,
      default: null, // Time string "HH:mm" for Weekly/Monthly schedules (e.g., "09:00", "14:30")
    },
    timezone: {
      type: String,
      default: 'UTC', // e.g., "America/New_York", "Asia/Kolkata", "Europe/London"
    },
    lastTriggeredAt: {
      type: Date,
      default: null, // Track last execution to prevent duplicates
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    active: {
      type: Boolean,
    },
    agentInstructions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AgentTask', // Reference to AgentTask
      },
    ],
    batch_process_enabled: {
      type: Boolean,
      default: false,
    },
    batch_scope: {
      type: String,
      default: null,
    },
    batch_size: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Agent', agentModel);
