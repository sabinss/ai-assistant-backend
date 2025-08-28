const ctl = require('../controllers/authCtrl');
const authUser = require('../middleware/authUser')['authenticate'];

module.exports = (app) => {
  app.post(`/api/v1/auth/signup`, ctl.signup);
  app.post(`/api/v1/auth/signin`, ctl.signin);
  app.post(`/api/v1/auth/changePassword`, ctl.changePassword);
  app.post(`/api/v1/auth/forgot-password`, ctl.forgotPassword);
  app.post(`/api/v1/auth/verify-token`, ctl.verifyPasswordResetToken);
  app.post(`/api/v1/auth/email-verify`, ctl.verifyEmail);
  app.post(`/api/v1/auth/sendEmailVerifyToken`, ctl.sendConfirmEmailToken);
  app.post(`/api/v1/auth/google-login-verify`, authUser, ctl.verifyGoogleLogin);
  app.post(
    `/api/v1/auth/google-login/disconnect`,
    authUser,
    ctl.disconnectOrgGoogleUser
  );
  app.post(`/api/v1/auth/google-oauth/exchange`, ctl.googleOauthCodeExchange);

  // app.post(`/api/v1/auth/tokenRefresh`, ctl.tokenRefresh);
};
