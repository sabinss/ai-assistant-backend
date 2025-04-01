const User = require('../models/User');

const updateUserRole = async () => {
  try {
    const userId = '67e444ff9f9fd0f96daa9d7e'; // Assuming this is a valid ObjectId, otherwise, update it accordingly
    const roleId = '67e57a47a61ef32411df11fb'; // Assuming this is a valid ObjectId

    const updatedUser = await User.findOneAndUpdate(
      { _id: userId }, // Find user by ID
      { role: roleId }, // Update role
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      console.log('User not found');
      return;
    }

    console.log('User role updated:', updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
  }
};

module.exports = updateUserRole;
