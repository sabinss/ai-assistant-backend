const User = require('../models/User');

const updateUserRole = async () => {
  try {
    const userId = '68a4a47efc4f54cacb902baf'; // Assuming this is a valid ObjectId, otherwise, update it accordingly
    const roleId = '68a4a5325c740184cb3f29a5'; // Assuming this is a valid ObjectId

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
