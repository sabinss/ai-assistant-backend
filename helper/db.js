const mongoose = require("mongoose")

async function connect() {
  try {
    await mongoose.connect(process.env.DB_URL, {
      autoIndex: true,
    })
    console.log("MongoDB is connected...")
    return true
  } catch (err) {
    console.log("Failed to connect to MongoDB")
    return false
  }
}

module.exports = { connect }