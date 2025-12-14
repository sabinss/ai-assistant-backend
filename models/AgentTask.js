const mongoose = require("mongoose");

const agentTaskSchema = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent", // Reference to the Organization model
      required: true,
    },
    name: { type: String, default: null },
    tools: { type: String, default: null }, // Array of tool names
    instruction: { type: String, default: null },
  },
  { timestamps: true }
);

const AgentTask = mongoose.model("AgentTask", agentTaskSchema);

module.exports = AgentTask;
