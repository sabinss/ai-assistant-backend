const ctl = require('../controllers/userCtrl');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const permissonCheck = checkPermissions('users');
module.exports = (app) => {
  app.get(
    `${process.env.APP_URL}/user/profile/changeSession`,
    authUser,
    ctl.changeSession
  );
  app.get(`${process.env.APP_URL}/user/profile/`, authUser, ctl.getProfile);
  app.patch(
    `${process.env.APP_URL}/user/profile/update/`,
    authUser,
    ctl.updateProfile
  );
  app.post(
    `${process.env.APP_URL}/user/add`,
    authUser,
    permissonCheck,
    ctl.addUser
  );
  app.get(
    `${process.env.APP_URL}/users`,
    authUser,
    permissonCheck,
    ctl.getUsers
  );
  app.get(
    `${process.env.APP_URL}/user/:user_id`,
    authUser,
    permissonCheck,
    ctl.getUser
  );
  app.patch(
    `${process.env.APP_URL}/user/:user_id`,
    authUser,
    permissonCheck,
    ctl.update
  );
  app.delete(
    `${process.env.APP_URL}/user/:user_id`,
    authUser,
    permissonCheck,
    ctl.deleteUser
  );
};
