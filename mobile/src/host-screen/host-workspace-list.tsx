import { useCallback } from 'react'
import { Pressable, RefreshControl, SectionList, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, Pin } from 'lucide-react-native'
import type { RepoIcon } from '../../../src/shared/repo-icon'
import { AuthFailedBanner } from '../components/AuthFailedBanner'
import { HostDiagnosticsLink } from '../components/HostDiagnosticsLink'
import { HostRouteNoticeBanner } from '../components/HostRouteNoticeBanner'
import { MobileRepoIcon } from '../components/MobileRepoIcon'
import { MobileSearchField } from '../components/MobileSearchField'
import { NewWorkspaceFab, FAB_SIZE } from '../components/NewWorkspaceFab'
import { WorktreeListRow } from '../components/WorktreeListRow'
import { colors, spacing } from '../theme/mobile-theme'
import { getWorktreeRowIdentity } from '../worktree/worktree-host-row-identity'
import { HostWorkspaceListStates } from '../worktree/host-workspace-list-states'
import { getWorktreeStatus, type Section, type Worktree } from '../worktree/workspace-list-sections'
import { repoColor } from '../worktree/repo-color'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

export function HostWorkspaceList({ controller }: { controller: HostScreenController }) {
  const {
    actions,
    activeWorktreeScroll,
    catalog,
    connState,
    contentMaxWidth,
    displayWorktrees,
    embedded,
    forceReconnectHost,
    hostId,
    insets,
    isReadOnly,
    isWideLayout,
    noticeParam,
    now,
    reconnectAttempts,
    relayRecovery,
    routeNotice,
    router,
    sectionsResult,
    setDismissedNotice,
    settings,
    state
  } = controller
  const { rawSections, sections, uniqueRepoColors } = sectionsResult
  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => {
      if (!section.title) {
        return null
      }
      const rawSection = rawSections.find((candidate) => candidate.key === section.key)
      return (
        <WorkspaceSectionHeader
          section={section}
          count={rawSection?.data.length ?? 0}
          isCollapsed={state.collapsedGroups.has(section.key)}
          repoColor={state.groupMode === 'repo' ? uniqueRepoColors.get(section.title) : null}
          repoIcon={
            state.groupMode === 'repo' ? (state.repoIconsByName.get(section.title) ?? null) : null
          }
          showRepo={state.groupMode === 'repo'}
          onToggle={settings.toggleCollapsed}
        />
      )
    },
    [
      rawSections,
      settings.toggleCollapsed,
      state.collapsedGroups,
      state.groupMode,
      state.repoIconsByName,
      uniqueRepoColors
    ]
  )
  const renderItem = useCallback(
    ({ item }: { item: Worktree }) => (
      <WorktreeListRow
        item={item}
        isReadOnly={isReadOnly}
        now={now}
        status={getWorktreeStatus(item)}
        repoColor={uniqueRepoColors.get(item.repo) ?? repoColor(item.repo)}
        repoIcon={state.repoIconsByName.get(item.repo) ?? null}
        hideRepo={state.groupMode === 'repo'}
        onPress={actions.openWorktreeSession}
        onLongPress={item.workspaceKind === 'folder-workspace' ? undefined : state.setActionTarget}
        onToggleLineage={settings.toggleWorktreeLineage}
      />
    ),
    [
      actions.openWorktreeSession,
      isReadOnly,
      now,
      settings.toggleWorktreeLineage,
      state.groupMode,
      state.repoIconsByName,
      state.setActionTarget,
      uniqueRepoColors
    ]
  )

  return (
    <>
      {/* Auth failed: a latched relay rejection must reach the same re-pair affordance. */}
      {(connState === 'auth-failed' || relayRecovery.pairingRejected) && (
        <AuthFailedBanner
          canRetry={!!hostId}
          onRetry={() => hostId && void forceReconnectHost(hostId)}
          onRepair={() => router.push('/pair-scan')}
          onRemove={() => state.setConfirmRemoveHost(true)}
        />
      )}

      {connState !== 'connected' &&
      !relayRecovery.pairingRejected &&
      reconnectAttempts >= 3 &&
      hostId ? (
        <HostDiagnosticsLink
          onPress={() =>
            router.push({ pathname: '/connection-log', params: { hostId: String(hostId) } })
          }
        />
      ) : null}

      {/* Why a bounced route landed here (e.g. the workspace was deleted on the desktop). */}
      {routeNotice && (
        <HostRouteNoticeBanner
          message={routeNotice}
          onDismiss={() => setDismissedNotice(noticeParam ?? null)}
        />
      )}

      {/* Search bar */}
      {state.showSearch && (
        <View style={styles.searchBar}>
          <MobileSearchField
            value={state.search}
            onChangeText={state.setSearch}
            placeholder="Search worktrees…"
            autoFocus
            // Why: new key per open remounts the focus effect across rapid toggles so the keyboard reappears.
            focusKey={state.showSearch}
            accessibilityLabel="Search worktrees"
          />
        </View>
      )}

      <HostWorkspaceListStates
        connState={connState}
        worktreesLoaded={state.worktreesLoaded}
        displayCount={displayWorktrees.length}
        sectionCount={sections.length}
        catalogError={state.catalogError}
        search={state.search}
        activeFilterCount={settings.activeFilterCount}
      />

      {sections.length > 0 && (
        <SectionList
          ref={activeWorktreeScroll.sectionListRef}
          sections={sections}
          keyExtractor={(w) => w.sectionListKey ?? getWorktreeRowIdentity(w)}
          stickySectionHeadersEnabled={false}
          // Why: keep the search IME up while tapping clear / scrolling results.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollToIndexFailed={activeWorktreeScroll.onScrollToIndexFailed}
          // Why: edge-to-edge under the system nav bar; insets.bottom keeps the last row above it.
          contentContainerStyle={[
            styles.list,
            // Reserve room so the last row stays tappable above the phone's floating "+" (embedded uses the toolbar +).
            { paddingBottom: (embedded ? spacing.lg : FAB_SIZE + spacing.xl) + insets.bottom },
            isWideLayout &&
              !embedded && { maxWidth: contentMaxWidth, width: '100%', alignSelf: 'center' }
          ]}
          renderSectionHeader={renderSectionHeader}
          ItemSeparatorComponent={ListSeparator}
          // Why (#8498): manual pull-to-refresh forces a fresh snapshot after a stale-cache reconnect.
          refreshControl={
            <RefreshControl
              refreshing={catalog.refreshing}
              onRefresh={catalog.onRefresh}
              tintColor={colors.textSecondary}
              colors={[colors.textSecondary]}
            />
          }
          renderItem={renderItem}
        />
      )}

      {/* Floating "new workspace" button — phone only; embedded sidebars keep the toolbar +. */}
      {!embedded && (
        <NewWorkspaceFab
          onPress={actions.openNewWorktreeModal}
          disabled={connState !== 'connected'}
        />
      )}
    </>
  )
}

function ListSeparator() {
  return <View style={styles.separator} />
}

function WorkspaceSectionHeader({
  count,
  isCollapsed,
  onToggle,
  repoColor: sectionRepoColor,
  repoIcon,
  section,
  showRepo
}: {
  count: number
  isCollapsed: boolean
  onToggle: (key: string) => void
  repoColor: string | null | undefined
  repoIcon: RepoIcon | null
  section: Section
  showRepo: boolean
}) {
  const handlePress = useCallback(() => onToggle(section.key), [onToggle, section.key])
  return (
    <Pressable style={styles.sectionHeader} onPress={handlePress}>
      {isCollapsed ? (
        <ChevronRight size={12} color={colors.textMuted} style={styles.sectionIcon} />
      ) : (
        <ChevronDown size={12} color={colors.textMuted} style={styles.sectionIcon} />
      )}
      {section.icon === 'pin' && (
        <Pin size={12} color={colors.textMuted} style={styles.sectionIcon} />
      )}
      {showRepo ? (
        <View style={styles.sectionRepoIcon}>
          <MobileRepoIcon
            repoIcon={repoIcon}
            size={14}
            color={sectionRepoColor ?? colors.textSecondary}
          />
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </Pressable>
  )
}
