import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

import { configPath, validateConfig, type Config } from './config.js'

/** Prompts for reusable, non-secret defaults and writes only validated configuration. */
async function configureProject(): Promise<void> {
  const prompt = createInterface({ input: stdin, output: stdout })

  try {
    let current: Partial<Config> = {}

    if (existsSync(configPath)) {
      current = validateConfig(JSON.parse(readFileSync(configPath, 'utf8')))
    }

    const ask = async (label: string, fallback: string) =>
      (
        await prompt.question(`${label}${fallback ? ` [${fallback}]` : ''}: `)
      ).trim() || fallback
    const ngrokDomain = await ask(
      'Your ngrok domain',
      current.ngrokDomain ?? '',
    )
    const port = Number(await ask('Local port', String(current.port ?? 3001)))
    const scopes = await ask(
      'Default scopes',
      current.scopes ?? 'read_products',
    )
    const tunnelChoice = await ask(
      'Start ngrok with the app? (yes/no)',
      current.startTunnel === false ? 'no' : 'yes',
    )

    if (!['yes', 'no'].includes(tunnelChoice)) {
      throw new Error('Choose yes or no for starting ngrok.')
    }

    const config = validateConfig({
      ngrokDomain,
      port,
      scopes,
      startTunnel: tunnelChoice === 'yes',
    })
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', {
      mode: 0o600,
    })
    console.log(
      `\nSaved config.local.json.\nApp URL: https://${config.ngrokDomain}\nRedirect URL: https://${config.ngrokDomain}/auth/callback\n\nRun bun start.`,
    )
  } finally {
    prompt.close()
  }
}

configureProject().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Could not save configuration.',
  )
  process.exitCode = 1
})
