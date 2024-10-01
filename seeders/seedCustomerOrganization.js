const Customer = require('../models/Customer');
const customerData = require('../constants/customer_data');

const seedOrganizationCustomerData = async () => {
  try {
    const payload = customerData.map((x) => {
      return {
        name: x.Customer,
        email: x.Email,
        arr: x.ARR,
        licenses_purchased: x.Licenses_Purchased,
        licenses_used: x.Licenses_Used,
        renewal_date: x.Renewal_Date,
        csm_agent: x.CSM_Agent,
        account_executive: x.Account_Executive,
        health_score: x.Health_Score,
        login_count: x.Login_Count,
        main_feature_usage_count: x.Main_Feature_Usage_Count,
        total_ticket_count: x.Total_Ticket_Count,
        open_ticket_count: x.Open_Ticket_Count,
        escalated_ticket: x.Escalated_Ticket_Count,
        closed_ticket_count: x.Closed_Ticket_Count,
        organization: x.Org_Id,
      };
    });
    const customers = await Customer.insertMany(payload);
    console.log('Customers successfully inserted:', customers);
  } catch (err) {
    console.log(err);
  }
};

module.exports = seedOrganizationCustomerData;
