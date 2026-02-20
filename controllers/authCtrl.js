const User = require("../models/User");
const Organization = require("../models/Organization");
const Role = require("../models/Role");
const Status = require("../models/Status");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const ResetToken = require("../models/ResetToken");
const ConfirmToken = require("../models/ConfirmToken");
const rolePermission = require("../helper/rolePermission");
const GoogleUser = require("../models/GoogleUser");
const axios = require("axios");
const { getGoogleAuthTokens, getGoogleUser } = require("../service/userService");
const AgentModel = require("../models/AgentModel");
const AgentTask = require("../models/AgentTask");
const INDIVIDUAL_USER_DEFAULT_AGENT = require("../constants/individual-user-default-agent");
const mongoose = require("mongoose");

exports.verifyOrganization = async (req, res) => {
  try {
    const { organizationId } = req.body;
    const organization = await Organization.findById(organizationId);
    if (organization) {
      return res.status(200).json({
        message: "Organization found",
        isAuthenticated: true,
      });
    }
    return res.status(404).json({ message: "Organization not found", isAuthenticated: false });
  } catch (err) {
    return res.status(404).json({
      message: "Organization not found",
      isAuthenticated: false,
      error: err,
    });
  }
};
exports.signup = async (req, res) => {
  const { first_name, last_name, email, organization_name, ai_assistant_name, password } = req.body;

  // Validate required fields before processing
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  if (!organization_name) {
    return res.status(400).json({ message: "Organization name is required" });
  }

  try {
    const isUserExist = await User.findOne({ email });
    if (isUserExist) {
      return res.status(400).json({ message: "User already exist" });
    }
    const existingOrg = await Organization.findOne({ name: organization_name });
    if (existingOrg) {
      return res.status(409).json({ message: "Organization name already taken." });
    }

    const newOrg = new Organization({
      name: organization_name,
      assistant_name: ai_assistant_name || "",
    });
    await newOrg.save();

    const role = await Role.findOne({ name: "admin" });
    const status = await Status.findOne({ name: "active" });
    const role_id = role ? role._id : null;
    const status_id = status ? status._id : null;

    const hashed_password = bcrypt.hashSync(password, 10);

    const newUser = new User({
      organization: newOrg._id,
      email,
      first_name: first_name || "",
      last_name: last_name || "",
      password: hashed_password,
      role: role_id,
      status: status_id,
    });

    await newUser.save();
    return res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
const revokeGoogleToken = async (refreshToken) => {
  try {
    await axios.post(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`,
      {},
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    console.log("Token revoked");
    return true;
  } catch (err) {
    console.error("Failed to revoke token:", err.response?.data || err.message);
    return false;
  }
};

exports.googleOauthCodeExchange = async (req, res) => {
  try {
    const { code, orgId } = req.body;
    console.log(code, orgId);
    const emailCredential = await getGoogleAuthTokens({
      code,
    });
    const googleUser = await getGoogleUser({
      id_token: emailCredential.id_token,
      access_token: emailCredential.access_token,
    });
    console.log("googleUser", googleUser);
    if (!googleUser || !googleUser.email) {
      console.log("Failed to retrieve google user details");
    }
    const existingUser = await User.findOne({
      email: googleUser.email,
    });

    // Update or link the logged-in user with their Google account
    let googleUserPayload = {
      googleId: googleUser.id,
      isGoogleUser: true,
      user: existingUser ? existingUser.id : null,
      emailCredential,
      isActive: true,
    };
    if (orgId) {
      googleUserPayload.organization = orgId;
    }
    console.log("Google user payload", googleUserPayload);
    const newGoogleUser = await GoogleUser.findOneAndUpdate(
      { email: googleUser.email },
      googleUserPayload,
      { new: true, upsert: true }
    );
    console.log("newGoogleUser", newGoogleUser);
    //redirect back to client
    // res.redirect(process.env.CLIENT_URI);
    res.status(200).json({
      success: true,
      message: "Google oauth success",
    });
  } catch (err) {}
};

exports.disconnectOrgGoogleUser = async (req, res) => {
  try {
    const organization = req.user?.organization;
    if (!organization) {
      res.status(500).json({ message: "Organization is required", err });
    }

    const googleUserRecord = await GoogleUser.findOne({
      organization: organization,
    });

    const refreshToken = googleUserRecord.emailCredential.access_token;
    console.log("refresh token", googleUserRecord.emailCredential.access_token);
    refreshToken && (await revokeGoogleToken(googleUserRecord.emailCredential.access_token));
    await GoogleUser.deleteOne({ organization: organization });
    return res.status(200).json({
      message: "Disconnected google user successfully",
      success: true,
    });
  } catch (err) {
    res.status(500).json({ message: "Internal server error", err });
  }
};

exports.verifyGoogleLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const googleLoginUser = await GoogleUser.findOne({
      // email: email,
      organization: req.user.organization,
      isActive: true,
    }).lean();
    // .sort({ createdAt: -1 }) // newest first
    // .limit(1); // get only one
    if (googleLoginUser) {
      return res.status(200).json({
        message: "User successfully logged in as google user",
        success: true,
        data: googleLoginUser,
      });
    } else {
      return res.status(200).json({
        message: "Google user not found",
        success: false,
        googleEmail: null,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.signin = async (req, res) => {
  // await this.sendEmailTest('sabinshrestha292@gmail.com', '123456');
  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ message: "Please fill all details" });
  if (password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters long" });

  try {
    const user = await User.findOne({ email: email });
    if (!user) return res.status(404).json({ message: "Email not found" });
    if (!user.isVerified)
      return res.status(200).json({ message: "User is not verified", isVerified: user.isVerified });

    const role = (await Role.findById(user.role)) || { name: "user" };
    const isValidUser = await bcrypt.compare(password, user.password);
    if (!isValidUser) return res.status(401).json({ message: "Invalid password" });

    const userDetails = {
      user_id: user._id,
      email: user.email,
      organization: user.organization,
      role: user.role,
      status: user.status,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const accessToken = jwt.sign(userDetails, process.env.JWT_SECRET, {
      expiresIn: "365d",
    });

    return res.status(200).json({
      access_token: accessToken,
      message: "User logged in successfully",
      user_details: userDetails,
      rolePermission: rolePermission[role.name],
      chatSession: user.chatSession,
      role: role.name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.changePassword = async (req, res) => {
  const { user_id, new_password, current_password } = req.body;

  try {
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(current_password, user.password);
    if (!isPasswordCorrect) return res.status(401).json({ message: "Incorrect current password" });

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "Email not found" });

    // Check if a reset token already exists for the user
    let resetTokenData = await ResetToken.findOne({ userRef: user._id });

    // Generate a new reset token if no token exists, otherwise update the existing one
    const resetToken = Math.floor(Math.random() * 1000000 + 1);
    if (!resetTokenData) {
      resetTokenData = new ResetToken({
        userRef: user._id,
        resetToken,
      });
    } else {
      resetTokenData.resetToken = resetToken;
    }

    // Save or update the reset token data
    await resetTokenData.save();

    // Send email with the reset token
    await sendEmail(email, resetToken, true);
    res.status(200).json({
      message: "The reset password link has been sent to your email.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const sendEmail = async (email, token, isReset = true) => {
  console.log(process.env.MAIL_API_EMAIL, process.env.MAIL_API_PASSWORD);
  const transporter = nodemailer.createTransport({
    // service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_API_EMAIL,
      pass: process.env.MAIL_API_PASSWORD,
    },
  });

  const mailOptions = {
    // from: 'theagilemove@gmail.com',,
    from: process.env.MAIL_API_EMAIL,
    to: email,
    subject: isReset ? "Reset Password" : "Email Confirmation",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isReset ? "Password Reset" : "Email Confirmation"}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            color: #333;
            padding: 20px;
          }
          .container {
            background-color: #fff;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
          }
          h1 {
            color: #2c3e50;
            text-align: center;
          }
          p {
            line-height: 1.6;
          }
          .token {
            background-color: #f1c40f;
            color: #2c3e50;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${isReset ? "Reset Password" : "Email Confirmation"}</h1>
          <p>Dear User,</p>
          <p> ${
            isReset
              ? " You have requested to reset your password Please use the following token to proceed:"
              : "Thank you for singing up for CoWrkr! To complete your registration, please use the following token ."
          }. </p>
          <div class="token">${token}</div>
          <p>Note: This token is only valid for 5 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br>CoWrkr Team <br< Agilemove Inc.</p>

        </div>
      </body>
      </html>
    `,
  };
  console.log("mailOptions", mailOptions);
  try {
    const mailResponse = await transporter.sendMail(mailOptions);
    console.log("mailResponse", mailResponse);
  } catch (err) {
    console.log("Send Email error", err);
  }
};

exports.sendEmailTest = async (email, token, isReset = true) => {
  const transporter = nodemailer.createTransport({
    // service: "gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_API_EMAIL,
      pass: process.env.MAIL_API_PASSWORD,
    },
  });

  const emailId = Math.floor(1000 + Math.random() * 9000);

  const mailOptions = {
    // from: 'theagilemove@gmail.com',,
    from: process.env.MAIL_API_EMAIL,
    to: "sabinshrestha292@gmail.com",
    subject: "Test Email for CoWrkr",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isReset ? "Password Reset" : "Email Confirmation"}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            color: #333;
            padding: 20px;
          }
          .container {
            background-color: #fff;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
          }
          h1 {
            color: #2c3e50;
            text-align: center;
          }
          p {
            line-height: 1.6;
          }
          .token {
            background-color: #f1c40f;
            color: #2c3e50;
            padding: 10px;
            border-radius: 5px;
            font-weight: bold;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${isReset ? "Reset Password" : "Email Confirmation"}</h1>
          <p>Dear User,</p>
          <p> ${
            isReset
              ? " You have requested to reset your password Please use the following token to proceed:"
              : "Thank you for singing up for CoWrkr! To complete your registration, please use the following token ."
          }. </p>
          <div class="token">${token}</div>
          <p>Note: This token is only valid for 5 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br>CoWrkr Team <br< Agilemove Inc.</p>
<p>
   <a href="http://localhost:3000/mainapp/chat?query=good morning&emailId=${emailId}"
   style="display:inline-block; padding:10px 20px; background-color:#007bff; color:#fff; text-decoration:none; border-radius:5px;">
  Open Chat
</a>

  </p>
        </div>
      </body>
      </html>
    `,
  };
  console.log("mailOptions", mailOptions);
  try {
    const mailResponse = await transporter.sendMail(mailOptions);
    console.log("mailResponse", mailResponse);
  } catch (err) {
    console.log("Send Email error", err);
  }
};

exports.verifyPasswordResetToken = async (req, res) => {
  const { token, email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const tokenInDb = await ResetToken.findOne({ resetToken: token });
    if (!tokenInDb) return res.status(400).json({ message: "Invalid token" });

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await ResetToken.findOneAndDelete({ resetToken: token });
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendConfirmEmailToken = async (req, res) => {
  try {
    const {
      email,
      first_name,
      last_name,
      organization_name,
      ai_assistant_name,
      password,
      account_type = null,
    } = req.body;

    // Check if user already exists
    const isUserExist = await User.findOne({ email });
    const isUserVerified = isUserExist ? isUserExist.isVerified : false;

    // If user exists and is verified, return error
    if (isUserExist && isUserVerified) {
      return res.status(400).json({ message: "User already exists and is verified" });
    }

    const token = Math.floor(Math.random() * 100000 + 1);
    const confirmTokenData = new ConfirmToken({
      email: email,
      token,
    });

    await confirmTokenData.save();

    // Create organization if provided
    let organizationId = null;
    if (organization_name) {
      const existingOrg = await Organization.findOne({
        name: organization_name,
      });
      if (existingOrg) {
        return res.status(409).json({ message: "Organization name already taken." });
      }

      const newOrg = new Organization({
        name: organization_name,
        assistant_name: ai_assistant_name,
        ...(account_type === "individual"
          ? { redshit_work_space: "default", redshift_db: "default", database_name: "default" }
          : {}),
      });
      await newOrg.save();
      organizationId = newOrg._id;
    }

    // Get role and status
    let role = null;
    if (account_type === "individual") {
      role = await Role.findOne({ name: "individual" });
    } else {
      role = await Role.findOne({ name: "user" });
    }
    const status = await Status.findOne({ name: "active" });
    const role_id = role ? role._id : null;
    const status_id = status ? status._id : null;

    // Create or update user with isVerified: false
    const hashed_password = password ? bcrypt.hashSync(password, 10) : null;

    // If user exists but is not verified, update the user
    if (isUserExist && !isUserVerified) {
      isUserExist.first_name = first_name || isUserExist.first_name;
      isUserExist.last_name = last_name || isUserExist.last_name;
      if (password) {
        isUserExist.password = hashed_password;
      }
      if (organizationId) {
        isUserExist.organization = organizationId;
      }
      isUserExist.role = role_id;
      isUserExist.status = status_id;
      isUserExist.isVerified = false;
      await isUserExist.save();
      console.log("User updated successfully with isVerified: false");
    } else {
      // Create new user
      const newUser = new User({
        organization: organizationId,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        password: hashed_password,
        role: role_id,
        status: status_id,
        isVerified: false,
      });

      await newUser.save();
      console.log("User created successfully with isVerified: false");
    }

    console.log("Sending Email");
    await sendEmail(email, token, false);
    res.status(200).json({ message: "Verification code has been sent to your email." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createDefaultAgentForIndividualUser = async (user) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if user is an individual user
    const role = await Role.findById(user.role);
    if (!role || role.name !== "individual") {
      await session.abortTransaction();
      session.endSession();
      return; // Not an individual user, skip
    }

    // Ensure user has an organization (create one if they don't)
    let organizationId = user.organization;
    if (!organizationId) {
      await session.abortTransaction();
      session.endSession();
      return;
    }

    // Create agent from INDIVIDUAL_USER_DEFAULT_AGENT
    // Exclude agentInstructions and tasks as they will be handled separately
    const { agentInstructions, tasks, ...agentData } = INDIVIDUAL_USER_DEFAULT_AGENT;
    const agent = new AgentModel({
      ...agentData,
      organization: organizationId,
      agentInstructions: [], // Will be populated after tasks are created
    });

    await agent.save({ session });

    // Create tasks if they exist
    let agentTaskIds = [];
    if (tasks && tasks.length > 0) {
      // Filter out tasks with "N/A" values
      const validTasks = tasks.filter(
        (task) => task.name !== "N/A" && task.instruction !== "N/A" && task.tools !== "N/A"
      );

      if (validTasks.length > 0) {
        const newAgentTasks = await AgentTask.insertMany(
          validTasks.map((task) => ({
            agent: agent._id,
            name: task.name,
            tools: task.tools,
            instruction: task.instruction,
          })),
          { session }
        );
        agentTaskIds = newAgentTasks.map((task) => task._id);
      }
    }

    // Update agent with task references
    agent.agentInstructions = agentTaskIds;
    await agent.save({ session });

    await session.commitTransaction();
    session.endSession();

    console.log(`Default agent and tasks created for individual user: ${user.email}`);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error creating default agent for individual user:", error);
    throw error;
  }
};

exports.verifyEmail = async (req, res) => {
  const { token, email } = req.body;

  try {
    const tokenInDb = await ConfirmToken.findOne({ email, token });
    if (!tokenInDb) return res.status(400).json({ message: "Invalid token" });

    await ConfirmToken.findOneAndDelete({ email, token });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });
    user.isVerified = true;
    await user.save();

    // Create default agent and tasks for individual users
    try {
      await createDefaultAgentForIndividualUser(user);
    } catch (error) {
      console.error("Failed to create default agent for individual user:", error);
      // Don't fail the verification if agent creation fails
    }

    res.status(200).json({ message: "Email confirmed successfully", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
