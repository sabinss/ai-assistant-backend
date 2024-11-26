const jwt = require('jsonwebtoken');

const verifySameOrganization = async (req, res, next) => {
  try {
    // Extract API key from request headers
    const {token, email} = req.query;
    // Check if API key is provided
    if (!token && !email) {
      // this call is from Frontend
      next();
    } else {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.email === email) {
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
