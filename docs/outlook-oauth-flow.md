# Microsoft Outlook OAuth (main app)

This documents the **frontend callback + backend code exchange** flow used by the Next.js app for connecting an organization’s mailbox via Microsoft identity (Outlook / Microsoft 365 Graph), parallel to the Gmail flow described in [google-oauth-flow.md](./google-oauth-flow.md).

## Sequence

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Microsoft
    participant Backend

    User->>Frontend: Clicks Connect to Outlook (profile)
    Frontend->>User: Redirect to Microsoft authorize URL
    Note over Frontend: redirect_uri = NEXT_PUBLIC_MICROSOFT_OAUTH_REDIRECT_URL<br/>(must match Azure exactly — e.g. https://app.example.com/oauthcallback,<br/>local Next http://localhost:3000/oauthcallback)<br/>state = JSON e.g. {"auth_flow":"auth_flow","orgId":"..."}

    User->>Microsoft: Signs in / consents
    Microsoft->>Frontend: Redirect to redirect_uri with ?code=...&state=...

    Frontend->>Backend: POST APP_URL/auth/outlook-oauth/exchange { code, orgId }
    Backend->>Microsoft: POST token endpoint (code, client_id, client_secret, redirect_uri)
    Microsoft->>Backend: access_token, refresh_token, ...

    Backend->>Microsoft: GET https://graph.microsoft.com/v1.0/me (Bearer access_token)
    Microsoft->>Backend: id, mail / userPrincipalName

    Backend->>Backend: Upsert OutlookUser (email, microsoftId, emailCredential, orgId)
    Backend->>Frontend: 200 { success, message }

    Frontend->>User: Redirect to /mainapp/profile
```

## Verify and disconnect

- **Verify:** `POST APP_URL/auth/outlook-login-verify` (authenticated) — returns whether an `OutlookUser` exists for the caller’s organization.
- **Disconnect:** `POST APP_URL/auth/outlook-login/disconnect` (authenticated) — removes the org’s Outlook connection record.

## Organization API for agent tools (Python / CoWorkr AI Agent)

The custom agent fetches Microsoft tokens the same way it does for Gmail: **`GET APP_URL/organization/microsoft-users`** with the **same middleware** as [`google-users`](./google-oauth-flow.md) (organization JWT in query: `token`, plus `email` and optional `from_email`).

| Query param  | Purpose                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `token`      | JWT identifying the org user (required; validated by `verifyGoogleAuthUser`).                          |
| `email`      | Present for parity with the Gmail endpoint; the handler uses `req.user` from the token.                |
| `from_email` | Optional. When set, only the `OutlookUser` row matching this mailbox for the organization is returned. |

**Response `data`:**

- `user_email` — email of the authenticated user.
- `orgMicrosoftCredential` — `{ client_id, client_secret, secret_id, tenant_id }` from env (`MICROSOFT_*`), used with stored refresh tokens for MSAL/Graph.
- `connectedOutlooks` — list of Outlook connections for the org (each includes `email`, `emailCredential`, `granted_scope`, etc.).

The Python agent mirrors the Gmail tools pattern (`gmail_outreach`): read, draft, and send via Microsoft Graph using these credentials.

## Environment variables

### Backend

| Variable                  | Purpose                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MICROSOFT_CLIENT_ID`     | App registration (client) ID in Azure Entra ID.                                                                                                   |
| `MICROSOFT_CLIENT_SECRET` | Client secret for the confidential client app.                                                                                                    |
| `MICROSOFT_REDIRECT_URL`  | Must **exactly** match the redirect URI used in the authorize request (same value as `NEXT_PUBLIC_MICROSOFT_OAUTH_REDIRECT_URL` on the frontend). |

### Frontend

| Variable                                   | Purpose                                                                                                              |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_MICROSOFT_CLIENT_ID`          | Same client ID as the backend (public in the browser).                                                               |
| `NEXT_PUBLIC_MICROSOFT_OAUTH_REDIRECT_URL` | Full redirect URI registered in Azure (e.g. Next dev `http://localhost:3000/oauthcallback`). Must match **exactly**. |

## Azure app registration

1. Register an **Web** application in Microsoft Entra ID (Azure AD).
2. Add a **client secret** (for confidential client).
3. Under **Authentication**, add a **Redirect URI** of type **Web** with the same value as `MICROSOFT_REDIRECT_URL` / `NEXT_PUBLIC_MICROSOFT_OAUTH_REDIRECT_URL` (for example production `https://your-domain.com/oauthcallback`; local Next `http://localhost:3000/oauthcallback`).
4. Grant **API permissions** (Microsoft Graph, delegated): at minimum `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Mail.Read`, `Mail.ReadWrite` (aligned with the scopes requested in the frontend authorize URL).

## Redirect URI mismatch

The string Microsoft redirects to after login must match **both** the authorize request’s `redirect_uri` and the token exchange `redirect_uri` on the backend, and must be listed in the Azure app registration.

## PKCE (Proof Key for Code Exchange)

The main Next.js app sends **`code_challenge`** / **`code_challenge_method=S256`** on the authorize request and stores a **`code_verifier`** in `sessionStorage`. The `/oauthcallback` page posts **`code_verifier`** to `POST .../auth/outlook-oauth/exchange` with the **`code`**. The backend includes **`code_verifier`** in the token request. This satisfies Microsoft’s requirement for browser-based (“cross-origin”) authorization code redemption when using a public authorize URL from the SPA.

Server logs: `[Microsoft token]` and `outlookOauthCodeExchange` print the Microsoft error JSON on failure. Browser DevTools: `[Outlook OAuth]` logs each step.
