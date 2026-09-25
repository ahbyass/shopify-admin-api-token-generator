import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface Config {
  port: number
  ngrokDomain: string
  scopes: string
  startTunnel: boolean
}

export const configPath = resolve('config.local.json')

/** Validates non-secret baseline settings shared by first-run setup and server startup. */
export function validateConfig(value: unknown): Config {
  if (!value || typeof value !== 'object') {
    throw new Error('Configuration must be a JSON object.')
  }

  const input = value as Record<string, unknown>
  const port = input.port ?? 3001
  const domain =
    typeof input.ngrokDomain === 'string'
      ? input.ngrokDomain
          .trim()
          .replace(/^https:\/\//, '')
          .replace(/\/$/, '')
      : ''
  const scopes = input.scopes ?? 'read_products'
  const startTunnel = input.startTunnel ?? true

  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1024 ||
    port > 65535
  ) {
    throw new Error('port must be an integer between 1024 and 65535.')
  }

  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new Error(
      'Set ngrokDomain to your assigned ngrok hostname, without a path.',
    )
  }

  if (
    typeof scopes !== 'string' ||
    !/^[a-z][a-z0-9_]*(,[a-z][a-z0-9_]*)*$/.test(scopes)
  ) {
    throw new Error('scopes must be comma-separated Shopify permission names.')
  }

  if (typeof startTunnel !== 'boolean') {
    throw new Error('startTunnel must be true or false.')
  }

  return { port, ngrokDomain: domain.toLowerCase(), scopes, startTunnel }
}

/** Reads config.local.json or explains how to create it; never loads legacy .env files. */
export function readConfig(): Config {
  if (!existsSync(configPath)) {
    throw new Error('Run bun run setup first to configure your ngrok domain.')
  }

  return validateConfig(JSON.parse(readFileSync(configPath, 'utf8')))
}
