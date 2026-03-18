const mongoose = require("mongoose");

const organizationDetailSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      unique: true,
    },
    organizationDetail: {
      type: String,
      default: "",
    },
    website: {
      type: String,
      default: "",
    },
    subscriptionPlan: {
      type: String,
    },
    industry: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("OrganizationDetail", organizationDetailSchema);
