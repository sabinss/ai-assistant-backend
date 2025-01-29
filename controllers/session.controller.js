const User = require('../models/User');
const GoogleUser = require('../models/GoogleUser');
const {getGoogleAuthTokens, getGoogleUser} = require('../service/userService');
const jwt = require('jsonwebtoken');

async function googleOauthHandler(req, res) {
  try {
    // get the code from qs
    const code = req.query.code;
    // get id and access token with code
    const {id_token, access_token} = await getGoogleAuthTokens({code});
    console.log({id_token, access_token});
    // get user with tokens
    // const googleUser = jwt.decode(id_token);

    const googleUser = await getGoogleUser({id_token, access_token});
    console.log('googleUser', googleUser);
    if (!googleUser || !googleUser.email) {
      console.log('Failed to retrieve google user details');
    }
    // upsert the user
    const existingUser = await User.findOne({
      email: googleUser.email,
    });

    // Update or link the logged-in user with their Google account
    const newGoogleUser = await GoogleUser.findOneAndUpdate(
      {email: googleUser.email},
      {
        googleId: googleUser.id,
        isGoogleUser: true,
        user: existingUser ? existingUser.id : null,
      },
      {new: true, upsert: true}
    );
    console.log('newGoogleUser', newGoogleUser);
    //redirect back to client
    res.redirect(process.env.CLIENT_URI);
  } catch (err) {
    console.log('Error', err);
    res.redirect(process.env.CLIENT_URI);
  }
}

module.exports = {googleOauthHandler};
