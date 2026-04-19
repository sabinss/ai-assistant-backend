const axios = require("axios");
const qs = require("qs");

async function getGoogleAuthTokens({ code }) {
  const url = "https://oauth2.googleapis.com/token";
  const values = {
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: process.env.GOOGLE_REDIRECT_URL,
    grant_type: "authorization_code",
  };
  console.log("getGoogleAuthTokens called----", values);
  try {
    const res = await axios.post(url, qs.stringify(values), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    console.log("url response->", res.data);
    return res.data;
  } catch (err) {
    console.error(err.response.data.error);
    console.log("Failed to fetch google oauth token", err);
  }
}

async function getGoogleUser({ id_token, access_token }) {
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
    console.log("Error fetching google user", err);
  }
}

async function getMicrosoftAuthTokens({ code }) {
  const url = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const values = {
    code,
    client_id: process.env.MICROSOFT_CLIENT_ID,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URL,
    grant_type: "authorization_code",
  };
  try {
    const res = await axios.post(url, qs.stringify(values), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return res.data;
  } catch (err) {
    console.error("Failed to fetch Microsoft oauth token", err.response?.data || err.message);
  }
}

async function getMicrosoftUser({ access_token }) {
  try {
    const res = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    const data = res.data;
    return {
      id: data.id,
      email: data.mail || data.userPrincipalName,
    };
  } catch (err) {
    console.log("Error fetching Microsoft user", err.response?.data || err.message);
  }
}

module.exports = {
  getGoogleAuthTokens,
  getGoogleUser,
  getMicrosoftAuthTokens,
  getMicrosoftUser,
};
