import type { AddressInfo } from 'node:net'

import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'

import { createApp } from '../src/server/app.js'
import { SessionStore } from '../src/server/session-store.js'

async function fixture(
  t: TestContext,
  response: Record<string, unknown> = {
    access_token: 'test-private-token',
    scope: 'read_products',
  },
) {
  let clock = Date.now()
  const requests: { url: string; body: URLSearchParams }[] = []
  const directory = mkdtempSync(join(tmpdir(), 'shopify-test-'))
  const makeApp = () =>
    createApp({
      store: new SessionStore(directory),
      now: () => clock,
      fetchToken: async (url, options) => {
        requests.push({
          url: String(url),
          body: new URLSearchParams(String(options?.body)),
        })

        return Response.json(response)
      },
    })
  let server = makeApp().listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    rmSync(directory, { recursive: true })
  })
  let base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const request = (
    path: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: URLSearchParams
    } = {},
  ) =>
    new Promise<Response>((resolve, reject) => {
      const req = httpRequest(
        base + path,
        {
          method: options.method || 'GET',
          headers: { Host: 'localhost:3001', ...options.headers },
        },
        (res) => {
          let body = ''
          res.on('data', (chunk) => {
            body += chunk
          })
          res.on('end', () =>
            resolve(
              new Response(body, {
                status: res.statusCode,
                headers: Object.fromEntries(
                  Object.entries(res.headers)
                    .filter(
                      (entry): entry is [string, string | string[]] =>
                        entry[1] !== undefined,
                    )
                    .map(([key, value]) => [
                      key,
                      Array.isArray(value) ? value.join(', ') : value,
                    ]),
                ),
              }),
            ),
          )
        },
      )
      req.on('error', reject)
      req.end(options.body?.toString())
    })
  const page = await request('/')
  const cookie = page.headers.get('set-cookie')!.split(';')[0]
  const csrf = (await page.text()).match(/name="csrf" value="([^"]+)"/)![1]
  const headers = {
    Cookie: cookie,
    Origin: 'http://localhost:3001',
    'Content-Type': 'application/x-www-form-urlencoded',
  }
  const values = {
    csrf,
    shop: 'https://client.myshopify.com/',
    clientId: 'app-id',
    clientSecret: 'app-secret',
    scopes: 'read_products',
    redirectUri: 'https://example.ngrok.dev/auth/callback',
  }
  const start = (overrides = {}) =>
    request('/install', {
      method: 'POST',
      headers,
      body: new URLSearchParams({ ...values, ...overrides }),
    })
  function callback(
    state: string | null,
    overrides: Record<string, string> = {},
  ) {
    const query: Record<string, string> = {
      code: 'test-code',
      shop: 'client.myshopify.com',
      state: state!,
      timestamp: '1234567890',
      ...overrides,
    }
    const message = Object.keys(query)
      .sort()
      .map((key) => `${key}=${query[key]}`)
      .join('&')
    query.hmac = createHmac('sha256', values.clientSecret)
      .update(message)
      .digest('hex')

    return '/auth/callback?' + new URLSearchParams(query)
  }

  const restart = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    server = makeApp().listen(0, '127.0.0.1')
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  return {
    directory,
    restart,
    request,
    start,
    callback,
    headers,
    csrf,
    cookie,
    requests,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

test('OAuth result is local, session-bound, non-expiring, and cleared for the next client', async (t) => {
  const f = await fixture(t)
  const start = await f.start()
  assert.equal(start.status, 303)
  const authorization = new URL(start.headers.get('location')!)
  assert.equal(authorization.hostname, 'client.myshopify.com')
  assert.equal(authorization.searchParams.get('grant_options[]'), null)
  assert.equal(authorization.searchParams.get('client_secret'), null)
  const callback = f.callback(authorization.searchParams.get('state'))
  const result = await f.request(callback, {
    headers: { Host: 'example.ngrok.dev' },
  })
  assert.equal(result.status, 303)
  assert.equal(result.headers.get('location'), 'http://localhost:3001/result')
  assert.equal(f.requests[0].body.get('expiring'), '0')
  assert.equal(f.requests[0].body.get('client_secret'), 'app-secret')
  assert.equal((await f.request('/result')).status, 400)
  const local = await f.request('/result', { headers: { Cookie: f.cookie } })
  assert.equal(local.headers.get('cache-control'), 'no-store')
  assert.match(await local.text(), /test-private-token/)
  const publicResult = await f.request('/result', {
    headers: { Host: 'example.ngrok.dev', Cookie: f.cookie },
  })
  assert.equal(publicResult.status, 403)
  assert.doesNotMatch(await publicResult.text(), /test-private-token/)
  assert.equal((await f.request(callback)).status, 400)
  await f.request('/reset', {
    method: 'POST',
    headers: f.headers,
    body: new URLSearchParams({ csrf: f.csrf }),
  })
  assert.equal(
    (await f.request('/result', { headers: { Cookie: f.cookie } })).status,
    400,
  )
})

test('rejects CSRF, malicious input, mismatched stores, forged callbacks and expired installs', async (t) => {
  const f = await fixture(t)
  assert.equal((await f.start({ csrf: 'wrong' })).status, 403)
  assert.equal((await f.start({ shop: 'evil.example' })).status, 400)
  assert.equal(
    (await f.start({ redirectUri: 'http://example.com/auth/callback' })).status,
    400,
  )
  const malformed = await f.start({
    clientId: '</script><script>alert(1)</script>',
    scopes: 'bad!',
  })
  const html = await malformed.text()
  assert.doesNotMatch(html, /<script>alert/)
  assert.doesNotMatch(html, /app-secret/)
  const start = await f.start()
  const state = new URL(start.headers.get('location')!).searchParams.get(
    'state',
  )
  assert.equal(
    (await f.request(f.callback(state, { shop: 'other.myshopify.com' })))
      .status,
    400,
  )
  const forged = new URL('http://localhost' + f.callback(state))
  forged.searchParams.set('hmac', '0'.repeat(64))
  assert.equal((await f.request(forged.pathname + forged.search)).status, 400)
  f.advance(11 * 60 * 1000)
  assert.equal((await f.request(f.callback(state))).status, 400)
  assert.equal(f.requests.length, 0)
})

test('public visitors cannot access setup, including tunnels rewriting Host', async (t) => {
  const f = await fixture(t)
  const publicHome = await f.request('/', {
    headers: { Host: 'example.ngrok.dev' },
  })
  assert.doesNotMatch(await publicHome.text(), /name="clientSecret"/)
  const forwardedHome = await f.request('/', {
    headers: { 'X-Forwarded-For': '203.0.113.1' },
  })
  assert.doesNotMatch(await forwardedHome.text(), /name="clientSecret"/)
  const wrongOrigin = await f.request('/install', {
    method: 'POST',
    headers: { ...f.headers, Origin: 'https://other.example' },
    body: new URLSearchParams({ csrf: f.csrf }),
  })
  assert.equal(wrongOrigin.status, 403)
})

test('expiring tokens are not presented as permanent tokens', async (t) => {
  const f = await fixture(t, {
    access_token: 'expiring-secret',
    expires_in: 3600,
  })
  const start = await f.start()
  await f.request(
    f.callback(
      new URL(start.headers.get('location')!).searchParams.get('state'),
    ),
  )
  const result = await f.request('/result', { headers: { Cookie: f.cookie } })
  assert.equal(result.status, 502)
  assert.doesNotMatch(await result.text(), /expiring-secret/)
})

test('pending approval and completed tokens survive restarts without plaintext secrets on disk', async (t) => {
  const f = await fixture(t)
  const start = await f.start()
  const state = new URL(start.headers.get('location')!).searchParams.get(
    'state',
  )
  assert.ok(
    !readFileSync(join(f.directory, 'sessions.enc')).includes('app-secret'),
  )
  await f.restart()
  const callback = await f.request(f.callback(state))
  assert.equal(callback.status, 303)
  await f.restart()
  const result = await f.request('/result', { headers: { Cookie: f.cookie } })
  assert.match(await result.text(), /test-private-token/)
  assert.ok(
    !readFileSync(join(f.directory, 'sessions.enc')).includes(
      'test-private-token',
    ),
  )
  await f.request('/reset', {
    method: 'POST',
    headers: f.headers,
    body: new URLSearchParams({ csrf: f.csrf }),
  })
  await f.restart()
  assert.equal(
    (await f.request('/result', { headers: { Cookie: f.cookie } })).status,
    400,
  )
})

test('failed exchanges restart approval with a fresh state and saved credentials', async (t) => {
  const f = await fixture(t, { error: 'failed' })
  const start = await f.start()
  const oldState = new URL(start.headers.get('location')!).searchParams.get(
    'state',
  )
  await f.request(f.callback(oldState))
  await f.restart()
  const result = await f.request('/result', { headers: { Cookie: f.cookie } })
  assert.match(await result.text(), /Restart Shopify approval/)
  const retry = await f.request('/retry', {
    method: 'POST',
    headers: f.headers,
    body: new URLSearchParams({ csrf: f.csrf }),
  })
  assert.equal(retry.status, 303)
  const newApproval = new URL(retry.headers.get('location')!)
  assert.notEqual(newApproval.searchParams.get('state'), oldState)
  assert.equal(newApproval.searchParams.get('client_id'), 'app-id')
  assert.equal((await f.request(f.callback(oldState))).status, 400)
})
