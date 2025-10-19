const NotificationModel = require('../models/notification');

exports.createNotification = async (req, res) => {
  try {
    const {
      emailFrom,
      emailTo,
      action = null,
      subject = null,
      url = null,
      organization,
      customer,
      event = null,
    } = req.body;
    const missingFields = [];
    if (!emailFrom) missingFields.push('emailFrom');
    if (!emailTo) missingFields.push('emailTo');
    if (!organization) missingFields.push('organization');
    if (!customer) missingFields.push('customer');

    if (missingFields.length > 0) {
      return res.status(400).json({
        message: `The following fields are missing: ${missingFields.join(
          ', '
        )}`,
      });
    }

    // Save to DB
    const notification = new NotificationModel({
      emailFrom,
      emailTo,
      action: action ?? null,
      subject: subject ?? null,
      url: url ?? null,
      organization,
      customer,
      event,
    });

    await notification.save();
    res
      .status(201)
      .json({ message: 'Notification saved successfully', notification });
  } catch (err) {
    res
      .status(500)
      .json({ error: err?.message ?? 'Failed to save notificaton' });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    let filter = {};
    const { organization, email } = req.user;
    if (organization) {
      filter.organization = organization;
    }
    if (email) {
      filter.emailFrom = email;
    }
    const notifications = await NotificationModel.find(filter);
    res.status(200).json(notifications);
  } catch (err) {
    res
      .status(500)
      .json({ error: err?.message ?? 'Failed to fetch notificaton' });
  }
};
