const mongoose = require("mongoose");

const outlookUserSchema = new mongoose.Schema(
  {
    email: { type: String, default: null, unique: true },
    isOutlookUser: { type: Boolean, default: false },
    microsoftId: { type: String, default: null },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    emailCredential: { type: Object, default: {} },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OutlookUser", outlookUserSchema);
