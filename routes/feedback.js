const ctl = require('../controllers/feedbackCtrl');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const verifySameOrganization = require('../middleware/verifySameOrganization');
const permissonCheck = checkPermissions('feedbacks');

module.exports = (app) => {
  app.post(
    `${process.env.APP_URL}/feedback/public/add`,
    ctl.createPublicFeedback
  );
  app.post(`${process.env.APP_URL}/feedback/survey`, ctl.createFeedbackSurvey);
  app.get(
    `${process.env.APP_URL}/feedback/survey`,
    verifySameOrganization,
    ctl.getFeedbackSurveys
  );

  app.post(
    `${process.env.APP_URL}/feedback/add`,
    authUser,
    checkPermissions('feedbacks', 'like-dislike'),
    ctl.createFeedback
  );
  app.get(
    `${process.env.APP_URL}/feedbacks/count`,
    authUser,
    permissonCheck,
    ctl.feedbackCounts
  );
  app.get(
    `${process.env.APP_URL}/feedbacks`,
    authUser,
    permissonCheck,
    ctl.getFeedbacks
  );
  app.get(
    `${process.env.APP_URL}/feedback/:feedback_id`,
    authUser,
    permissonCheck,
    ctl.getFeedback
  );
  app.patch(
    `${process.env.APP_URL}/feedback/:feedback_id`,
    authUser,
    permissonCheck,
    ctl.updateFeedback
  );
  app.delete(
    `${process.env.APP_URL}/feedback/:feedback_id`,
    authUser,
    permissonCheck,
    ctl.deleteFeedback
  );
};
