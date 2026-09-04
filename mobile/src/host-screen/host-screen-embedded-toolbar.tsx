import { Pressable, Text, View } from 'react-native'
import {
  Filter,
  Layers,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  SquareTerminal,
  UserCircle,
  X
} from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

export function HostScreenEmbeddedToolbar({ controller }: { controller: HostScreenController }) {
  const { actions, connState, floatingWorkspaceEnabled, hostId, settings, state } = controller
  const groupLabel =
    state.groupMode === 'none'
      ? 'Group'
      : state.groupMode === 'workspaceStatus'
        ? 'Status'
        : state.groupMode === 'repo'
          ? 'Repo'
          : 'PR'
  const iconColor = connState === 'connected' ? colors.textSecondary : colors.textMuted

  return (
    <View style={styles.embeddedToolbar}>
      <View style={styles.embeddedToolbarRow}>
        <Pressable
          style={[
            styles.filterChip,
            styles.embeddedFilterChip,
            settings.activeFilterCount > 0 && styles.filterChipActive
          ]}
          onPress={() => state.setShowFilterModal(true)}
          accessibilityRole="button"
          accessibilityLabel={`Filter workspaces${settings.activeFilterCount > 0 ? `, ${settings.activeFilterCount} active` : ''}`}
        >
          <Filter
            size={12}
            color={settings.activeFilterCount > 0 ? colors.textPrimary : colors.textSecondary}
          />
          <Text
            style={[
              styles.filterChipText,
              settings.activeFilterCount > 0 && styles.filterChipTextActive
            ]}
            numberOfLines={1}
          >
            Filter{settings.activeFilterCount > 0 ? ` ${settings.activeFilterCount}` : ''}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.modeButton, styles.embeddedModeButton]}
          onPress={() => state.setShowSortPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${settings.selectedSortLabel}`}
        >
          <SlidersHorizontal size={14} color={colors.textSecondary} />
          <Text style={styles.sortLabel} numberOfLines={1}>
            {settings.selectedSortLabel}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.modeButton, styles.embeddedModeButton]}
          onPress={() => state.setShowGroupPicker(true)}
          accessibilityRole="button"
          accessibilityLabel="Group workspaces"
        >
          <Layers size={14} color={colors.textSecondary} />
          <Text style={styles.sortLabel} numberOfLines={1}>
            {groupLabel}
          </Text>
        </Pressable>
      </View>

      <View style={styles.embeddedToolbarRow}>
        <Pressable
          style={[
            styles.embeddedToolbarIconButton,
            connState !== 'connected' && styles.toolbarIconDisabled
          ]}
          onPress={() => actions.navigateFromHostList(`/h/${hostId}/accounts`)}
          disabled={connState !== 'connected'}
          accessibilityRole="button"
          accessibilityLabel="Accounts"
        >
          <UserCircle size={16} color={iconColor} />
        </Pressable>

        <Pressable
          style={[
            styles.embeddedToolbarIconButton,
            connState !== 'connected' && styles.toolbarIconDisabled
          ]}
          onPress={() => actions.navigateFromHostList(`/h/${hostId}/tasks`)}
          disabled={connState !== 'connected'}
          accessibilityRole="button"
          accessibilityLabel="Tasks"
        >
          <List size={16} color={iconColor} />
        </Pressable>

        {floatingWorkspaceEnabled ? (
          <Pressable
            style={[
              styles.embeddedToolbarIconButton,
              connState !== 'connected' && styles.toolbarIconDisabled
            ]}
            onPress={actions.openFloatingWorkspace}
            disabled={connState !== 'connected'}
            accessibilityRole="button"
            accessibilityLabel="Floating Workspace"
          >
            <SquareTerminal size={18} color={iconColor} />
          </Pressable>
        ) : null}

        <Pressable
          style={[
            styles.embeddedToolbarIconButton,
            connState !== 'connected' && styles.toolbarIconDisabled
          ]}
          onPress={actions.openNewWorktreeModal}
          disabled={connState !== 'connected'}
          accessibilityRole="button"
          accessibilityLabel="New workspace"
        >
          <Plus
            size={16}
            color={connState === 'connected' ? colors.textPrimary : colors.textMuted}
          />
        </Pressable>

        <Pressable
          style={styles.embeddedToolbarIconButton}
          onPress={() => state.setShowSearch((showing) => !showing)}
          accessibilityRole="button"
          accessibilityLabel={state.showSearch ? 'Close search' : 'Search workspaces'}
        >
          {state.showSearch ? (
            <X size={16} color={colors.textSecondary} />
          ) : (
            <Search size={16} color={colors.textSecondary} />
          )}
        </Pressable>
      </View>
    </View>
  )
}
