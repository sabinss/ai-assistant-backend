/**
 * Seed one OrganizationDetail record:
 *   subscriptionPlan: Free
 *   industry: Dental Clinic
 *
 * Usage:
 *   node seeders/seedOrganizationDetail.js <organizationId>
 *   ORG_ID=<organizationId> node seeders/seedOrganizationDetail.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const db = require("../helper/db");
const Organization = require("../models/Organization");
const OrganizationDetail = require("../models/OrganizationDetail");

const SUBSCRIPTION_PLAN = "Free";
const INDUSTRY = "Dental Clinic";

async function seedOrganizationDetail() {
  const orgId = "6a25ff0de327bc35c7697231";

  if (!orgId) {
    console.error("Organization id is required.");
    console.error("Usage: node seeders/seedOrganizationDetail.js <organizationId>");
    process.exit(1);
  }

  if (!mongoose.Types.ObjectId.isValid(orgId)) {
    console.error(`Invalid organization id: ${orgId}`);
    process.exit(1);
  }

  const connected = await db.connect();
  if (!connected) {
    process.exit(1);
  }

  try {
    const org = await Organization.findById(orgId);
    if (!org) {
      console.error(`Organization not found: ${orgId}`);
      process.exit(1);
    }

    const detail = await OrganizationDetail.findOneAndUpdate(
      { organization: orgId },
      {
        $set: {
          subscriptionPlan: SUBSCRIPTION_PLAN,
          industry: INDUSTRY,
        },
        $setOnInsert: {
          organization: orgId,
          organizationDetail: "",
          website: "",
        },
      },
      { upsert: true, new: true }
    );

    if (org.organizationDetail?.toString() !== detail._id.toString()) {
      await Organization.findByIdAndUpdate(orgId, {
        organizationDetail: detail._id,
      });
    }

    console.log("OrganizationDetail upserted successfully:");
    console.log({
      _id: detail._id.toString(),
      organization: detail.organization.toString(),
      subscriptionPlan: detail.subscriptionPlan,
      industry: detail.industry,
    });
  } catch (error) {
    console.error("Error seeding OrganizationDetail:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedOrganizationDetail();
