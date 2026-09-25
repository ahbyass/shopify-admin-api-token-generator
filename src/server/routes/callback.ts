import type { RequestHandler } from 'express'

import type { Log } from '../logger.js'
import type { SessionStore } from '../session-store.js'

import { sendError } from '../renderPage.js'
import { exchangeToken, verifyCallback, type TokenRequest } from '../shopify.js'

interface CallbackOptions {
  store: SessionStore
  log: Log
  now: () => number
  fetchToken: TokenRequest
  localOrigin: string
}

/**
 * Accepts Shopify's public callback, consumes its one-use state, and saves the result.
 * No browser cookie is required here: state identifies the original local session.
 * The token is never rendered through the public tunnel; the browser returns to localhost.
 */
export function createCallbackHandler({
  store,
  log,
  now,
  fetchToken,
  localOrigin,
}: CallbackOptions): RequestHandler {
  const { sessions, installs } = store

  return async function handleShopifyCallback(req, res) {
    const { code, state } = req.query
    const install = typeof state === 'string' ? installs.get(state) : undefined

    if (!install || typeof state !== 'string') {
      return sendError(
        res,
        400,
        'This installation has expired or was already completed. Return to the local tool and start again.',
      )
    }

    if (!verifyCallback(req.query, install)) {
      return sendError(
        res,
        400,
        'The Shopify response could not be verified. Return to the local tool and check your app credentials.',
      )
    }

    const session = sessions.get(install.sessionId)

    if (!session || typeof code !== 'string') {
      return sendError(res, 400, 'This setup session has expired.')
    }

    // Persist consumption before sending the one-use code to Shopify.
    installs.delete(state)
    session.phase = 'exchanging'
    store.save()

    try {
      session.result = await exchangeToken(install, code, fetchToken)
      session.phase = 'complete'

      delete session.connection
      delete session.error
      session.createdAt = now()

      log('exchange_completed')
    } catch {
      session.phase = 'failed'
      session.error =
        'Shopify could not issue a non-expiring token. Check the app details or restart approval to try again.'
      log('exchange_failed')
    }

    store.save()

    res.redirect(303, `${localOrigin}/result`)
  }
}
