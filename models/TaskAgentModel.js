const mongoose = require('mongoose');

const taskAgentModel = new mongoose.Schema(
  {
    name: {type: String, default: null},
    action: {
      type: String,
      enum: ['Draft Email', 'Send Chat Msg', 'Create Task', 'Notify'],
    },
    objective: {type: String, default: null},
    who: {type: String},
    trigger: {type: String},
    output: {type: String},
    tools: {
      type: String,
    },
    active: {type: Boolean, default: true},
    frequency: {
      type: String,
      enum: ['Daily', 'Weekly', 'Monthly', 'Quarterly'], // Allowed values
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TaskAgent', taskAgentModel);
