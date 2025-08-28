const ctl = require('../controllers/userCtrl');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const permissonCheck = checkPermissions('users');
const verifySameOrganization = require('../middleware/verifySameOrganization');
module.exports = (app) => {
  app.get(
    `/api/v1/user/profile/changeSession`,
    authUser,
    ctl.changeSession
  );
  app.get(`/api/v1/user/profile`, authUser, ctl.getProfile);
  app.patch(
    `/api/v1/user/profile/update/`,
    authUser,
    ctl.updateProfile
  );
  app.post(
    `/api/v1/user/add`,
    authUser,
    permissonCheck,
    ctl.addUser
  );
  app.get(
    `/api/v1/users`,
    verifySameOrganization,
    authUser,
    permissonCheck,
    ctl.getUsers
  );
  app.get(
    `/api/v1/user/:user_id`,
    authUser,
    permissonCheck,
    ctl.getUser
  );
  app.patch(
    `/api/v1/user/:user_id`,
    authUser,
    permissonCheck,
    ctl.update
  );
  app.delete(
    `/api/v1/user/:user_id`,
    authUser,
    permissonCheck,
    ctl.deleteUser
  );
};
