const passport = require('passport');
const passportJwt = require('passport-jwt');
const ExtractJwt = passportJwt.ExtractJwt;
const StrategyJwt = passportJwt.Strategy;
const User = require('../models/User');

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
};

const checkToken = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({message: 'Token is required'});
  }

  next();
};

passport.use(
  'user',
  new StrategyJwt(options, async (jwtPayload, done) => {
    return User.findById(jwtPayload.user_id)
      .select('-password')
      .then((user) => {
        return done(null, user);
      })
      .catch((error) => {
        return done(error);
      });
  })
);

module.exports = {checkToken};
