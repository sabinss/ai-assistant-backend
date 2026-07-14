const User = require("../models/User");

const EMAIL_COLLATION = { locale: "en", strength: 2 };

function normalizeEmail(email) {
  if (typeof email !== "string") return email;
  return email.trim().toLowerCase();
}

function findUserByEmail(email, options = {}) {
  const { session } = options;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return Promise.resolve(null);

  let query = User.findOne({ email: normalizedEmail }).collation(EMAIL_COLLATION);
  if (session) query = query.session(session);
  return query;
}

module.exports = {
  normalizeEmail,
  findUserByEmail,
  EMAIL_COLLATION,
};
