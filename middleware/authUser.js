const passport = require("passport");
const jwt = require("jsonwebtoken");
module.exports = {
  initialize: function () {
    return passport.initialize();
  },
  authenticate: function (req, res, next) {
    return passport.authenticate(
      "user",
      {
        session: false,
      },
      (err, user, info) => {
        if (req?.externalApiCall) {
          next();
        } else if (req.headers["x-api-secret-key"]) {
          if (req.headers["x-api-secret-key"] == process.env.PYTHON_API_SECRET_KEY) {
            req.user = req.user || {};
            req.user.isAuth = true;
            req.user.organization = req.query?.organization || null;
            req.user.externalEmail = req.query?.email || null;
            next();
          } else {
            return res.status(401).json({ message: "Authorization failed" });
          }
        } else if (req.orgTokenAuth) {
          next();
        } else {
          const authHeader = req.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Authorization header missing or invalid" });
          }

          const token = authHeader.split(" ")[1];
          if (!token) {
            return res.status(401).json({ message: "Token not provided" });
          }

          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            req.user._id = req.user?.user_id;
            next();
          } catch (error) {
            return res.status(401).json({ message: "Invalid or expired token" });
          }
        }
      }
    )(req, res, next);
  },
};
