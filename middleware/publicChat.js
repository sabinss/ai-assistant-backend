const SessionApi = require("../models/SessionApi");
const User = require("../models/User");
const Organization = require("../models/Organization");


const publicChat = async (req, res, next) => {
    //get headers
    try {

        const { org_id } = req.query;
        const org = await Organization.findById(org_id)
        if (!org) {
            return res.status(400).json({ message: "You have no permissons, there is no organization like that ", org_id })
        }
        const public_chat_user = await createUserIfNotExist()
        req.public_user_id = public_chat_user._id
        return next();
    }

    catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Internal server error" })
    }


};

module.exports = publicChat;


const createUserIfNotExist = async () => {
    try {
        let user = await User.findOne({ email: "public_chat@demo.com" });
        if (!user) {
            user = await User.create({
                email: "public_chat@demo.com",
                password: "public",
            });
        }
        return user;
    } catch (error) {
        console.error("Error creating or finding user:", error);
        throw error;
    }
};


