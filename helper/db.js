const mongoose = require("mongoose");

async function connect() {
  try {
    const isProduction = process.env.NODE_ENV === "production";

    // Different connection options for MongoDB Atlas (staging) vs Azure Cosmos DB (production)
    const connectionOptions = isProduction
      ? {
          // Azure Cosmos DB options
          autoIndex: true,
          tls: true,
          retryWrites: false,
          authMechanism: "SCRAM-SHA-256",
        }
      : {
          // MongoDB Atlas options (staging/development)
          autoIndex: true,
        };

    await mongoose.connect(process.env.DB_URL, connectionOptions);
    console.log(`${isProduction ? "Azure Cosmos DB" : "MongoDB"} is connected successfully...`);
    return true;
  } catch (err) {
    console.log("Failed to connect to MongoDB", err);
    return false;
  }
}

module.exports = { connect };
