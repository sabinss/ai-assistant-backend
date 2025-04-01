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
    scope: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('GoogleUser', googleUserSchema);
