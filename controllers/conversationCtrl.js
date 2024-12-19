const Conversation = require('../models/UserConversation');
const User = require('../models/User');
const http = require('../helper/http');
const axios = require('axios');

// Add conversation
exports.addConversation = async (req, res) => {
  try {
    let ans, apiTypeValue;
    const defaultCustomerId = '0000';
    const {question, chatSession, workflowFlag, apiType} = req.body;
    let session_id = req.body?.sessionId ? req.body?.sessionId : null;
    let customerId = null;
    if (apiType === 'Customer Information') {
      apiTypeValue = 'insights';
    } else if (apiType === 'Product Knowledge') {
      apiTypeValue = 'support';
    }
    console.log('workflowFlag', workflowFlag);
    if (workflowFlag) {
      let url = `http://3.17.138.140:8000/ask?query=${encodeURIComponent(
        question
      )}&user_email=${req.user.email}&org_id=${
        req.user.organization
      }&customer_id=${defaultCustomerId}&api_type=${apiTypeValue}`;

      if (session_id) {
        // Append session_id to the URL if it exists
        url += `&session_id=${encodeURIComponent(session_id)}`;
      }
      const response = await axios.get(url);
      console.log('chat response==', response.data);
      ans = {
        results: {
          answer: response.data.message,
          sessionId: response.data.session_id,
          customer_id: response.data?.customer_id ?? null,
        },
      };
    } else {
      ans = await http.sendMessage(
        req?.user?.organization,
        question,
        chatSession
      );
    }

    if (!session_id && ans.results?.sessionId) {
      session_id = ans.results.sessionId;
    }

    const answer = ans.results.answer;
    console.log('Customer object', {
      user_id: req.user._id,
      question,
      answer,
      organization: req.user.organization,
      chatSession,
      session_id,
      customer: ans.results?.customer_id,
    });
    const newConversation = new Conversation({
      user_id: req.user._id,
      question,
      answer,
      organization: req.user.organization,
      chatSession,
      session_id,
      customer: ans.results?.customer_id,
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
    const {
      user_id,
      chatSession,
      startDate,
      endDate,
      customer_id,
      updated_date,
      created_date,
    } = req.query;
    // Check if user_id is provided
    if (!req.user._id && !user_id && !customer_id) {
      return res.status(400).json({
        error: 'Either user_id, or customer_id is required',
      });
    }
    let searchCondition = {};
    if (user_id) {
      searchCondition = {
        user_id: user_id ? user_id : req.user._id,
      };
    }

    if (customer_id) {
      searchCondition = {
        customer: customer_id,
      };
    }
    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition['updatedAt'] = {$gt: filterDate};
    }
    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition['createdAt'] = {$gt: filterDate};
    }
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

    // const conversation = await Conversation.find(searchCondition).sort({
    //   createdAt: -1,
    // });
    const conversation = await Conversation.find(searchCondition)
      .populate('customer') // Populate the 'customer' field
      .populate('user_id') // Populate the 'customer' field
      .sort({createdAt: -1}) // Sort by createdAt in descending order
      .exec(); // Execute the query
    if (!conversation || conversation.length === 0) {
      return res.status(404).json({
        error: `Conversation not found for the provided ${
          customer_id ? 'customer_id' : 'user_id'
        }`,
      });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};

exports.getConversationByCustomerId = async (req, res) => {
  try {
    const {user_id, chatSession, startDate, endDate, customer_id} = req.query;

    // Check if user_id is provided
    if (!user_id && !customer_id) {
      return res
        .status(400)
        .json({error: 'user_id or customer_id is required'});
    }

    let searchCondition = {};
    if (user_id) {
      searchCondition = {
        user_id: user_id,
      };
    }

    if (customer_id) {
      searchCondition = {
        customer: customer_id,
      };
    }

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
      return res.status(404).json({
        error: `Conversation not found for the provided ${
          customer_id ? 'customer_id' : 'user_id'
        }`,
      });
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
  const {startDate, endDate, customer_id} = req.query;
  let searchCondition = {};
  console.log('11', customer_id);
  if (customer_id) {
    searchCondition = {
      customer: customer_id,
    };
  } else {
    searchCondition = {
      organization: req.user.organization,
    };
  }

  if (startDate && endDate) {
    searchCondition.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  console.log('22', searchCondition);
  try {
    const conversation = await Conversation.find(searchCondition);
    res.json(conversation);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
};
