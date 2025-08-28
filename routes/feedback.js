const ctl = require('../controllers/feedbackCtrl');
const authUser = require('../middleware/authUser')['authenticate'];
const checkPermissions = require('../middleware/rolePermit');
const verifySameOrganization = require('../middleware/verifySameOrganization');
const permissonCheck = checkPermissions('feedbacks');

module.exports = (app) => {
  app.post(
    `/api/v1/feedback/public/add`,
    ctl.createPublicFeedback
  );
  app.post(`/api/v1/feedback/survey`, ctl.createFeedbackSurvey);
  app.get(
    `/api/v1/feedback/survey`,
    verifySameOrganization,
    ctl.getFeedbackSurveys
  );

  app.post(
    `/api/v1/feedback/add`,
    authUser,
    checkPermissions('feedbacks', 'like-dislike'),
    ctl.createFeedback
  );
  app.get(
    `/api/v1/feedbacks/count`,
    authUser,
    permissonCheck,
    ctl.feedbackCounts
  );
  app.get(
    `/api/v1/feedbacks`,
    authUser,
    permissonCheck,
    ctl.getFeedbacks
  );
  app.get(
    `/api/v1/feedback/:feedback_id`,
    authUser,
    permissonCheck,
    ctl.getFeedback
  );
  app.patch(
    `/api/v1/feedback/:feedback_id`,
    authUser,
    permissonCheck,
    ctl.updateFeedback
  );
  app.delete(
    `/api/v1/feedback/:feedback_id`,
    authUser,
    permissonCheck,
    ctl.deleteFeedback
  );
};
