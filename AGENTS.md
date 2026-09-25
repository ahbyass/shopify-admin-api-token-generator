# Project conventions

- Use Bun for dependency management, scripts, and the server runtime.
- Use TypeScript for application and browser logic.
- Use Tailwind utilities directly in React components; keep CSS source limited to Tailwind setup and shared theme values.
- Use Oxlint for linting and Oxfmt for formatting. Do not introduce or run ESLint or Prettier.
- Run `bun run check`, `bun run lint`, `bun run format:check`, and `bun test` before finishing code changes.
- Keep credentials, tokens, and local runtime data out of logs and version control.

- Keep the application entrypoints readable as a sequence of named operations. Separate routing, input validation, Shopify protocol handling, and persistence by responsibility.
- Document exported functions and non-obvious state transitions with concise JSDoc describing purpose, side effects, and important constraints. Prefer named functions over long inline callbacks.
- Keep the code walkthrough current when changing the connection flow. Retain tests for OAuth security and recovery; do not add UI snapshots or superficial implementation tests.

- Write for a maintainer reading the source: separate input preparation, guards, state changes, persistence and responses with meaningful blank lines. Always brace control-flow bodies.
- In JSX, put conditional blocks, nested elements and long attribute lists on separate lines. Wrap long Tailwind class lists within the attribute rather than compressing whole controls onto one line. Keep related label/control/help text together, with space between field groups.
- Oxfmt uses an 80-column print width. Preserve manually chosen paragraph breaks; formatter compliance alone does not establish readability.
