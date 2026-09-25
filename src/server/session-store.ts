import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import type { Install, Session } from './connection.js'

export const SESSION_TTL = 24 * 60 * 60 * 1000
export const INSTALL_TTL = 10 * 60 * 1000

interface Snapshot {
  sessions: [string, Session][]
  installs: [string, Install][]
}

/**
 * Persists sessions and OAuth states together in an authenticated, encrypted snapshot.
 * Call save() after mutations; no directory means memory-only storage for isolated callers.
 * The adjacent private key protects against accidental disclosure, not account compromise.
 */
export class SessionStore {
  readonly sessions = new Map<string, Session>()
  readonly installs = new Map<string, Install>()
  private readonly key?: Buffer
  private readonly filename?: string

  /** Restores saved sessions and marks any interrupted exchange as requiring fresh approval. */
  constructor(directory?: string) {
    if (!directory) {
      return
    }

    mkdirSync(directory, { recursive: true, mode: 0o700 })
    chmodSync(directory, 0o700)
    const keyFile = join(directory, 'session.key')
    this.filename = join(directory, 'sessions.enc')

    if (!existsSync(keyFile)) {
      if (existsSync(this.filename)) {
        throw new Error(
          'Session key is missing. Restore the key or remove the old sessions.enc file before restarting.',
        )
      }

      writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' })
    }

    chmodSync(keyFile, 0o600)
    this.key = readFileSync(keyFile)

    if (this.key.length !== 32) {
      throw new Error('Invalid local session key.')
    }

    if (!existsSync(this.filename)) {
      return
    }

    try {
      const encrypted = readFileSync(this.filename)
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        encrypted.subarray(0, 12),
      )
      decipher.setAuthTag(encrypted.subarray(12, 28))
      const plaintext = Buffer.concat([
        decipher.update(encrypted.subarray(28)),
        decipher.final(),
      ])
      const snapshot: Snapshot = JSON.parse(plaintext.toString('utf8'))

      for (const [id, session] of snapshot.sessions) {
        if (session.phase === 'exchanging') {
          session.phase = 'failed'
          session.error =
            'The server stopped during token exchange. Restart Shopify approval to request a fresh code.'
        }

        this.sessions.set(id, session)
      }

      for (const [state, install] of snapshot.installs) {
        this.installs.set(state, install)
      }
    } catch {
      throw new Error(
        'Cannot read encrypted sessions. Restore .local from a backup, or remove sessions.enc to start fresh. The existing file has not been overwritten.',
      )
    }
  }

  /** Atomically replaces the encrypted snapshot; write errors propagate to the caller. */
  save(): void {
    if (!this.key || !this.filename) {
      return
    }
    // Each saved snapshot gets a fresh nonce, even when the data is unchanged.
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce)
    const snapshot: Snapshot = {
      sessions: [...this.sessions],
      installs: [...this.installs],
    }
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(snapshot)),
      cipher.final(),
    ])

    const temporary = `${this.filename}.tmp`
    writeFileSync(
      temporary,
      Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]),
      {
        mode: 0o600,
      },
    )

    renameSync(temporary, this.filename)
  }

  /** Removes expired sessions and authorization states, saving only when something changed. */
  prune(now: number): void {
    let changed = false

    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > SESSION_TTL) {
        this.sessions.delete(id)
        changed = true
      }
    }

    for (const [state, install] of this.installs) {
      if (
        now - install.createdAt > INSTALL_TTL ||
        !this.sessions.has(install.sessionId)
      ) {
        this.installs.delete(state)
        changed = true
      }
    }

    if (changed) {
      this.save()
    }
  }

  /** Invalidates older approval links for a browser; the caller saves the complete transition. */
  clearInstalls(sessionId: string): void {
    for (const [state, install] of this.installs) {
      if (install.sessionId === sessionId) {
        this.installs.delete(state)
      }
    }
  }
}
