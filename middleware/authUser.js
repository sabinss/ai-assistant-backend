const passport = require('passport');

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
        // if true called from external source
        if (req.orgTokenAuth) {
          next();
        } else {
          if (err) return next(err);
          if (!user) return res.status(401).json({message: 'Session Expired'});
          req.user = user;
        }
      }
    )(req, res, next);
  },
};
