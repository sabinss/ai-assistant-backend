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

exports.updateCustomerDetail = async (req, res) => {
    try {
        const { id } = req.params; // Customer ID
        const { stage } = req.body; // Fields to update

        if (!id) {
            return res.status(400).json({ message: 'Customer ID is required' });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(id, { stage }, { new: true, runValidators: true });

        if (!updatedCustomer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        return res.status(200).json({
            message: 'Customer updated successfully',
            data: updatedCustomer
        });
    } catch (err) {
        console.error('Error updating customer:', err);
        return res.status(500).json({ message: 'Internal server error', error: err.message });
    }
};

exports.getCustomerScore = async (req, res) => {
    try {
        const session_id = Math.floor(1000 + Math.random() * 9000);
        const org_id = req.user.organization.toString(); // e.g., '12'
        const customer_id = req.params.id || req.query.id; // e.g., '123123'

        if (!customer_id) {
            return res.status(400).json({ message: 'Missing customer_id' });
        }

        const sql_query = `
        SELECT * FROM db${org_id}.customer_score_view 
        WHERE customer_id = '${customer_id}' 
          AND year = EXTRACT(YEAR FROM DATEADD(MONTH, -1, CURRENT_DATE)) 
          AND month = EXTRACT(MONTH FROM DATEADD(MONTH, -1, CURRENT_DATE))
      `;

        const url = `${process.env.AI_AGENT_SERVER_URI}/run-sql-query?sql_query=${encodeURIComponent(
            sql_query
        )}&session_id=${session_id}&org_id=${org_id}`;

        console.log('Requesting URL:', url);

        const response = await axios.post(url);

        if (response?.data?.error) {
            return res.status(500).json({ message: response.data.error, error: response.data.error });
        }
        // has score and analysis
        return res.status(200).json({ data: response.data.result.result_set });
    } catch (error) {
        console.error('Error fetching customer score:', error);
        return res.status(500).json({ message: 'Internal Server Error', error });
    }
};

exports.getCustomerScoreDetails = async (req, res) => {
    try {
        const session_id = Math.floor(1000 + Math.random() * 9000);
        const org_id = req.user.organization.toString(); // e.g. '12'
        const customer_id = req.params.id || req.query.id; // e.g. 'hilton'

        if (!customer_id) {
            return res.status(400).json({ message: 'Missing customer_id' });
        }

        const sql_query = `
        SELECT * FROM db${org_id}.score_details_view 
        WHERE customer_id = '${customer_id}' 
          AND year = EXTRACT(YEAR FROM DATEADD(MONTH, -1, CURRENT_DATE)) 
          AND month = EXTRACT(MONTH FROM DATEADD(MONTH, -1, CURRENT_DATE))
      `;

        const url = `${process.env.AI_AGENT_SERVER_URI}/run-sql-query?sql_query=${encodeURIComponent(
            sql_query
        )}&session_id=${session_id}&org_id=${org_id}`;

        console.log('Requesting URL:', url);

        const response = await axios.post(url);

        if (response?.data?.error) {
            return res.status(500).json({ message: response.data.error, error: response.data.error });
        }
        // key drivers
        return res.status(200).json({ data: response.data.result.result_set });
    } catch (error) {
        console.error('Error fetching customer score details:', error);
        return res.status(500).json({ message: 'Internal Server Error', error });
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
        if (response?.data?.error) {
            res.status(500).json({ message: response?.data?.error, error: response?.data?.error });
            return;
        }
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
