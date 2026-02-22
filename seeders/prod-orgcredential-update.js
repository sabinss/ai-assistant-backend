const mongoose = require("mongoose");
const Organization = require("../models/Organization");
let obj = {
  client_id: process.env.GOOGLE_CLIENT_ID,
  client_secret: process.env.GOOGLE_CLIENT_SECRET,
  redirect_uris: [process.env.GOOGLE_REDIRECT_URL],
  project_id: "cowrkr-prod",
  auth_uri: "https://accounts.google.com/o/oauth2/v2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
};
async function updateOrgGoogleCredentialForAll() {
  try {
    const organizations = await Organization.find();

    for (const org of organizations) {
      org.orgGoogleCredential = obj; // only updating this field
      await org.save(); // saves the updated document
    }

    console.log(`Updated ${organizations.length} organizations.`);
  } catch (err) {
    console.error("Error updating organizations:", err);
  }
}
module.exports = updateOrgGoogleCredentialForAll;
