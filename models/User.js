const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
    },
    first_name: {type: String, default: null},
    last_name: {type: String, default: null},
    email: {type: String, default: null, unique: true},
    // googleEmail: {type: String},
    password: {type: String, required: true, default: null},
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
    isGoogleUser: {type: Boolean, default: false}, // Field to indicate Google login
    googleId: {type: String, default: null}, // Store Google account ID
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
