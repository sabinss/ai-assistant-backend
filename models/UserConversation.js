//two documents user and conversations
const mongoose = require('mongoose');
const UserConversation = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    chatSession: {
      type: String,
      required: true,
    },
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
    liked_disliked: {
      type: String,
      eum: ['liked', 'disliked'],
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
    },
    session_id: {
      type: String,
      required: false,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
    agentName: { type: String },
  },
  {
    timestamps: true,
  }
);
module.exports = mongoose.model('UserConversation', UserConversation);
