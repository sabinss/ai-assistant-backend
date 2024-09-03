const mongoose = require("mongoose");

const sourceSchema = new mongoose.Schema(
    {
        organization: {
            type: String,
        },
        name: {
            type: String,
        },
        status: {
            type: String
        }
    },
    {
        timestamps: true,
    }
)
module.exports = mongoose.model("Source", sourceSchema);
