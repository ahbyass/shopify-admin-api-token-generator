# How a connection works

Read this alongside the source in the order below. The app has two HTTP audiences: the developer's local browser and Shopify's public callback. The distinction determines route ordering and where credentials may be shown.

## 1. Start the local tool

[`src/index.ts`](../src/index.ts) is the executable entrypoint. Its `main()` function:

1. Reads the baseline settings using [`readConfig()`](../src/config.ts).
2. Acquires the process lock so two servers cannot write the same encrypted snapshot.
3. Builds the browser JavaScript and Tailwind CSS.
4. Restores saved sessions and removes expired records.
5. Creates the HTTP app, starts its local listener and optionally launches ngrok.
6. Registers periodic expiry cleanup and shutdown handlers.

The three files under [`src/runtime/`](../src/runtime/) own the process lock, browser compilation and ngrok child process respectively. They do not know how Shopify authorization works.

First-run configuration is separate: [`src/setup.ts`](../src/setup.ts) asks for a domain, port and scopes and writes `config.local.json`. Client secrets never belong in that file.

## 2. Read the HTTP route order

[`createApp()`](../src/server/app.ts) assembles Express without opening a port. Its order is intentional:

| Order | Handler                             | Reason                                                            |
| ----- | ----------------------------------- | ----------------------------------------------------------------- |
| 1     | Response headers and expiry cleanup | Shared response policy and session lifetime enforcement           |
| 2     | Public browser assets               | CSS and JavaScript contain no session data                        |
| 3     | `GET /auth/callback`                | Shopify must be able to reach this through ngrok                  |
| 4     | Local browser session               | Everything below this requires direct localhost access            |
| 5     | Form parsing and CSRF verification  | POST requests must belong to the same local browser               |
| 6     | Setup routes                        | Only the developer can manage app credentials and tokens          |
| 7     | Error response                      | Failures produce a page without leaking raw requests or responses |

[`local-session.ts`](../src/server/local-session.ts) verifies the socket address, Host header and forwarding headers. A public request to `/` receives an informational page. Other public requests to local-only routes are rejected before a session is attached.

The session cookie identifies the saved browser session. The CSRF token protects form submissions; it is different from the OAuth state sent to Shopify.

## 3. Submit the app details

[`routes/setup.ts`](../src/server/routes/setup.ts) contains the local route table and named handlers:

| Request               | Handler             | Result                                            |
| --------------------- | ------------------- | ------------------------------------------------- |
| `GET /`               | `showSetup`         | Default fields and an optional recovery link      |
| `GET /install?shop=…` | `showSetup`         | Compatibility link with the store field populated |
| `POST /install`       | `beginInstallation` | Validate details, save state, redirect to Shopify |
| `POST /retry`         | `retryApproval`     | Start fresh approval using the saved connection   |
| `GET /result`         | `showResult`        | Display a saved token or recovery action          |
| `POST /reset`         | `clearConnection`   | Forget local session data                         |

[`parseSetupForm()`](../src/server/setup-form.ts) normalizes the store address and scopes, validates the credentials and callback URL, and returns either a valid `Connection` or a validation message with non-secret fields. It never returns the client secret in values intended for redisplay.

`startApproval()` saves the connection and random OAuth state before redirecting. [`authorizationUrl()`](../src/server/shopify.ts) builds the Shopify URL. The secret stays in the encrypted local store.

## 4. Receive Shopify's callback

[`handleShopifyCallback`](../src/server/routes/callback.ts) locates the pending installation by state. [`verifyCallback()`](../src/server/shopify.ts) verifies the store, callback parameters and HMAC using the saved app secret.

The handler removes the state and saves `phase: exchanging` **before** sending the code to Shopify. That prevents callback replay and tells restart recovery that an exchange might already have consumed the code.

`exchangeToken()` requests a non-expiring offline token. On success, the session keeps the token and discards the app credentials. On failure, it keeps the credentials so approval can be restarted. Both outcomes are saved before redirecting back to localhost.

The callback never displays the token through ngrok. `/result` renders it only for the original local browser session.

## 5. Understand saved state and recovery

[`connection.ts`](../src/server/connection.ts) defines the data shared by routes and storage:

- `Connection`: the store, app credentials, permissions and callback URL.
- `Session`: one local browser's CSRF token, connection phase and optional result.
- `Install`: a short-lived OAuth state linked to its originating session.

The phases are:

```text
new session → authorizing → exchanging → complete
                                ↓
                              failed → authorizing (new state and code)
```

[`SessionStore`](../src/server/session-store.ts) encrypts sessions and installations together. `save()` writes a temporary snapshot and renames it into place. Routes explicitly call it after transitions; mutating a Map alone does not persist anything.

On restart, a stored `exchanging` phase becomes `failed`. The app cannot know whether Shopify consumed the authorization code, so retry always starts new approval. Pending states expire after 10 minutes; local sessions expire after 24 hours. Corrupt storage produces an error rather than being silently replaced.

The encryption key sits beside the data with owner-only permissions. This protects against accidental disclosure, not an attacker with access to the user's account.

## 6. Follow the rendered page

[`renderPage.tsx`](../src/server/renderPage.tsx) renders the React page on the server. It validates display data with [`pageData.ts`](../src/client/connection/pageData.ts), strips unknown fields, and escapes the JSON payload used for hydration. Client secrets are never part of that payload.

[`entry.tsx`](../src/client/entry.tsx) hydrates the same component tree. [`ConnectionPage.tsx`](../src/client/connection/ConnectionPage.tsx) owns the shared layout; `SetupForm` handles URL derivation, `TokenResult` presents the result, and `CopyField` owns clipboard feedback and token visibility. Tailwind utilities live directly in these components.

Forms still submit to the existing server routes. React does not call Shopify or persist credentials. The browser entrypoint also reloads restored back/forward-cache pages so clearing a token cannot leave an old result visible.

## What the tests protect

- [`test/oauth.test.ts`](../test/oauth.test.ts) drives the HTTP app with simulated Shopify responses. It covers callback validation, one-use state, local/session access restrictions, non-expiring token handling, restart recovery, retry and clearing saved tokens.
- [`test/persistence.test.ts`](../test/persistence.test.ts) checks interrupted exchange recovery, key permissions, expiry and refusal to overwrite corrupt encrypted storage.

These are backend tests. They do not launch a browser, compare screenshots, or test CSS classes. The few HTML assertions check that secrets cannot leak into public or invalid responses.
