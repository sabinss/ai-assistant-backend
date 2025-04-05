const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    email: { type: String, default: null, unique: true },
    password: { type: String, required: true },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
    },
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Status',
      default: null,
    },
    chatSession: {
      type: String,
      default: '001',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
