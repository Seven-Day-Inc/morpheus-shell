import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalMessageItem } from '../../src/shared/agent-session-journal-types'
import { computeAgentSessionPayloadFingerprint } from '../../src/shared/agent-session-mutation-envelope'
import type { AgentSessionMutationEnvelope } from '../../src/shared/agent-session-wire'
import { AgentSessionRecordStore } from '../../src/main/runtime/agent-session-record-store'
import {
  openAgentSessionJournal,
  type AgentSessionJournal
} from '../../src/main/native-chat/agent-session-journal/journal-store'
import type { StructuredAgentSessionAdapter } from '../../src/main/native-chat/agent-session-wire/structured-agent-session-adapter'
import { admitAndRunAgentSessionMutation } from '../../src/main/native-chat/agent-session-wire/structured-agent-session-mutation-admission'
import { sendPlan } from '../../src/main/native-chat/agent-session-wire/structured-agent-session-mutation-plans'
import {
  performSend,
  type AgentSessionTurnContext
} from '../../src/main/native-chat/agent-session-wire/structured-agent-session-turns'

const NOW = 1_800_000_000_000
const SESSION_ID = 'qualification-session'
const THREAD_ID = 'qualification-thread'
const BOOT_OPERATION_ID = `${NOW}-${'b'.repeat(32)}`
const SEND_OPERATION_ID = `${NOW + 1}-${'a'.repeat(32)}`
const JOURNAL_IDENTITY = {
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

async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function message(text: string): AgentJournalMessageItem {
  return { kind: 'message', role: 'user', blocks: [{ type: 'text', text }] }
}

function fingerprint(body: AgentJournalMessageItem): string {
  return computeAgentSessionPayloadFingerprint({
    method: 'agentSession.send',
    sessionId: SESSION_ID,
    fields: { body }
  })
}

function envelope(body: AgentJournalMessageItem): AgentSessionMutationEnvelope {
  return {
    sessionId: SESSION_ID,
    clientOperationId: SEND_OPERATION_ID,
    expectedRuntimeFence: 1,
    payloadFingerprint: fingerprint(body)
  }
}

function acceptedDispatch(): StructuredAgentSessionAdapter['dispatch'] {
  return vi.fn(async () => ({
    state: 'accepted' as const,
    providerIdentity: {
      provider: 'codex' as const,
      threadId: THREAD_ID,
      turnId: 'turn-1',
      ordinal: 0
    }
  }))
}

function adapterWith(
  dispatch: StructuredAgentSessionAdapter['dispatch']
): StructuredAgentSessionAdapter {
  return { dispatch } as StructuredAgentSessionAdapter
}

function turnContext(
  journal: AgentSessionJournal,
  dispatch: StructuredAgentSessionAdapter['dispatch']
): AgentSessionTurnContext {
  return {
    sessionId: SESSION_ID,
    journal,
    fence: 1,
    adapter: adapterWith(dispatch),
    persistOptions: async () => undefined,
    resolvedBy: 'qualification-client',
    publish: vi.fn(),
    now: () => NOW + 10
  }
}

async function openJournal(
  directory?: string
): Promise<{ directory: string; journal: AgentSessionJournal }> {
  const journalDirectory = directory ?? (await temporaryDirectory('orca-qualification-journal-'))
  return {
    directory: journalDirectory,
    journal: await openAgentSessionJournal({
      identity: JOURNAL_IDENTITY,
      journalDir: journalDirectory,
      autoCompact: false,
      now: () => NOW
    })
  }
}

async function createOwnedStore(): Promise<{
  store: AgentSessionRecordStore
  directory: string
}> {
  const directory = await temporaryDirectory('orca-qualification-store-')
  const store = await AgentSessionRecordStore.open({
    directory,
    hostId: 'local'
  })
  const reserved = await store.reserveOwner({
    sessionId: SESSION_ID,
    location: {
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: JOURNAL_IDENTITY.workspaceId,
      workspaceKind: 'git-worktree'
    },
    provider: 'codex',
    accountHome: { variable: 'CODEX_HOME', path: join(tmpdir(), 'qualification-codex-home') },
    runtimeKind: 'native',
    expectedFence: null,
    spawnToken: 'qualification-spawn',
    claimKeyId: 'qualification-claim',
    handoffOperationId: null,
    probe: { outcome: 'indeterminate', reason: 'new session' },
    operation: {
      callerKey: 'qualification-bootstrap',
      operationId: BOOT_OPERATION_ID,
      fingerprint: 'qualification-bootstrap-fingerprint'
    },
    now: NOW
  })
  await store.commitProcessIdentity({
    sessionId: SESSION_ID,
    fence: reserved.record.lease.runtimeFence,
    process: {
      hostId: 'local',
      pid: 4242,
      processStartTimeMs: NOW - 1_000,
      spawnToken: 'qualification-spawn'
    },
    now: NOW
  })
  await store.proveOwner({
    sessionId: SESSION_ID,
    fence: reserved.record.lease.runtimeFence,
    link: {
      linkId: 'qualification-link',
      handle: { provider: 'codex', threadId: THREAD_ID },
      origin: 'created',
      mintedAtFence: reserved.record.lease.runtimeFence,
      observedAt: NOW
    },
    now: NOW
  })
  return { store, directory }
}

describe('Contract 2 mutation delivery qualification', () => {
  it('persists one intent and one user item, and dispatches an identical retry once', async () => {
    const { store, directory: storeDirectory } = await createOwnedStore()
    const { directory, journal } = await openJournal()
    const body = message('one durable mutation')
    const mutationEnvelope = envelope(body)
    const dispatch = acceptedDispatch()
    const request = {
      store,
      adapter: adapterWith(dispatch),
      callerKey: 'qualification-client',
      envelope: mutationEnvelope,
      plan: sendPlan({ envelope: mutationEnvelope, body }),
      journal,
      publish: vi.fn(),
      now: () => NOW + 10
    }

    const first = await admitAndRunAgentSessionMutation(request)
    const replay = await admitAndRunAgentSessionMutation(request)
    const reopenedStore = await AgentSessionRecordStore.open({
      directory: storeDirectory,
      hostId: 'local'
    })
    const reopenedJournal = (await openJournal(directory)).journal

    expect(first).toMatchObject({ ok: true, replayed: false })
    expect(replay).toMatchObject({ ok: true, replayed: true })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(
      store.listOperationRows().filter((row) => row.operationId === SEND_OPERATION_ID)
    ).toHaveLength(1)
    expect(reopenedJournal.submissions()).toHaveLength(1)
    expect(
      reopenedJournal
        .snapshot()
        .items.filter((item) => item.body.kind === 'message' && item.body.role === 'user')
    ).toHaveLength(1)
    expect(
      reopenedStore.listOperationRows().filter((row) => row.operationId === SEND_OPERATION_ID)
    ).toHaveLength(1)
  })

  it('rejects one mutation id carrying a changed payload without a second dispatch', async () => {
    const { store } = await createOwnedStore()
    const { journal } = await openJournal()
    const originalBody = message('original payload')
    const originalEnvelope = envelope(originalBody)
    const dispatch = acceptedDispatch()
    const baseRequest = {
      store,
      adapter: adapterWith(dispatch),
      callerKey: 'qualification-client',
      journal,
      publish: vi.fn(),
      now: () => NOW + 10
    }
    await admitAndRunAgentSessionMutation({
      ...baseRequest,
      envelope: originalEnvelope,
      plan: sendPlan({ envelope: originalEnvelope, body: originalBody })
    })

    const changedBody = message('changed payload')
    const changedEnvelope = envelope(changedBody)
    const conflict = await admitAndRunAgentSessionMutation({
      ...baseRequest,
      envelope: changedEnvelope,
      plan: sendPlan({ envelope: changedEnvelope, body: changedBody })
    })

    expect(conflict).toMatchObject({
      ok: false,
      refusal: { code: 'agent_session_operation_conflict' }
    })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(journal.submissions()).toHaveLength(1)
  })

  it.each(['local commit before dispatch', 'attempt marker before provider call'])(
    'recovers %s as unknown without automatic dispatch',
    async () => {
      const { directory, journal } = await openJournal()
      const body = message('crash before provider call')
      const input = {
        clientMessageId: SEND_OPERATION_ID,
        payloadFingerprint: fingerprint(body),
        body
      }
      await journal.appendSubmission({ ...input, fence: 1 })

      const reopened = (await openJournal(directory)).journal
      expect(await reopened.markPendingSubmissionsUnknown(1)).toEqual([SEND_OPERATION_ID])
      const dispatch = acceptedDispatch()
      const replay = await performSend(turnContext(reopened, dispatch), input)

      expect(replay).toMatchObject({
        ok: true,
        value: { submission: { dispatchState: 'unknown' } }
      })
      expect(dispatch).not.toHaveBeenCalled()
      expect(reopened.receiptFor(SEND_OPERATION_ID)).toBeNull()
      expect(reopened.snapshot().items).toHaveLength(1)
    }
  )

  it('records a lost provider response as unknown and never silently redispatches', async () => {
    const { directory, journal } = await openJournal()
    const body = message('provider response was lost')
    const input = {
      clientMessageId: SEND_OPERATION_ID,
      payloadFingerprint: fingerprint(body),
      body
    }
    const dispatch: StructuredAgentSessionAdapter['dispatch'] = vi.fn(async () => {
      throw new Error('connection closed after provider call')
    })

    const first = await performSend(turnContext(journal, dispatch), input)
    const reopened = (await openJournal(directory)).journal
    const replay = await performSend(turnContext(reopened, dispatch), input)

    expect(first).toMatchObject({ ok: true, value: { submission: { dispatchState: 'unknown' } } })
    expect(replay).toMatchObject({ ok: true, value: { submission: { dispatchState: 'unknown' } } })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(reopened.receiptFor(SEND_OPERATION_ID)).toBeNull()
  })

  it('diagnoses that an explicit unknown retry redispatches the same mutation id', async () => {
    const { journal } = await openJournal()
    const body = message('retry after unknown')
    const input = {
      clientMessageId: SEND_OPERATION_ID,
      payloadFingerprint: fingerprint(body),
      body
    }
    await journal.appendSubmission({ ...input, fence: 1 })
    await journal.resolveDispatch({
      clientMessageId: SEND_OPERATION_ID,
      state: 'unknown',
      reason: 'response lost',
      fence: 1
    })
    const dispatch = acceptedDispatch()

    const result = await performSend(turnContext(journal, dispatch), {
      ...input,
      retryUnknown: true
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        clientMessageId: SEND_OPERATION_ID,
        submission: { dispatchState: 'accepted' }
      }
    })
    expect(dispatch).toHaveBeenCalledOnce()
  })

  it('recovers an accepted response lost before journal resolution as unknown', async () => {
    const { directory, journal } = await openJournal()
    const body = message('accepted before controller crash')
    const input = {
      clientMessageId: SEND_OPERATION_ID,
      payloadFingerprint: fingerprint(body),
      body
    }
    const dispatch = acceptedDispatch()
    await journal.appendSubmission({ ...input, fence: 1 })
    await dispatch({ sessionId: SESSION_ID, clientMessageId: SEND_OPERATION_ID, body, fence: 1 })

    const reopened = (await openJournal(directory)).journal
    expect(await reopened.markPendingSubmissionsUnknown(1)).toEqual([SEND_OPERATION_ID])
    const replay = await performSend(turnContext(reopened, dispatch), input)

    expect(replay).toMatchObject({ ok: true, value: { submission: { dispatchState: 'unknown' } } })
    expect(dispatch).toHaveBeenCalledOnce()
    expect(reopened.receiptFor(SEND_OPERATION_ID)).toBeNull()
  })
})
