const NotificationModel = require("../models/notification");
const mongoose = require("mongoose");

const { ObjectId } = mongoose.Types;

let initialEmails = [
  {
    _id: 1,
    event: "new_lead",
    action: "outreach",
    emailTo: "team@project.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Weekly Project Update",
    datetime: new Date("2024-03-20T09:00:00"),
    status: "open",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 2,
    event: "follow_up",
    action: "email",
    emailTo: "client@example.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Follow-Up on Proposal",
    datetime: new Date("2024-03-21T10:00:00"),
    status: "open",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 3,
    event: "feedback_request",
    action: "survey",
    emailTo: "feedback@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Customer Feedback Request",
    datetime: new Date("2024-03-22T11:30:00"),
    status: "done",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 4,
    event: "payment_reminder",
    action: "reminder",
    emailTo: "billing@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Payment Due Reminder",
    datetime: new Date("2024-03-23T15:00:00"),
    status: "pending",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 5,
    event: "webinar_invite",
    action: "invite",
    emailTo: "attendees@event.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Exclusive Webinar Invitation",
    datetime: new Date("2024-03-24T14:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 6,
    event: "contract_signed",
    action: "confirmation",
    emailTo: "legal@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Contract Signed Confirmation",
    datetime: new Date("2024-03-25T09:30:00"),
    status: "done",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 7,
    event: "promotion",
    action: "announcement",
    emailTo: "customers@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Special Promotion for Loyal Customers",
    datetime: new Date("2024-03-26T12:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 8,
    event: "appointment_confirmation",
    action: "reminder",
    emailTo: "user@client.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Your Appointment Confirmation",
    datetime: new Date("2024-03-27T16:00:00"),
    status: "open",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 9,
    event: "survey_followup",
    action: "survey",
    emailTo: "user@survey.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Follow-Up: Survey Feedback",
    datetime: new Date("2024-03-28T11:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 10,
    event: "product_launch",
    action: "announcement",
    emailTo: "subscribers@newsletter.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Introducing Our Newest Product!",
    datetime: new Date("2024-03-29T08:00:00"),
    status: "pending",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 11,
    event: "support_ticket",
    action: "notification",
    emailTo: "support@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "New Support Ticket Created",
    datetime: new Date("2024-03-30T14:30:00"),
    status: "open",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 12,
    event: "invoice_sent",
    action: "billing",
    emailTo: "finance@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Invoice for Your Recent Purchase",
    datetime: new Date("2024-03-31T13:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 13,
    event: "account_activation",
    action: "email",
    emailTo: "newuser@platform.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Activate Your Account",
    datetime: new Date("2024-04-01T10:00:00"),
    status: "done",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 14,
    event: "newsletter",
    action: "announcement",
    emailTo: "subscribers@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Monthly Newsletter - April Edition",
    datetime: new Date("2024-04-02T09:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 15,
    event: "meeting_invite",
    action: "invite",
    emailTo: "team@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Team Meeting Invitation",
    datetime: new Date("2024-04-03T14:00:00"),
    status: "pending",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 16,
    event: "demo_request",
    action: "demo",
    emailTo: "client@demo.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Schedule a Demo with Us",
    datetime: new Date("2024-04-04T11:30:00"),
    status: "open",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 17,
    event: "policy_update",
    action: "notification",
    emailTo: "users@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Important Policy Update",
    datetime: new Date("2024-04-05T12:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 18,
    event: "training_invite",
    action: "invite",
    emailTo: "employees@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Mandatory Employee Training",
    datetime: new Date("2024-04-06T15:00:00"),
    status: "pending",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 19,
    event: "discount_offer",
    action: "promotion",
    emailTo: "customers@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Limited Time Discount Offer!",
    datetime: new Date("2024-04-07T09:00:00"),
    status: "sent",
    organization: "66158fe71bfe10b58cb23eea",
  },
  {
    _id: 20,
    event: "project_deadline",
    action: "reminder",
    emailTo: "team@company.com",
    emailFrom: "bhattachas@hotmail.com",
    subject: "Project Deadline Approaching",
    datetime: new Date("2024-04-08T17:00:00"),
    status: "open",
    organization: "66158fe71bfe10b58cb23eea",
  },
];

async function bulkInsertNotifications() {
  try {
    initialEmails = initialEmails.map((x) => {
      const { _id, ...a } = x;
      return {
        ...a,
        organization: new ObjectId(x.organization), // Convert string to ObjectId
      };
    });
    initialEmails = initialEmails.map((email) => {
      if (email.status !== "done" && email.status !== "open") {
        email.status = "open"; // or 'done', depending on your logic
      }
      return email;
    });
    await NotificationModel.deleteMany({});
    console.log("deleted success");
    // Insert the emails into the database
    await NotificationModel.insertMany(initialEmails);

    console.log("Bulk insert successful!");
  } catch (error) {
    console.error("Error inserting emails:", error);
  }
}

module.exports = bulkInsertNotifications;
