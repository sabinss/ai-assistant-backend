const NotificationModel = require('../models/notification');

exports.createNotification = async (req, res) => {
  try {
    const {
      emailFrom,
      emailTo,
      action = null,
      subject = null,
      url = null,
    } = req.body;

    // Validate input
    if (!emailFrom || !emailTo) {
      return res
        .status(400)
        .json({message: 'Email(From) and Email(to) are missing'});
    }

    // Save to DB
    const notification = new NotificationModel({
      emailFrom,
      emailTo,
      action: action ?? null,
      subject: subject ?? null,
      url: url ?? null,
    });

    await notification.save();
    res
      .status(201)
      .json({message: 'Notification saved successfully', notification});
  } catch (err) {
    res.status(500).json({error: err?.message ?? 'Failed to save notificaton'});
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const notificatios = await NotificationModel.find({});
    res.status(200).json({success: true, data: notificatios});
  } catch (err) {
    res
      .status(500)
      .json({error: err?.message ?? 'Failed to fetch notificaton'});
  }
};
