import assert from 'node:assert/strict'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { SessionStore, SESSION_TTL } from '../src/server/session-store.js'

test('interrupted exchanges become retryable; corrupt storage is not silently discarded', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'shopify-storage-'))
  t.after(() => rmSync(directory, { recursive: true }))
  const store = new SessionStore(directory)
  store.sessions.set('browser', {
    id: 'browser',
    csrf: 'csrf',
    createdAt: Date.now(),
    phase: 'exchanging',
  })
  store.save()
  const restored = new SessionStore(directory)
  assert.equal(restored.sessions.get('browser')?.phase, 'failed')
  assert.match(
    restored.sessions.get('browser')?.error ?? '',
    /stopped during token exchange/,
  )
  assert.equal(statSync(join(directory, 'session.key')).mode & 0o777, 0o600)
  restored.prune(Date.now() + SESSION_TTL + 1)
  assert.equal(new SessionStore(directory).sessions.size, 0)
  writeFileSync(join(directory, 'sessions.enc'), 'broken snapshot')
  assert.throws(
    () => new SessionStore(directory),
    /Cannot read encrypted sessions/,
  )
  assert.equal(
    readFileSync(join(directory, 'sessions.enc'), 'utf8'),
    'broken snapshot',
  )
})
