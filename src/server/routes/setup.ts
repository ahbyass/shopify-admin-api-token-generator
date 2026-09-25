import { Router, type Request, type Response } from 'express'

import type { Connection } from '../connection.js'
import type { Log } from '../logger.js'
import type { SessionStore } from '../session-store.js'

import { renderPage, sendError } from '../renderPage.js'
import { parseSetupForm } from '../setup-form.js'
import { authorizationUrl, random } from '../shopify.js'

interface SetupOptions {
  defaults: { scopes?: string; redirectUri?: string }
  store: SessionStore
  log: Log
  now: () => number
}

/** Local-only pages and actions. Mount after localSession and verifyLocalForm. */
export function createSetupRouter({
  defaults,
  store,
  log,
  now,
}: SetupOptions): Router {
  const router = Router()
  const { sessions, installs } = store

  /** Displays defaults and a recovery link without sending saved secrets to the page. */
  function showSetup(
    _req: Request,
    res: Response,
    values: Partial<Connection> = {},
    message = '',
  ) {
    return res.send(
      renderPage({
        status: 'setup',
        title: 'Connect a client’s store.',
        description:
          'Create the app in Shopify, approve its access, and copy a non-expiring Admin API token.',
        recoverable: Boolean(
          res.locals.session.connection || res.locals.session.result,
        ),
        csrf: res.locals.session.csrf,
        values: {
          scopes: defaults.scopes || 'read_products',
          redirectUri: defaults.redirectUri || '',
          ...values,
        },
        message,
      }),
    )
  }

  /** Validates submitted fields before creating a new connection attempt. */
  function beginInstallation(req: Request, res: Response) {
    if (res.locals.session.phase === 'exchanging') {
      return sendError(
        res,
        409,
        'A token exchange is still running. Wait a moment before starting another connection.',
      )
    }

    const submission = parseSetupForm(req.body)

    if (!submission.ok) {
      res.status(400)

      return showSetup(req, res, submission.values, submission.message)
    }

    startApproval(res, submission.connection)
  }

  /** Persist app details and fresh OAuth state before leaving localhost for Shopify. */
  function startApproval(res: Response, connection: Connection): void {
    const session = res.locals.session

    store.clearInstalls(session.id)
    delete session.result
    delete session.error

    session.connection = connection
    session.phase = 'authorizing'
    session.createdAt = now()
    const state = random()
    installs.set(state, {
      ...connection,
      sessionId: session.id,
      createdAt: now(),
    })
    store.save()
    log('approval_started')

    res.redirect(303, authorizationUrl(connection, state))
  }

  /** Retry uses a new authorization code; an interrupted code may already be consumed. */
  function retryApproval(_req: Request, res: Response) {
    const session = res.locals.session

    if (!session.connection) {
      return sendError(
        res,
        400,
        'No connection is available to retry. Enter the app details again.',
      )
    }

    if (session.phase === 'exchanging') {
      return sendError(
        res,
        409,
        'A token exchange is still running. Wait a moment and reload the result page.',
      )
    }

    startApproval(res, session.connection)
  }

  /** Shows either the saved token or the action needed to resume this browser’s connection. */
  function showResult(_req: Request, res: Response) {
    const session = res.locals.session

    if (session.connection && !session.result) {
      return res.status(session.error ? 502 : 200).send(
        renderPage({
          status: 'error',
          title: 'Continue your connection.',
          description:
            session.error ||
            'Your app details are saved. Complete the open Shopify approval, or restart it here.',
          retryable: session.phase !== 'exchanging',
          csrf: session.csrf,
        }),
      )
    }

    if (!session.result) {
      return sendError(
        res,
        400,
        'No token is available in this browser session. Start a connection from the setup page.',
      )
    }

    res.send(
      renderPage({
        status: 'success',
        title: 'Your token is ready.',
        description:
          'Copy this token into your integration’s server-side configuration.',
        ...session.result,
        csrf: session.csrf,
      }),
    )
  }

  /** Forget local recovery data without uninstalling or revoking anything in Shopify. */
  function clearConnection(_req: Request, res: Response) {
    const session = res.locals.session

    sessions.delete(session.id)
    store.clearInstalls(session.id)
    store.save()
    log('session_cleared')

    res.clearCookie('setup_session')
    res.redirect(303, '/')
  }

  router.get('/', (req, res) => showSetup(req, res))
  router.get('/install', (req, res) =>
    showSetup(req, res, {
      shop: typeof req.query.shop === 'string' ? req.query.shop : '',
    }),
  )

  router.post('/install', beginInstallation)
  router.post('/retry', retryApproval)
  router.get('/result', showResult)
  router.post('/reset', clearConnection)

  return router
}
