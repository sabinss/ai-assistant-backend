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
    // upsert the user
    //create a session
    // create access and refresh tokens
    // set cookies
    //redirect back to client
  } catch (err) {
    return res.redirect('http://localhost:3000/mainapp/organization');
  }
}

module.exports = {googleOauthHandler};
