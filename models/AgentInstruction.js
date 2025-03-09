const mongoose = require('mongoose');

const agentInstructionSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent', // Reference to the Organization model
      required: true,
    },
    name: { type: String, required: true },
    tools: { type: String, required: true }, // Array of tool names
    instruction: { type: String, required: true },
  },
  { timestamps: true }
);

const AgentInstruction = mongoose.model(
  'AgentInstruction',
  agentInstructionSchema
);

module.exports = AgentInstruction;
