# Shopify Admin API token exchange / generator 2026

This is a tiny Node/Express server that helps you **generate a Shopify Admin API access token** for a specific store by running the OAuth install flow.

It’s useful when you want to:

- Prove your Shopify app credentials and redirect URL are configured correctly.
- Quickly obtain an Admin API access token for development/testing.
- Understand the OAuth callback security checks (state + HMAC) without a full app template.
- Use Shopify Admin API from a Hydrogen project (server-side), or run local scripts/tools that need Admin access.
  generator

## Why this is needed

Shopify Admin API requests must be authenticated with an **access token**.

As of recent Shopify platform/admin changes (Jan 2026), many workflows that previously relied on generating or copying a long-lived Admin API token directly from the Shopify Admin UI are no longer available or are more restricted. In practice, this means you often need to obtain tokens via a Shopify app using an OAuth-based flow.

Shopify’s recommended token acquisition patterns and security posture have also been evolving (for example, support for expiring offline tokens + refresh tokens and stronger guidance around correct token flows). This repo is intentionally minimal and explicit so you can validate your end-to-end setup (credentials, redirect URLs, and HMAC/state checks) without pulling in a full framework template.

To get that token, Shopify requires an authorization step where the merchant approves your requested scopes. When the merchant approves, Shopify redirects back to your server with a `code` and an `hmac`. Your backend must:

1. Verify the request is authentic (HMAC).
2. Verify the request belongs to the same browser session you started (state).
3. Exchange the authorization `code` for an access token.

This repo implements exactly that in a minimal way.

> Note on terminology: Shopify also supports an embedded-app flow called **token exchange** (session token → access token). This repo implements the classic **authorization code grant** flow (`code` → access token). If you’re building an embedded app, you’ll usually want token exchange instead.

## What it does

- `GET /install?shop=your-store.myshopify.com`
  - Redirects to Shopify’s grant screen (`/admin/oauth/authorize`) using your app’s `client_id`, requested scopes, redirect URI, and a random `state`.

- `GET /auth/callback`
  - Receives Shopify’s redirect (includes `code`, `hmac`, `shop`, `state`, …).
  - Verifies the HMAC.
  - Exchanges the `code` for an access token via `POST https://{shop}/admin/oauth/access_token`.
  - Prints the token in your terminal.

## Prerequisites

- Node.js installed
- An ngrok account + a domain (or use a temporary URL)
- A Shopify app created in the Shopify Dev Dashboard / Partners

## 1) Shopify app settings

In your Shopify app configuration:

- **App URL**: `https://YOUR_NGROK_DOMAIN` (example: `https://bg.ngrok.dev`)
- **Allowed redirection URL(s)**:
  - `https://YOUR_NGROK_DOMAIN/auth/callback` (example: `https://bg.ngrok.dev/auth/callback`)

The redirect URL must match exactly what you set in `SHOPIFY_REDIRECT_URI`.

## 2) Environment variables

Create a `.env` file in the project root:

```dotenv
SHOPIFY_CLIENT_ID=your_client_id
SHOPIFY_CLIENT_SECRET=your_client_secret
SHOPIFY_SCOPES=write_draft_orders,read_products
SHOPIFY_REDIRECT_URI=https://YOUR_NGROK_DOMAIN/auth/callback
PORT=3001

# Optional (Dec 2025+): request an expiring offline token
# SHOPIFY_OFFLINE_TOKEN_EXPIRING=1
```

Important:

- `SHOPIFY_CLIENT_SECRET` is NOT the same as `SHOPIFY_CLIENT_ID`.
- Scopes are comma-separated.
- Scopes must match the app installed

## 3) Install dependencies

```bash
npm install
```

## 4) Start the server

```bash
node server.js
```

You should see something like:

- `Token installer listening on http://localhost:3001`

## 5) Start ngrok

If you have a reserved domain:

```bash
ngrok http --domain=YOUR_NGROK_DOMAIN 3001
```

Example:

```bash
ngrok http --domain=bg.ngrok.dev 3001
```

## 6) Run the install flow

Open this in your browser:

```text
https://YOUR_NGROK_DOMAIN/install?shop=YOUR_SHOP.myshopify.com
```

- Approve the scopes on the Shopify grant screen.
- After redirect, the server prints the access token in the terminal.

## Using the token

For Admin API requests, include the token in:

- Header: `X-Shopify-Access-Token: <token>`

Example GraphQL endpoint:

- `https://{shop}.myshopify.com/admin/api/2026-01/graphql.json`

## Troubleshooting

### “HMAC mismatch”

Most common causes:

- `SHOPIFY_CLIENT_SECRET` is wrong (or has whitespace). Re-copy it from the Dev Dashboard.
- You’re using credentials from a different app than the one installed.

### ngrok exits with code 1

Run ngrok and read the full error output. Common causes:

- Domain not reserved / not on your ngrok plan
- Not logged in (`ngrok config add-authtoken ...`)
- Another process already using the domain or port

### Wrong URL

Start installs at:

- `/install?shop=...`

Not at:

- `/auth/callback/...`

The callback URL is for Shopify to redirect to after approval.

## Security notes (don’t skip in real apps)

This repo is intentionally minimal:

- It uses an in-memory `state` store (not suitable for multi-instance or restarts).
- It prints tokens to the console (don’t do this in production).
- You should store tokens securely (DB/secret manager) and implement proper session handling.

## References

- Authorization code grant (manual): https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
- Token exchange (session token → access token): https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/token-exchange
