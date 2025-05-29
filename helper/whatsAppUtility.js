const axios = require('axios');
async function regenerateToken() {
  const res = await axios.get(
    'https://graph.facebook.com/v19.0/oauth/access_token',
    {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: process.env.FB_APP_ID,
        client_secret: process.env.FB_APP_SECRET,
        fb_exchange_token: process.env.FB_EXPIRED_TOKEN,
      },
    }
  );

  return res.data.access_token;
}
