const mongoose = require('mongoose');

const feedbackSurvey = new mongoose.Schema(
  {
    query: {type: String},
    rating: {type: Number, default: null},
    feedback: {type: String},
    user_email: {type: String},
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FeedbackSurvey', feedbackSurvey);
