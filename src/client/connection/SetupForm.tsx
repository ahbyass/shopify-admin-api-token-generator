import { useState } from 'react'

import type { PageData } from './pageData.js'

import { CopyField } from './CopyField.js'

type Props = {
  csrf: string
  values: PageData['values']
}

/**
 * SetupForm
 * ---------------------------------------------
 * Collects one client's app details and submits them through the existing local POST route.
 * Only the editable callback URL needs React state; other fields remain native form inputs.
 *
 * @param csrf - Server-issued token authenticating this browser's form submission.
 * @param values - Non-secret defaults or fields returned after server validation fails.
 */
export function SetupForm({ csrf, values }: Props) {
  const [redirectUri, setRedirectUri] = useState(values.redirectUri || '')
  const appUrl = deriveAppUrl(redirectUri)

  return (
    <form action="/install" method="post" autoComplete="off" className="mt-7">
      <input type="hidden" name="csrf" value={csrf} />
      <fieldset className="mt-6 min-w-0 border-0 border-t border-line pt-6">
        <legend className="pe-3 text-[15px] font-[650]">
          1. Prepare the Shopify app
        </legend>
        <p className="mt-1.75 text-xs leading-[1.6] text-muted">
          Keep your local server and HTTPS tunnel running during setup.
        </p>

        <CopyField
          id="redirectUri"
          name="redirectUri"
          descriptionId="redirect-help"
          label="Allowed redirection URL"
          type="url"
          required
          value={redirectUri}
          onChange={(event) => setRedirectUri(event.target.value)}
        />
        <p
          id="redirect-help"
          className="mt-1.75 text-xs leading-[1.6] text-muted"
        >
          Your tunnel address followed by /auth/callback. Paste this exact URL
          into the app’s allowed redirection URLs.
        </p>

        <CopyField id="appUrl" label="App URL" value={appUrl} readOnly />

        <details className="mt-6 text-[13px] text-muted">
          <summary
            className="
              w-fit cursor-pointer rounded-xs focus-visible:outline-2
              focus-visible:outline-offset-5 focus-visible:outline-accent
            "
          >
            Shopify setup checklist
          </summary>
          <ol className="my-3 list-decimal ps-5">
            <li className="py-1 text-[13px]">
              Create an app for this client in the{' '}
              <a
                href="https://dev.shopify.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="
                  rounded-xs text-accent underline
                  underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-5 focus-visible:outline-accent
                "
              >
                Dev Dashboard
              </a>
              .
            </li>
            <li className="py-1 text-[13px]">
              Configure it as a non-embedded app. Add the App URL and allowed
              redirection URL shown above.
            </li>
            <li className="py-1 text-[13px]">
              Set the permissions you need, release the version, and configure
              distribution for the client’s store.
            </li>
            <li className="py-1 text-[13px]">
              Copy the client ID and secret from the app’s settings.
            </li>
          </ol>
        </details>
      </fieldset>

      <fieldset className="mt-6 min-w-0 border-0 border-t border-line pt-6">
        <legend className="pe-3 text-[15px] font-[650]">
          2. Enter the client’s details
        </legend>
        <label
          htmlFor="shop"
          className="mt-4.5 mb-1.5 block text-[13px] font-semibold"
        >
          Shopify store
        </label>
        <input
          id="shop"
          name="shop"
          required
          placeholder="client-store.myshopify.com"
          defaultValue={values.shop || ''}
          autoCapitalize="none"
          spellCheck="false"
          className="
            w-full min-w-0 rounded-[7px] border border-input-border
            bg-surface px-3 py-2.75 text-sm leading-[1.6] text-ink focus-visible:outline-2
            focus-visible:outline-offset-3 focus-visible:outline-accent
          "
        />
        <label
          htmlFor="clientId"
          className="mt-4.5 mb-1.5 block text-[13px] font-semibold"
        >
          Client ID
        </label>
        <input
          id="clientId"
          name="clientId"
          required
          defaultValue={values.clientId || ''}
          autoCapitalize="none"
          spellCheck="false"
          className="
            w-full min-w-0 rounded-[7px] border border-input-border
            bg-surface px-3 py-2.75 text-sm leading-[1.6] text-ink focus-visible:outline-2
            focus-visible:outline-offset-3 focus-visible:outline-accent
          "
        />
        <label
          htmlFor="clientSecret"
          className="mt-4.5 mb-1.5 block text-[13px] font-semibold"
        >
          Client secret
        </label>
        <input
          id="clientSecret"
          name="clientSecret"
          type="password"
          required
          autoComplete="new-password"
          aria-describedby="secret-help"
          className="
            w-full min-w-0 rounded-[7px] border border-input-border
            bg-surface px-3 py-2.75 text-sm leading-[1.6] text-ink focus-visible:outline-2
            focus-visible:outline-offset-3 focus-visible:outline-accent
          "
        />
        <p
          id="secret-help"
          className="mt-1.75 text-xs leading-[1.6] text-muted"
        >
          Stored encrypted locally so you can resume after a restart.
        </p>

        <label
          htmlFor="scopes"
          className="mt-4.5 mb-1.5 block text-[13px] font-semibold"
        >
          Permissions
        </label>
        <input
          id="scopes"
          name="scopes"
          required
          defaultValue={values.scopes || ''}
          placeholder="read_products,write_draft_orders"
          aria-describedby="scope-help"
          autoCapitalize="none"
          spellCheck="false"
          className="
            w-full min-w-0 rounded-[7px] border border-input-border
            bg-surface px-3 py-2.75 text-sm leading-[1.6] text-ink focus-visible:outline-2
            focus-visible:outline-offset-3 focus-visible:outline-accent
          "
        />
        <p id="scope-help" className="mt-1.75 text-xs leading-[1.6] text-muted">
          Comma-separated scopes. Use the same permissions you configured in
          Shopify.
        </p>
      </fieldset>
      <button
        type="submit"
        className="
          mt-6 w-full cursor-pointer rounded-[7px]
          border border-accent bg-accent px-4 py-2.75 text-sm leading-[1.6] font-semibold text-white
          hover:brightness-112 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent
        "
      >
        Connect with Shopify →
      </button>
      <p className="mt-1.75 text-xs leading-[1.6] text-muted">
        Approve access in Shopify, then return here to copy the token. Complete
        approval in this browser within 10 minutes.
      </p>
    </form>
  )
}

/**
 * deriveAppUrl
 * ---------------------------------------------
 * Derives the app's public homepage while the callback URL is being edited.
 *
 * @param redirectUri - Possibly incomplete user input; invalid URLs show an empty homepage.
 */
function deriveAppUrl(redirectUri: string): string {
  try {
    return new URL(redirectUri).origin
  } catch {
    return ''
  }
}
