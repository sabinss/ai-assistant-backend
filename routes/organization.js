const ctl = require("../controllers/orgCtrl");
const permitUser = require("../middleware/permitUser");
const authUser = require("../middleware/authUser")["authenticate"];
const checkPermissions = require("../middleware/rolePermit");
const permissonCheck = checkPermissions("organization")

module.exports = (app) => {
  app.get(`${process.env.APP_URL}/organization/`, authUser, permissonCheck, ctl.getOrg);
  app.patch(`${process.env.APP_URL}/organization`, authUser, permissonCheck, ctl.editOrg);
  app.post(`${process.env.APP_URL}/organization`, authUser, permissonCheck, ctl.create);
  app.get(`${process.env.APP_URL}/organization/greeting_botname`, ctl.getGreeting_botName);
  app.post(
    `${process.env.APP_URL}/organization/user`,
    authUser,
    permitUser,
    ctl.createUser
  );

  app.post(
    `${process.env.APP_URL}/organization/users`,
    authUser,
    permitUser,
    ctl.findUsers
  );
  app.patch(
    `${process.env.APP_URL}/organization/user/:user_id`,
    authUser,
    permitUser,
    ctl.editUser
  );
  app.delete(
    `${process.env.APP_URL}/organization/user/:user_id`,
    authUser,
    permitUser,
    ctl.deleteUser
  );
};
