const User = require("../models/User");
const ConfirmToken = require("../models/ConfirmToken");

function normalizeEmail(email) {
  if (typeof email !== "string") return email;
  return email.trim().toLowerCase();
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function caseInsensitiveEmailFilter(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  return {
    email: { $regex: new RegExp(`^${escapeRegExp(normalizedEmail)}$`, "i") },
  };
}

function findUserByEmail(email, options = {}) {
  const { session } = options;
  const filter = caseInsensitiveEmailFilter(email);
  if (!filter) return Promise.resolve(null);

  let query = User.findOne(filter);
  if (session) query = query.session(session);
  return query;
}

function findConfirmTokenByEmailAndToken(email, token, options = {}) {
  const { session } = options;
  const filter = caseInsensitiveEmailFilter(email);
  if (!filter) return Promise.resolve(null);

  let query = ConfirmToken.findOne({ ...filter, token });
  if (session) query = query.session(session);
  return query;
}

function deleteConfirmTokenByEmailAndToken(email, token, options = {}) {
  const { session } = options;
  const filter = caseInsensitiveEmailFilter(email);
  if (!filter) return Promise.resolve(null);

  let query = ConfirmToken.findOneAndDelete({ ...filter, token });
  if (session) query = query.session(session);
  return query;
}

module.exports = {
  normalizeEmail,
  findUserByEmail,
  findConfirmTokenByEmailAndToken,
  deleteConfirmTokenByEmailAndToken,
};
