const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    log_id: {
      type: String,
      required: false,
      unique: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    agent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: false,
    },
    agent_name: {
      type: String,
      required: true,
    },
    start_time: {
      type: Date,
      required: true,
    },
    end_time: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['Pass', 'Fail'],
      required: true,
    },
    note: {
      type: String,
      default: null,
    },
    user_id: {
      type: String,
      required: false,
    },
    non_interaction: {
      type: String,
      enum: ['Y', 'N'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for better query performance
activityLogSchema.index({ organization: 1, agent_id: 1, start_time: -1 });
activityLogSchema.index({ log_id: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
