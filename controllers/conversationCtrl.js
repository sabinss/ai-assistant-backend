const Conversation = require("../models/UserConversation");
const http = require("../helper/http");
const axios = require("axios");

// Configuration for timeout and retry handling
const AGENT_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 300000, // 5 minutes
  RETRY_DELAY_MS: 2000, // 2 seconds
  CONNECTION_TIMEOUT_MS: 10000, // 10 seconds
  STREAMING_TIMEOUT_MS: 60000, // 1 minute for streaming
};

// Private chat
exports.addConversation = async (req, res) => {
  try {
    let ans;
    let apiTypeValue = "insights";

    const defaultCustomerId = "0000";
    const { question, chatSession, apiType, customer, fromCustomer, message } = req.body;
    // if (fromCustomer) {
    //     apiTypeValue = '';
    // }

    let session_id = req.body?.sessionId
      ? req.body?.sessionId
      : Math.floor(100000 + Math.random() * 900000);

    // if (apiType === 'Customer Information') {
    //   apiTypeValue = 'insights';
    // } else if (apiType === 'Product Knowledge') {
    //   apiTypeValue = 'support';
    // }

    // Base URL for Python API
    let url = `${process.env.AI_AGENT_SERVER_URI}/ask?query=${encodeURIComponent(
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
      let clientDisconnected = false;

      // Handle client disconnect
      res.on("close", async () => {
        if (clientDisconnected) return; // Prevent duplicate handling
        clientDisconnected = true;

        console.log(`Client disconnected for session ${session_id}, saving partial message`);

        // Save partial message if we have any content
        if (completeMessage && completeMessage.trim()) {
          try {
            let payload = null;
            const answer = completeMessage;

            if (fromCustomer) {
              payload = {
                user_id: req.user?._id || req.user?.user_id,
                question: message,
                answer,
                organization: req.user.organization,
                chatSession,
                session_id,
                customer,
                incomplete: true, // Mark as incomplete
              };
            } else {
              payload = {
                user_id: req.user?._id || req.user?.user_id,
                question,
                answer,
                organization: req.user.organization,
                chatSession,
                session_id,
                incomplete: true, // Mark as incomplete
              };
            }

            const newConversation = new Conversation(payload);
            await newConversation.save();
            console.log(`Partial message saved for session ${session_id}`);
          } catch (error) {
            console.error("Error saving partial conversation:", error);
          }
        }

        // Clean up Python stream
        if (pythonResponse && pythonResponse.data) {
          pythonResponse.data.destroy();
        }
      });

      // Forward the stream from Python API to client
      pythonResponse.data.on("data", (chunk) => {
        // Stop processing if client disconnected
        if (clientDisconnected) {
          return;
        }

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
        // Don't save if client already disconnected
        if (clientDisconnected) {
          console.log(`Stream ended but client already disconnected for session ${session_id}`);
          return;
        }

        try {
          // Send end even
          let payload = null;
          answer = completeMessage;
          if (fromCustomer) {
            payload = {
              user_id: req.user?._id || req.user?.user_id,
              question: message,
              answer,
              organization: req.user.organization,
              chatSession,
              session_id,
              customer,
            };
          } else {
            payload = {
              user_id: req.user?._id || req.user?.user_id,
              question,
              answer,
              organization: req.user.organization,
              chatSession,
              session_id,
            };
          }

          console.log("payload", payload);

          const newConversation = new Conversation(payload);
          await newConversation.save();
          res.write(
            `data: ${JSON.stringify({
              done: true,
              session_id: session_id,
              id: newConversation._id,
              answer,
            })}\n\n`
          );

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
        user_id: req.user?._id || req.user?.user_id,
        question,
        answer,
        organization: req.user.organization,
        chatSession,
        session_id,
        customer,
      };
      console.log("payload", payload);

      const newConversation = new Conversation(payload);
      const savedConversation = await newConversation.save();

      res.json(savedConversation);
    }
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: err.message });
  }
};

// Custom agent chat (Active)
exports.addCustomAgentConversation = async (req, res) => {
  try {
    const { question, chatSession, agentName } = req.body;
    let session_id = req.body?.sessionId
      ? req.body?.sessionId
      : Math.floor(100000 + Math.random() * 900000);

    // Build URL for the Python API endpoint
    let url = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${encodeURIComponent(
      agentName
    )}&query=${encodeURIComponent(question)}&org_id=${req.user.organization}`;

    console.log("*** Agent Python API url**", url);
    // Add session ID if provided
    if (session_id) {
      url += `&session_id=${encodeURIComponent(session_id)}`;
    }
    console.log("**Agent conversation URI", url);
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

    console.log(`*** Python API response for agent ${agentName} `, pythonResponse);

    let completeMessage = "";
    let clientDisconnected = false;

    // Handle client disconnect
    res.on("close", async () => {
      if (clientDisconnected) return; // Prevent duplicate handling
      clientDisconnected = true;

      console.log(
        `Client disconnected for agent ${agentName} session ${session_id}, saving partial message`
      );

      // Save partial message if we have any content
      if (completeMessage && completeMessage.trim()) {
        try {
          const answer = completeMessage;
          const payload = {
            user_id: req.user?._id || req.user?.user_id,
            question,
            answer,
            organization: req.user.organization,
            chatSession,
            session_id: session_id,
            agent_name: agentName ? agentName : "Onboarding Agent",
            incomplete: true, // Mark as incomplete
          };

          const newConversation = new Conversation(payload);
          await newConversation.save();
          console.log(`Partial agent message saved for session ${session_id}`);
        } catch (error) {
          console.error("Error saving partial agent conversation:", error);
        }
      }

      // Clean up Python stream
      if (pythonResponse && pythonResponse.data) {
        pythonResponse.data.destroy();
      }
    });

    // Forward the stream from Python API to client
    pythonResponse.data.on("data", (chunk) => {
      // Stop processing if client disconnected
      if (clientDisconnected) {
        return;
      }

      const chunkStr = chunk.toString();

      // Clean up the string and try to parse JSON
      try {
        // Handle multiple SSE messages that might be in a single chunk
        const messages = chunkStr.split("\n\n").filter((m) => m.trim());
        console.log(`*** Messages for agent ${agentName} `);

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
      // Don't save if client already disconnected
      if (clientDisconnected) {
        console.log(
          `Stream ended but client already disconnected for agent ${agentName} session ${session_id}`
        );
        return;
      }

      try {
        // Send end event

        const answer = completeMessage; // Use the accumulated message

        // Create payload for saving conversation
        let payload = {
          user_id: req.user?._id || req.user?.user_id,
          question,
          answer, // Save the complete answer
          organization: req.user.organization,
          chatSession,
          session_id: session_id, // Use the potentially updated session_id
          agent_name: agentName ? agentName : "Onboarding Agent", // Track the agent used
        };
        console.log("Saving agent conversation payload:", payload);

        // Create a new conversation record
        const newConversation = new Conversation(payload);

        // Save the conversation to database
        let c = await newConversation.save();
        console.log("Agent conversation saved successfully.");
        res.write(
          `data: ${JSON.stringify({
            done: true,
            session_id: session_id,
            id: c._id,
          })}\n\n`
        );

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
    // pythonResponse.data.on('error', (err) => {
    //   console.error('Error in Python API agent stream:', err);
    //   // Attempt to send an error event if stream is still open
    //   if (!res.writableEnded) {
    //     res.write(
    //       `data: ${JSON.stringify({
    //         error: 'Error in streaming agent response',
    //       })}\n\n`
    //     );
    //     res.end();
    //   }
    // });
    pythonResponse.data.on("error", (err) => {
      console.error("Error in Python API agent stream:");

      if (err instanceof Error) {
        console.error("Message:", err.message);
        console.error("Stack:", err.stack);
      } else {
        // Fallback for non-Error objects (could be plain object, buffer, string, etc.)
        try {
          console.error("Error JSON:", JSON.stringify(err, null, 2));
        } catch (e) {
          console.error("Error (raw):", err);
        }
      }

      // Send error response to client if stream is still open
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

// Public chat
exports.addPublicConversation = async (req, res) => {
  let { org_id = null, chat_session, user_email = null } = req.query;
  try {
    const { question, user_email, customer_id } = req.body;

    if (req.externalApiCall) {
      org_id = req.organization;
    }
    let url = `${process.env.AI_AGENT_SERVER_URI}/ask/public?query=${encodeURIComponent(
      // let url = `http://localhost:7999/ask/public?query=${encodeURIComponent(
      question
    )}&user_email=${user_email}&org_id=${org_id}&customer_id=null`;

    // Append session_id to the URL if it exists
    if (chat_session) {
      url += `&session_id=${encodeURIComponent(chat_session)}`;
    } else {
      let randomSessionId = Math.floor(999 + Math.random() * 9000);
      chat_session = randomSessionId;
      url += `&session_id=${randomSessionId}`;
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
    res.status(499).json({
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
  }
};

// Get conversation by user id
exports.getConversationByUserId = async (req, res) => {
  try {
    const externalApiCall = req.externalApiCall;
    const { user_id, chatSession, startDate, endDate, customer_id, updated_date, created_date } =
      req.query;
    // Check if user_id is provided
    if (!req.user?._id && !user_id && !customer_id) {
      return res.status(400).json({
        error: "Either user_id, or customer_id is required",
      });
    }
    let searchCondition = {};
    if (user_id) {
      searchCondition = {
        user_id: user_id ? user_id : req.user?._id || req.user?.user_id,
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
  }
};

exports.getConversationByCustomerId = async (req, res) => {
  try {
    const { user_id, chatSession, startDate, endDate, customer_id } = req.query;

    // Check if user_id is provided
    if (!user_id && !customer_id) {
      return res.status(400).json({ error: "user_id or customer_id is required" });
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
        error: `Conversation not found for the provided ${customer_id ? "customer_id" : "user_id"}`,
      });
    }

    res.json(conversation);
  } catch (err) {
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
  }
};

exports.getPublicConversationByUserId = async (req, res) => {
  let { org_id = null, chat_session } = req.query;
  if (req.externalApiCall) {
    org_id = req.organization;
  }
  let payload = {
    user_id: req.public_user_id,
  };
  if (chat_session) {
    payload = { ...payload, chatSession: chat_session };
  }
  try {
    const conversation = await Conversation.find({
      ...payload,
    }).sort({ created_date: -1 });
    res.json(conversation);
  } catch (err) {
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
// Add custom agent conversation with comprehensive logging and proper timeout handling
exports.addCustomAgentConversationBackup = async (req, res) => {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Use AGENT_CONFIG values
  const { TIMEOUT_MS, CONNECTION_TIMEOUT_MS, STREAMING_TIMEOUT_MS } = AGENT_CONFIG;

  let timeoutId = null;
  let streamingTimeoutId = null;
  let isStreaming = false;
  let isCompleted = false;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (streamingTimeoutId) {
      clearTimeout(streamingTimeoutId);
      streamingTimeoutId = null;
    }
  };

  const handleTimeout = (type) => {
    const currentTime = Date.now();
    const totalTime = currentTime - startTime;

    console.error(`[${requestId}] ${type} timeout after ${totalTime}ms:`, {
      agentName: req.body?.agentName,
      timeoutType: type,
      totalTime: `${totalTime}ms`,
      isStreaming,
      isCompleted,
      timestamp: new Date().toISOString(),
    });

    cleanup();

    if (!res.writableEnded) {
      res.write(
        `data: ${JSON.stringify({
          error: `${type} timeout - request took too long`,
          timeout: true,
          timeoutType: type,
          totalTime: totalTime,
        })}\n\n`
      );
      res.end();
    }
  };

  try {
    const { question, chatSession, agentName } = req.body;
    let session_id = req.body?.sessionId
      ? req.body?.sessionId
      : Math.floor(100000 + Math.random() * 900000);

    console.log(`[${requestId}] Starting agent conversation request`, {
      agentName,
      question: question?.substring(0, 100) + (question?.length > 100 ? "..." : ""),
      chatSession,
      sessionId: session_id,
      userId: req.user?._id || req.user?.user_id,
      organization: req.user.organization,
      timeoutMs: TIMEOUT_MS,
      connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
      streamingTimeoutMs: STREAMING_TIMEOUT_MS,
      timestamp: new Date().toISOString(),
    });

    // Build URL for the Python API endpoint
    let url = `${process.env.AI_AGENT_SERVER_URI}/ask/agent?agent_name=${encodeURIComponent(
      agentName
    )}&query=${encodeURIComponent(question)}&org_id=${req.user.organization}`;

    // Add session ID if provided
    if (session_id) {
      url += `&session_id=${encodeURIComponent(session_id)}`;
    }

    console.log(`[${requestId}] Python API URL constructed:`, {
      url: url,
      agentName,
      orgId: req.user.organization,
      hasSessionId: !!session_id,
    });

    // Set proper headers for SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering for Nginx
    });

    console.log(`[${requestId}] SSE headers set, making request to Python API...`);

    // Set up main timeout
    timeoutId = setTimeout(() => {
      handleTimeout("Request");
    }, TIMEOUT_MS);

    // Make streaming request to Python API with proper timeout configuration
    const pythonResponse = await axios({
      method: "get",
      url: url,
      responseType: "stream",
      timeout: TIMEOUT_MS,
      // Add connection timeout
      httpAgent: new (require("http").Agent)({
        timeout: CONNECTION_TIMEOUT_MS,
        keepAlive: true,
        maxSockets: 10,
      }),
      httpsAgent: new (require("https").Agent)({
        timeout: CONNECTION_TIMEOUT_MS,
        keepAlive: true,
        maxSockets: 10,
      }),
      // Add additional headers for better connection handling
      headers: {
        Connection: "keep-alive",
        "Keep-Alive": "timeout=300, max=1000",
      },
    });

    const responseTime = Date.now() - startTime;
    console.log(`[${requestId}] Python API response received`, {
      status: pythonResponse.status,
      statusText: pythonResponse.statusText,
      headers: pythonResponse.headers,
      responseTime: `${responseTime}ms`,
      agentName,
      timestamp: new Date().toISOString(),
    });

    let completeMessage = "";
    let chunkCount = 0;
    let dataChunkCount = 0;
    let errorChunkCount = 0;
    const streamStartTime = Date.now();

    // Set up streaming timeout
    streamingTimeoutId = setTimeout(() => {
      handleTimeout("Streaming");
    }, STREAMING_TIMEOUT_MS);

    // Forward the stream from Python API to client
    pythonResponse.data.on("data", (chunk) => {
      // Reset streaming timeout on each data chunk
      if (streamingTimeoutId) {
        clearTimeout(streamingTimeoutId);
        streamingTimeoutId = setTimeout(() => {
          handleTimeout("Streaming");
        }, STREAMING_TIMEOUT_MS);
      }

      isStreaming = true;
      chunkCount++;
      const chunkStr = chunk.toString();
      const chunkSize = chunk.length;

      console.log(`[${requestId}] Received data chunk #${chunkCount}`, {
        chunkSize,
        agentName,
        chunkPreview: chunkStr.substring(0, 200) + (chunkStr.length > 200 ? "..." : ""),
        timestamp: new Date().toISOString(),
      });

      // Clean up the string and try to parse JSON
      try {
        // Handle multiple SSE messages that might be in a single chunk
        const messages = chunkStr.split("\n\n").filter((m) => m.trim());

        console.log(
          `[${requestId}] Processing ${messages.length} messages from chunk #${chunkCount}`,
          {
            agentName,
            messageCount: messages.length,
            messages: messages.map(
              (msg) => msg.substring(0, 100) + (msg.length > 100 ? "..." : "")
            ),
          }
        );

        for (const msgText of messages) {
          if (msgText.startsWith("data: ")) {
            try {
              const data = JSON.parse(msgText.replace("data: ", ""));
              dataChunkCount++;

              console.log(`[${requestId}] Parsed data message #${dataChunkCount}`, {
                agentName,
                hasSessionId: !!data.session_id,
                hasMessage: !!data.message,
                messageLength: data.message?.length || 0,
                dataKeys: Object.keys(data),
                timestamp: new Date().toISOString(),
              });

              // Extract session_id if it exists in the response
              if (data.session_id && !session_id) {
                session_id = data.session_id;
                console.log(`[${requestId}] Updated session_id from response:`, {
                  newSessionId: session_id,
                  agentName,
                });
              }

              // Add content to the complete message
              if (data.message) {
                completeMessage += data.message;
                console.log(`[${requestId}] Accumulated message length:`, {
                  currentLength: completeMessage.length,
                  newChunkLength: data.message.length,
                  agentName,
                });
              }

              // Ensure proper SSE format with data: prefix and double newline
              res.write(`data: ${JSON.stringify(data)}\n\n`);

              console.log(`[${requestId}] Forwarded data to client`, {
                agentName,
                dataSize: JSON.stringify(data).length,
              });
            } catch (e) {
              errorChunkCount++;
              console.error(
                `[${requestId}] Error parsing individual message #${errorChunkCount}:`,
                {
                  error: e.message,
                  agentName,
                  msgText: msgText.substring(0, 200) + (msgText.length > 200 ? "..." : ""),
                  timestamp: new Date().toISOString(),
                }
              );

              // If parsing individual message fails, send as is
              res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
            }
          } else if (msgText.trim()) {
            console.log(`[${requestId}] Processing non-data message:`, {
              agentName,
              msgText: msgText.substring(0, 100) + (msgText.length > 100 ? "..." : ""),
              timestamp: new Date().toISOString(),
            });

            // For non-data prefixed lines, add the prefix
            res.write(`data: ${JSON.stringify({ chunk: msgText })}\n\n`);
          }
        }
      } catch (e) {
        errorChunkCount++;
        console.error(`[${requestId}] Error processing chunk #${chunkCount}:`, {
          error: e.message,
          agentName,
          chunkStr: chunkStr.substring(0, 200) + (chunkStr.length > 200 ? "..." : ""),
          timestamp: new Date().toISOString(),
        });

        // If overall parsing fails, send raw chunk
        res.write(`data: ${JSON.stringify({ chunk: chunkStr })}\n\n`);
      }
    });

    // When the stream ends, update the conversation with the complete answer
    pythonResponse.data.on("end", async () => {
      const streamEndTime = Date.now();
      const totalStreamTime = streamEndTime - streamStartTime;
      const totalRequestTime = streamEndTime - startTime;

      console.log(`[${requestId}] Python API stream ended`, {
        agentName,
        totalChunks: chunkCount,
        dataChunks: dataChunkCount,
        errorChunks: errorChunkCount,
        completeMessageLength: completeMessage.length,
        streamTime: `${totalStreamTime}ms`,
        totalRequestTime: `${totalRequestTime}ms`,
        timestamp: new Date().toISOString(),
      });

      try {
        isCompleted = true;
        cleanup(); // Clear all timeouts

        const answer = completeMessage; // Use the accumulated message

        console.log(`[${requestId}] Final answer received:`, {
          agentName,
          answerLength: answer.length,
          answerPreview: answer.substring(0, 200) + (answer.length > 200 ? "..." : ""),
          timestamp: new Date().toISOString(),
        });

        // Create payload for saving conversation
        let payload = {
          user_id: req.user?._id || req.user?.user_id,
          question,
          answer, // Save the complete answer
          organization: req.user.organization,
          chatSession,
          session_id: session_id, // Use the potentially updated session_id
          agent_name: agentName ? agentName : "Onboarding Agent", // Track the agent used
        };

        console.log(`[${requestId}] Saving conversation to database:`, {
          agentName,
          payload: {
            ...payload,
            question:
              payload.question?.substring(0, 100) + (payload.question?.length > 100 ? "..." : ""),
            answer: payload.answer?.substring(0, 100) + (payload.answer?.length > 100 ? "..." : ""),
          },
          timestamp: new Date().toISOString(),
        });

        // Create a new conversation record
        const newConversation = new Conversation(payload);

        // Save the conversation to database
        const dbStartTime = Date.now();
        let c = await newConversation.save();
        const dbEndTime = Date.now();

        console.log(`[${requestId}] Agent conversation saved successfully`, {
          agentName,
          conversationId: c._id,
          dbSaveTime: `${dbEndTime - dbStartTime}ms`,
          totalRequestTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString(),
        });

        res.write(
          `data: ${JSON.stringify({
            done: true,
            session_id: session_id,
            id: c._id,
          })}\n\n`
        );

        console.log(`[${requestId}] Final response sent to client`, {
          agentName,
          conversationId: c._id,
          sessionId: session_id,
          timestamp: new Date().toISOString(),
        });

        res.end(); // End the response stream
      } catch (error) {
        console.error(`[${requestId}] Error saving agent conversation:`, {
          error: error.message,
          stack: error.stack,
          agentName,
          completeMessageLength: completeMessage.length,
          timestamp: new Date().toISOString(),
        });

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
      const errorTime = Date.now();
      const totalRequestTime = errorTime - startTime;

      console.error(`[${requestId}] Error in Python API agent stream:`, {
        error: err.message,
        errorCode: err.code,
        errorStack: err.stack,
        agentName,
        totalRequestTime: `${totalRequestTime}ms`,
        chunkCount,
        dataChunkCount,
        errorChunkCount,
        completeMessageLength: completeMessage.length,
        timestamp: new Date().toISOString(),
      });

      cleanup(); // Clear timeouts on error

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
    const errorTime = Date.now();
    const totalRequestTime = errorTime - startTime;

    console.error(`[${requestId}] Error handling agent conversation:`, {
      error: err.message,
      errorCode: err.code,
      errorStack: err.stack,
      agentName: req.body?.agentName,
      totalRequestTime: `${totalRequestTime}ms`,
      timestamp: new Date().toISOString(),
    });

    cleanup(); // Clear timeouts on error

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
exports.getWholeOrgConvo = async (req, res) => {
  const { startDate, endDate, customer_id } = req.query;

  let searchCondition = {};
  const customerId = customer_id === "null" || customer_id === "undefined" ? null : customer_id;

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
