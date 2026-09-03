// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

const { retryAllRemoteRuntimePtyRecoveriesNowMock } = vi.hoisted(() => ({
  retryAllRemoteRuntimePtyRecoveriesNowMock: vi.fn()
}))

vi.mock('@/components/terminal-pane/remote-runtime-pty-recovery-state', () => ({
  retryAllRemoteRuntimePtyRecoveriesNow: retryAllRemoteRuntimePtyRecoveriesNowMock
}))

import { useRemoteRuntimeRecoveryTriggers } from './use-remote-runtime-recovery-triggers'
import { RUNTIME_ENVIRONMENT_RECONNECTED_EVENT } from './runtime-environment-recovery-event'

describe('useRemoteRuntimeRecoveryTriggers', () => {
  let systemResumedCallback: (() => void) | null = null
  const unsubscribeSystemResumed = vi.fn()
  const onSystemResumed = vi.fn((callback: () => void) => {
    systemResumedCallback = callback
    return unsubscribeSystemResumed
  })
  const retryConnectionsNow = vi.fn(() => Promise.resolve())

  beforeEach(() => {
    systemResumedCallback = null
    unsubscribeSystemResumed.mockClear()
    onSystemResumed.mockClear()
    retryConnectionsNow.mockClear()
    retryAllRemoteRuntimePtyRecoveriesNowMock.mockClear()
    ;(window as unknown as { api: unknown }).api = {
      ui: { onSystemResumed },
      runtimeEnvironments: { retryConnectionsNow }
    }
  })

  afterEach(() => {
    delete (window as unknown as { api?: unknown }).api
  })

  it('advances shared-control and pane backoffs once per online, resume, or host reconnect trigger', () => {
    const { rerender, unmount } = renderHook(() => useRemoteRuntimeRecoveryTriggers())
    rerender()

    window.dispatchEvent(new Event('online'))
    systemResumedCallback?.()
    window.dispatchEvent(new Event(RUNTIME_ENVIRONMENT_RECONNECTED_EVENT))

    expect(retryConnectionsNow).toHaveBeenCalledTimes(3)
    expect(retryAllRemoteRuntimePtyRecoveriesNowMock).toHaveBeenCalledTimes(3)
    expect(onSystemResumed).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('removes the online listener and resume subscription on unmount', () => {
    const { unmount } = renderHook(() => useRemoteRuntimeRecoveryTriggers())
    unmount()

    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event(RUNTIME_ENVIRONMENT_RECONNECTED_EVENT))

    expect(retryConnectionsNow).not.toHaveBeenCalled()
    expect(retryAllRemoteRuntimePtyRecoveriesNowMock).not.toHaveBeenCalled()
    expect(unsubscribeSystemResumed).toHaveBeenCalledTimes(1)
  })
})
