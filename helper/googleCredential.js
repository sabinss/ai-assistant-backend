/**
 * Builds orgGoogleCredential in the shape expected by the Python service
 * (Pydantic OrgGoogleCredential: client_id, project_id, auth_uri, token_uri,
 * auth_provider_x509_cert_url, client_secret) plus token fields (access_token, refresh_token, etc.)
 */
function buildOrgGoogleCredential(tokenResponse) {
  if (!tokenResponse || typeof tokenResponse !== "object") {
    return {};
  }
  return {
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    project_id: process.env.GOOGLE_PROJECT_ID || "",
    auth_uri: "https://accounts.google.com/o/oauth2/v2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    ...tokenResponse, // access_token, refresh_token, scope, token_type, expiry_date, id_token, etc.
  };
}

module.exports = { buildOrgGoogleCredential };
