# Google OAuth Flow

## Flow 1: Session OAuth (redirect-based)

Used when the frontend sends the user to Google and the **backend** is the callback URL (`GET /api/sessions/oauth/google`).

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Google
    participant Backend

    User->>Frontend: Clicks "Sign in with Google"
    Frontend->>User: Redirect to Google OAuth URL
    Note over Frontend: redirect_uri = GOOGLE_REDIRECT_URL<br/>(e.g. https://api.yourapp.com/api/sessions/oauth/google)<br/>state = JSON e.g. {"orgId": "..."}

    User->>Google: Opens Google sign-in page
    User->>Google: Signs in / approves

    Google->>Backend: Redirect GET /api/sessions/oauth/google?code=...&state=...
    Note over Google: redirect_uri must match exactly<br/>what was sent in step 2

    Backend->>Backend: googleOauthHandler: read code, state (orgId)
    Backend->>Google: POST token endpoint (code, client_id, client_secret, redirect_uri)
    Google->>Backend: id_token, access_token

    Backend->>Google: GET userinfo (Bearer access_token)
    Google->>Backend: email, id, etc.

    Backend->>Backend: Find/Create User, upsert GoogleUser (email, googleId, emailCredential, orgId)
    Backend->>User: Redirect to CLIENT_URI (or ?oauth-completed=true)
    User->>Frontend: Lands on app, signed in
```

---

## Flow 2: Code exchange (POST)

Used when the frontend uses its **own** redirect URL; after Google redirects to the frontend with `?code=...`, the frontend POSTs the code to the backend.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Google
    participant Backend

    User->>Frontend: Clicks "Sign in with Google"
    Frontend->>User: Redirect to Google (redirect_uri = frontend URL)
    User->>Google: Signs in
    Google->>Frontend: Redirect to frontend?code=...&state=...

    Frontend->>Backend: POST APP_URL/auth/google-oauth/exchange { code, orgId }
    Note over Backend: GOOGLE_REDIRECT_URL here must be<br/>the frontend callback URL

    Backend->>Google: POST token (code, redirect_uri, ...)
    Google->>Backend: id_token, access_token
    Backend->>Google: GET userinfo
    Google->>Backend: email, id, etc.
    Backend->>Backend: Upsert GoogleUser
    Backend->>Frontend: 200 { success, message }
```

---

## High-level process (single diagram)

```mermaid
flowchart LR
    subgraph Client
        A[User clicks Sign in with Google]
        B[Redirect to Google]
    end
    subgraph Google
        C[User signs in]
        D[Redirect back with code]
    end
    subgraph Backend
        E[GET /api/sessions/oauth/google]
        F[Exchange code for tokens]
        G[Get user info]
        H[Upsert GoogleUser]
        I[Redirect to CLIENT_URI]
    end

    A --> B --> C --> D --> E --> F --> G --> H --> I
```

---

## orgGoogleCredential (for the client)

When a Google user is connected to an organization, the client often needs **orgGoogleCredential** (tokens for sending email, etc.). Here is how it is set and how to get it.

### How it is set

- **On connect:** When a user connects their Google account to an org (via session OAuth or code exchange), the backend:
  1. Saves the user in **GoogleUser** (with `emailCredential` and `organization`).
  2. Updates **Organization.orgGoogleCredential** with that user’s `emailCredential` (so the org has a usable credential).
- **On disconnect:** When the last (or only) Google user for the org is disconnected, **orgGoogleCredential** is set to `{}`. If there are other connected users, it is set to one of the remaining user’s credentials.

So **orgGoogleCredential** is set automatically when connecting/disconnecting; the client does not set it.

### How to get it

- **Endpoint:** `GET {APP_URL}/organization/google-users`
- **Auth:** Requires `verifyGoogleAuthUser` (logged-in user with organization).
- **Response:**  
  `data.user_email`, `data.orgGoogleCredential`, `data.connectedEmails` (list of connected GoogleUser records).

Use `data.orgGoogleCredential` on the client when you need the organization’s Google credential (e.g. for Gmail API or sending email as the org).

---

## Env variables

| Variable               | Purpose                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| `GOOGLE_REDIRECT_URL`  | Exact callback URL (backend for Flow 1, or frontend for Flow 2). Must match Google Console. |
| `GOOGLE_CLIENT_ID`     | OAuth client ID from Google Console.                                                        |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret.                                                                        |
| `CLIENT_URI`           | Where to send the user after OAuth (your frontend app URL).                                 |
| `APP_URL`              | Base URL for API routes (e.g. used in Flow 2 path).                                         |

---

## Important for redirect_uri_mismatch

- **Flow 1:** `GOOGLE_REDIRECT_URL` = `https://<your-backend>/api/sessions/oauth/google`
- That **exact** string must be added in **Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs**.
- The `redirect_uri` the frontend sends when building the Google login link must be the **same** as `GOOGLE_REDIRECT_URL` (and in Console).
