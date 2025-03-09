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
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    agentInstructions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AgentInstruction', // Reference to AgentInstruction
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Agent', agentModel);
