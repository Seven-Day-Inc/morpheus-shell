import { execFileSync } from 'node:child_process'

/** Runs Git with captured output so callers can keep stdout machine-readable. */
export function runGitCommand(args, { cwd = process.cwd() } = {}) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : ''
    const failure = new Error(
      `git ${args.join(' ')} failed${stderr.length > 0 ? `: ${stderr}` : ''}`
    )
    failure.exitCode = gitExitCode(error)
    throw failure
  }
}

/** Returns Git's process status when a caller needs to handle an expected miss. */
export function gitExitCode(error) {
  if (
    error &&
    typeof error === 'object' &&
    'exitCode' in error &&
    typeof error.exitCode === 'number'
  ) {
    return error.exitCode
  }
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') {
    return error.status
  }
  return 1
}
