const permitUser = async (req, res, next) => {
  const user = req.user;
  if (user.role === "admin") return next();

  if (user.role === "reviewer") {
    if (req.method === "PATCH" || req.method === "GET") return next();
    return res.status(403).json({ message: "Not enough permission" });
  }

  if (user.role === "user") {
    if (req.method === "GET") return next();
    return res.status(403).json({ message: "Not enough permission" });
  }
  next();
};

module.exports = permitUser;
