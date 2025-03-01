const ctl = require('../controllers/orgCtrl');
const permitUser = require('../middleware/permitUser');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const checkSessionApiKey = require('../middleware/sessionapi');
const verifySameOrganization = require('../middleware/verifySameOrganization');
const permissonCheck = checkPermissions('organization');

module.exports = (app) => {
  app.get(`${process.env.APP_URL}/customers/`, ctl.getCustomerDetail);
  app.get(
    `${process.env.APP_URL}/organization/`,
    authUser,
    permissonCheck,
    ctl.getOrg
  );

  app.get(
    `${process.env.APP_URL}/organization/google-users`,
    verifySameOrganization,
    ctl.getConnectedGmailsWithOrg
  );

  app.get(
    `${process.env.APP_URL}/organization/:org_id/customers`,
    authUser,
    permissonCheck,
    ctl.getCustomerList
  );

  app.get(
    `${process.env.APP_URL}/organization/:org_id/task_agent`,
    authUser,
    permissonCheck,
    ctl.getOrgTaskAgents
  );

  app.get(
    `${process.env.APP_URL}/organization/:org_id/task_agent/public`,
    checkSessionApiKey,
    ctl.getOrgTaskAgents
  );

  app.post(
    `${process.env.APP_URL}/organization/:org_id/task_agent`,
    authUser,
    permissonCheck,
    ctl.createOrgTaskAgents
  );

  app.put(
    `${process.env.APP_URL}/organization/:org_id/task_agent/:taskAgentId`,
    authUser,
    permissonCheck,
    ctl.updateOrgTaskAgents
  );

  app.patch(
    `${process.env.APP_URL}/organization`,
    authUser,
    permissonCheck,
    ctl.editOrg
  );
  app.post(
    `${process.env.APP_URL}/organization`,
    authUser,
    permissonCheck,
    ctl.create
  );
  app.patch(
    `${process.env.APP_URL}/organization/support-workflow`,
    authUser,
    permissonCheck,
    ctl.saveOrgSupportWorkflow
  );
  app.get(
    `${process.env.APP_URL}/organization/greeting_botname`,
    ctl.getGreeting_botName
  );
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
