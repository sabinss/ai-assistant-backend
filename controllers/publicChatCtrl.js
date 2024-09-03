const Conversation = require('../models/UserConversation');
exports.addConversation = async (req, res) => {
    try {
        const { question, answer, chatSession } = req.body;
        const newConversation = new Conversation({
            user_id: req.user._id,
            question,
            answer,
            organization: req.user.organization,
            chatSession
        });

        const savedConversation = await newConversation.save();

        res.json(savedConversation);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
