const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  text: { type: String, required: true },
});

module.exports = mongoose.model('PromptSchema', promptSchema);
