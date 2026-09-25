import type { Connection } from './connection.js'

import { validShop } from './shopify.js'

type PublicFormValues = Omit<Connection, 'clientSecret'>
type Submission =
  | { ok: true; connection: Connection }
  | { ok: false; values: PublicFormValues; message: string }

/**
 * Normalizes browser input into an app connection, or returns fields safe to redisplay.
 * The client secret is deliberately excluded from every validation-error result.
 */
export function parseSetupForm(body: unknown): Submission {
  const fields =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const text = (key: string): string =>
    typeof fields[key] === 'string' ? fields[key].trim() : ''

  let shop = text('shop')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')

  if (shop && !shop.includes('.')) {
    shop += '.myshopify.com'
  }

  const clientId = text('clientId')
  const clientSecret = text('clientSecret')
  const requestedScopes = text('scopes')
    .split(/[\s,]+/)
    .filter(Boolean)
  const scopes = [...new Set(requestedScopes)].join(',')
  const redirectUri = text('redirectUri')

  // Only these non-secret values may return to the form after validation fails.
  const values = { shop, clientId, scopes, redirectUri }
  const invalid = (message: string): Submission => ({
    ok: false,
    values,
    message,
  })

  if (!validShop(shop)) {
    return invalid(
      'Enter the store’s myshopify.com address, such as example.myshopify.com.',
    )
  }

  if (!clientId || !clientSecret || clientId === clientSecret) {
    return invalid(
      'Enter the client ID and its separate client secret from this app’s settings.',
    )
  }

  if (!/^[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*)*$/.test(scopes)) {
    return invalid(
      'Enter permission names separated by commas, such as read_products,write_draft_orders.',
    )
  }

  try {
    const url = new URL(redirectUri)

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/auth/callback'
    ) {
      throw new Error('Invalid callback URL')
    }
  } catch {
    return invalid(
      'Enter the HTTPS tunnel URL ending in /auth/callback. Add that exact URL to Shopify’s allowed redirection URLs.',
    )
  }

  return { ok: true, connection: { ...values, clientSecret } }
}
