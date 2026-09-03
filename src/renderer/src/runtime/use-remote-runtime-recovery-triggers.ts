import { useEffect } from 'react'
import { retryAllRemoteRuntimePtyRecoveriesNow } from '@/components/terminal-pane/remote-runtime-pty-recovery-state'
import { RUNTIME_ENVIRONMENT_RECONNECTED_EVENT } from './runtime-environment-recovery-event'

export function useRemoteRuntimeRecoveryTriggers(): void {
  useEffect(() => {
    const advanceRemoteRuntimeRecoveryBackoffs = (): void => {
      // Why: shared control and pane recovery own independent backoff timers.
      void window.api?.runtimeEnvironments?.retryConnectionsNow?.().catch(() => undefined)
      retryAllRemoteRuntimePtyRecoveriesNow()
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
    }
  }, [])
}
