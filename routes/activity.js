const ctl = require("../controllers/activityCtrl");
const authUser = require("../middleware/authUser")["authenticate"];

module.exports = (app) => {
  app.get(`${process.env.APP_URL}/activity/company`, authUser, ctl.getActivityCompanies);
  app.post(
    `${process.env.APP_URL}/activity/company/archive`,
    authUser,
    ctl.updateCompanyArchive
  );
  app.post(`${process.env.APP_URL}/activity/call/sms`, authUser, ctl.triggerSendSmsAgent);
  app.get(`${process.env.APP_URL}/activity/company/:inside`, authUser, ctl.getActivityCompanyById);
  app.get(`${process.env.APP_URL}/activity/email`, authUser, ctl.getActivityEmails);
  app.get(`${process.env.APP_URL}/activity/email/:inside`, authUser, ctl.getActivityEmailById);
};
