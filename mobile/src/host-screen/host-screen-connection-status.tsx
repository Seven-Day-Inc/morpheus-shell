import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, PanelLeftClose, SquareTerminal } from 'lucide-react-native'
import { StatusDot } from '../components/StatusDot'
import { colors } from '../theme/mobile-theme'
import { classifyConnection, type ConnectionVerdict } from '../transport/connection-health'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

function isErrorVerdict(verdict: ConnectionVerdict): boolean {
  return (
    verdict.kind === 'warning' || verdict.kind === 'unreachable' || verdict.kind === 'auth-failed'
  )
}

export function HostScreenConnectionStatus({ controller }: { controller: HostScreenController }) {
  const {
    actions,
    connState,
    embedded,
    floatingWorkspaceEnabled,
    forceReconnectHost,
    hostId,
    lastConnectedAt,
    onHideSidebar,
    reconnectAttempts,
    relayRecovery,
    state
  } = controller
  const verdict = classifyConnection({
    state: connState,
    reconnectAttempts,
    lastConnectedAt,
    ...relayRecovery
  })
  const showReconnectButton =
    connState !== 'connected' &&
    isErrorVerdict(verdict) &&
    Boolean(hostId) &&
    verdict.kind !== 'auth-failed'

  return (
    <View style={styles.statusBar}>
      <Pressable
        style={styles.backButton}
        onPress={actions.leaveHost}
        accessibilityRole="button"
        accessibilityLabel="Back to hosts"
        hitSlop={8}
      >
        <ChevronLeft size={22} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.hostIdentity}>
        <StatusDot state={connState} verdict={verdict} />
        <Text style={styles.hostNameText} numberOfLines={1}>
          {state.hostName || 'Host'}
        </Text>
      </View>
      {showReconnectButton ? (
        <Pressable
          style={styles.reconnectButton}
          onPress={() => void forceReconnectHost(hostId!)}
          hitSlop={8}
        >
          <Text style={styles.reconnectButtonText}>Reconnect</Text>
        </Pressable>
      ) : null}
      {!embedded && floatingWorkspaceEnabled ? (
        <Pressable
          style={[
            styles.floatingWorkspaceHeaderButton,
            connState !== 'connected' && styles.toolbarIconDisabled
          ]}
          onPress={actions.openFloatingWorkspace}
          disabled={connState !== 'connected'}
          accessibilityRole="button"
          accessibilityLabel="Floating Workspace"
          hitSlop={8}
        >
          <SquareTerminal
            size={18}
            color={connState === 'connected' ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>
      ) : null}
      {embedded && onHideSidebar ? (
        <Pressable
          style={styles.sidebarCollapseButton}
          onPress={onHideSidebar}
          accessibilityRole="button"
          accessibilityLabel="Hide sidebar"
          hitSlop={8}
        >
          <PanelLeftClose size={14} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  )
}
