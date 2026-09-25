import { spawn, type ChildProcess } from 'node:child_process'

import type { Config } from '../config.js'
import type { Log } from '../server/logger.js'

/**
 * Starts the configured ngrok endpoint; returns the child so shutdown can stop it.
 * Request inspection is disabled to avoid recording OAuth callback payloads.
 * Tunnel failure leaves the local recovery UI available and reports the corrective action.
 */
export function startTunnel(
  config: Config,
  log: Log,
): ChildProcess | undefined {
  if (!config.startTunnel) {
    return
  }

  const tunnel = spawn(
    'ngrok',
    [
      'http',
      `http://127.0.0.1:${config.port}`,
      `--url=https://${config.ngrokDomain}`,
      '--inspect=false',
    ],
    { stdio: 'inherit' },
  )
  tunnel.on('spawn', () => log('tunnel_started'))
  tunnel.on('error', () => {
    log('tunnel_failed')
    console.error(
      'Could not start ngrok. Install and authenticate the ngrok CLI, then restart; or set startTunnel to false.',
    )
  })
  tunnel.on('exit', (code) => {
    if (!code) {
      return
    }

    log('tunnel_failed')
    console.error(
      'The ngrok tunnel stopped. Resolve the ngrok error above, then restart the app. Saved sessions will remain available.',
    )
  })

  return tunnel
}
