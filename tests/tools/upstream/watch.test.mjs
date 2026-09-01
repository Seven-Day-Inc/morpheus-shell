import { describe, expect, it } from 'vitest'
import {
  collectChangedAreas,
  collectUpstreamDelta,
  parseWatchArguments,
  selectAvailableTag
} from '../../../tools/upstream/watch.mjs'

function createWatchGit() {
  const calls = []
  const git = (args) => {
    calls.push(args)
    if (args[0] === 'fetch') {
      return ''
    }
    if (args[0] === 'rev-parse' && args.at(-1) === 'pin/v1.4.183^{commit}') {
      return 'pin-commit'
    }
    if (args[0] === 'for-each-ref') {
      return [
        'refs/upstream/tags/v1.4.182',
        'refs/upstream/tags/v1.4.183',
        'refs/upstream/tags/v1.4.184-rc.1',
        'refs/upstream/tags/v1.4.184',
        'refs/upstream/tags/mobile-v1.4.185'
      ].join('\n')
    }
    if (args[0] === 'rev-parse' && args.at(-1) === 'refs/upstream/tags/v1.4.184^{commit}') {
      return 'upstream-commit'
    }
    if (args[0] === 'rev-list') {
      return '17'
    }
    if (args[0] === 'diff') {
      return [
        '.github/workflows/pr.yml',
        'README.md',
        'src/main/server.ts',
        'src/main/session.ts',
        'src/renderer/src/App.tsx'
      ].join('\n')
    }
    throw new Error(`Unexpected mock git command: ${args.join(' ')}`)
  }
  return { git, calls }
}

describe('watch upstream delta', () => {
  it('selects the newest stable SemVer tag after the pin', () => {
    const available = selectAvailableTag(
      [
        'refs/upstream/tags/v1.4.184-rc.1',
        'refs/upstream/tags/v1.4.184',
        'refs/upstream/tags/v1.5.0-rc.1',
        'refs/upstream/tags/not-a-release'
      ],
      'v1.4.183'
    )

    expect(available?.tag).toBe('v1.5.0-rc.1')
  })

  it('emits the machine-readable delta without a networked git test', () => {
    const { git, calls } = createWatchGit()
    const delta = collectUpstreamDelta({
      git,
      now: new Date('2026-08-31T12:00:00.000Z')
    })

    expect(delta).toMatchObject({
      schemaVersion: 1,
      checkedAt: '2026-08-31T12:00:00.000Z',
      available: true,
      newVersion: 'v1.4.184',
      commitCount: 17,
      pin: { ref: 'pin/v1.4.183', version: 'v1.4.183', commit: 'pin-commit' },
      target: { tag: 'v1.4.184', commit: 'upstream-commit' }
    })
    expect(delta.changedAreas).toEqual([
      { area: '.github/workflows', files: 1 },
      { area: 'README.md', files: 1 },
      { area: 'src/main', files: 2 },
      { area: 'src/renderer', files: 1 }
    ])
    expect(calls.some((args) => args[0] === 'fetch')).toBe(false)
  })

  it('uses the explicit namespaced fetch when a caller asks it to refresh', () => {
    const { git, calls } = createWatchGit()
    collectUpstreamDelta({ git, fetch: true })

    expect(calls[0]).toEqual(['fetch', '--prune', 'upstream', '+refs/tags/*:refs/upstream/tags/*'])
  })

  it('groups files into predictable change areas', () => {
    expect(collectChangedAreas(['src/main/a.ts', 'src/main/b.ts', 'package.json'])).toEqual([
      { area: 'package.json', files: 1 },
      { area: 'src/main', files: 2 }
    ])
  })

  it('parses an explicit pin ref and fetch flag', () => {
    expect(parseWatchArguments(['--fetch', '--pin-ref', 'origin/pin/v1.4.183'])).toMatchObject({
      fetch: true,
      pinRef: 'origin/pin/v1.4.183',
      pinTag: 'v1.4.183'
    })
  })
})
