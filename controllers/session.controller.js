const User = require('../models/User');
const GoogleUser = require('../models/GoogleUser');
const {
  getGoogleAuthTokens,
  getGoogleUser,
} = require('../service/userService');
const jwt = require('jsonwebtoken');

async function googleOauthHandler(req, res) {
  try {
    // get the code from qs
    const code = req.query.code;
    const state = req.query.state;
    console.log('State received', state);
    // Parse the 'state' to retrieve orgId
    let orgId = null;
    if (state) {
      try {
        const parsedState = JSON.parse(state); // Assuming state is a JSON string
        console.log('parsed satte', parsedState);
        orgId = parsedState.orgId; // Extract orgId from the state
      } catch (err) {
        console.log('Error parsing state:', err);
        return res.redirect(process.env.CLIENT_URI + '?oauth-completed=true');
      }
    }

    // get id and access token with code
    const emailCredential = await getGoogleAuthTokens({
      code,
    });

    const googleUser = await getGoogleUser({
      id_token: emailCredential.id_token,
      access_token: emailCredential.access_token,
    });
    console.log('googleUser', googleUser);
    if (!googleUser || !googleUser.email) {
      console.log('Failed to retrieve google user details');
    }
    // upsert the user
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
    console.log('Google user payload', googleUserPayload);
    const newGoogleUser = await GoogleUser.findOneAndUpdate(
      { email: googleUser.email },
      googleUserPayload,
      { new: true, upsert: true }
    );
    console.log('newGoogleUser', newGoogleUser);
    //redirect back to client
    res.redirect(process.env.CLIENT_URI);
  } catch (err) {
    console.log('Error', err);
    res.redirect(process.env.CLIENT_URI + '?oauth-completed=true');
  }
}

module.exports = { googleOauthHandler };
