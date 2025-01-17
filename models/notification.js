const mongoose = require('mongoose');

// Define the Notification schema
const notificationSchema = new mongoose.Schema(
  {
    emailFrom: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\S+@\S+\.\S+$/.test(v); // Basic email validation regex
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    emailTo: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\S+@\S+\.\S+$/.test(v); // Basic email validation regex
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    action: {
      type: String,
    },
    event: {
      type: String,
    },
    subject: {
      type: String,
    },
    url: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now, // Automatically sets the current date and time
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  }
);

// Create the Notification model
const NotificationModel = mongoose.model('Notification', notificationSchema);

module.exports = NotificationModel;
