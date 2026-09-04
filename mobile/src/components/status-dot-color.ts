import { colors } from '../theme/mobile-theme'
import type { ConnectionVerdict } from '../transport/connection-health'
import type { ConnectionState } from '../transport/types'

const stateColors: Record<ConnectionState, string> = {
  connected: colors.statusGreen,
  connecting: colors.statusAmber,
  handshaking: colors.statusAmber,
  reconnecting: colors.statusAmber,
  disconnected: colors.textMuted,
  'auth-failed': colors.statusRed
}

export function statusDotColor(state: ConnectionState, verdict?: ConnectionVerdict): string {
  if (verdict?.kind === 'unreachable' || verdict?.kind === 'auth-failed') {
    return colors.statusRed
  }
  if (verdict?.kind === 'warning' || (verdict?.kind === 'normal' && verdict.label.endsWith('…'))) {
    return colors.statusAmber
  }
  return stateColors[state] ?? colors.textMuted
}
