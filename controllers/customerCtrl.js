const Customer = require('../models/Customer');
const CustomerFeature = require('../models/CustomerFeature');
const axios = require('axios');
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
                message: 'Missing required fields: name,  organization'
            });
        }
        // Create a new customer with required and optional fields
        const customer = new Customer({
            name,
            organization,
            email: optionalFields?.email || '', // Ensure email is explicitly set to null if not provided
            ...optionalFields // Spread operator adds any additional fields dynamically
        });

        await customer.save();

        res.status(201).json({
            message: 'Customer created successfully',
            customer
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

exports.fetchCustomerDetailsFromRedshift = async (req, res) => {
    try {
        const session_id = Math.floor(1000 + Math.random() * 9000);
        const org_id = req.user.organization.toString();
        const sql_query = `SELECT * from  db${org_id}.companies`;
        let url =
            process.env.AI_AGENT_SERVER_URI +
            `/run-sql-query?sql_query=${sql_query}&session_id=${session_id}&org_id=${org_id}`;
        console.log('url', url);
        const response = await axios.post(url);
        res.status(200).json({ data: response.data.result.result_set });
    } catch (err) {
        console.log('Err', err);
        res.status(500).json({ message: 'Internal Server Error', err });
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
