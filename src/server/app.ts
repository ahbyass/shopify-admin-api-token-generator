import express, { type ErrorRequestHandler } from 'express'
import { fileURLToPath } from 'node:url'

import type { Log } from './logger.js'
import type { TokenRequest } from './shopify.js'

import { localSession, verifyLocalForm } from './local-session.js'
import { sendError } from './renderPage.js'
import { createCallbackHandler } from './routes/callback.js'
import { createSetupRouter } from './routes/setup.js'
import { SessionStore } from './session-store.js'

interface AppOptions {
  port?: number
  defaults?: { scopes?: string; redirectUri?: string }
  fetchToken?: TokenRequest
  now?: () => number
  store?: SessionStore
  log?: Log
}

/**
 * Assembles the HTTP app without opening a port or launching ngrok.
 * Public assets and Shopify's callback come first; all setup routes require a local session.
 * Tests use this same entrypoint with a temporary store and simulated Shopify responses.
 */
export function createApp({
  port = 3001,
  defaults = {},
  fetchToken = fetch,
  now = Date.now,
  store = new SessionStore(),
  log = () => {},
}: AppOptions = {}) {
  const app = express()
  const localOrigin = `http://localhost:${port}`
  app.disable('x-powered-by')

  app.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'same-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'self'; script-src 'self'; form-action 'self' https://*.myshopify.com; base-uri 'none'; frame-ancestors 'none'",
    })
    store.prune(now())
    next()
  })
  app.use(
    express.static(fileURLToPath(new URL('../../public', import.meta.url)), {
      index: false,
      dotfiles: 'deny',
    }),
  )
  app.get(
    '/auth/callback',
    createCallbackHandler({ store, log, now, fetchToken, localOrigin }),
  )

  // Order matters: public requests must be rejected before a browser session is attached.
  app.use(localSession(port, store, now))
  app.use(express.urlencoded({ extended: false, limit: '8kb' }))
  app.use(verifyLocalForm(localOrigin))
  app.use(createSetupRouter({ defaults, store, log, now }))

  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.too.large') {
      return sendError(res, 413, 'The submitted form is too large.')
    }

    log('storage_failed')

    return sendError(
      res,
      500,
      'The operation could not be saved. Check disk space and .local permissions, then restart the server.',
    )
  }
  app.use(handleError)

  return app
}
