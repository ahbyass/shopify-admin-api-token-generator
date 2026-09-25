# Shopify Admin API token generator

Generate a **Shopify Admin API access token** for a client's custom app through a local browser workflow. This tool handles Shopify OAuth authorization, the callback and token exchange, so you can approve access and copy a non-expiring offline token into your integration.

Built for Shopify developers, freelancers and agencies who create a separate app for each client store. Runs locally with Bun, React and TypeScript; the setup form and generated tokens are accessible only on localhost.

## Why this exists

Connecting a client's store to a script or backend integration involves more than obtaining a client ID and secret. You need to configure app and redirect URLs, request the right permissions, handle Shopify's approval callback and exchange the authorization code for an access token.

Repeating that plumbing for every client is cumbersome. This project gives you a reusable local setup tool: configure your ngrok domain once, enter each client's app details, approve the connection and copy the resulting token. You can use that token for product or customer integrations, reporting scripts and other Admin API tasks permitted by the scopes you request.

You still create and configure the Shopify app yourself. The tool handles the connection workflow and local recovery; your integration uses the resulting token independently.

## What it does

- **Generates offline Admin API tokens:** requests non-expiring access through Shopify's OAuth authorization code grant.
- **Derives your Shopify URLs:** shows the App URL and allowed redirection URL for your configured ngrok domain.
- **Starts locally with one command:** builds the UI and optionally launches the HTTPS tunnel with `bun start`.
- **Keeps client setup local:** restricts the form and token results to localhost while exposing the OAuth callback through ngrok.
- **Recovers after a restart:** stores encrypted connection details locally and lets you restart interrupted approval.
- **Supports successive client setups:** clears the current connection when you are ready to configure another store.

## Supported Shopify apps

This workflow is intended for separately configured client custom apps that support non-expiring offline tokens. It requires access to the app's client ID and secret, and permission to approve its installation on the store.

Shopify's expiring-token requirements for public apps do not apply to custom apps. Public apps have different requirements, and this tool does not implement token refresh. See [Shopify's token requirements and affected app types](https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027).

## Quick start

Install [Bun](https://bun.sh) and the [ngrok CLI](https://ngrok.com/download). Authenticate ngrok with your account and obtain an assigned or reserved domain before setup.

```sh
git clone https://github.com/ahbyass/shopify-admin-api-token-generator.git
cd shopify-admin-api-token-generator
bun install
bun run setup
bun start
```

Setup asks for your ngrok domain, local port, default Shopify permissions and whether to start the tunnel automatically. It writes an ignored `config.local.json`. By default, `bun start` launches both the local server and ngrok. Open the localhost link printed in the terminal.

Bun runs the TypeScript server directly. Startup bundles the React browser code and compiles Tailwind into ignored files in `public/`; there is no separate build command to remember. Run these commands from the project directory.

## Configure once

You can also copy [config.example.json](config.example.json) to `config.local.json`:

```json
{
  "port": 3001,
  "ngrokDomain": "your-domain.ngrok.dev",
  "scopes": "read_products",
  "startTunnel": true
}
```

The app derives both Shopify URLs from that domain:

| Shopify setting         | Value                                         |
| ----------------------- | --------------------------------------------- |
| App URL                 | `https://your-domain.ngrok.dev`               |
| Allowed redirection URL | `https://your-domain.ngrok.dev/auth/callback` |

Set `startTunnel` to `false` if you manage your tunnel separately. Configure it to forward to `http://127.0.0.1:3001`, or your chosen port. The bundled launcher disables ngrok’s request inspector so it does not record OAuth callback payloads.

No environment file is needed. The start and setup commands explicitly disable automatic `.env` loading. Enter each client’s **client ID and client secret in the local app interface**. `config.local.json` only stores reusable settings: your tunnel domain, port, default permissions and whether to start ngrok.

## Connect a client

1. Create the client’s app in the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard).
2. Configure a non-embedded app, copy the two URLs from the local tool, choose the permissions, release the app version and configure its distribution for the client’s store.
3. Enter the store’s `myshopify.com` address, client ID, client secret and matching permissions in the local form.
4. Select **Connect with Shopify**. Complete approval in the same browser within 10 minutes.
5. Shopify returns through the tunnel to the localhost result page. Copy the token into your integration’s server-side configuration.
6. Select **Clear token & set up another client** when finished.

This uses Shopify’s authorization code grant with `expiring=0`. Tokens have no scheduled expiry, but uninstalling the app or revoking its credentials can invalidate them. It does not use the 24-hour client credentials grant.

The public App URL shows a small informational homepage, not the setup form. It is available only while the server and tunnel are running. Stopping the tool does not revoke a token already issued.

## Restart and recovery

Run `bun start` again after a stop or crash, then open localhost in the same browser. A link on the setup page returns you to the saved connection.

- Pending approval survives a restart while its 10-minute state is valid.
- Completed tokens remain available for 24 hours.
- Failed or interrupted exchanges offer **Restart Shopify approval**, using the encrypted saved app details.
- Retry requests fresh authorization. It never blindly replays an authorization code that Shopify may already have consumed.
- Clearing the session removes its saved credentials, token and pending state. Expired sessions are periodically pruned.

An abrupt stop after Shopify issues a token but before it reaches local storage cannot recover that response. Restart approval in that case. Browser cookies are still required: encrypted storage is not a searchable credential vault for other browsers.

## Local files and logs

All runtime files live in the ignored `.local/` directory:

| File           | Purpose                                                                      |
| -------------- | ---------------------------------------------------------------------------- |
| `sessions.enc` | AES-256-GCM encrypted sessions, pending app credentials and completed tokens |
| `session.key`  | Local encryption key, owner-readable/writable only                           |
| `events.jsonl` | Timestamped lifecycle events; rotates at approximately 1 MB with one backup  |
| `server.pid`   | Prevents two app instances from writing the same session file                |

The key and encrypted data share this computer. Encryption protects against accidental file disclosure, not someone with access to your user account. Do not commit or share `.local/`. Logs contain event names only—no secrets, tokens, authorization codes, request URLs or Shopify response bodies.

If storage is unreadable, startup stops rather than silently replacing it. Restore the matching key and snapshot, or remove `sessions.enc` to discard saved sessions and start fresh. Clearing local data never uninstalls a Shopify app or revokes a Shopify token.

## Development

```sh
bun run check         # Strict TypeScript checks
bun test              # HTTP flows, restart recovery and encryption
bun run lint          # Oxlint checks
bun run format        # Oxfmt: format source and documentation
bun run format:check  # Oxfmt: check formatting without changing files
```

Restart `bun start` after editing source. The tests cover backend OAuth, access restrictions and encrypted recovery using simulated Shopify responses and temporary stores. There are no browser, screenshot or component tests, and no real apps are installed.

The UI uses React and TypeScript, with Tailwind utilities directly in the components. Express renders the initial page, and React hydrates the interactive controls. Forms submit to the server routes; OAuth and encrypted storage stay on the server.

Start with [the code walkthrough](docs/code-walkthrough.md). It follows one connection from startup through approval, callback, token storage and retry.

```text
src/
  index.ts                  Application startup and shutdown
  setup.ts                  First-run configuration
  config.ts                 Baseline configuration
  runtime/                  Browser assets, process lock and ngrok lifecycle
  server/
    app.ts                  HTTP middleware and route ordering
    connection.ts           Shared connection/session types
    local-session.ts        Localhost access, browser cookies and CSRF
    setup-form.ts           Input normalization and validation
    routes/setup.ts         Setup, installation, result, retry and reset
    routes/callback.ts      Public Shopify callback
    shopify.ts              Authorization URLs, HMAC and token exchange
    session-store.ts        Encrypted persistence and expiry
    logger.ts               Diagnostics without request data
    renderPage.tsx          Server-rendered React document and safe page data
  client/
    entry.tsx               Hydrates the server-rendered page
    connection/             Page, form, token result, copy field and data schema
    tailwind.css            Tailwind entrypoint and theme values
```

## Troubleshooting

- **Redirect mismatch:** the URL entered in the form must exactly match Shopify’s allowed redirection URL.
- **Verification failed:** confirm the client ID and secret belong to the same app, then start a new connection.
- **Tunnel stopped:** resolve the ngrok error printed in the terminal, then restart. Your encrypted sessions remain available.
- **Address already in use:** stop the other server or change the configured port.
- **Public page has no form:** open `http://localhost:3001`, not your ngrok domain or `127.0.0.1`.
- **Shopify denied access:** check distribution, store permissions, released version and requested scopes.

See [Shopify’s standalone-app authentication guide](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps).
