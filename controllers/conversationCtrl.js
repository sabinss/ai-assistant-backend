const Conversation = require('../models/UserConversation');
const User = require('../models/User');
const http = require('../helper/http');
const axios = require('axios');
// Add conversation
exports.addConversation = async (req, res) => {
  try {
    let ans;
    const {question, chatSession, workflowFlag} = req.body;
    if (workflowFlag) {
      const url = `http://ec2-18-188-31-176.us-east-2.compute.amazonaws.com:8000/ask?query=${encodeURIComponent(
        question
      )}&email=${req.user.email}`;
      const response = await axios.get(url);
      ans = {
        results: {
          answer: response.data.message,
        },
      };
    } else {
      ans = await http.sendMessage(
        req?.user?.organization,
        question,
        chatSession
      );
    }

    console.log('ans', ans);
    const answer = ans.results.answer;

    const newConversation = new Conversation({
      user_id: req.user._id,
      question,
      answer,
      organization: req.user.organization,
      chatSession,
    });

    const savedConversation = await newConversation.save();
    res.json(savedConversation);
  } catch (err) {
    console.log(err);
    res.status(500).json({error: err.message});
  }
};

// Delete conversation
exports.deleteConversation = async (req, res) => {
  try {
    const {id} = req.params;
    const deletedConversation = await Conversation.findByIdAndDelete(id);

    if (!deletedConversation) {
      return res.status(404).json({error: 'Conversation not found'});
    }

    res.json({message: 'Conversation deleted successfully'});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

// Get conversation by user id
exports.getConversationByUserId = async (req, res) => {
  try {
    const {user_id, chatSession, startDate, endDate} = req.query;

    // Check if user_id is provided
    if (!user_id) {
      return res.status(400).json({error: 'user_id is required'});
    }

    let searchCondition = {
      user_id: user_id,
    };

    // Add additional search conditions based on provided parameters
    if (chatSession) {
      searchCondition.chatSession = chatSession;
    }

    if (startDate && endDate) {
      searchCondition.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const conversation = await Conversation.find(searchCondition).sort({
      createdAt: -1,
    });

    if (!conversation || conversation.length === 0) {
      return res
        .status(404)
        .json({error: 'Conversation not found for the provided user_id'});
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

exports.updateLikeDislike = async (req, res) => {
  try {
    const {id, liked_disliked} = req.body;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({error: 'Conversation not found'});
    }

    conversation.liked_disliked = liked_disliked;
    const updatedConversation = await conversation.save();
    res.json({
      message: 'Conversation updated successfully',
      updatedConversation,
    });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

exports.totalConversations = async (req, res) => {
  try {
    const conversation = await Conversation.find({
      organization: req.user.organization,
    }).count();
    res.json(conversation);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

exports.getPublicConversationByUserId = async (req, res) => {
  const {org_id, chat_session} = req.query;

  try {
    const conversation = await Conversation.find({
      user_id: req.public_user_id,
      chatSession: chat_session,
    }).sort({created_date: -1});
    res.json(conversation);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

exports.updatePublicLikeDislike = async (req, res) => {
  try {
    const {id, liked_disliked} = req.body;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({error: 'Conversation not found'});
    }

    conversation.liked_disliked = liked_disliked;
    const updatedConversation = await conversation.save();
    res.json({
      message: 'Conversation updated successfully',
      updatedConversation,
    });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

exports.addPublicConversation = async (req, res) => {
  const {org_id, chat_session} = req.query;
  try {
    const {question} = req.body;
    const ans = await http.sendMessage(org_id, question, chat_session);
    const answer = ans.results.answer;
    const newConversation = new Conversation({
      user_id: req.public_user_id,
      question,
      answer,
      organization: org_id,
      chatSession: chat_session,
    });

    const savedConversation = await newConversation.save();
    res.json(savedConversation);
  } catch (err) {
    res.status(500).json({
      error:
        err.message +
        ' SOMETWTHING WENT WROTG ' +
        process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT +
        process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT_KEY,
      api: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT,
      headerkey: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT_KEY,
    });
  }
};

exports.getWholeOrgConvo = async (req, res) => {
  const {startDate, endDate} = req.query;
  let searchCondition = {
    organization: req.user.organization,
  };

  if (startDate && endDate) {
    searchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  try {
    const conversation = await Conversation.find(searchCondition);
    res.json(conversation);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
