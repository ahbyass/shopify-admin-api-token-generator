import type { Response } from 'express'

import { renderToString } from 'react-dom/server'

import { ConnectionPage } from '../client/connection/ConnectionPage.js'
import {
  pageDataSchema,
  type PageData,
  type PageInput,
} from '../client/connection/pageData.js'

type DocumentProps = {
  page: PageData
}

/**
 * renderPage
 * ---------------------------------------------
 * Renders the shared React page and an escaped hydration payload into a complete document.
 * The schema strips unknown setup fields so saved client secrets cannot enter the browser payload.
 *
 * @param input - Display data selected by a public or authenticated local route.
 * @returns HTML with the same React markup and props that the browser will hydrate.
 */
export function renderPage(input: PageInput): string {
  const page = pageDataSchema.parse(input)
  return '<!doctype html>' + renderToString(<Document page={page} />)
}

/**
 * sendError
 * ---------------------------------------------
 * Renders the standard error page without exposing raw Shopify requests or responses.
 *
 * @param res - Express response receiving the rendered document.
 * @param status - HTTP failure status chosen by the route.
 * @param description - Public-safe explanation and recovery guidance.
 */
export function sendError(res: Response, status: number, description: string) {
  return res.status(status).send(
    renderPage({
      status: 'error',
      title: 'Let’s try that again.',
      description,
    }),
  )
}

/**
 * Document
 * ---------------------------------------------
 * Supplies server-only document metadata around the hydratable React root.
 *
 * @param page - Validated props shared by server rendering and browser hydration.
 */
function Document({ page }: DocumentProps) {
  // Escaping '<' prevents user-controlled text from closing this inert JSON script tag.
  const payload = JSON.stringify(page).replace(/</g, '\\u003c')

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="referrer" content="same-origin" />
        <title>{`${page.title} · Store integration`}</title>
        <link rel="stylesheet" href="/styles.css" />
        <script type="module" src="/ui.js" />
      </head>
      <body className="m-0 bg-background font-sans leading-[1.6] text-ink scheme-light">
        <div id="root">
          <ConnectionPage page={page} />
        </div>
        <script
          id="page-data"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: payload }}
        />
      </body>
    </html>
  )
}
