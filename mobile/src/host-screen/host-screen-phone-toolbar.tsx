import { Pressable, Text, View } from 'react-native'
import { Filter, Layers, List, Search, SlidersHorizontal, UserCircle, X } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

export function HostScreenPhoneToolbar({ controller }: { controller: HostScreenController }) {
  const { actions, connState, hostId, settings, state } = controller
  const groupLabel =
    state.groupMode === 'none'
      ? 'Group'
      : state.groupMode === 'workspaceStatus'
        ? 'Status'
        : state.groupMode === 'repo'
          ? 'Repo'
          : 'PR'

  return (
    <View style={styles.toolbar}>
      <Pressable
        style={[styles.filterChip, settings.activeFilterCount > 0 && styles.filterChipActive]}
        onPress={() => state.setShowFilterModal(true)}
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
        >
          Filter{settings.activeFilterCount > 0 ? ` (${settings.activeFilterCount})` : ''}
        </Text>
      </Pressable>

      <Pressable style={styles.modeButton} onPress={() => state.setShowSortPicker(true)}>
        <SlidersHorizontal size={14} color={colors.textSecondary} />
        <Text style={styles.sortLabel} numberOfLines={1}>
          {settings.selectedSortLabel}
        </Text>
      </Pressable>

      <Pressable style={styles.modeButton} onPress={() => state.setShowGroupPicker(true)}>
        <Layers size={14} color={colors.textSecondary} />
        <Text style={styles.sortLabel} numberOfLines={1}>
          {groupLabel}
        </Text>
      </Pressable>

      <View style={styles.toolbarSpacer} />

      <Pressable
        style={styles.searchToggle}
        onPress={() => actions.navigateFromHostList(`/h/${hostId}/accounts`)}
        disabled={connState !== 'connected'}
      >
        <UserCircle
          size={16}
          color={connState === 'connected' ? colors.textSecondary : colors.textMuted}
        />
      </Pressable>

      <Pressable
        style={styles.searchToggle}
        onPress={() => actions.navigateFromHostList(`/h/${hostId}/tasks`)}
        disabled={connState !== 'connected'}
      >
        <List
          size={16}
          color={connState === 'connected' ? colors.textSecondary : colors.textMuted}
        />
      </Pressable>

      <Pressable
        style={styles.searchToggle}
        onPress={() => state.setShowSearch((showing) => !showing)}
      >
        {state.showSearch ? (
          <X size={16} color={colors.textSecondary} />
        ) : (
          <Search size={16} color={colors.textSecondary} />
        )}
      </Pressable>
    </View>
  )
}
