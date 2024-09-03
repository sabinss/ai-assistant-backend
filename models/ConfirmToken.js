const mongoose = require("mongoose");

const confirmTokenSchema = new mongoose.Schema(
    {
        email: {
            type: String
        },
        token: {
            type: String,
            required: true
        },
        createdAt: { type: Date, expires: 60 * 5, default: Date.now } // Expire and deletes the doc  after 5 min

    }
)
module.exports = mongoose.model("ConfirmToken", confirmTokenSchema);