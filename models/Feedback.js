const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
    {
        organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'UserConversation'
        },
        //liked or disliked feedbackenum
        modified_answer: { type: String, default: '' },
        feedback: { type: String, enum: ['liked', 'disliked'], required: true },
        status: { type: String, default: 'new' },
        frequency: { type: Number },
        agent_name: { type: String },
        feedbackMsg: { type: String }
    },

    {
        timestamps: true
    }
);
module.exports = mongoose.model('Feedback', feedbackSchema);
