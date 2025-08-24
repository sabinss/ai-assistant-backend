const passport = require('passport');
const jwt = require('jsonwebtoken');
module.exports = {
  initialize: function () {
    return passport.initialize();
  },
  authenticate: function (req, res, next) {
    return passport.authenticate(
      'user',
      {
        session: false,
      },
      (err, user, info) => {
        if (req?.externalApiCall) {
          next();
        } else if (req.headers['x-api-secret-key']) {
          if (
            req.headers['x-api-secret-key'] == process.env.PYTHON_API_SECRET_KEY
          ) {
            req.user = req.user || {};
            req.user.isAuth = true;
            req.user.organization = req.query?.organization || null;
            next();
          } else {
            return res.status(401).json({ message: 'Authorization failed' });
          }
        } else if (req.orgTokenAuth) {
          next();
        } else {
          const decoded = jwt.verify(
            req.headers.authorization.split(' ')[1],
            process.env.JWT_SECRET
          );
          req.user = decoded;
          req.user._id = req.user?.user_id;
          if (err) {
            if (!user) {
              return res.status(401).json({ message: 'Session Expired' });
            }
          }
          // req.user = user;
          next();
        }
      }
    )(req, res, next);
  },
};
