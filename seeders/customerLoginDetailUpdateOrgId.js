const mongoose = require("mongoose");
const CustomerFeature = require("../models/CustomerFeature");

async function updateOrganizationForAll() {
  // Find all documents
  const customerFeatures = await CustomerFeature.find();

  // Loop through each document and update the organization
  for (const feature of customerFeatures) {
    await CustomerFeature.findByIdAndUpdate(
      feature._id, // Find by document ID
      { $set: { organization: "66158fe71bfe10b58cb23eea" } }, // Set organization field
      { new: true } // Optional: returns the updated document
    );
  }

  console.log("Organization field updated for all records.");
}

// Call the function
module.exports = updateOrganizationForAll;
