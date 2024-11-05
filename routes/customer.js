const ctl = require('../controllers/customerCtrl');

module.exports = (app) => {
  app.get(
    `${process.env.APP_URL}/customer/login-details`,
    ctl.getCustomerLoginDetail
  );
  app.get(`${process.env.APP_URL}/customer/details`, ctl.getCustomerDetail);
};
