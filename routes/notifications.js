const ctl = require("../controllers/notifications");
const authUser = require("../middleware/authUser")["authenticate"];

module.exports = (app) => {
  app.post(`/api/v1/notification`, ctl.createNotification);
  app.get(
    `/api/v1/notification`,
    authUser,
    ctl.getAllNotifications
  );
};
