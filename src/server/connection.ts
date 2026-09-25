/** App details needed to start approval and exchange its authorization code. */
export interface Connection {
  shop: string
  clientId: string
  clientSecret: string
  scopes: string
  redirectUri: string
}

/**
 * One local browser's connection. Credentials remain only while approval can be retried;
 * a completed exchange replaces them with its token. This record is encrypted on disk.
 */
export interface Session {
  id: string
  csrf: string
  createdAt: number
  phase?: 'authorizing' | 'exchanging' | 'failed' | 'complete'
  connection?: Connection
  result?: { shop: string; scopes: string; token: string }
  error?: string
}

/** A single, short-lived OAuth state associated with its originating browser session. */
export interface Install extends Connection {
  sessionId: string
  createdAt: number
}
