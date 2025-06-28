const ctl = require('../controllers/orgCtrl');
const verifyGoogleAuthUser = require('../middleware/google-auth-verify');
const permitUser = require('../middleware/permitUser');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const checkSessionApiKey = require('../middleware/sessionapi');
const verifySameOrganization = require('../middleware/verifySameOrganization');
const permissonCheck = checkPermissions('organization');
const multer = require('multer');
const path = require('path');
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  limits: {
    fileSize: 20 * 1024 * 1024, // 5 MB in bytes
  },
}); // ensure folder exists
const uploadMiddleware = upload.array('files');

module.exports = (app) => {
  app.delete(
    `${process.env.APP_URL}/organization/source`,
    authUser,
    ctl.deleteSourceFile
  ),
    app.post(
      `${process.env.APP_URL}/organization/source/upload-pdf`,
      authUser,
      (req, res, next) => {
        uploadMiddleware(req, res, (err) => {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res
                .status(400)
                .json({ error: 'File too large. Max size is 2MB.' });
            }
            return res.status(400).json({ error: err.message });
          } else if (err) {
            return res.status(500).json({ error: 'File upload failed.' });
          }
          next(); // proceed to controller if no errors
        });
      },
      ctl.uploadOrganizationSourceUpload
    );
  app.get(
    `${process.env.APP_URL}/organization/source/file/list`,
    authUser,
    ctl.fetchSourceFileList
  );
  app.get(`${process.env.APP_URL}/customers/`, ctl.getCustomerDetail);
  app.get(
    `${process.env.APP_URL}/organization/`,
    authUser,
    permissonCheck,
    ctl.getOrg
  );

  app.get(
    `${process.env.APP_URL}/organization/google-users`,
    // verifySameOrganization,
    verifyGoogleAuthUser,
    ctl.getConnectedGmailsWithOrg
  );

  app.post(
    `${process.env.APP_URL}/organization/prompts`,
    authUser,
    ctl.createOrganizationPrompt
  );
  app.get(
    `${process.env.APP_URL}/organization/prompts`,
    authUser,
    ctl.getOrganizationPrompt
  );
  app.post(
    `${process.env.APP_URL}/organization/prompts/category`,
    authUser,
    ctl.updateOrganizationPromptCategory
  );

  app.post(
    `${process.env.APP_URL}/organization/task-agent/trigger`,
    authUser,
    ctl.callTaskAgentPythonApi
  );

  app.post(
    `${process.env.APP_URL}/organization/agent`,
    authUser,
    ctl.createOrgAgentInstructions
  );

  app.post(
    `${process.env.APP_URL}/organization/agent/:agentId/task/:taskId/status`,
    authUser,
    ctl.storeAgentTaskExecuteStatus
  );

  app.get(
    `${process.env.APP_URL}/organization/agent/:agentId/task/:taskId/status`,
    authUser,
    ctl.getAgentTaskStatus
  );

  app.put(
    `${process.env.APP_URL}/organization/agent`,
    authUser,
    ctl.updateOrgAgentInstructions
  );
  app.get(
    `${process.env.APP_URL}/organization/agent/instruction`,
    authUser,
    ctl.getOrgAgentInstructions
  );

  app.delete(
    `${process.env.APP_URL}/organization/agent/:id/instruction`,
    authUser,
    ctl.deleteAgentInstruction
  );

  app.get(
    `${process.env.APP_URL}/organization/agent`,
    verifySameOrganization,
    // ctl.getOrganizationAgentSetup
    ctl.getOrgAgentInstructions
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
