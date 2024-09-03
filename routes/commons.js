const Status = require("../models/Status.js");
const authUser = require("../middleware/authUser")["authenticate"];
module.exports = (app) => {
    app.get(`${process.env.APP_URL}/status`, authUser, async (req, res) => {
        const status = await Status.find();
        res.status(200).json(status)
    });
};