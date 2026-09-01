#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gitExitCode, runGitCommand } from './git-command-runner.mjs'

const DEFAULT_PIN_REF = 'pin/v1.4.183'
const DEFAULT_REMOTE = 'upstream'
const TAG_NAMESPACE = 'refs/upstream/tags'
const REPORT_FILENAME = path.join('docs', 'chat-transport', 'CANDIDATE-REPORT.md')

// Thin-fork rule: fork surfaces live in added modules; candidate merges may not rewrite panels.

function hasInvalidTagCharacter(tag) {
  return [...tag].some(
    (character) => character.codePointAt(0) <= 0x20 || '~^:?*[\\'.includes(character)
  )
}

/** Rejects unsafe ref syntax before a tag is embedded in Git's fetch refspec. */
export function validateTag(tag) {
  if (
    typeof tag !== 'string' ||
    tag.length === 0 ||
    tag.length > 240 ||
    tag.startsWith('-') ||
    tag.startsWith('/') ||
    tag.endsWith('/') ||
    tag.includes('..') ||
    tag.includes('@{') ||
    hasInvalidTagCharacter(tag)
  ) {
    throw new Error(`Invalid upstream tag: ${String(tag)}`)
  }
  if (
    tag
      .split('/')
      .some((part) => part.length === 0 || part.startsWith('.') || part.endsWith('.lock'))
  ) {
    throw new Error(`Invalid upstream tag: ${tag}`)
  }
  return tag
}

/** Returns the exact candidate branch namespace required by the merge lane. */
export function candidateBranchForTag(tag) {
  return `merge-candidate/${validateTag(tag)}`
}

function splitLines(output) {
  return output.length === 0 ? [] : output.split(/\r?\n/).filter(Boolean)
}

function branchExists(git, branch) {
  try {
    git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`])
    return true
  } catch (error) {
    if (gitExitCode(error) === 1) {
      return false
    }
    throw error
  }
}

function parsePackageJson(cwd, readFile) {
  const packageJsonPath = path.join(cwd, 'package.json')
  try {
    return JSON.parse(readFile(packageJsonPath, 'utf8'))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function testPackageManager(packageJson, cwd, fileExists) {
  const packageManager = packageJson.packageManager
  if (typeof packageManager === 'string') {
    if (packageManager.startsWith('pnpm@')) {
      return 'pnpm'
    }
    if (packageManager.startsWith('yarn@')) {
      return 'yarn'
    }
    if (packageManager.startsWith('bun@')) {
      return 'bun'
    }
  }
  if (fileExists(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (fileExists(path.join(cwd, 'yarn.lock'))) {
    return 'yarn'
  }
  if (fileExists(path.join(cwd, 'bun.lockb')) || fileExists(path.join(cwd, 'bun.lock'))) {
    return 'bun'
  }
  return 'npm'
}

/** Finds the upstream repository's declared test command after a clean merge. */
export function discoverUpstreamTestCommand({
  cwd = process.cwd(),
  readFile = readFileSync,
  fileExists = existsSync
} = {}) {
  const packageJson = parsePackageJson(cwd, readFile)
  if (!packageJson || typeof packageJson.scripts?.test !== 'string') {
    return null
  }
  const packageManager = testPackageManager(packageJson, cwd, fileExists)
  return {
    command: packageManager,
    args: ['test'],
    display: `${packageManager} test`,
    source: 'package.json scripts.test'
  }
}

function executeTestCommand(command, args, { cwd }) {
  return spawnSync(command, args, { cwd, shell: false, stdio: 'inherit' })
}

/** Runs the discovered test suite and returns a reportable status instead of throwing. */
export function runUpstreamTests(
  testCommand,
  { cwd = process.cwd(), runCommand = executeTestCommand } = {}
) {
  if (!testCommand) {
    return {
      status: 'not-declared',
      command: null,
      source: null,
      exitCode: null,
      detail: 'No package.json test script was declared by the merged upstream revision.'
    }
  }

  try {
    const result = runCommand(testCommand.command, testCommand.args, { cwd })
    const exitCode = typeof result?.status === 'number' ? result.status : 1
    return {
      status: exitCode === 0 ? 'passed' : 'failed',
      command: testCommand.display,
      source: testCommand.source,
      exitCode,
      detail: result?.error ? String(result.error.message ?? result.error) : null
    }
  } catch (error) {
    return {
      status: 'failed',
      command: testCommand.display,
      source: testCommand.source,
      exitCode: 1,
      detail: error instanceof Error ? error.message : String(error)
    }
  }
}

function markdownCell(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replaceAll('`', '\\`')
}

/** Renders the committed conflict-or-clean assessment for a candidate branch. */
export function renderCandidateReport({
  tag,
  branch,
  pinRef,
  pinCommit,
  targetCommit,
  outcome,
  changedFiles,
  conflictedFiles,
  test,
  now = new Date()
}) {
  const conflicted = new Set(conflictedFiles)
  const testSummary = test.command
    ? `\`${test.command}\` from ${test.source}: **${test.status}**${
        test.exitCode === null ? '' : ` (exit ${test.exitCode})`
      }`
    : `**${test.status}** — ${test.detail}`
  const fileRows = changedFiles.length
    ? changedFiles
        .map(
          (file) => `| \`${markdownCell(file)}\` | ${conflicted.has(file) ? 'conflict' : 'clean'} |`
        )
        .join('\n')
    : '| _No upstream file changes_ | clean |'
  const mergeDetail =
    outcome === 'conflicted'
      ? 'Conflicts were recorded and the merge was aborted; no conflict resolution was attempted.'
      : 'The upstream merge completed without conflicts.'

  return [
    `# Upstream merge candidate: ${tag}`,
    '',
    `- Generated: ${now.toISOString()}`,
    `- Candidate branch: \`${branch}\``,
    `- Pin: \`${pinRef}\` (${pinCommit})`,
    `- Upstream target: \`${tag}\` (${targetCommit})`,
    `- Merge result: **${outcome}**`,
    `- ${mergeDetail}`,
    '- Thin-fork rule: fork surfaces live in added modules; candidate merges may not rewrite panels.',
    '',
    '## Upstream test suite',
    '',
    `- ${testSummary}`,
    test.detail && test.command ? `- Detail: ${test.detail}` : null,
    '',
    '## File assessment',
    '',
    '| File | Assessment |',
    '| --- | --- |',
    fileRows,
    ''
  ]
    .filter((line) => line !== null)
    .join('\n')
}

function reportCommitMessage(tag, outcome) {
  return outcome === 'conflicted'
    ? `chore(upstream): record ${tag} merge conflicts`
    : `chore(upstream): assess ${tag} merge candidate`
}

/**
 * Creates a candidate from the pin, merges a single upstream tag, and commits
 * docs/chat-transport/CANDIDATE-REPORT.md. A conflict is aborted and reported rather than resolved.
 */
export function assessCandidate({
  tag,
  cwd = process.cwd(),
  pinRef = DEFAULT_PIN_REF,
  remote = DEFAULT_REMOTE,
  fetchTarget = true,
  runTests = true,
  git = runGitCommand,
  readFile = readFileSync,
  fileExists = existsSync,
  writeFile = writeFileSync,
  runCommand = executeTestCommand,
  now = new Date()
} = {}) {
  const validatedTag = validateTag(tag)
  const branch = candidateBranchForTag(validatedTag)
  const tagRef = `${TAG_NAMESPACE}/${validatedTag}`
  if (git(['status', '--porcelain']).length > 0) {
    throw new Error('Candidate creation requires a clean worktree.')
  }
  if (branchExists(git, branch)) {
    throw new Error(`Candidate branch already exists and will not be reset: ${branch}`)
  }
  if (fetchTarget) {
    git(['fetch', '--prune', remote, `+refs/tags/${validatedTag}:${tagRef}`])
  }

  const pinCommit = git(['rev-parse', '--verify', `${pinRef}^{commit}`])
  const targetCommit = git(['rev-parse', '--verify', `${tagRef}^{commit}`])
  const changedFiles = splitLines(git(['diff', '--name-only', pinCommit, targetCommit]))
  git(['switch', '--create', branch, pinRef])

  let outcome = 'clean'
  let conflictedFiles = []
  try {
    git(['merge', '--no-ff', '--no-edit', tagRef])
  } catch (error) {
    conflictedFiles = splitLines(git(['diff', '--name-only', '--diff-filter=U']))
    if (conflictedFiles.length === 0) {
      throw error
    }
    git(['merge', '--abort'])
    outcome = 'conflicted'
  }

  const test =
    outcome === 'clean' && runTests
      ? runUpstreamTests(discoverUpstreamTestCommand({ cwd, readFile, fileExists }), {
          cwd,
          runCommand
        })
      : {
          status: 'not-run',
          command: null,
          source: null,
          exitCode: null,
          detail:
            outcome === 'conflicted'
              ? 'Merge conflicts require human resolution before tests can run.'
              : 'Tests were skipped by --skip-tests.'
        }
  const reportPath = path.join(cwd, REPORT_FILENAME)
  const report = renderCandidateReport({
    tag: validatedTag,
    branch,
    pinRef,
    pinCommit,
    targetCommit,
    outcome,
    changedFiles,
    conflictedFiles,
    test,
    now
  })
  writeFile(reportPath, report, 'utf8')
  git(['add', '--', REPORT_FILENAME])
  git(['commit', '-m', reportCommitMessage(validatedTag, outcome)])

  return {
    schemaVersion: 1,
    branch,
    outcome,
    tag: validatedTag,
    pin: { ref: pinRef, commit: pinCommit },
    target: { ref: tagRef, commit: targetCommit },
    files: changedFiles.map((file) => ({
      file,
      assessment: conflictedFiles.includes(file) ? 'conflict' : 'clean'
    })),
    test,
    reportPath
  }
}

/** Parses the candidate CLI without permitting unrecognized destructive flags. */
export function parseCandidateArguments(argv) {
  const options = {
    pinRef: process.env.UPSTREAM_PIN_REF ?? DEFAULT_PIN_REF,
    remote: process.env.UPSTREAM_REMOTE ?? DEFAULT_REMOTE,
    fetchTarget: true,
    runTests: true,
    tag: null
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--no-fetch') {
      options.fetchTarget = false
      continue
    }
    if (argument === '--skip-tests') {
      options.runTests = false
      continue
    }
    if (argument === '--pin-ref' || argument === '--remote') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`)
      }
      if (argument === '--pin-ref') {
        options.pinRef = value
      } else {
        options.remote = value
      }
      index += 1
      continue
    }
    if (argument === '--help') {
      return { help: true }
    }
    if (argument.startsWith('--') || options.tag !== null) {
      throw new Error(`Unknown argument: ${argument}`)
    }
    options.tag = argument
  }
  if (!options.tag) {
    throw new Error('A target upstream tag is required.')
  }
  options.tag = validateTag(options.tag)
  return options
}

/** Maps reported states to useful automation exit codes after the report is committed. */
export function candidateExitCode(result) {
  if (result.outcome === 'conflicted') {
    return 2
  }
  return result.test.status === 'failed' ? 1 : 0
}

function printHelp() {
  console.log(
    'Usage: node tools/upstream/candidate.mjs <tag> [--no-fetch] [--skip-tests] [--pin-ref <ref>]'
  )
}

function main() {
  const options = parseCandidateArguments(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return 0
  }
  const result = assessCandidate(options)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return candidateExitCode(result)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
