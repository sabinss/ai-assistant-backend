const mongoose = require('mongoose');
const Organization = require('../models/Organization');
let obj = {};
async function updateOrgGoogleCredentialForAll() {
    try {
        const organizations = await Organization.find();

        for (const org of organizations) {
            org.orgGoogleCredential = obj; // only updating this field
            await org.save(); // saves the updated document
        }

        console.log(`Updated ${organizations.length} organizations.`);
    } catch (err) {
        console.error('Error updating organizations:', err);
    }
}
module.exports = updateOrgGoogleCredentialForAll;
