import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  assessCandidate,
  candidateBranchForTag,
  candidateExitCode,
  discoverUpstreamTestCommand,
  validateTag
} from '../../../tools/upstream/candidate.mjs'

function missingRefError() {
  const error = new Error('missing ref')
  error.exitCode = 1
  return error
}

function createCandidateGit({ conflict = false } = {}) {
  const calls = []
  const git = (args) => {
    calls.push(args)
    if (args[0] === 'status' || args[0] === 'fetch' || args[0] === 'switch') {
      return ''
    }
    if (args[0] === 'show-ref') {
      throw missingRefError()
    }
    if (args[0] === 'rev-parse') {
      return args.at(-1).startsWith('pin/') ? 'pin-commit' : 'upstream-commit'
    }
    if (args[0] === 'diff' && args.includes('--diff-filter=U')) {
      return conflict ? 'src/renderer/src/panel.tsx' : ''
    }
    if (args[0] === 'diff') {
      return ['src/main/bootstrap.ts', 'src/renderer/src/panel.tsx'].join('\n')
    }
    if (args[0] === 'merge' && args[1] === '--no-ff' && conflict) {
      throw new Error('merge conflict')
    }
    if (args[0] === 'merge' || args[0] === 'add' || args[0] === 'commit') {
      return ''
    }
    throw new Error(`Unexpected mock git command: ${args.join(' ')}`)
  }
  return { git, calls }
}

function candidateOptions(git, overrides = {}) {
  const writes = []
  const testCalls = []
  const result = assessCandidate({
    tag: 'v1.4.184',
    cwd: 'candidate-fixture',
    fetchTarget: false,
    git,
    readFile: () =>
      JSON.stringify({ packageManager: 'pnpm@10.24.0', scripts: { test: 'vitest run' } }),
    fileExists: () => false,
    makeDirectory: () => {},
    writeFile: (...args) => writes.push(args),
    runCommand: (...args) => {
      testCalls.push(args)
      return { status: 0 }
    },
    now: new Date('2026-08-31T12:00:00.000Z'),
    ...overrides
  })
  return { result, writes, testCalls }
}

describe('upstream merge candidates', () => {
  it('creates a clean candidate, runs the discovered upstream test suite, and records every file', () => {
    const { git, calls } = createCandidateGit()
    const { result, writes, testCalls } = candidateOptions(git)

    expect(result).toMatchObject({
      branch: 'merge-candidate/v1.4.184',
      outcome: 'clean',
      test: { status: 'passed', command: 'pnpm test' },
      files: [
        { file: 'src/main/bootstrap.ts', assessment: 'clean' },
        { file: 'src/renderer/src/panel.tsx', assessment: 'clean' }
      ]
    })
    expect(testCalls).toEqual([['pnpm', ['test'], { cwd: 'candidate-fixture' }]])
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toBe(
      join('candidate-fixture', 'docs', 'chat-transport', 'CANDIDATE-REPORT.md')
    )
    expect(writes[0][1]).toContain('| `src/renderer/src/panel.tsx` | clean |')
    expect(calls).toContainEqual([
      'add',
      '--',
      join('docs', 'chat-transport', 'CANDIDATE-REPORT.md')
    ])
    expect(calls).toContainEqual(['merge', '--no-ff', '--no-edit', 'refs/upstream/tags/v1.4.184'])
    expect(calls.some((args) => args[0] === 'merge' && args[1] === '--abort')).toBe(false)
    expect(calls.some((args) => args[0] === 'checkout' || args[0] === 'restore')).toBe(false)
  })

  it('creates a missing report directory before writing with the real filesystem', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'orca-upstream-candidate-'))
    try {
      const { git } = createCandidateGit()
      const { result } = candidateOptions(git, {
        cwd,
        makeDirectory: mkdirSync,
        writeFile: writeFileSync
      })

      expect(readFileSync(result.reportPath, 'utf8')).toContain(
        '# Upstream merge candidate: v1.4.184'
      )
    } finally {
      rmSync(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 })
    }
  })

  it('aborts a conflicted merge, commits its report, and never runs tests on guesses', () => {
    const { git, calls } = createCandidateGit({ conflict: true })
    const { result, writes, testCalls } = candidateOptions(git)

    expect(result.outcome).toBe('conflicted')
    expect(result.files).toEqual([
      { file: 'src/main/bootstrap.ts', assessment: 'clean' },
      { file: 'src/renderer/src/panel.tsx', assessment: 'conflict' }
    ])
    expect(testCalls).toEqual([])
    expect(writes[0][1]).toContain('no conflict resolution was attempted')
    expect(writes[0][1]).toContain('| `src/renderer/src/panel.tsx` | conflict |')
    expect(calls).toContainEqual(['merge', '--abort'])
    expect(candidateExitCode(result)).toBe(2)
  })

  it('discovers lockfile-specific test commands without running package managers', () => {
    expect(
      discoverUpstreamTestCommand({
        cwd: 'candidate-fixture',
        readFile: () => JSON.stringify({ scripts: { test: 'node --test' } }),
        fileExists: (file) => file.endsWith('yarn.lock')
      })
    ).toMatchObject({ command: 'yarn', args: ['test'], display: 'yarn test' })
  })

  it('rejects unsafe target tags before they reach Git', () => {
    expect(() => validateTag('../v1.4.184')).toThrow('Invalid upstream tag')
    expect(() => candidateBranchForTag('-v1.4.184')).toThrow('Invalid upstream tag')
  })
})
