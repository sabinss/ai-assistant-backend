const ctl = require("../controllers/conversationCtrl");
const publicChat = require("../middleware/publicChat");
const authUser = require("../middleware/authUser")["authenticate"];
const checkPermissions = require("../middleware/rolePermit");
const verifySameOrganization = require("../middleware/verifySameOrganization");
const permissonCheck = checkPermissions("chat");

module.exports = (app) => {
  app.get(
    `${process.env.APP_URL}/conversations/whole_organization`,
    authUser,
    ctl.getWholeOrgConvo
  );

  app.get(
    `${process.env.APP_URL}/conversations/public/`,
    verifySameOrganization,
    publicChat,
    ctl.getPublicConversationByUserId
  );

  // Private chat (insights agent)
  app.post(
    `${process.env.APP_URL}/conversation/add`,
    authUser,
    ctl.addConversation
  );

  // Public chat
  app.post(
    `${process.env.APP_URL}/conversation/public/add`,
    verifySameOrganization,
    publicChat,
    ctl.addPublicConversation
  );

  // Custom agent chat
  app.post(
    `${process.env.APP_URL}/conversation/agent/add`,
    authUser,
    ctl.addCustomAgentConversation
  );
  app.post(
    `${process.env.APP_URL}/conversation/public/update_like_dislike`,
    publicChat,
    ctl.updatePublicLikeDislike
  );

  app.post(
    `${process.env.APP_URL}/conversation/update_like_dislike`,
    authUser,
    permissonCheck,
    ctl.updateLikeDislike
  );

  app.get(
    `${process.env.APP_URL}/conversations`,
    verifySameOrganization,
    authUser,
    permissonCheck,
    ctl.getConversationByUserId
  );

  app.get(
    `${process.env.APP_URL}/conversations/customer`,
    (req, res, next) => {
      if (req.query.token) {
        const tokerParts = req.query.token.split("_");
        console.log("tokerParts", tokerParts);
        if (tokerParts.length > 0) {
          next();
        } else {
          return res.status(403).json({ message: "Authentication failed" });
        }
      } else {
        return res.status(403).json({ message: "Authentication failed" });
      }
    },
    ctl.getConversationByCustomerId
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
