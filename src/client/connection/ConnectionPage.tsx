import { cn } from 'cnfast'

import type { PageData } from './pageData.js'

import { SetupForm } from './SetupForm.js'
import { TokenResult } from './TokenResult.js'

type Props = {
  page: PageData
}

/**
 * ConnectionPage
 * ---------------------------------------------
 * Composes the server-selected setup, result or recovery view inside the shared layout.
 * It does not select routes, contact Shopify or read persisted credentials.
 *
 * @param page - Validated display data selected by the existing Express route.
 */
export function ConnectionPage({ page }: Props) {
  const isError = page.status === 'error'
  const isComplete = page.status === 'success'
  let badge = 'Shopify Admin API'

  if (isError) {
    badge = 'Setup needs attention'
  } else if (isComplete) {
    badge = '✓ Connection complete'
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-160 content-center px-4 py-7 min-[480px]:px-6 min-[480px]:py-12">
      <div className="mb-6 flex items-center gap-2.5 text-sm leading-[1.6] font-semibold">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
          className="shrink-0 text-accent"
        >
          <rect x="3" y="3" width="7" height="7" rx="2" />
          <rect x="14" y="14" width="7" height="7" rx="2" />
          <path d="M14 6h2a2 2 0 0 1 2 2v3M10 18H8a2 2 0 0 1-2-2v-3" />
        </svg>
        Store integration
      </div>

      <section
        aria-labelledby="page-title"
        className="rounded-[20px] border border-line bg-surface px-6 py-7 shadow-panel min-[480px]:p-10"
      >
        <div
          className={cn(
            'mb-6 inline-flex items-center gap-1.75 rounded-md px-2.5 py-1.25 text-xs leading-[1.6] font-semibold',
            isError ? 'bg-warning text-warning-ink' : 'bg-success text-accent',
          )}
        >
          {badge}
        </div>

        <h1
          id="page-title"
          className="mb-3 text-[clamp(28px,5vw,36px)] leading-[1.2] font-[650] tracking-[-0.035em]"
        >
          {page.title}
        </h1>
        <p className="text-[15px] text-muted">{page.description}</p>

        {page.message && (
          <p
            role="alert"
            className="mt-5 rounded-[7px] bg-warning p-3 text-sm leading-[1.6] text-warning-ink"
          >
            {page.message}
          </p>
        )}

        {page.status === 'setup' && (
          <>
            {page.recoverable && (
              <div className="mt-5 rounded-[7px] bg-warning p-3 text-sm leading-[1.6] text-warning-ink">
                <p className="text-[15px] text-muted">
                  A previous connection is available in this browser.
                </p>
                <a
                  href="/result"
                  className="
                    rounded-xs text-accent underline
                    underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-5
                    focus-visible:outline-accent
                  "
                >
                  Continue your previous connection
                </a>
              </div>
            )}
            <SetupForm csrf={page.csrf} values={page.values} />
          </>
        )}

        {isComplete && (
          <TokenResult
            shop={page.shop}
            scopes={page.scopes}
            token={page.token}
            csrf={page.csrf}
          />
        )}

        {isError && (
          <>
            {page.retryable && (
              <>
                <form action="/retry" method="post" className="mt-7">
                  <input type="hidden" name="csrf" value={page.csrf} />
                  <button
                    type="submit"
                    className="
                      cursor-pointer rounded-[7px] border border-accent
                      bg-accent px-4 py-2.75 text-sm leading-[1.6] font-semibold
                      text-white hover:brightness-112 focus-visible:outline-2
                      focus-visible:outline-offset-3 focus-visible:outline-accent
                    "
                  >
                    Restart Shopify approval
                  </button>
                </form>
                <p className="mt-1.75 text-xs leading-[1.6] text-muted">
                  Uses the app details saved for this connection and requests a
                  fresh authorization code.
                </p>
              </>
            )}
            <a
              href="/"
              className="
                mt-6 inline-block rounded-xs text-sm
                leading-[1.6] font-semibold text-accent underline underline-offset-4 focus-visible:outline-2
                focus-visible:outline-offset-5 focus-visible:outline-accent
              "
            >
              Return to setup
            </a>
          </>
        )}

        <div className="mt-2 min-h-5" />
      </section>

      <footer className="px-1 pt-5 text-xs leading-[1.6] text-muted">
        Local setup tool · Saved sessions are encrypted on this computer.
      </footer>
    </main>
  )
}
