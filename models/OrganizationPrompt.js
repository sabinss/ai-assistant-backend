const mongoose = require('mongoose');

const promptSchema = new mongoose.Schema({
  text: { type: String, required: true },
});
const organizationPrompt = new mongoose.Schema({
  category: { type: String, required: true },
  prompts: [promptSchema],
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
  },
});

module.exports = mongoose.model('OrganizationPrompt', organizationPrompt);
