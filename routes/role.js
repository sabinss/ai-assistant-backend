const Role = require("../models/Role.js");
const authUser = require("../middleware/authUser")["authenticate"];
module.exports = (app) => {
    app.get(`${process.env.APP_URL}/roles`, authUser, async (req, res) => {
        const roles = await Role.find();
        res.status(200).json(roles)

    });
};