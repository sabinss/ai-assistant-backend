const mongoose = require('mongoose');
const User = require('../models/User');
const db = require('../helper/db');

async function updateUsersIsVerified() {
  try {
    // Connect to database

    // Update all users to set isVerified to true
    const result = await User.updateMany(
      {}, // Find users where isVerified is false
      { $set: { isVerified: true } } // Set isVerified to true
    );

    console.log(
      `Successfully updated ${result.modifiedCount} users to isVerified: true`
    );
    console.log(`Total users matched: ${result.matchedCount}`);

    return result;
  } catch (error) {
    console.error('Error updating users:', error);
    throw error;
  }
}

module.exports = updateUsersIsVerified;
