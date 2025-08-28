const ctl = require('../controllers/conversationCtrl');
const publicChat = require('../middleware/publicChat');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const verifySameOrganization = require('../middleware/verifySameOrganization');
const permissonCheck = checkPermissions('chat');

module.exports = app => {
    app.get(`/api/v1/conversations/whole_organization`, authUser, ctl.getWholeOrgConvo);

    app.get(
        `/api/v1/conversations/public/`,
        verifySameOrganization,
        publicChat,
        ctl.getPublicConversationByUserId
    );

    app.post(`/api/v1/conversation/add`, authUser, ctl.addConversation);

    app.post(
        `/api/v1/conversation/public/add`,
        verifySameOrganization,
        publicChat,
        ctl.addPublicConversation
    );

    app.post(`/api/v1/conversation/agent/add`, authUser, ctl.addCustomAgentConversation);
    app.post(`/api/v1/conversation/public/update_like_dislike`, publicChat, ctl.updatePublicLikeDislike);

    app.post(
        `/api/v1/conversation/update_like_dislike`,
        authUser,
        permissonCheck,
        ctl.updateLikeDislike
    );

    app.get(
        `/api/v1/conversations`,
        verifySameOrganization,
        authUser,
        permissonCheck,
        ctl.getConversationByUserId
    );

    app.get(
        `/api/v1/conversations/customer`,
        (req, res, next) => {
            if (req.query.token) {
                const tokerParts = req.query.token.split('_');
                console.log('tokerParts', tokerParts);
                if (tokerParts.length > 0) {
                    next();
                } else {
                    return res.status(403).json({ message: 'Authentication failed' });
                }
            } else {
                return res.status(403).json({ message: 'Authentication failed' });
            }
        },
        ctl.getConversationByCustomerId
    );

    app.get(`/api/v1/conversations/count`, authUser, permissonCheck, ctl.totalConversations);

    app.delete(
        `/api/v1/conversation/:conversation_id`,
        authUser,
        permissonCheck,
        ctl.deleteConversation
    );
};
