const User = require('../models/User');
const Organization = require('../models/Organization');
const Role = require('../models/Role');
const Status = require('../models/Status');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const ResetToken = require('../models/ResetToken');
const ConfirmToken = require('../models/ConfirmToken');
const rolePermission = require('../helper/rolePermission');
const GoogleUser = require('../models/GoogleUser');

exports.signup = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    organization_name,
    ai_assistant_name,
    password,
  } = req.body;

  try {
    const existingOrg = await Organization.findOne({ name: organization_name });
    if (existingOrg)
      return res
        .status(409)
        .json({ message: 'Organization name already taken.' });

    const newOrg = new Organization({
      name: organization_name,
      assistant_name: ai_assistant_name,
    });

    await newOrg.save();

    const role = await Role.findOne({ name: 'admin' });
    const status = await Status.findOne({ name: 'active' });
    const role_id = role ? role._id : null;
    const status_id = status ? status._id : null;

    const existingUser = await User.findOne({ email: email });
    if (existingUser)
      return res.status(409).json({ message: 'Email is already in use' });

    const hashed_password = bcrypt.hashSync(password, 10);

    const newUser = new User({
      organization: newOrg._id,
      email,
      first_name,
      last_name,
      password: hashed_password,
      role: role_id,
      status: status_id,
    });

    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.verifyGoogleLogin = async (req, res) => {
  try {
    const { email } = req.body;
    const googleLoginUser = await GoogleUser.findOne({
      email: email,
    });
    if (googleLoginUser) {
      return res.status(200).json({
        message: 'User successfully logged in as google user',
        success: true,
        googleEmail: googleLoginUser.googleEmail,
      });
    } else {
      return res.status(200).json({
        message: 'Google user not found',
        success: false,
        googleEmail: null,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.signin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Please fill all details' });
  if (password.length < 6)
    return res
      .status(400)
      .json({ message: 'Password must be at least 6 characters long' });

  try {
    const user = await User.findOne({ email: email });
    if (!user) return res.status(404).json({ message: 'Email not found' });

    const role = (await Role.findById(user.role)) || { name: 'user' };
    const isValidUser = await bcrypt.compare(password, user.password);
    if (!isValidUser)
      return res.status(401).json({ message: 'Invalid password' });

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
      expiresIn: '365d',
    });

    res.status(200).json({
      access_token: accessToken,
      message: 'User logged in successfully',
      user_details: userDetails,
      rolePermission: rolePermission[role.name],
      chatSession: user.chatSession,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.changePassword = async (req, res) => {
  const { user_id, new_password, current_password } = req.body;

  try {
    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isPasswordCorrect = await bcrypt.compare(
      current_password,
      user.password
    );
    if (!isPasswordCorrect)
      return res.status(401).json({ message: 'Incorrect current password' });

    const hashedPassword = bcrypt.hashSync(new_password, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Find the user by email
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Email not found' });

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
      message: 'The reset password link has been sent to your email.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const sendEmail = async (email, token, isReset = true) => {
  console.log(process.env.MAIL_API_EMAIL, process.env.MAIL_API_PASSWORD);
  const transporter = nodemailer.createTransport({
    // service: "gmail",
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_API_EMAIL,
      pass: process.env.MAIL_API_PASSWORD,
    },
  });

  const mailOptions = {
    from: 'theagilemove@gmail.com',
    // from: process.env.MAIL_API_EMAIL,
    to: email,
    subject: isReset ? 'Reset Password' : 'Email Confirmation',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${isReset ? 'Password Reset' : 'Email Confirmation'}</title>
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
          <h1>${isReset ? 'Reset Password' : 'Email Confirmation'}</h1>
          <p>Dear User,</p>
          <p> ${
            isReset
              ? ' You have requested to reset your password Please use the following token to proceed:'
              : 'Thank you for singing up for Instwise! To complete your registration, please use the following token .'
          }. </p>
          <div class="token">${token}</div>
          <p>Note: This token is only valid for 5 minutes.</p>
          <p>If you did not request this, please ignore this email.</p>
          <p>Best regards,<br>Instwise Team <br< Agilemove Inc.</p>

        </div>
      </body>
      </html>
    `,
  };
  console.log('mailOptions', mailOptions);
  const mailResponse = await transporter.sendMail(mailOptions);
  console.log('mailResponse', mailResponse);
};

exports.verifyPasswordResetToken = async (req, res) => {
  const { token, email, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const tokenInDb = await ResetToken.findOne({ resetToken: token });
    if (!tokenInDb) return res.status(400).json({ message: 'Invalid token' });

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await ResetToken.findOneAndDelete({ resetToken: token });
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.sendConfirmEmailToken = async (req, res) => {
  const { email } = req.body;
  console.log('sendConfirmEmailToken called');
  try {
    const token = Math.floor(Math.random() * 100000 + 1);
    const confirmTokenData = new ConfirmToken({
      email,
      token,
    });

    await confirmTokenData.save();
    console.log('Sending Email');
    await sendEmail(email, token, false);
    res
      .status(200)
      .json({ message: 'Verification code has been sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.verifyEmail = async (req, res) => {
  const { token, email } = req.body;

  try {
    const tokenInDb = await ConfirmToken.findOne({ email, token });
    if (!tokenInDb) return res.status(400).json({ message: 'Invalid token' });

    await ConfirmToken.findOneAndDelete({ email, token });
    res.status(200).json({ message: 'Email confirmed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
