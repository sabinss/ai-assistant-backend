const ctl = require('../controllers/notifications');

module.exports = (app) => {
  app.post(`${process.env.APP_URL}/notification`, ctl.createNotification);
  app.get(`${process.env.APP_URL}/notification`, ctl.getAllNotifications);
};
