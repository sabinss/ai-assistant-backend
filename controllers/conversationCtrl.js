const Conversation = require("../models/UserConversation");
const http = require("../helper/http");
const axios = require("axios");

// Add conversation
exports.addConversation = async (req, res) => {
  try {
    let ans, apiTypeValue;

    const defaultCustomerId = "0000";
    const { question, chatSession, apiType } = req.body;

    let session_id = req.body?.sessionId ? req.body?.sessionId : null;

    if (apiType === "Customer Information") {
      apiTypeValue = "insights";
    } else if (apiType === "Product Knowledge") {
      apiTypeValue = "support";
    }

    // Base URL for Python API
    let url = `${process.env.AGENT_SERVER_URL}/ask?query=${encodeURIComponent(
      question
    )}&user_email=${req.user.email}&org_id=${
      req.user.organization
    }&customer_id=${defaultCustomerId}&api_type=${apiTypeValue}`;

    // Append session_id to the URL if it exists
    if (session_id) {
      url += `&session_id=${encodeURIComponent(session_id)}`;
    }

    // Use streaming only for "insights" API type
    if (apiTypeValue === "insights") {
      // Set proper headers for SSE
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable buffering for Nginx
      });

      // Make streaming request to Python API
      const pythonResponse = await axios({
        method: "get",
        url: url,
        responseType: "stream",
      });

      let completeMessage = "";

      // Forward the stream from Python API to client
      pythonResponse.data.on("data", (chunk) => {
        const chunkStr = chunk.toString();

        // Clean up the string and try to parse JSON
        try {
          // Handle multiple SSE messages that might be in a single chunk
          const messages = chunkStr.split("\n\n").filter((m) => m.trim());

          for (const msgText of messages) {
            if (msgText.startsWith("data: ")) {
              try {
                const data = JSON.parse(msgText.replace("data: ", ""));

                // Extract session_id if it exists in the response
                if (data.session_id && !session_id) {
                  session_id = data.session_id;
                }

                // Add content to the complete message
                if (data.message) {
                  completeMessage += data.message;
                }

                // Ensure proper SSE format with data: prefix and double newline
                res.write(`data: ${JSON.stringify(data)}\n\n`);
              } catch (e) {
                // If parsing individual message fails, send as is
                res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
              }
            } else if (msgText.trim()) {
              // For non-data prefixed lines, add the prefix
              res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
            }
          }
        } catch (e) {
          // If overall parsing fails, send raw chunk
          res.write(`data: ${JSON.stringify({ chunk: chunkStr })}\n\n`);
        }
      });

      // When the stream ends, update the conversation with the complete answer
      pythonResponse.data.on("end", async () => {
        try {
          // Send end even
          res.write(
            `data: ${JSON.stringify({
              done: true,
              session_id: session_id,
            })}\n\n`
          );

          answer = completeMessage;
          let payload = {
            user_id: req.user._id,
            question,
            answer,
            organization: req.user.organization,
            chatSession,
            session_id,
          };
          console.log("payload", payload);

          const newConversation = new Conversation(payload);
          await newConversation.save();

          res.end();
        } catch (error) {
          console.error("Error updating conversation:", error);
          res.end();
        }
      });

      // Handle errors in the Python API response
      pythonResponse.data.on("error", (err) => {
        console.error("Error in Python API stream:", err);
        res.write(
          `data: ${JSON.stringify({
            error: "Error in streaming response",
          })}\n\n`
        );
        res.end();
      });
    } else {
      // Non-streaming approach for other API types
      const response = await axios.get(url);

      ans = {
        results: {
          answer: response.data.message,
          sessionId: response.data.session_id,
          customer_id: response.data?.customer_id ?? null,
        },
      };

      if (!session_id && ans.results?.sessionId) {
        session_id = ans.results.sessionId;
      }
      if (!session_id && ans.results?.sessionId) {
        session_id = ans.results.sessionId;
      }

      const answer = ans.results.answer;

      let payload = {
        user_id: req.user._id,
        question,
        answer,
        organization: req.user.organization,
        chatSession,
        session_id,
      };
      console.log("payload", payload);

      const newConversation = new Conversation(payload);
      const savedConversation = await newConversation.save();

      res.json(savedConversation);
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Add custom agent conversation
exports.addCustomAgentConversation = async (req, res) => {
  try {
    const { question, chatSession, agentName } = req.body;
    let session_id = req.body?.sessionId ? req.body?.sessionId : null;

    // Build URL for the Python API endpoint
    let url = `${
      process.env.AGENT_SERVER_URL
    }/ask/agent?agent_name=${encodeURIComponent(
      agentName
    )}&query=${encodeURIComponent(question)}&org_id=${req.user.organization}`;

    // Add session ID if provided
    if (session_id) {
      url += `&session_id=${encodeURIComponent(session_id)}`;
    }

    // Set proper headers for SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering for Nginx
    });

    // Make streaming request to Python API
    const pythonResponse = await axios({
      method: "get",
      url: url,
      responseType: "stream",
    });

    let completeMessage = "";

    // Forward the stream from Python API to client
    pythonResponse.data.on("data", (chunk) => {
      const chunkStr = chunk.toString();

      // Clean up the string and try to parse JSON
      try {
        // Handle multiple SSE messages that might be in a single chunk
        const messages = chunkStr.split("\n\n").filter((m) => m.trim());

        for (const msgText of messages) {
          if (msgText.startsWith("data: ")) {
            try {
              const data = JSON.parse(msgText.replace("data: ", ""));

              // Extract session_id if it exists in the response
              if (data.session_id && !session_id) {
                session_id = data.session_id;
              }

              // Add content to the complete message
              if (data.message) {
                completeMessage += data.message;
              }

              // Ensure proper SSE format with data: prefix and double newline
              res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (e) {
              // If parsing individual message fails, send as is
              res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
            }
          } else if (msgText.trim()) {
            // For non-data prefixed lines, add the prefix
            res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
          }
        }
      } catch (e) {
        // If overall parsing fails, send raw chunk
        res.write(`data: ${JSON.stringify({ chunk: chunkStr })}\n\n`);
      }
    });

    // When the stream ends, update the conversation with the complete answer
    pythonResponse.data.on("end", async () => {
      try {
        // Send end event
        res.write(
          `data: ${JSON.stringify({
            done: true,
            session_id: session_id,
          })}\n\n`
        );

        const answer = completeMessage; // Use the accumulated message

        // Create payload for saving conversation
        let payload = {
          user_id: req.user._id,
          question,
          answer, // Save the complete answer
          organization: req.user.organization,
          chatSession,
          session_id: session_id, // Use the potentially updated session_id
          agent_name: agentName, // Track the agent used
        };
        console.log("Saving agent conversation payload:", payload);

        // Create a new conversation record
        const newConversation = new Conversation(payload);

        // Save the conversation to database
        await newConversation.save();
        console.log("Agent conversation saved successfully.");

        res.end(); // End the response stream
      } catch (error) {
        console.error("Error saving agent conversation:", error);
        // Attempt to send an error event if stream is still open, otherwise just log
        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              error: "Error saving conversation",
            })}\n\n`
          );
          res.end();
        }
      }
    });

    // Handle errors in the Python API response
    pythonResponse.data.on("error", (err) => {
      console.error("Error in Python API agent stream:", err);
      // Attempt to send an error event if stream is still open
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            error: "Error in streaming agent response",
          })}\n\n`
        );
        res.end();
      }
    });
  } catch (err) {
    console.error("Error handling agent conversation:", err);
    // Check if headers have already been sent before sending a status code
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else if (!res.writableEnded) {
      // If streaming has started, try sending an error event
      res.write(
        `data: ${JSON.stringify({
          error: "Server error during streaming",
        })}\n\n`
      );
      res.end();
    }
  }
};

// Delete conversation
exports.deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedConversation = await Conversation.findByIdAndDelete(id);

    if (!deletedConversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({ message: "Conversation deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

// Get conversation by user id
exports.getConversationByUserId = async (req, res) => {
  try {
    const externalApiCall = req.externalApiCall;
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
        error: "Either user_id, or customer_id is required",
      });
    }
    let searchCondition = {};
    if (user_id) {
      searchCondition = {
        user_id: user_id ? user_id : req.user._id,
      };
    }

    // if (externalApiCall) {
    //   searchCondition['customer'] = {$ne: '0000000'};
    // }

    if (externalApiCall && req.organization) {
      searchCondition["organization"] = req.organization._id;
    }

    if (customer_id) {
      searchCondition = {
        customer: customer_id,
      };
    }
    if (updated_date) {
      const filterDate = new Date(updated_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition["updatedAt"] = { $gt: filterDate };
    }
    if (created_date) {
      const filterDate = new Date(created_date);
      filterDate.setHours(0, 0, 0, 0); // Ensure it starts from midnight
      searchCondition["createdAt"] = { $gt: filterDate };
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
      .populate("customer") // Populate the 'customer' field
      .populate("user_id") // Populate the 'customer' field
      .sort({ createdAt: 1 }) // Sort by createdAt in descending order
      .exec(); // Execute the query

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.getConversationByCustomerId = async (req, res) => {
  try {
    const { user_id, chatSession, startDate, endDate, customer_id } = req.query;

    // Check if user_id is provided
    if (!user_id && !customer_id) {
      return res
        .status(400)
        .json({ error: "user_id or customer_id is required" });
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
          customer_id ? "customer_id" : "user_id"
        }`,
      });
    }

    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.updateLikeDislike = async (req, res) => {
  try {
    const { id, liked_disliked } = req.body;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    conversation.liked_disliked = liked_disliked;
    const updatedConversation = await conversation.save();
    res.json({
      message: "Conversation updated successfully",
      updatedConversation,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.totalConversations = async (req, res) => {
  try {
    const conversation = await Conversation.find({
      organization: req.user.organization,
    }).count();
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.getPublicConversationByUserId = async (req, res) => {
  const { org_id, chat_session } = req.query;

  try {
    const conversation = await Conversation.find({
      user_id: req.public_user_id,
      chatSession: chat_session,
    }).sort({ created_date: -1 });
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.updatePublicLikeDislike = async (req, res) => {
  try {
    const { id, liked_disliked } = req.body;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    conversation.liked_disliked = liked_disliked;
    const updatedConversation = await conversation.save();
    res.json({
      message: "Conversation updated successfully",
      updatedConversation,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
};

exports.addPublicConversation = async (req, res) => {
  const { org_id, chat_session, user_email = null } = req.query;
  try {
    const { question, user_email, customer_id } = req.body;

    let url = `${
      process.env.AGENT_SERVER_URL
    }/ask/public?query=${encodeURIComponent(
      // let url = `http://localhost:8000/ask/public?query=${encodeURIComponent(
      question
    )}&user_email=${user_email}&org_id=${org_id}&customer_id=null`;

    // Append session_id to the URL if it exists
    if (chat_session) {
      url += `&session_id=${encodeURIComponent(chat_session)}`;
    }

    const response = await axios.get(url);
    console.log("chat response==", response.data);

    const answer = response.data.message;
    console.log(answer);

    const newConversation = new Conversation({
      user_id: req.public_user_id,
      question,
      answer,
      organization: org_id,
      chatSession: chat_session,
    });

    const savedConversation = await newConversation.save();

    const enhancedResponse = {
      ...savedConversation.toObject(), // Convert Mongoose document to plain JS object
      user_email: response.data.user_email || null, // Add user_email from request (fallback to null if not provided)
      customer_id: response.data.customer_id || null, // Add customer_id from request (fallback to null if not provided)
    };
    res.json(enhancedResponse);
  } catch (err) {
    res.status(500).json({
      error:
        err.message +
        " SOMETWTHING WENT WRONG " +
        err +
        process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT +
        process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT_KEY,
      api: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT,
      headerkey: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT_KEY,
    });
  }
};

// For public chat streaming
// exports.addPublicConversation = async (req, res) => {
//   const { org_id, chat_session } = req.query;

//   const { question, user_email, customer_id } = req.body;

//   let url = `http://localhost:8000/ask/public?query=${encodeURIComponent(
//     // let url = `${process.env.AGENT_SERVER_URL}/public/ask?query=${encodeURIComponent(
//     question
//   )}&user_email=${user_email}&org_id=${org_id}&customer_id=null`;
//   try {
//     const response = await axios.get(url);
//     const answer = response.data.message;

//     const newConversation = new Conversation({
//       user_id: req.public_user_id,
//       question,
//       answer,
//       organization: org_id,
//       chatSession: chat_session,
//     });

//     const savedConversation = await newConversation.save();
//     const enhancedResponse = {
//       ...savedConversation.toObject(), // Convert Mongoose document to plain JS object
//       user_email: response.data.user_email || null, // Add user_email from request (fallback to null if not provided)
//       customer_id: response.data.customer_id || null, // Add customer_id from request (fallback to null if not provided)
//     };

//     res.json(enhancedResponse);
//   } catch (err) {
//     console.error("Error in addPublicConversation:", err);
//   }
//   // try {
//   //   const { question, user_email, customer_id } = req.body;

//   //   // Append session_id to the URL if it exists
//   //   if (chat_session) {
//   //     url += `&session_id=${encodeURIComponent(chat_session)}`;
//   //   }

//   //   // Set proper headers for SSE
//   //   res.writeHead(200, {
//   //     "Content-Type": "text/event-stream",
//   //     "Cache-Control": "no-cache, no-transform",
//   //     Connection: "keep-alive",
//   //     "X-Accel-Buffering": "no",
//   //   });

//   //   // Make streaming request to Python API
//   //   const pythonResponse = await axios({
//   //     method: "get",
//   //     url: url,
//   //     responseType: "stream",
//   //   });

//   //   let completeMessage = "";
//   //   let session_id = chat_session;

//   //   pythonResponse.data.on("data", (chunk) => {
//   //     const chunkStr = chunk.toString();

//   //     // Clean up the string and try to parse JSON
//   //     try {
//   //       // Handle multiple SSE messages that might be in a single chunk
//   //       const messages = chunkStr.split("\n\n").filter((m) => m.trim());

//   //       for (const msgText of messages) {
//   //         if (msgText.startsWith("data: ")) {
//   //           try {
//   //             const data = JSON.parse(msgText.replace("data: ", ""));

//   //             // Add content to the complete message
//   //             if (data.message) {
//   //               completeMessage += data.message;
//   //             }

//   //             // Ensure proper SSE format with data: prefix and double newline
//   //             res.write(`data: ${JSON.stringify(data)}\n\n`);
//   //           } catch (e) {
//   //             console.error("Error parsing JSON:", e); // Add this line
//   //             res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
//   //           }
//   //         } else if (msgText.trim()) {
//   //           // For non-data prefixed lines, add the prefix
//   //           res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
//   //         }
//   //       }
//   //     } catch (e) {
//   //       console.error("Error processing chunk:", e); // Add this line
//   //       res.write(`data: ${JSON.stringify({ chunk: chunkStr })}\n\n`);
//   //     }
//   //   });

//   //   // When the stream ends, update the conversation with the complete answer
//   //   pythonResponse.data.on("end", async () => {
//   //     try {
//   //       // Send end event
//   //       res.write(
//   //         `data: ${JSON.stringify({
//   //           done: true,
//   //           session_id: session_id,
//   //         })}\n\n`
//   //       );

//   //       console.log("completeMessage", completeMessage);

//   //       // Create the conversation record in the database
//   //       // const newConversation = new Conversation({
//   //       //   user_id: req.public_user_id,
//   //       //   question,
//   //       //   answer: completeMessage,
//   //       //   organization: org_id,
//   //       //   chatSession: chat_session,
//   //       // });

//   //       // await newConversation.save();

//   //       res.end();
//   //     } catch (error) {
//   //       console.error("Error saving public conversation:", error);
//   //       res.write(
//   //         `data: ${JSON.stringify({
//   //           error: "Error saving conversation",
//   //         })}\n\n`
//   //       );
//   //       res.end();
//   //     }
//   //   });

//   //   // Handle errors in the Python API response
//   //   pythonResponse.data.on("error", (err) => {
//   //     console.error("Error in Python API stream for public conversation:", err);
//   //     res.write(
//   //       `data: ${JSON.stringify({
//   //         error: "Error in streaming response",
//   //       })}\n\n`
//   //     );
//   //     res.end();
//   //   });

//   // Check if headers have already been sent
//   //   if (!res.headerSent) {
//   //     res.status(500).json({
//   //       error:
//   //         err.message +
//   //         " SOMETWTHING WENT WROTG " +
//   //         process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT +
//   //         process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT_KEY,
//   //       api: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT,
//   //       headerkey: process.env.NEXT_PUBLIC_OPEN_API_FOR_CHAT_KEY,
//   //     });
//   //   } else {
//   //     // If streaming has already started, send error as SSE
//   //     res.write(
//   //       `data: ${JSON.stringify({
//   //         error: "Error in streaming response",
//   //       })}\n\n`
//   //     );
//   //     res.end();
//   //   }
//   // }
// };

exports.getWholeOrgConvo = async (req, res) => {
  const { startDate, endDate, customer_id } = req.query;

  let searchCondition = {};
  const customerId =
    customer_id === "null" || customer_id === "undefined" ? null : customer_id;

  if (customerId) {
    searchCondition = {
      customer: customerId,
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
  try {
    const conversation = await Conversation.find(searchCondition);
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
