const ctl = require('../controllers/activityLogCtrl');
const authUser = require('../middleware/authUser')['authenticate'];

module.exports = (app) => {
  // Store activity log from Python server (no auth required for external calls)
  app.post(
    `${process.env.APP_URL}/activity-log`,
    authUser,
    ctl.storeActivityLog
  );

  // Get all activity logs with filters (requires authentication)
  app.get(`${process.env.APP_URL}/activity-log`, authUser, ctl.getActivityLogs);
};
