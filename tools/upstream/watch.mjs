#!/usr/bin/env node

import { pathToFileURL } from 'node:url'
import { runGitCommand } from './git-command-runner.mjs'

const DEFAULT_PIN_REF = 'pin/v1.4.183'
const DEFAULT_REMOTE = 'upstream'
const TAG_NAMESPACE = 'refs/upstream/tags'
const UPSTREAM_REPOSITORY = 'stablyai/orca'
const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

/** Parses an upstream version tag without accepting unrelated tags. */
export function parseVersionTag(tag) {
  const match = VERSION_PATTERN.exec(tag)
  if (!match) {
    return null
  }
  return {
    tag,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null
  }
}

function comparePrerelease(left, right) {
  if (left === right) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }

  const leftParts = left.split('.')
  const rightParts = right.split('.')
  const longestLength = Math.max(leftParts.length, rightParts.length)
  for (let index = 0; index < longestLength; index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    if (leftPart === rightPart) {
      continue
    }
    if (leftPart === undefined) {
      return -1
    }
    if (rightPart === undefined) {
      return 1
    }
    const leftNumber = Number(leftPart)
    const rightNumber = Number(rightPart)
    const leftIsNumber = /^\d+$/.test(leftPart)
    const rightIsNumber = /^\d+$/.test(rightPart)
    if (leftIsNumber && rightIsNumber) {
      return leftNumber - rightNumber
    }
    if (leftIsNumber) {
      return -1
    }
    if (rightIsNumber) {
      return 1
    }
    return leftPart.localeCompare(rightPart)
  }
  return 0
}

/** Compares parsed SemVer tags in ascending order. */
export function compareVersions(left, right) {
  for (const part of ['major', 'minor', 'patch']) {
    if (left[part] !== right[part]) {
      return left[part] - right[part]
    }
  }
  return comparePrerelease(left.prerelease, right.prerelease)
}

/** Extracts the version encoded in the project's pin branch name. */
export function inferPinTag(pinRef) {
  const match = /(?:^|\/)((?:v)?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:$|\/)/.exec(pinRef)
  return match?.[1] ?? null
}

function tagNameFromRef(ref) {
  const prefix = `${TAG_NAMESPACE}/`
  return ref.startsWith(prefix) ? ref.slice(prefix.length) : null
}

/** Chooses the newest upstream tag newer than the configured pin. */
export function selectAvailableTag(refs, pinTag) {
  const parsedPinTag = parseVersionTag(pinTag)
  if (!parsedPinTag) {
    throw new Error(`Cannot determine a SemVer pin from ${pinTag ?? 'the configured pin ref'}`)
  }

  return refs
    .map(tagNameFromRef)
    .filter((tag) => tag !== null)
    .map((tag) => parseVersionTag(tag))
    .filter((tag) => tag !== null && compareVersions(tag, parsedPinTag) > 0)
    .sort(compareVersions)
    .at(-1)
}

function splitLines(output) {
  return output.length === 0 ? [] : output.split(/\r?\n/).filter(Boolean)
}

/** Groups changed paths into stable two-segment areas for issue summaries. */
export function collectChangedAreas(changedFiles) {
  const totals = new Map()
  for (const file of changedFiles) {
    const parts = file.split('/').filter(Boolean)
    const area = parts.slice(0, Math.min(2, parts.length)).join('/')
    totals.set(area, (totals.get(area) ?? 0) + 1)
  }
  return [...totals]
    .map(([area, files]) => ({ area, files }))
    .sort((left, right) => left.area.localeCompare(right.area))
}

/**
 * Collects a JSON-ready delta from the pin to the newest available upstream
 * SemVer tag. Upstream tags are mirrored under refs/upstream/tags, never pushed.
 */
export function collectUpstreamDelta({
  git = runGitCommand,
  pinRef = DEFAULT_PIN_REF,
  pinTag = inferPinTag(pinRef),
  remote = DEFAULT_REMOTE,
  fetch = false,
  now = new Date()
} = {}) {
  if (fetch) {
    git(['fetch', '--prune', remote, '+refs/tags/*:refs/upstream/tags/*'])
  }

  const pinCommit = git(['rev-parse', '--verify', `${pinRef}^{commit}`])
  const tagRefs = splitLines(git(['for-each-ref', '--format=%(refname)', TAG_NAMESPACE]))
  const target = selectAvailableTag(tagRefs, pinTag)
  if (!target) {
    return {
      schemaVersion: 1,
      checkedAt: now.toISOString(),
      upstream: { repository: UPSTREAM_REPOSITORY, remote, tagNamespace: TAG_NAMESPACE },
      pin: { ref: pinRef, version: pinTag, commit: pinCommit },
      available: false,
      newVersion: null,
      target: null,
      commitCount: 0,
      changedFileCount: 0,
      changedAreas: []
    }
  }

  const targetRef = `${TAG_NAMESPACE}/${target.tag}`
  const targetCommit = git(['rev-parse', '--verify', `${targetRef}^{commit}`])
  const commitCount = Number(git(['rev-list', '--count', `${pinCommit}..${targetCommit}`]))
  const changedFiles = splitLines(git(['diff', '--name-only', pinCommit, targetCommit]))

  return {
    schemaVersion: 1,
    checkedAt: now.toISOString(),
    upstream: { repository: UPSTREAM_REPOSITORY, remote, tagNamespace: TAG_NAMESPACE },
    pin: { ref: pinRef, version: pinTag, commit: pinCommit },
    available: true,
    newVersion: target.tag,
    target: { tag: target.tag, commit: targetCommit },
    commitCount,
    changedFileCount: changedFiles.length,
    changedAreas: collectChangedAreas(changedFiles)
  }
}

/** Parses the small CLI surface so workflow output remains JSON-only. */
export function parseWatchArguments(argv) {
  const options = {
    fetch: false,
    pinRef: process.env.UPSTREAM_PIN_REF ?? DEFAULT_PIN_REF,
    pinTag: process.env.UPSTREAM_PIN_TAG,
    remote: process.env.UPSTREAM_REMOTE ?? DEFAULT_REMOTE
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--fetch') {
      options.fetch = true
      continue
    }
    if (argument === '--pin-ref' || argument === '--pin-tag' || argument === '--remote') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value`)
      }
      if (argument === '--pin-ref') {
        options.pinRef = value
      } else if (argument === '--pin-tag') {
        options.pinTag = value
      } else {
        options.remote = value
      }
      index += 1
      continue
    }
    if (argument === '--help') {
      return { help: true }
    }
    throw new Error(`Unknown argument: ${argument}`)
  }
  options.pinTag ??= inferPinTag(options.pinRef)
  return options
}

function printHelp() {
  console.log('Usage: node tools/upstream/watch.mjs [--fetch] [--pin-ref <ref>] [--pin-tag <tag>]')
}

function main() {
  const options = parseWatchArguments(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return 0
  }
  const delta = collectUpstreamDelta(options)
  process.stdout.write(`${JSON.stringify(delta, null, 2)}\n`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
