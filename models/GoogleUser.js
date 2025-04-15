const mongoose = require('mongoose');

const googleUserSchema = new mongoose.Schema(
  {
    email: { type: String, default: null, unique: true },
    isGoogleUser: { type: Boolean, default: false }, // Field to indicate Google login
    googleId: { type: String, default: null }, // Store Google account ID
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    emailCredential: { type: Object, default: {} },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GoogleUser', googleUserSchema);
