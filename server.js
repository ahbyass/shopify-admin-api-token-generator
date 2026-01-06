require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');

const app = express();

const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET?.trim();
const SCOPES = process.env.SHOPIFY_SCOPES;
const REDIRECT_URI = process.env.SHOPIFY_REDIRECT_URI;
const OFFLINE_TOKEN_EXPIRING =
  process.env.SHOPIFY_OFFLINE_TOKEN_EXPIRING === '1';
const PORT = process.env.PORT || 3001;

if (!CLIENT_ID || !CLIENT_SECRET || !SCOPES || !REDIRECT_URI) {
  throw new Error('Missing required env vars');
}

if (CLIENT_SECRET === CLIENT_ID) {
  throw new Error(
    'Misconfigured env: SHOPIFY_CLIENT_SECRET equals SHOPIFY_CLIENT_ID (this will break HMAC validation).',
  );
}

// Extremely simple state store in memory
const stateStore = new Map();

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, createdAt] of stateStore.entries()) {
    if (typeof createdAt !== 'number' || now - createdAt > STATE_TTL_MS) {
      stateStore.delete(state);
    }
  }
}, 60 * 1000).unref();

function isValidShop(shop) {
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

function safeCompare(a, b) {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function buildHmacMessage(query) {
  // Build message string from all params except hmac & signature.
  // Shopify expects keys sorted and URL-encoded.
  const { hmac: _hmac, signature: _signature, ...rest } = query;
  return Object.keys(rest)
    .sort()
    .map((key) => {
      const value = Array.isArray(rest[key]) ? rest[key].join(',') : rest[key];
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');
}

function verifyHmac(query) {
  const { hmac } = query;

  if (!hmac) {
    console.error('No hmac in query:', query);
    return false;
  }

  const message = buildHmacMessage(query);

  const calculated = crypto
    .createHmac('sha256', CLIENT_SECRET)
    .update(message, 'utf-8')
    .digest('hex');

  if (!safeCompare(calculated, hmac)) {
    console.error('HMAC mismatch');
    console.error('Query params:', query);
    console.error('Message string:', message);
    console.error('Calculated HMAC:', calculated);
    console.error('Shopify HMAC:', hmac);
    return false;
  }

  return true;
}

// 1) Start install: /install?shop=client-store.myshopify.com
app.get('/install', (req, res) => {
  const { shop } = req.query;

  if (!shop || !isValidShop(shop)) {
    return res.status(400).send('Invalid ?shop parameter');
  }

  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, Date.now());

  const redirectUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  redirectUrl.searchParams.set('client_id', CLIENT_ID);
  redirectUrl.searchParams.set('scope', SCOPES);
  redirectUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  redirectUrl.searchParams.set('state', state);
  // NOTE: no grant_options[]=per-user => offline mode

  console.log('Redirecting to Shopify authorize URL:', redirectUrl.toString());
  res.redirect(redirectUrl.toString());
});

// 2) Handle callback: /auth/callback
app.get('/auth/callback', async (req, res) => {
  console.log('Received callback with query:', req.query);
  const { shop, code, state } = req.query;

  if (!shop || !isValidShop(shop)) {
    return res.status(400).send('Invalid shop parameter');
  }

  if (!code) {
    return res.status(400).send('Missing code parameter');
  }

  if (!state || !stateStore.has(state)) {
    console.error('Invalid or missing state:', state);
    return res.status(400).send('Invalid or missing state');
  }

  if (!verifyHmac(req.query)) {
    return res.status(400).send('HMAC validation failed');
  }

  // one-time use (only after request is authenticated)
  stateStore.delete(state);

  try {
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        // Optional: request expiring offline token + refresh token (supported as of Dec 2025)
        ...(OFFLINE_TOKEN_EXPIRING ? { expiring: '1' } : {}),
      }).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Token exchange failed:', text);
      return res.status(500).send('Token exchange failed');
    }

    const json = await response.json();
    const accessToken = json.access_token;
    const scopes = json.scope;

    if (!accessToken) {
      console.error('No access_token in response:', json);
      return res.status(500).send('No access_token in response');
    }

    console.log('=====================================');
    console.log(`Shop: ${shop}`);
    console.log(`Access token: ${accessToken}`);
    console.log(`Scopes: ${scopes}`);
    console.log('=====================================');

    res.send(
      `<h1>Success</h1>
       <p>Token generated for <strong>${shop}</strong>.</p>
       <p>Check your terminal logs for the access token.</p>`,
    );
  } catch (err) {
    console.error('Error in callback handler:', err);
    res.status(500).send('Internal error');
  }
});

app.listen(PORT, () => {
  console.log(`Token installer listening on http://localhost:${PORT}`);
  console.log(
    `Install URL example: http://localhost:${PORT}/install?shop=YOUR-STORE.myshopify.com`,
  );
});
