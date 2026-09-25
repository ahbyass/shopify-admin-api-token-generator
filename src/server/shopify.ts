import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'

import type { Connection } from './connection.js'

export type TokenRequest = (
  url: string,
  options: RequestInit,
) => Promise<Response>

/** Generates an unguessable browser identifier, CSRF token or OAuth state. */
export const random = () => randomBytes(32).toString('hex')

/** Compares untrusted tokens without exposing where equal-length values differ. */
export function equal(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false
  }

  const left = Buffer.from(a)
  const right = Buffer.from(b)

  return left.length === right.length && timingSafeEqual(left, right)
}

/** Restricts outbound Shopify requests to canonical store hostnames. */
export function validShop(shop: unknown): shop is string {
  return (
    typeof shop === 'string' &&
    /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)
  )
}

/** Verifies the originating store, required parameters and Shopify’s HMAC signature. */
export function verifyCallback(
  query: Record<string, unknown>,
  connection: Connection,
): boolean {
  if (
    query.shop !== connection.shop ||
    typeof query.code !== 'string' ||
    !query.code
  ) {
    return false
  }

  if (typeof query.hmac !== 'string' || !/^[a-f0-9]{64}$/.test(query.hmac)) {
    return false
  }

  if (Object.values(query).some((value) => typeof value !== 'string')) {
    return false
  }

  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&')
  const expected = createHmac('sha256', connection.clientSecret)
    .update(message)
    .digest('hex')

  return equal(expected, query.hmac)
}

/** Builds an offline authorization request; the client secret never enters this URL. */
export function authorizationUrl(
  connection: Connection,
  state: string,
): string {
  const url = new URL(`https://${connection.shop}/admin/oauth/authorize`)
  url.search = new URLSearchParams({
    client_id: connection.clientId,
    scope: connection.scopes,
    redirect_uri: connection.redirectUri,
    state,
  }).toString()

  return url.toString()
}

/**
 * Exchanges one authorization code for a non-expiring offline token.
 * No automatic retry: a network failure may occur after Shopify has consumed the code.
 * Raw response bodies are deliberately excluded from thrown errors and diagnostics.
 */
export async function exchangeToken(
  connection: Connection,
  code: string,
  fetchToken: TokenRequest,
) {
  const response = await fetchToken(
    `https://${connection.shop}/admin/oauth/access_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: connection.clientId,
        client_secret: connection.clientSecret,
        code,
        expiring: '0',
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    },
  )

  if (!response.ok) {
    throw new Error('Token exchange failed.')
  }

  const token = await response.json()

  if (
    typeof token.access_token !== 'string' ||
    !token.access_token ||
    token.expires_in ||
    token.refresh_token
  ) {
    throw new Error('Shopify did not issue a non-expiring token.')
  }

  return {
    shop: connection.shop,
    scopes: typeof token.scope === 'string' ? token.scope : '',
    token: token.access_token,
  }
}
