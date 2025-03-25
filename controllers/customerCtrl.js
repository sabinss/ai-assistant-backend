const Customer = require('../models/Customer');
const CustomerFeature = require('../models/CustomerFeature');

exports.getCustomerDetail = async (req, res) => {
  try {
    const { customer_id, updated_date, created_date } = req.query;
    let filter = {};
    if (customer_id) {
      filter._id = customer_id;
    }
    if (req.externalApiCall && req.organization) {
      filter.organization = req.organization;
    }
    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }
    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition['createdAt'] = { $gt: filterDate };
    }
    const customerDetail = await Customer.find(filter);

    res.status(200).json({ data: customerDetail });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.createCustomer = async (req, res) => {
  try {
    const { name, organization, ...optionalFields } = req.body;
    if (req.externalApiCall && !req.organization) {
      res.status(400).json({ message: 'Organization required', error });
    }
    // Check if required fields are provided
    if (!name || !organization) {
      return res.status(400).json({
        message: 'Missing required fields: name, email, organization',
      });
    }
    // Create a new customer with required and optional fields
    const customer = new Customer({
      name,
      organization,
      ...optionalFields, // Spread operator adds any additional fields dynamically
    });

    await customer.save();

    res.status(201).json({
      message: 'Customer created successfully',
      customer,
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getCustomerLoginDetail = async (req, res) => {
  try {
    const { customer_id, updated_date } = req.query;
    let filter = { feature: { $regex: /^Login$/i } };
    if (customer_id) {
      filter.customer = customer_id;
    }

    if (req?.organization) {
      filter.organization = organization;
    }

    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }
    const customerLoginDetails = await CustomerFeature.find(filter);
    res.status(200).json({ data: customerLoginDetails });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};

exports.getCustomerFeatures = async (req, res) => {
  try {
    const { customer_id, updated_date, created_date } = req.query;
    let filter = { feature: { $not: { $regex: /^login$/i } } };
    if (customer_id) {
      filter.customer = customer_id;
    }
    if (req.externalApiCall && req.organization) {
      filter.organization = req.organization;
    }
    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      filter['updatedAt'] = { $gt: filterDate };
    }
    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition['createdAt'] = { $gt: filterDate };
    }
    const customerLoginDetails = await CustomerFeature.find(filter);
    res.status(200).json({ data: customerLoginDetails });
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error', error });
  }
};
