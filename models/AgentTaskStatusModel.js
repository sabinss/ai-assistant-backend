const mongoose = require('mongoose');

const agentTaskStatusModel = new mongoose.Schema(
  {
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent', // Reference to the Organization model
      required: true,
    },
    agentTask: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'AgentTask',
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Organization',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'Customer',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Done'],
      default: 'Open',
    },
  },
  { timestamps: true }
);

const AgentTaskStatusModel = mongoose.model(
  'AgentTaskStatus',
  agentTaskStatusModel
);

module.exports = AgentTaskStatusModel;
