const mongoose = require("mongoose");

const statusSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            unique: true
        }
    }
)
module.exports = mongoose.model("Status", statusSchema);
