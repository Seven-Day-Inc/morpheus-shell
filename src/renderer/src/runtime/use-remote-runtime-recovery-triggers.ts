import { useEffect } from 'react'
import { retryAllRemoteRuntimePtyRecoveriesNow } from '@/components/terminal-pane/remote-runtime-pty-recovery-state'
import { RUNTIME_ENVIRONMENT_RECONNECTED_EVENT } from './runtime-environment-recovery-event'

export function useRemoteRuntimeRecoveryTriggers(): void {
  useEffect(() => {
    const pendingWakeTimers = new Set<number>()
    const advanceRemoteRuntimeRecoveryBackoffs = (): void => {
      // Why: reconnect can be delivered during xterm input/composition work; leave that
      // renderer turn intact before waking independent control and pane recovery timers.
      const timer = window.setTimeout(() => {
        pendingWakeTimers.delete(timer)
        void window.api?.runtimeEnvironments?.retryConnectionsNow?.().catch(() => undefined)
        retryAllRemoteRuntimePtyRecoveriesNow()
      }, 0)
      pendingWakeTimers.add(timer)
    }
    window.addEventListener('online', advanceRemoteRuntimeRecoveryBackoffs)
    window.addEventListener(RUNTIME_ENVIRONMENT_RECONNECTED_EVENT, advanceRemoteRuntimeRecoveryBackoffs)
    const unsubscribeSystemResumed =
      typeof window.api?.ui?.onSystemResumed === 'function'
        ? window.api.ui.onSystemResumed(advanceRemoteRuntimeRecoveryBackoffs)
        : null
    return () => {
      window.removeEventListener('online', advanceRemoteRuntimeRecoveryBackoffs)
      window.removeEventListener(
        RUNTIME_ENVIRONMENT_RECONNECTED_EVENT,
        advanceRemoteRuntimeRecoveryBackoffs
      )
      unsubscribeSystemResumed?.()
      for (const timer of pendingWakeTimers) {
        window.clearTimeout(timer)
      }
      pendingWakeTimers.clear()
    }
  }, [])
}
