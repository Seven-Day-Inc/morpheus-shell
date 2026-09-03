import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRemoteRuntimeTransportMocks,
  type MultiplexSubscriptionCallbacks
} from './remote-runtime-pty-transport-test-harness'

let subscriptionCallbacks: MultiplexSubscriptionCallbacks = null
let resolvedPaneHandle = 'terminal-1'

const { runtimeCall, resetRemoteRuntimeTransport, subscribedTerminalHandles } =
  createRemoteRuntimeTransportMocks({
    getCallbacks: () => subscriptionCallbacks,
    setCallbacks: (callbacks) => {
      subscriptionCallbacks = callbacks
    },
    getResolvedPaneHandle: () => resolvedPaneHandle,
    setResolvedPaneHandle: (handle) => {
      resolvedPaneHandle = handle
    }
  })

function hostSurface(status: 'pending-handle' | 'ready'): unknown {
  return {
    worktree: 'id:wt-1',
    publicationEpoch: 'epoch-1',
    snapshotVersion: 1,
    activeGroupId: 'group-1',
    activeTabId: 'host-tab-1::leaf-1',
    activeTabType: 'terminal',
    tabs: [
      {
        type: 'terminal',
        id: 'host-tab-1::leaf-1',
        parentTabId: 'host-tab-1',
        leafId: 'leaf-1',
        title: 'Terminal 1',
        isActive: true,
        status,
        terminal: status === 'ready' ? 'terminal-1' : null
      }
    ]
  }
}

describe('pending paired host terminal attachment', () => {
  beforeEach(() => {
    resetRemoteRuntimeTransport()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parks an unmaterialized host surface for a later recovery instead of staying connecting', async () => {
    let materialized = false
    runtimeCall.mockImplementation((args: { method: string }) => {
      if (args.method === 'session.tabs.activate' || args.method === 'session.tabs.list') {
        return Promise.resolve({
          ok: true,
          result: hostSurface(materialized ? 'ready' : 'pending-handle')
        })
      }
      return Promise.resolve({ ok: true, result: { terminal: { handle: 'terminal-1' } } })
    })
    const { createRemoteRuntimePtyTransport } = await import('./remote-runtime-pty-transport')
    const { REMOTE_RUNTIME_AUTO_RECOVERY_TIMEOUT_MS, retryAllRemoteRuntimePtyRecoveriesNow } =
      await import('./remote-runtime-pty-recovery-state')
    const transport = createRemoteRuntimePtyTransport('env-1', {
      worktreeId: 'wt-1',
      tabId: 'web-terminal-host-tab-1',
      leafId: 'leaf-1'
    })

    const connect = transport.connect({ url: '', callbacks: {} })
    await vi.advanceTimersByTimeAsync(15_000)
    await expect(connect).resolves.toBeUndefined()
    expect(transport.getRecoveryState?.().phase).toBe('recovering')
    expect(
      runtimeCall.mock.calls.filter((call) => call[0].method === 'session.tabs.activate').length
    ).toBeGreaterThan(1)

    await vi.advanceTimersByTimeAsync(REMOTE_RUNTIME_AUTO_RECOVERY_TIMEOUT_MS)
    expect(transport.getRecoveryState?.().phase).toBe('disconnected')
    materialized = true
    expect(retryAllRemoteRuntimePtyRecoveriesNow()).toBe(1)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(subscribedTerminalHandles()).toContain('terminal-1')
    expect(transport.getPtyId()).toBe('remote:env-1@@terminal-1')
    transport.destroy?.()
  })
})
