import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { resolvePullRequestDiffBase } from './git-pull-request-diff-base.mjs'
import { resolvePnpmCliInvocation } from './pnpm-cli-invocation.mjs'

const GIT_REVISION = /^[A-Za-z0-9._/@^~-]+$/
const MAX_FILES_PER_SCAN = 250
const MAX_WINDOWS_ARGUMENT_CHARS = 20_000
const MAX_POSIX_ARGUMENT_CHARS = 1_000_000
const MAX_GIT_OUTPUT_BYTES = 64 * 1024 * 1024

export function chunkReactDoctorChangedFiles(
  files,
  {
    maxFiles = MAX_FILES_PER_SCAN,
    maxArgumentChars = process.platform === 'win32'
      ? MAX_WINDOWS_ARGUMENT_CHARS
      : MAX_POSIX_ARGUMENT_CHARS
  } = {}
) {
  const chunks = []
  let chunk = []
  let argumentChars = 0

  for (const file of files) {
    const nextArgumentChars = argumentChars + file.length + 1
    if (chunk.length > 0 && (chunk.length >= maxFiles || nextArgumentChars > maxArgumentChars)) {
      chunks.push(chunk)
      chunk = []
      argumentChars = 0
    }
    chunk.push(file)
    argumentChars += file.length + 1
  }

  if (chunk.length > 0) {
    chunks.push(chunk)
  }
  return chunks
}

function readNullSeparatedGitOutput(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: MAX_GIT_OUTPUT_BYTES
  })
    .split('\0')
    .filter(Boolean)
}

export function collectReactDoctorChangedFiles(root, base) {
  const mergeBase = execFileSync('git', ['merge-base', base, 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  }).trim()
  const paths = [
    ...readNullSeparatedGitOutput(root, [
      'diff',
      '--no-ext-diff',
      '--name-only',
      '--diff-filter=ACMR',
      '-z',
      mergeBase,
      'HEAD'
    ]),
    ...readNullSeparatedGitOutput(root, [
      'diff',
      '--no-ext-diff',
      '--name-only',
      '--diff-filter=ACMR',
      '-z'
    ]),
    ...readNullSeparatedGitOutput(root, [
      'diff',
      '--no-ext-diff',
      '--cached',
      '--name-only',
      '--diff-filter=ACMR',
      '-z'
    ]),
    ...readNullSeparatedGitOutput(root, ['ls-files', '--others', '--exclude-standard', '-z'])
  ]
  const uniquePaths = [...new Set(paths)]
  const unsafePath = uniquePaths.find((file) => file.includes('\n') || file.includes('\r'))
  if (unsafePath) {
    throw new Error(
      `React Doctor changed-file lists cannot encode path: ${JSON.stringify(unsafePath)}`
    )
  }
  return uniquePaths
}

export function buildReactDoctorArgs(base, changedFilesPath) {
  return [
    'dlx',
    'react-doctor@0.9.1',
    '.',
    '--yes',
    '--scope',
    'lines',
    '--base',
    base,
    '--changed-files-from',
    changedFilesPath,
    '--include-untracked',
    '--no-dead-code',
    '--no-supply-chain',
    '--no-telemetry',
    '--blocking',
    'error',
    '--max-duration',
    '900'
  ]
}

export function buildReactDoctorEnvironment(environment, base) {
  return {
    ...environment,
    REACT_DOCTOR_BASE_SHA: base,
    REACT_DOCTOR_LINT_PHASE_TIMEOUT_MS: '900000'
  }
}

export function main() {
  const root = process.cwd()
  const requestedBase =
    process.argv.slice(2).find((argument) => argument !== '--') ??
    process.env.ORCA_CODE_QUALITY_BASE ??
    'origin/main'
  const base = resolvePullRequestDiffBase(root, requestedBase)
  if (!GIT_REVISION.test(base)) {
    throw new Error(`Refusing to pass an unsafe diff base to pnpm: ${base}`)
  }

  const changedFiles = collectReactDoctorChangedFiles(root, base)
  const chunks = chunkReactDoctorChangedFiles(changedFiles)
  if (chunks.length === 0) {
    return 0
  }

  const { command, prefixArgs, shell } = resolvePnpmCliInvocation()
  const environment = buildReactDoctorEnvironment(process.env, base)
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'orca-react-doctor-changed-'))
  let exitCode = 0
  try {
    for (const [index, chunk] of chunks.entries()) {
      const changedFilesPath = join(temporaryDirectory, `changed-files-${index}.txt`)
      writeFileSync(changedFilesPath, `${chunk.join('\n')}\n`)
      const result = spawnSync(
        command,
        [...prefixArgs, ...buildReactDoctorArgs(base, changedFilesPath)],
        { stdio: 'inherit', env: environment, shell, windowsHide: true }
      )
      if (result.error) {
        throw result.error
      }
      if (result.status !== 0) {
        exitCode = result.status ?? 1
        break
      }
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true })
  }
  return exitCode
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}
