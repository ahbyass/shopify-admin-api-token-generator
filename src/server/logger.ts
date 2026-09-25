import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from 'node:fs'
import { join } from 'node:path'

type Event =
  | 'server_started'
  | 'server_stopped'
  | 'tunnel_started'
  | 'tunnel_failed'
  | 'approval_started'
  | 'exchange_completed'
  | 'exchange_failed'
  | 'session_cleared'
  | 'storage_failed'
export type Log = (event: Event) => void

/** Writes bounded lifecycle logs from event names only, keeping request data out of diagnostics. */
export function createLogger(directory: string): Log {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const filename = join(directory, 'events.jsonl')

  return (event) => {
    // Accept event names only: request URLs, credentials and tokens cannot be logged.
    try {
      if (existsSync(filename) && statSync(filename).size > 1_000_000) {
        renameSync(filename, `${filename}.1`)
      }

      appendFileSync(
        filename,
        JSON.stringify({ time: new Date().toISOString(), event }) + '\n',
        {
          mode: 0o600,
        },
      )
    } catch {
      console.error(
        'Could not write the local diagnostic log. Check .local permissions and disk space.',
      )
    }
  }
}
