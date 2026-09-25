import { hydrateRoot } from 'react-dom/client'

import { ConnectionPage } from './connection/ConnectionPage.js'
import { pageDataSchema } from './connection/pageData.js'

/**
 * hydratePage
 * ---------------------------------------------
 * Attaches React to the server-rendered page using its validated, local-only display payload.
 * Form submissions still navigate through Express; hydration adds only browser interactions.
 */
function hydratePage(): void {
  const root = document.getElementById('root')
  const payload = document.getElementById('page-data')

  if (!root || !payload?.textContent) {
    throw new Error('The server-rendered page is missing its hydration data.')
  }

  const page = pageDataSchema.parse(JSON.parse(payload.textContent))
  hydrateRoot(root, <ConnectionPage page={page} />)

  // A browser history snapshot must not resurrect a token cleared on the server.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload()
    }
  })
}

hydratePage()
