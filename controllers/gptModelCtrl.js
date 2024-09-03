const GptModel = require("../models/GptModel");

exports.create = async (req, res) => {
    const { name } = req.body;
    if (!name) {
        return res.status(404).json({ message: "Name is required" });
    }
    //create a  new data ingpt model
    const gptModel = new GptModel({
        name
    });

    try {
        const newGptModel = await gptModel.save();
        res.status(201).json({ message: "GptModel created" });
    } catch (error) {
        res.status(500).json(error);
    }
}