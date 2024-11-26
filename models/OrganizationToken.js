const mongoose = require('mongoose');

const orgnizationToken = new mongoose.Schema(
  {
    token: {type: String, required: true},
    email: {type: String, required: true},
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('OrganizationToken', orgnizationToken);
