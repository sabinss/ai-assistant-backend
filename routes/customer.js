const ctl = require('../controllers/customerCtrl');
const verifySameOrganization = require('../middleware/verifySameOrganization');

module.exports = (app) => {
  app.get(
    `${process.env.APP_URL}/customer/login-details`,
    verifySameOrganization,
    ctl.getCustomerLoginDetail
  );
  app.get(
    `${process.env.APP_URL}/customer/features`,
    verifySameOrganization,
    ctl.getCustomerFeatures
  );
  app.get(
    `${process.env.APP_URL}/customer/details`,
    verifySameOrganization,
    ctl.getCustomerDetail
  );
};
