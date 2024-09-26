const ctl = require('../controllers/conversationCtrl');
const publicChat = require('../middleware/publicChat');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const permissonCheck = checkPermissions('chat');
module.exports = (app) => {
  app.get(
    `${process.env.APP_URL}/conversations/whole_organization`,
    authUser,
    ctl.getWholeOrgConvo
  );
  app.get(
    `${process.env.APP_URL}/conversations/public/`,
    publicChat,
    ctl.getPublicConversationByUserId
  );
  app.post(
    `${process.env.APP_URL}/conversation/public/add`,
    publicChat,
    ctl.addPublicConversation
  );
  app.post(
    `${process.env.APP_URL}/conversation/public/update_like_dislike`,
    publicChat,
    ctl.updatePublicLikeDislike
  );
  // app.post(`${process.env.APP_URL}/conversation/add`, authUser, permissonCheck, ctl.addConversation);
  app.post(
    `${process.env.APP_URL}/conversation/add`,
    authUser,
    ctl.addConversation
  );
  app.post(
    `${process.env.APP_URL}/conversation/update_like_dislike`,
    authUser,
    permissonCheck,
    ctl.updateLikeDislike
  );
  app.get(
    `${process.env.APP_URL}/conversations`,
    authUser,
    permissonCheck,
    ctl.getConversationByUserId
  );
  app.get(
    `${process.env.APP_URL}/conversations/count`,
    authUser,
    permissonCheck,
    ctl.totalConversations
  );
  app.delete(
    `${process.env.APP_URL}/conversation/:conversation_id`,
    authUser,
    permissonCheck,
    ctl.deleteConversation
  );
};
