import type { ChildProcess } from 'node:child_process'

import { resolve } from 'node:path'

import { readConfig } from './config.js'
import { buildBrowserAssets } from './runtime/assets.js'
import { acquireProcessLock } from './runtime/process-lock.js'
import { startTunnel } from './runtime/tunnel.js'
import { createApp } from './server/app.js'
import { createLogger } from './server/logger.js'
import { SessionStore } from './server/session-store.js'

/** Starts one local app instance, then owns its tunnel, maintenance timer and shutdown. */
async function main(): Promise<void> {
  const config = readConfig()
  const directory = resolve('.local')
  const releaseLock = acquireProcessLock(directory)
  let tunnel: ChildProcess | undefined
  process.on('exit', () => {
    tunnel?.kill()
    releaseLock()
  })

  await buildBrowserAssets()
  const log = createLogger(directory)
  const store = new SessionStore(directory)
  store.prune(Date.now())
  store.save()

  const app = createApp({
    port: config.port,
    defaults: {
      scopes: config.scopes,
      redirectUri: `https://${config.ngrokDomain}/auth/callback`,
    },
    store,
    log,
  })
  const listener = app.listen(config.port, '127.0.0.1', () => {
    log('server_started')
    console.log(
      `\nLocal tool: http://localhost:${config.port}\nApp URL: https://${config.ngrokDomain}\nRedirect URL: https://${config.ngrokDomain}/auth/callback\n`,
    )
    tunnel = startTunnel(config, log)
  })
  listener.on('error', (error) => {
    console.error(`Cannot start the local server: ${error.message}`)
    process.exit(1)
  })

  const maintenance = setInterval(() => {
    try {
      store.prune(Date.now())
    } catch {
      log('storage_failed')
    }
  }, 60_000)
  maintenance.unref()

  /** Stop accepting requests, allow in-flight work briefly, then release process resources. */
  function shutdown(): void {
    clearInterval(maintenance)
    tunnel?.kill()
    log('server_stopped')
    listener.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Could not start the app.',
  )
  process.exitCode = 1
})
