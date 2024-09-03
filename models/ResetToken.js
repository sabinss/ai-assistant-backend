const mongoose = require("mongoose");

const resetTokenSchema = new mongoose.Schema(
    {
        userRef: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            unique: true,
        },
        resetToken: {
            type: String,
            required: true
        },
        createdAt: { type: Date, expires: 60 * 5, default: Date.now } // Expire and deletes the doc  after 5 min

    }
)
module.exports = mongoose.model("ResetToken", resetTokenSchema);