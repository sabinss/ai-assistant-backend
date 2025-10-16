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
    schedule_time: {
      type: String,
    },
    time_zone: {
      type: String,
      default: 'EST',
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
