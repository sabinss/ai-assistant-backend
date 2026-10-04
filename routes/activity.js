const ctl = require("../controllers/activityCtrl");
const authUser = require("../middleware/authUser")["authenticate"];

module.exports = (app) => {
  app.get(`${process.env.APP_URL}/activity/company`, authUser, ctl.getActivityCompanies);
  app.get(`${process.env.APP_URL}/activity/company/:inside`, authUser, ctl.getActivityCompanyById);
};
