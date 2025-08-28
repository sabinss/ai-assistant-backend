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
        fileSize: 40 * 1024 * 1024 // 40 MB in bytes
    }
}); // ensure folder exists
const uploadMiddleware = upload.array('files');

module.exports = app => {
    app.delete(`/api/v1/organization/source`, authUser, ctl.deleteSourceFile),
        app.post(
            `/api/v1/organization/source/upload-pdf`,
            authUser,
            (req, res, next) => {
                uploadMiddleware(req, res, err => {
                    console.log('Rag file upload error', err);
                    if (err instanceof multer.MulterError) {
                        if (err.code === 'LIMIT_FILE_SIZE') {
                            return res.status(400).json({ error: 'File too large. Max size is 40mMB.' });
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
    app.get(`/api/v1/organization/source/file/list`, authUser, ctl.fetchSourceFileList);
    app.get(`/api/v1/customers/`, ctl.getCustomerDetail);
    app.get(`/api/v1/organization/`, authUser, permissonCheck, ctl.getOrg);

    app.get(
        `/api/v1/organization/google-users`,
        // verifySameOrganization,
        verifyGoogleAuthUser,
        ctl.getConnectedGmailsWithOrg
    );

    app.post(`/api/v1/organization/prompts`, authUser, ctl.createOrganizationPrompt);
    app.get(`/api/v1/organization/prompts`, authUser, ctl.getOrganizationPrompt);
    app.post(`/api/v1/organization/prompts/category`, authUser, ctl.updateOrganizationPromptCategory);

    app.post(`/api/v1/organization/task-agent/trigger`, authUser, ctl.callTaskAgentPythonApi);

    app.post(`/api/v1/organization/agent`, authUser, ctl.createOrgAgentInstructions);

    app.post(
        `/api/v1/organization/agent/:agentId/task/:taskId/status`,
        authUser,
        ctl.storeAgentTaskExecuteStatus
    );

    app.get(`/api/v1/organization/agent/:agentId/task/:taskId/status`, authUser, ctl.getAgentTaskStatus);

    app.put(`/api/v1/organization/agent`, authUser, ctl.updateOrgAgentInstructions);
    app.get(`/api/v1/organization/agent/instruction`, authUser, ctl.getOrgAgentInstructions);

    app.delete(`/api/v1/organization/agent/:id/instruction`, authUser, ctl.deleteAgentInstruction);

    app.get(
        `/api/v1/organization/agent`,
        verifySameOrganization,
        // ctl.getOrganizationAgentSetup
        ctl.getOrgAgentInstructions
    );

    app.get(`/api/v1/organization/:org_id/customers`, authUser, permissonCheck, ctl.getCustomerList);

    app.get(`/api/v1/organization/:org_id/task_agent`, authUser, permissonCheck, ctl.getOrgTaskAgents);

    app.get(`/api/v1/organization/:org_id/task_agent/public`, checkSessionApiKey, ctl.getOrgTaskAgents);

    app.post(
        `/api/v1/organization/:org_id/task_agent`,
        authUser,
        permissonCheck,
        ctl.createOrgTaskAgents
    );

    app.put(
        `/api/v1/organization/:org_id/task_agent/:taskAgentId`,
        authUser,
        permissonCheck,
        ctl.updateOrgTaskAgents
    );

    app.patch(`/api/v1/organization`, authUser, permissonCheck, ctl.editOrg);
    app.post(`/api/v1/organization`, authUser, permissonCheck, ctl.create);
    app.patch(
        `/api/v1/organization/support-workflow`,
        authUser,
        permissonCheck,
        ctl.saveOrgSupportWorkflow
    );
    app.get(`/api/v1/organization/greeting_botname`, ctl.getGreeting_botName);
    app.post(`/api/v1/organization/user`, authUser, permitUser, ctl.createUser);

    app.post(`/api/v1/organization/users`, authUser, permitUser, ctl.findUsers);
    app.patch(`/api/v1/organization/user/:user_id`, authUser, permitUser, ctl.editUser);
    app.delete(`/api/v1/organization/user/:user_id`, authUser, permitUser, ctl.deleteUser);
};
