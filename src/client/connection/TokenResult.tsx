import { CopyField } from './CopyField.js'

type Props = {
  shop: string
  scopes: string
  token: string
  csrf: string
}

/**
 * TokenResult
 * ---------------------------------------------
 * Shows the completed connection and lets its originating browser copy or clear the token.
 *
 * @param shop - Store verified during the Shopify callback.
 * @param scopes - Permissions Shopify actually granted.
 * @param token - Generated credential; this page is rendered only behind local-session access.
 * @param csrf - Authenticates the action that clears local recovery data.
 */
export function TokenResult({ shop, scopes, token, csrf }: Props) {
  const permissions = scopes.split(',').filter(Boolean)

  return (
    <>
      <div className="mt-7 border-t border-line pt-6">
        <h2 className="mb-2 text-[13px] font-semibold">Connected store</h2>
        <p className="text-[15px] wrap-anywhere text-ink">{shop}</p>
      </div>

      {permissions.length > 0 && (
        <div className="mt-7 border-t border-line pt-6">
          <h2 className="mb-2 text-[13px] font-semibold">
            Approved permissions
          </h2>
          <ul className="flex list-none flex-wrap gap-2">
            {permissions.map((scope) => (
              <li
                key={scope}
                className="
                  max-w-full rounded-[5px] border border-line px-2 py-1 font-mono text-xs
                  leading-[1.6] wrap-anywhere
                "
              >
                {scope}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-7 border-t border-line pt-6">
        <CopyField
          id="accessToken"
          label="Admin API access token"
          value={token}
          readOnly
          isSecret
        />
        <p className="mt-1.75 text-xs leading-[1.6] text-muted">
          No scheduled expiry. Uninstalling the app or revoking its credentials
          can invalidate it.
        </p>
        <p className="mt-1.75 text-xs leading-[1.6] text-muted">
          Your encrypted local copy is available for 24 hours, including after a
          server restart. Save it before setting up another client.
        </p>
      </div>

      <form action="/reset" method="post" className="mt-7">
        <input type="hidden" name="csrf" value={csrf} />
        <button
          type="submit"
          className="
            cursor-pointer rounded-[7px] border border-line bg-surface
            px-4 py-2.75 text-sm leading-[1.6] font-semibold text-accent hover:brightness-112
            focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent
          "
        >
          Clear token &amp; set up another client
        </button>
      </form>
    </>
  )
}
