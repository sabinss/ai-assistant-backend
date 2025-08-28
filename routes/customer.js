const ctl = require('../controllers/customerCtrl');
const authUser = require('../middleware/authUser')['authenticate'];
const verifySameOrganization = require('../middleware/verifySameOrganization');

module.exports = (app) => {
  app.get(
    `/api/v1/customer/login-details`,
    verifySameOrganization,
    ctl.getCustomerLoginDetail
  );
  app.get(
    `/api/v1/customer/features`,
    verifySameOrganization,
    ctl.getCustomerFeatures
  );
  app.get(
    `/api/v1/customer/details`,
    verifySameOrganization,
    ctl.getCustomerDetail
  );
  app.get(
    `/api/v1/customer/all`,
    verifySameOrganization,
    ctl.getAllCustomers
  );
  app.post(
    `/api/v1/customer`,
    verifySameOrganization,
    ctl.createCustomer
  );
  app.get(
    `/api/v1/customer/redshift`,
    authUser,
    ctl.fetchCustomerDetailsFromRedshift
  );
  app.get(
    `/api/v1/customer/high-risk-churn-stats`,
    authUser,
    ctl.getHighRiskChurnStats
  );
  app.put(
    `/api/v1/customer/:id`,
    authUser,
    ctl.updateCustomerDetail
  );
  app.get(
    `/api/v1/customer/:id/score`,
    authUser,
    ctl.getCustomerScore
  );
  app.get(
    `/api/v1/customer/:id/details`,
    authUser,
    ctl.getCustomerScoreDetails
  );
};
