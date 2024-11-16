const Customer = require('../models/Customer');
const loginData = require('../constants/customer_feature_data');
const CustomerFeature = require('../models/CustomerFeature');

const seedCustomerFeature = async () => {
  try {
    let finalPayload = [];
    for (let x of loginData) {
      const customer = await Customer.findOne({
        name: {$regex: new RegExp(x.hotel, 'i')},
      });
      console.log('found=', customer);
      let payload = {
        product: x.hotel,
        email: x.system,
        date: x.date,
        time: x.time,
        feature: x.action,
        customer: customer._id,
      };
      finalPayload.push(payload);
    }
    const records = finalPayload.filter((x) => x.customer);
    console.log('records', records);
    const customers = await CustomerFeature.insertMany(records);

    console.log('Customers successfully inserted:', customers);
  } catch (err) {
    console.log(err);
  }
};

module.exports = seedCustomerFeature;
