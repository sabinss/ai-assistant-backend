const mongoose = require("mongoose")
//role schema
const RoleSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true
    }
})
module.exports = mongoose.model("Role", RoleSchema)