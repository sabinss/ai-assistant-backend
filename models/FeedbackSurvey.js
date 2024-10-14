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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('FeedbackSurvey', feedbackSurvey);
