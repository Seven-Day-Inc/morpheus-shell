import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentJournalMessageItem } from '../../src/shared/agent-session-journal-types'
import { projectStructuredAgentSessionStatus } from '../../src/shared/structured-agent-session-projection'
import { loadJournal } from '../../src/main/native-chat/agent-session-journal/journal-open'
import {
  applyJournalRow,
  createJournalReducerState,
  renderJournalState
} from '../../src/main/native-chat/agent-session-journal/journal-reducer'
import {
  openAgentSessionJournal,
  type AgentSessionJournal
} from '../../src/main/native-chat/agent-session-journal/journal-store'

const SESSION_ID = 'qualification-replay-session'
const THREAD_ID = 'qualification-replay-thread'
const NOW = 1_800_000_000_000
const IDENTITY = {
  sessionId: SESSION_ID,
  workspaceId: 'qualification-workspace',
  hostId: 'local',
  agent: 'codex' as const,
  providerHandle: { kind: 'codex' as const, threadId: THREAD_ID }
}

let temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

async function journalAt(
  directory?: string,
  options: { epochs?: string[]; clock?: { value: number } } = {}
): Promise<{ directory: string; journal: AgentSessionJournal }> {
  const journalDirectory =
    directory ?? (await mkdtemp(join(tmpdir(), 'orca-qualification-replay-')))
  if (!directory) {
    temporaryDirectories.push(journalDirectory)
  }
  const epochs = options.epochs ?? ['qualification-epoch']
  const clock = options.clock ?? { value: NOW }
  return {
    directory: journalDirectory,
    journal: await openAgentSessionJournal({
      identity: IDENTITY,
      journalDir: journalDirectory,
      autoCompact: false,
      mintEpoch: () => epochs.shift() ?? 'qualification-fallback-epoch',
      now: () => clock.value++
    })
  }
}

function assistant(text: string): AgentJournalMessageItem {
  return { kind: 'message', role: 'assistant', blocks: [{ type: 'text', text }] }
}

describe('Contract 3 replay and projection qualification', () => {
  it('reopens after a streaming delta and converges to the uninterrupted projection', async () => {
    const clock = { value: NOW }
    const reopenedPath = await journalAt(undefined, { clock })
    const identity = {
      provider: 'codex' as const,
      threadId: THREAD_ID,
      turnId: 'turn-1',
      ordinal: 0
    }
    await reopenedPath.journal.appendItem(identity, assistant('partial'), { fence: 1 })

    const reopened = (await journalAt(reopenedPath.directory, { clock })).journal
    expect(reopened.snapshot().items).toHaveLength(1)
    await reopened.appendItem(identity, assistant('complete'), { fence: 1 })

    const uninterruptedPath = await journalAt(undefined, { clock: { value: NOW } })
    await uninterruptedPath.journal.appendItem(identity, assistant('partial'), { fence: 1 })
    await uninterruptedPath.journal.appendItem(identity, assistant('complete'), { fence: 1 })

    expect(reopened.snapshot()).toEqual(uninterruptedPath.journal.snapshot())
    expect(reopened.snapshot().items).toMatchObject([
      { revision: 2, body: { kind: 'message', blocks: [{ type: 'text', text: 'complete' }] } }
    ])
  })

  it('makes replay from zero equal the compacted snapshot plus a later tail', async () => {
    const clock = { value: NOW }
    const { directory, journal } = await journalAt(undefined, { clock })
    await journal.appendItem(
      { provider: 'codex', threadId: THREAD_ID, turnId: 'turn-1', ordinal: 0 },
      assistant('first'),
      { fence: 1 }
    )
    await journal.appendItem(
      { provider: 'codex', threadId: THREAD_ID, turnId: 'turn-1', ordinal: 1 },
      assistant('second'),
      { fence: 1 }
    )
    const beforeCompaction = journal.readSince({ epoch: journal.epoch, sequence: 0 })
    if (!beforeCompaction.ok) {
      throw new Error(beforeCompaction.reset)
    }
    await journal.compact(clock.value + 1_000, { minTailRows: 1, retainTailMs: 0 })
    const compactedThrough = journal.cursor().sequence
    await journal.appendItem(
      { provider: 'codex', threadId: THREAD_ID, turnId: 'turn-1', ordinal: 2 },
      assistant('tail'),
      { fence: 1 }
    )
    const tail = journal.readSince({ epoch: journal.epoch, sequence: compactedThrough })
    if (!tail.ok) {
      throw new Error(tail.reset)
    }

    const fromZero = createJournalReducerState(SESSION_ID, journal.epoch)
    for (const row of [...beforeCompaction.rows, ...tail.rows]) {
      applyJournalRow(fromZero, row)
    }
    const snapshotPlusTail = await loadJournal(directory, SESSION_ID)

    expect(snapshotPlusTail).not.toBeNull()
    expect(renderJournalState(snapshotPlusTail!.state)).toEqual(renderJournalState(fromZero))
    expect(renderJournalState(fromZero)).toEqual(journal.snapshot())
  })

  it('upserts replayed provider events instead of duplicating their item', async () => {
    const { directory, journal } = await journalAt()
    const identity = {
      provider: 'codex' as const,
      threadId: THREAD_ID,
      turnId: 'turn-2',
      ordinal: 0
    }
    await journal.appendItem(identity, assistant('delta'), { fence: 1 })
    const reopened = (await journalAt(directory)).journal
    await reopened.appendItem(identity, assistant('completed'), { fence: 1 })
    const replayedAgain = (await journalAt(directory)).journal

    expect(replayedAgain.snapshot().items).toHaveLength(1)
    expect(replayedAgain.snapshot().items[0]).toMatchObject({
      revision: 2,
      body: { kind: 'message', blocks: [{ type: 'text', text: 'completed' }] }
    })
  })

  it('diagnoses epoch sequence reuse and the absence of flat session-wide normalization', async () => {
    const epochs = ['epoch-before-handoff', 'epoch-after-handoff']
    const { journal } = await journalAt(undefined, { epochs })
    await journal.appendItem(
      { provider: 'codex', threadId: THREAD_ID, turnId: 'approval', ordinal: 0 },
      {
        kind: 'approval',
        title: 'Approve?',
        detail: null,
        options: [{ id: 'yes', label: 'Yes' }],
        resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
      },
      { fence: 1 }
    )
    const oldCursor = journal.cursor()
    await journal.rollEpoch('handle_forked', 2)
    const rolloverCursor = journal.cursor()
    await journal.appendItem(
      { provider: 'orca', clientMessageId: 'ownership-change' },
      { kind: 'status', text: 'Owner changed after interruption.' },
      { fence: 2 }
    )

    expect(oldCursor).toEqual({ epoch: 'epoch-before-handoff', sequence: 2 })
    expect(rolloverCursor).toEqual({ epoch: 'epoch-after-handoff', sequence: 1 })
    expect(journal.cursor()).toEqual({ epoch: 'epoch-after-handoff', sequence: 2 })
    expect(journal.readSince(oldCursor)).toEqual({ ok: false, reset: 'epoch_changed' })
    expect(journal.snapshot().items.map((item) => item.body)).toEqual([
      { kind: 'status', text: 'Owner changed after interruption.' }
    ])
  })

  it('diagnoses that a legacy-import epoch carries no freshness certificate', async () => {
    const { journal } = await journalAt()
    await journal.replaceEpochItems('legacy_import', 1, [
      {
        identity: {
          provider: 'legacy',
          agent: 'codex',
          sessionId: 'legacy-provider-session',
          recordId: 'legacy-1'
        },
        body: assistant('imported history')
      }
    ])
    const snapshot = journal.snapshot()

    expect('freshness' in snapshot).toBe(false)
    expect(projectStructuredAgentSessionStatus(snapshot.items)).toBe('idle')
  })
})
