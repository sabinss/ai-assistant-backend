const ctl = require('../controllers/activityLogCtrl');
const authUser = require('../middleware/authUser')['authenticate'];

module.exports = (app) => {
  // Store activity log from Python server (no auth required for external calls)
  app.post(
    `/api/v1/activity-log`,
    authUser,
    ctl.storeActivityLog
  );

  // Get all activity logs with filters (requires authentication)
  app.get(`/api/v1/activity-log`, authUser, ctl.getActivityLogs);
};
