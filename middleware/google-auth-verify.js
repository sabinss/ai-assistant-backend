const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Types } = require('mongoose');

/**
 *
 * This is called by Python api
 * Here we validate with organization token and orgId
 */
// const verifyGoogleAuthUser = async (req, res, next) => {
//   try {
//     // Extract API key from request headers
//     const { token, orgId } = req.query;
//     if (!req.query.token && !req.query.orgId) {
//       return res.status(400).json({
//         error: 'Org token and Organization Id is missing',
//         message: 'Authentication failed',
//       });
//     }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const organizationId = orgId ? orgId : decoded.organization;

//     const user = await User.findOne({ email: decoded.email });
//     if (user.organization.equals(organizationId.toString())) {
//       // Organization matches
//       req.orgTokenAuth = true;
//       req.externalApiCall = true;
//       req.user = user;
//       req.organization = user.organization;
//       next();
//     } else {
//       return res.status(500).json({
//         error: 'Internal Server Error',
//         message: 'Authentication failed',
//       });
//     }
//     // Check if API key is provided
//   } catch (error) {
//     return res.status(500).json({
//       error: 'Internal Server Error',
//       message: 'Email not matched with orgnization token',
//     });
//   }
// };
const verifyGoogleAuthUser = async (req, res, next) => {
  try {
    console.log('verifyGoogleAuthUser called----');
    // Extract API key from request headers
    const { token, orgId } = req.query;
    if (!req.query.token && !req.query.orgId) {
      return res.status(400).json({
        error: 'Org token and Organization Id is missing',
        message: 'Authentication failed',
      });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const organizationId = orgId ? orgId : decoded.orgnizationId;
    console.log({ decoded });
    const user = await User.findOne({ email: decoded.email });
    console.log({ user });
    console.log('matched', user.organization.toString() === organizationId);
    if (user.organization.toString() === organizationId) {
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
    console.log('Error', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Email not matched with orgnization token',
    });
  }
};

module.exports = verifyGoogleAuthUser;
