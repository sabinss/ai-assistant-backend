const ctl = require('../controllers/authCtrl');
const authUser = require('../middleware/authUser');
console.log('process.env.APP_URL', process.env.APP_URL);
module.exports = (app) => {
  app.post(`${process.env.APP_URL}/auth/signup`, ctl.signup);
  app.post(`${process.env.APP_URL}/auth/signin`, ctl.signin);
  app.post(`${process.env.APP_URL}/auth/changePassword`, ctl.changePassword);
  app.post(`${process.env.APP_URL}/auth/forgot-password`, ctl.forgotPassword);
  app.post(
    `${process.env.APP_URL}/auth/verify-token`,
    ctl.verifyPasswordResetToken
  );
  app.post(`${process.env.APP_URL}/auth/email-verify`, ctl.verifyEmail);
  app.post(
    `${process.env.APP_URL}/auth/sendEmailVerifyToken`,
    ctl.sendConfirmEmailToken
  );
  app.post(
    `${process.env.APP_URL}/auth/google-login-verify`,
    ctl.verifyGoogleLogin
  );

  // app.post(`${process.env.APP_URL}/auth/tokenRefresh`, ctl.tokenRefresh);
};
