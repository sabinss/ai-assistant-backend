const jwt = require('jsonwebtoken');
const User = require('../models/User');

const verifySameOrganization = async (req, res, next) => {
  try {
    // Extract API key from request headers
    const { token, email } = req.query;

    // Check if API key is provided
    if (!req.query.token && !req.query.email) {
      // this call is from Frontend

      next();
    } else {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findOne({ email: decoded.email });
      if (decoded.email === email) {
        req.orgTokenAuth = true;
        req.externalApiCall = true;
        req.user = user;
        req.organization = user.organization;

        next();
      } else {
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authentication failed',
        });
      }
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Email not matched with orgnization token',
    });
  }
};

module.exports = verifySameOrganization;
