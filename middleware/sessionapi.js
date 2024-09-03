const SessionApi = require("../models/SessionApi");

const checkSessionApiKey = async (req, res, next) => {
    try {
        // Extract API key from request headers
        const apiKey = req.headers['x-api-key-local'];

        // Check if API key is provided
        if (!apiKey) {
            return res.status(401).json({ error: 'Unauthorized', message: 'API Key is missing' });
        }

        // Find the SessionApi document by API key
        const api = await SessionApi.findOne({ key: apiKey });

        // Check if the API key exists
        if (!api) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API Key' });
        }

        // API key is valid, proceed to the next middleware
        next();
    } catch (error) {
        console.error('Error checking API key:', error);
        return res.status(500).json({ error: 'Internal Server Error', message: 'Error checking API key' });
    }
}

module.exports = checkSessionApiKey;