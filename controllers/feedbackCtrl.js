const Feedback = require("../models/Feedback");
const Conversation = require("../models/UserConversation");
const Organization = require("../models/Organization");

exports.getFeedbacks = async (req, res) => {
    try {
        const page = parseInt(req?.query?.page) || 1;
        const limit = parseInt(req?.query?.limit) || 10;
        const startIndex = (page - 1) * limit;
        const searchQuery = req?.query?.search || '';
        const sortField = req?.query?.sortField || "createdAt";
        const sortDirection = req?.query?.sortDirection === "desc" ? -1 : 1;
        const { status, feedbackType, startDate, endDate } = req?.query;
        let searchCondition = {
            $and: [
                { organization: req?.user?.organization },
                {
                    $or: [
                        { "conversation.question": { $regex: searchQuery, $options: 'i' } },
                        { "conversation.answer": { $regex: searchQuery, $options: 'i' } },
                        { modified_answer: { $regex: searchQuery, $options: 'i' } },
                        { feedback: { $regex: searchQuery, $options: 'i' } }
                    ]
                }
            ]
        };

        if (feedbackType && feedbackType !== "both") {
            searchCondition.feedback = feedbackType;
        }

        if (status && status !== "all") {
            searchCondition.status = status;
        }

        if (startDate && endDate) {
            searchCondition.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const feedbacks = await Feedback.find(searchCondition)
            .populate('conversation')
            .skip(startIndex)
            .limit(limit)
            .sort({ [sortField]: sortDirection });

        const totalCount = await Feedback.countDocuments(searchCondition);
        const totalPages = Math.ceil(totalCount / limit);

        res.status(200).json({ feedbacks, totalPages, totalCount });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

exports.getFeedback = async (req, res) => {
    const feedback_id = req.params.feedback_id;
    try {
        const feedback = await Feedback.findById(feedback_id)
            .populate('conversation')
            .populate('user');
        if (!feedback) return res.status(404).json({ message: "Feedback not found" });
        res.status(200).json({ feedback });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

exports.createFeedback = async (req, res) => {
    const { conversation, feedback, modified_answer } = req.body;
    if (!conversation) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const conversationData = await Conversation.findById(conversation);
        if (!conversationData) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        //get frequency from org
        const org = await Organization.findById(req?.user?.organization);
        const frequency = org?.temperature;

        console.log("frequency from org is ", frequency);

        const newFeedback = await Feedback.create({
            organization: req?.user?.organization,
            user: req?.user?._id,
            conversation,
            modified_answer,
            feedback,
            status: "new",
            frequency
        });

        res.status(200).json({ message: "Feedback created successfully", newFeedback });
    } catch (error) {
        console.error("Error creating feedback:", error);
        res.status(500).json({ message: "Internal server error", error });
    }
};

exports.updateFeedback = async (req, res) => {
    try {
        const feedback_id = req.params.feedback_id;
        const { feedback, modified_answer, status } = req.body;
        const updatedFeedback = await Feedback.findByIdAndUpdate(
            feedback_id,
            { $set: { feedback, modified_answer, status: "updated" } },
            { new: true }
        );

        if (!updatedFeedback) {
            return res.status(404).json({ message: "Feedback not found" });
        }

        res.status(200).json({ message: "Feedback updated", updatedFeedback });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error", error });
    }
};

exports.deleteFeedback = async (req, res) => {
    const { feedback_id } = req.params;

    try {
        const feedback = await Feedback.findByIdAndUpdate(feedback_id, { $set: { status: 'removed' } }, { new: true });
        if (!feedback) return res.status(404).json({ message: "Feedback not found" });

        res.status(200).json({ message: "Feedback deleted" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error", error });
    }
};
exports.feedbackCounts = async (req, res) => {
    const { startDate, endDate } = req?.query;
    let searchCondition = {
        organization: req?.user?.organization,
        createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) }
    };
    //count total doucments found  and then send 
    try {
        const feedbackCounts = await Feedback.countDocuments(searchCondition);
        const likedFeedbackCounts = await Feedback.countDocuments({ ...searchCondition, feedback: "liked" });
        const dislikedFeedbackCounts = await Feedback.countDocuments({ ...searchCondition, feedback: "disliked" });
        res.status(200).json({ feedbackCounts, likedFeedbackCounts, dislikedFeedbackCounts });
    } catch (error) {
        res.status(500).json({ message: "Internal Server Error", error });
    }
}
exports.createPublicFeedback = async (req, res) => {
    const { conversation, feedback, modified_answer, org_id, user_id } = req.body;
    if (!conversation) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        const conversationData = await Conversation.findById(conversation);
        if (!conversationData) {
            return res.status(404).json({ message: "Conversation not found" });
        }
        //get frequency from org
        const org = await Organization.findById(org_id);
        const frequency = org?.temperature;

        const newFeedback = await Feedback.create({
            organization: org,
            user: user_id,
            conversation,
            modified_answer,
            feedback,
            status: "new",
            frequency
        });

        res.status(200).json({ message: "Feedback created successfully", newFeedback });
    } catch (error) {
        console.error("Error creating feedback:", error);
        res.status(500).json({ message: "Internal server error", error });
    }
};