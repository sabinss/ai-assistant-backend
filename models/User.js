const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
    first_name: { type: String, default: null },
    last_name: { type: String, default: null },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Status",
    },
    chatSession: {
      type: String,
      default: "001"
    }
  },
  {
    timestamps: true,
  }
);


module.exports = mongoose.model("User", userSchema);
