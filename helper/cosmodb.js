const mongoose = require("mongoose");

async function connect() {
  try {
    await mongoose.connect(process.env.COSMOSDB_URL, {
      autoIndex: true,
      retryWrites: false, // Cosmos DB doesn't support retryWrites
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    console.log("Cosmos DB is connected successfully...");
    return true;
  } catch (err) {
    console.log("Failed to connect to Cosmos DB", err);
    return false;
  }
}

module.exports = { connect };
