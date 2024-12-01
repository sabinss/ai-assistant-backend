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
        const decoded = jwt.verify(
          req.headers.authorization.split(' ')[1],
          process.env.JWT_SECRET
        );
        req.user = decoded;
        // if true called from external source
        if (req.orgTokenAuth) {
          next();
        } else {
          if (err) return next(err);
          if (!user) return res.status(401).json({message: 'Session Expired'});
          req.user = user;
          next();
        }
      }
    )(req, res, next);
  },
};
