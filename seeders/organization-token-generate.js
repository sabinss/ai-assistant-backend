const OrganizationToken = require('../models/OrganizationToken');
const jwt = require('jsonwebtoken');

async function createOrgToken() {
    try {
        const payload = {
            userId: '689e567cb613070f268f5b61',
            orgnizationId: '689e567cb613070f268f5b5c',
            email: 'curt@symphosize.com'
        };

        // Generate JWT token
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET);

        // Insert into OrganizationToken collection
        const record = await OrganizationToken.create({
            token: accessToken,
            email: payload.email
        });

        console.log('OrganizationToken created:', record);
        process.exit(0);
    } catch (err) {
        console.error('Error creating OrganizationToken:', err);
        process.exit(1);
    }
}

module.exports = createOrgToken;
