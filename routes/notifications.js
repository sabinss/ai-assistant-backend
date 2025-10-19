const ctl = require('../controllers/notifications');
const authUser = require('../middleware/authUser')['authenticate'];

module.exports = (app) => {
  app.post(`${process.env.APP_URL}/notification`, ctl.createNotification);
  app.get(
    `${process.env.APP_URL}/notification`,
    authUser,
    ctl.getAllNotifications
  );
};
