const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 *
 * This is called by Python api
 * Here we validate with organization token and orgId
 */
const verifyGoogleAuthUser = async (req, res, next) => {
  try {
    // Extract API key from request headers
    const { token, orgId } = req.query;
    if (!req.query.token && !req.query.orgId) {
      return res.status(400).json({
        error: 'Org token and Organization Id is missing',
        message: 'Authentication failed',
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({ email: decoded.email });
    if (user.organization.equals(orgId.toString())) {
      // Organization matches
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
    // Check if API key is provided
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Email not matched with orgnization token',
    });
  }
};

module.exports = verifyGoogleAuthUser;
