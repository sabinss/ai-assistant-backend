const mongoose = require("mongoose");

const orgSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    greeting: { type: String, require: true, default: "Hello, I'm an AI Assistant, your virtual Support Agent. My purpose is to assist you with any inquiries. Whether you need a concise summary, detailed information, or step-by-step instructions, just let me know in your queries." },
    assistant_name: { type: String, default: "" },
    temperature: { type: Number, default: "0.1" },
    model: { type: String, default: "gpt-3.5-turbo" },
    api: { type: String, default: "" },
    prompt: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Organization", orgSchema);
