const axios = require('axios');
const qs = require('qs');

async function getGoogleAuthTokens({code}) {
  const url = 'https://oauth2.googleapis.com/token';
  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URL,
    grant_type: 'authorization_code',
  };
  console.log('values', values);
  try {
    const res = await axios.post(url, qs.stringify(values), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return res.data;
  } catch (err) {
    console.error(err.response.data.error);
    console.log('Failed to fetch google oauth token', err);
  }
}

async function getGoogleUser({id_token, access_token}) {
  try {
    const res = await axios.get(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      }
    );
    return res.data;
  } catch (err) {
    console.log('Error fetching google user', err);
  }
}

module.exports = {getGoogleAuthTokens, getGoogleUser};
