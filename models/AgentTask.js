const mongoose = require('mongoose');

const agentTaskSchema = new mongoose.Schema(
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

const AgentTask = mongoose.model('AgentTask', agentTaskSchema);

module.exports = AgentTask;
