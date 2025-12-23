const mongoose = require("mongoose");

async function connect() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      autoIndex: true,
      tls: true,
      retryWrites: false,
      authMechanism: "SCRAM-SHA-256",
    });
    console.log("MongoDB is connected successfully...");
    return true;
  } catch (err) {
    console.log("Failed to connect to MongoDB", err);
    return false;
  }
}

module.exports = { connect };
