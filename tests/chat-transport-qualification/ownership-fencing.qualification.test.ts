import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  adjudicateAgentSessionRestart,
  agentSessionLeaseAdmitsWriter,
  evaluateAgentSessionAcquisition
} from '../../src/shared/agent-session-lease-adjudication'
import { evaluateAgentSessionOperation } from '../../src/shared/agent-session-operation-ledger'
import {
  agentSessionLeaseFixture,
  agentSessionRecordFixture
} from '../../src/shared/agent-session-record.test-fixture'
import {
  computeAgentSessionPayloadFingerprint,
  admitAgentSessionMutation
} from '../../src/shared/agent-session-mutation-envelope'
import { AgentSessionRecordStore } from '../../src/main/runtime/agent-session-record-store'
import type { AgentSessionReserveRequest } from '../../src/main/runtime/agent-session-reservation-admission'
import {
  isResumableStructuredAgentSessionRecord,
  structuredAgentSessionResumeParams
} from '../../src/main/native-chat/agent-session-wire/structured-agent-session-resume-eligibility'

const NOW = 1_800_000_000_000
let temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

function operationId(suffix: string): string {
  return `${NOW}-${suffix.repeat(32).slice(0, 32)}`
}

function reserveRequest(suffix: string): AgentSessionReserveRequest {
  return {
    sessionId: 'qualification-owned-session',
    location: {
      executionHostId: 'local',
      wslDistro: null,
      workspaceId: 'qualification-workspace',
      workspaceKind: 'git-worktree'
    },
    provider: 'codex',
    accountHome: { variable: 'CODEX_HOME', path: join(tmpdir(), 'qualification-codex-home') },
    runtimeKind: 'native',
    expectedFence: null,
    spawnToken: `spawn-${suffix}`,
    claimKeyId: 'qualification-claim',
    handoffOperationId: null,
    probe: { outcome: 'indeterminate', reason: 'new session' },
    operation: {
      callerKey: `qualification-client-${suffix}`,
      operationId: operationId(suffix),
      fingerprint: `fingerprint-${suffix}`
    },
    now: NOW
  }
}

describe('Contract 5 ownership and fencing qualification', () => {
  it('allows exactly one of two durable writers to acquire the initial fence', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'orca-qualification-ownership-'))
    temporaryDirectories.push(directory)
    const [first, second] = await Promise.all([
      AgentSessionRecordStore.open({ directory, hostId: 'local' }),
      AgentSessionRecordStore.open({ directory, hostId: 'local' })
    ])

    const results = await Promise.allSettled([
      first.reserveOwner(reserveRequest('a')),
      second.reserveOwner(reserveRequest('b'))
    ])
    const persisted = await AgentSessionRecordStore.open({ directory, hostId: 'local' })

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(persisted.getRecord('qualification-owned-session')?.lease.runtimeFence).toBe(1)
    expect(persisted.listOperationRows()).toHaveLength(1)
  })

  it('rejects a mutation carrying the old fence after ownership advances', () => {
    const fields = {
      body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'late' }] }
    }
    const hostFingerprint = computeAgentSessionPayloadFingerprint({
      method: 'agentSession.send',
      sessionId: 'session-alpha-1',
      fields
    })
    const envelope = {
      sessionId: 'session-alpha-1',
      clientOperationId: operationId('c'),
      expectedRuntimeFence: 6,
      payloadFingerprint: hostFingerprint
    }
    const ledger = evaluateAgentSessionOperation({
      rows: new Map(),
      callerKey: 'qualification-client',
      operationId: envelope.clientOperationId,
      fingerprint: hostFingerprint,
      now: NOW
    })

    expect(
      admitAgentSessionMutation({
        envelope,
        hostFingerprint,
        ledger,
        lease: agentSessionLeaseFixture({ runtimeKind: 'native', runtimeFence: 7 })
      })
    ).toMatchObject({
      decision: 'refused',
      refusal: { code: 'agent_session_checkpoint_stale', currentFence: 7 }
    })
  })

  it('routes a provider process that outlives its controller into recovery', () => {
    const lease = agentSessionLeaseFixture({ runtimeKind: 'native', leaseDeadlineAt: 1 })
    const decision = adjudicateAgentSessionRestart({
      lease,
      probe: { outcome: 'identity-matched', matchedOn: ['spawn-token'] },
      observedAt: NOW
    })

    expect(decision).toMatchObject({ disposition: 'recovering', stage: 'recovering' })
    expect(agentSessionLeaseAdmitsWriter({ ...lease, unreconciled: true })).toBe(false)
  })

  it('does not resume a second app-server while the Codex thread has a live writer', () => {
    const live = agentSessionRecordFixture(
      agentSessionLeaseFixture({ runtimeKind: 'native', sessionId: 'codex-owned-session' })
    )
    const codexRecord = {
      ...live,
      provider: 'codex' as const,
      accountHome: {
        variable: 'CODEX_HOME' as const,
        path: join(tmpdir(), 'qualification-codex-home')
      },
      providerHandleChain: [
        {
          linkId: 'codex-link',
          origin: 'created' as const,
          mintedAtFence: live.lease.runtimeFence,
          observedAt: NOW,
          handle: { provider: 'codex' as const, threadId: 'writer-owned-thread' }
        }
      ]
    }
    expect(isResumableStructuredAgentSessionRecord(codexRecord)).toBe(false)
    expect(structuredAgentSessionResumeParams(codexRecord, operationId('d'))).toBeNull()

    const released = {
      ...codexRecord,
      lease: {
        ...codexRecord.lease,
        ownerProcess: null,
        reservedSpawnToken: null,
        claimStatus: 'released' as const
      }
    }
    expect(structuredAgentSessionResumeParams(released, operationId('e'))).not.toBeNull()
  })

  it('never transfers ownership because a lease deadline elapsed', () => {
    const expired = agentSessionLeaseFixture({
      runtimeKind: 'native',
      leaseDeadlineAt: 1,
      lastRenewedAt: 1
    })

    expect(
      evaluateAgentSessionAcquisition({
        lease: expired,
        expectedFence: expired.runtimeFence,
        handoffOperationId: null,
        probe: { outcome: 'indeterminate', reason: 'controller unreachable' }
      })
    ).toEqual({ decision: 'refused', code: 'agent_session_ownership_unknown' })
    expect(
      evaluateAgentSessionAcquisition({
        lease: expired,
        expectedFence: expired.runtimeFence,
        handoffOperationId: null,
        probe: { outcome: 'identity-matched', matchedOn: ['spawn-token'] }
      })
    ).toEqual({ decision: 'refused', code: 'agent_session_conflict' })
  })
})
