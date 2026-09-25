import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

/**
 * Claims exclusive use of the local session directory and returns a release function.
 * A dead process's lock may be reclaimed; a live process must never share the snapshot file.
 */
export function acquireProcessLock(directory: string): () => void {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const filename = join(directory, 'server.pid')

  try {
    const pid = Number(readFileSync(filename, 'utf8'))

    if (!Number.isInteger(pid) || pid < 1) {
      throw new Error(
        'Invalid .local/server.pid. Remove it only if no app instance is running.',
      )
    }

    try {
      process.kill(pid, 0)
      throw new Error(
        'Another app instance is running. Stop it before starting again.',
      )
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
        throw error
      }
    }

    unlinkSync(filename)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  const descriptor = openSync(filename, 'wx', 0o600)

  try {
    writeFileSync(descriptor, String(process.pid))
  } finally {
    closeSync(descriptor)
  }

  return () => unlinkSync(filename)
}
