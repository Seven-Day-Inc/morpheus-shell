import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../shared/execution-host'

/**
 * Bring a browser workspace forward as the surface the reader is in.
 *
 * Why the unified tab and not just the browser state: the pane renders whatever its group's active
 * tab is, so selecting the workspace alone leaves the page live behind a tab that never shows it.
 * Returns false when the workspace has no unified tab yet, which is the caller's cue that there is
 * nothing to bring forward.
 */
export function activateBrowserWorkspaceTab(params: {
  executionHostId?: ExecutionHostId
  worktreeId: string
  workspaceId: string
  pageId?: string
}): boolean {
  const state = useAppStore.getState()
  const browserTabs = (state.unifiedTabsByWorktree[params.worktreeId] ?? []).filter(
    (candidate) => candidate.contentType === 'browser' && candidate.entityId === params.workspaceId
  )
  const unifiedTab =
    params.executionHostId === undefined
      ? browserTabs[0]
      : (browserTabs.find((candidate) => candidate.executionHostId === params.executionHostId) ??
        browserTabs.find((candidate) => candidate.executionHostId === undefined))
  if (!unifiedTab) {
    return false
  }
  state.focusGroup(params.worktreeId, unifiedTab.groupId)
  state.activateTab(unifiedTab.id)
  state.setActiveBrowserTab(params.workspaceId)
  if (params.pageId) {
    state.setActiveBrowserPage(params.workspaceId, params.pageId)
  }
  return true
}
