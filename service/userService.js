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

async function getMicrosoftAuthTokens({ code, code_verifier }) {
  const url = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
  const rawMicrosoftSecret = process.env.MICROSOFT_CLIENT_SECRET || "";
  const microsoftSecretPreview =
    rawMicrosoftSecret.length > 6
      ? `${rawMicrosoftSecret.slice(0, 3)}${"*".repeat(rawMicrosoftSecret.length - 6)}${rawMicrosoftSecret.slice(-3)}`
      : rawMicrosoftSecret;
  console.log("[Microsoft token debug]", {
    client_id: process.env.MICROSOFT_CLIENT_ID || "",
    has_client_secret: Boolean(rawMicrosoftSecret),
    client_secret_length: rawMicrosoftSecret.length,
    client_secret_preview: microsoftSecretPreview,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URL || "",
    has_code_verifier: Boolean(code_verifier),
  });

  const values = {
    code,
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: process.env.MICROSOFT_REDIRECT_URL,
    grant_type: "authorization_code",
  };
  const headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // When the code came from the browser authorize request (PKCE), include code_verifier.
  // For Web/confidential app registrations, Azure can still require client_secret.
  // Include Origin header so Azure AD accepts cross-origin style redemption.
  if (code_verifier) {
    values.code_verifier = code_verifier;
    let redirectOrigin = null;
    if (process.env.MICROSOFT_REDIRECT_URL) {
      try {
        redirectOrigin = new URL(process.env.MICROSOFT_REDIRECT_URL).origin;
      } catch (e) {
        redirectOrigin = null;
      }
    }
    if (redirectOrigin) {
      headers.Origin = redirectOrigin;
    }
  }

  // For confidential web-client flows, include client_secret regardless of PKCE usage.
  if (process.env.MICROSOFT_CLIENT_SECRET) {
    values.client_secret = process.env.MICROSOFT_CLIENT_SECRET;
  }
  try {
    const res = await axios.post(url, qs.stringify(values), { headers });
    return res.data;
  } catch (err) {
    const ms = err.response?.data;
    console.error(
      "[Microsoft token] Request failed:",
      ms ? JSON.stringify(ms, null, 2) : err.message
    );
    throw err;
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
