/**
 * Generates the two browser assets before the HTTP server starts accepting requests.
 * Server TypeScript runs directly in Bun; only browser TypeScript and Tailwind need compilation.
 */
export async function buildBrowserAssets(): Promise<void> {
  const build = await Bun.build({
    entrypoints: ['./src/client/entry.tsx'],
    outdir: './public',
    target: 'browser',
    naming: { entry: 'ui.js' },
    // Select React's production build; this is a compile-time constant, not user configuration.
    define: { 'process.env.NODE_ENV': '"production"' },
  })

  if (!build.success) {
    throw new Error('Browser asset compilation failed. Run bun run check.')
  }

  const css = Bun.spawn(
    [
      process.execPath,
      './node_modules/@tailwindcss/cli/dist/index.mjs',
      '-i',
      './src/client/tailwind.css',
      '-o',
      './public/styles.css',
      '--minify',
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  )

  if ((await css.exited) !== 0) {
    throw new Error('Tailwind compilation failed.')
  }
}
