import type { RequestHandler } from 'express'

import type { Session } from './connection.js'

import { renderPage, sendError } from './renderPage.js'
import { SessionStore, SESSION_TTL } from './session-store.js'
import { equal, random } from './shopify.js'

declare global {
  namespace Express {
    interface Locals {
      session: Session
    }
  }
}

/**
 * Restricts the setup routes to direct localhost requests and attaches their saved session.
 * Tunnel visitors may see the informational homepage, but never credentials or tokens.
 */
export function localSession(
  port: number,
  store: SessionStore,
  now: () => number,
): RequestHandler {
  const { sessions } = store

  return function attachLocalSession(req, res, next) {
    const address = req.socket.remoteAddress
    const local =
      ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address ?? '') &&
      req.get('host') === `localhost:${port}` &&
      !req.get('x-forwarded-for') &&
      !req.get('forwarded') &&
      !req.get('x-forwarded-host')

    if (!local) {
      if (req.method === 'GET' && req.path === '/') {
        return res.send(
          renderPage({
            title: 'Built for your store.',
            description:
              'This app supports a custom Shopify integration. Your developer manages its setup and configuration.',
          }),
        )
      }

      return sendError(
        res,
        403,
        'Open this tool on localhost to manage a connection.',
      )
    }

    const cookie = req.headers.cookie
      ?.split('; ')
      .find((part) => part.startsWith('setup_session='))
      ?.slice(14)
    let session = sessions.get(cookie ?? '')

    if (!session) {
      const id = random()
      session = { id, csrf: random(), createdAt: now() }
      sessions.set(id, session)
      store.save()
    }

    res.cookie('setup_session', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_TTL,
      path: '/',
    })
    res.locals.session = session

    next()
  }
}

/** Checks both the request origin and the per-session token before accepting form writes. */
export function verifyLocalForm(localOrigin: string): RequestHandler {
  return function validateFormOrigin(req, res, next) {
    if (req.method !== 'POST') {
      return next()
    }

    const validOrigin = req.get('origin') === localOrigin
    const validToken = equal(req.body?.csrf, res.locals.session.csrf)

    if (!validOrigin || !validToken) {
      return sendError(
        res,
        403,
        'This form has expired. Return to the setup page and try again.',
      )
    }

    next()
  }
}
