const Customer = require('../models/Customer');
const CustomerFeature = require('../models/CustomerFeature');

exports.getCustomerDetail = async (req, res) => {
  try {
    const {customer_id} = req.query;
    let filter = {};
    if (customer_id) {
      filter._id = customer_id;
    }
    const customerDetail = await Customer.find(filter);

    res.status(200).json({data: customerDetail});
  } catch (error) {
    res.status(500).json({message: 'Internal Server Error', error});
  }
};

exports.getCustomerLoginDetail = async (req, res) => {
  try {
    const {customer_id} = req.query;
    let filter = {feature: {$regex: /^Login$/i}};
    if (customer_id) {
      filter.customer = customer_id;
    }
    const customerLoginDetails = await CustomerFeature.find(filter);
    res.status(200).json({data: customerLoginDetails});
  } catch (error) {
    res.status(500).json({message: 'Internal Server Error', error});
  }
};
