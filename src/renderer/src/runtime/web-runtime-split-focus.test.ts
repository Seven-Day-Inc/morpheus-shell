import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebSessionIntentOwner } from './web-session-intent-owner'

const mocks = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
  activateTabAndFocusPane: vi.fn(),
  clearWebSessionFocusIntentIfMatches: vi.fn(),
  recordWebSessionFocusIntent: vi.fn(),
  refreshWebRuntimeSessionTabsSnapshot: vi.fn(),
  matchesWebSessionIntentOwner: vi.fn(() => true)
}))

vi.mock('../store', () => ({
  useAppStore: { getState: () => mocks.state }
}))

vi.mock('../lib/activate-tab-and-focus-pane', () => ({
  activateTabAndFocusPane: mocks.activateTabAndFocusPane
}))

vi.mock('./web-runtime-session-environment', () => ({
  matchesWebSessionIntentOwner: mocks.matchesWebSessionIntentOwner
}))

vi.mock('./web-runtime-session-snapshot', () => ({
  refreshWebRuntimeSessionTabsSnapshot: mocks.refreshWebRuntimeSessionTabsSnapshot
}))

vi.mock('./web-session-focus-intent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./web-session-focus-intent')>()),
  clearWebSessionFocusIntentIfMatches: mocks.clearWebSessionFocusIntentIfMatches,
  recordWebSessionFocusIntent: mocks.recordWebSessionFocusIntent
}))

import {
  beginWebRuntimeSplitFocusRequest,
  captureWebRuntimeSplitFocusTarget,
  finishWebRuntimeSplitFocusRequest,
  focusSplitWebRuntimeTerminalPane
} from './web-runtime-split-focus'
import { toWebTerminalSurfaceTabId } from './web-terminal-surface-id'

const environmentId = 'environment-a'
const worktreeId = 'worktree-a'
const hostTabId = 'host-tab-a'
const sourceLeafId = 'source-leaf'
const splitLeafId = 'split-leaf'
const sourcePtyId = 'remote:environment-a@@terminal-a'
const mirroredTabId = toWebTerminalSurfaceTabId(hostTabId)
const owner: WebSessionIntentOwner = { environmentId, pairingRevision: 1 }

function state(activeLeafId: string): Record<string, unknown> {
  return {
    activeWorktreeId: worktreeId,
    activeWorkspaceExecutionHostId: null,
    tabsByWorktree: {
      [worktreeId]: [{ id: mirroredTabId }]
    },
    terminalLayoutsByTabId: {
      [mirroredTabId]: {
        activeLeafId,
        ptyIdsByLeafId: { [sourceLeafId]: sourcePtyId, [splitLeafId]: 'remote:split' }
      }
    },
    activeGroupIdByWorktree: { [worktreeId]: 'group-a' },
    groupsByWorktree: {
      [worktreeId]: [{ id: 'group-a', activeTabId: mirroredTabId }]
    },
    unifiedTabsByWorktree: {
      [worktreeId]: [
        {
          id: mirroredTabId,
          entityId: mirroredTabId,
          groupId: 'group-a',
          contentType: 'terminal'
        }
      ]
    }
  }
}

describe('focusSplitWebRuntimeTerminalPane', () => {
  beforeEach(() => {
    mocks.state = state(sourceLeafId)
    mocks.activateTabAndFocusPane.mockReset()
    mocks.clearWebSessionFocusIntentIfMatches.mockReset()
    mocks.recordWebSessionFocusIntent.mockReset()
    mocks.matchesWebSessionIntentOwner.mockReset().mockReturnValue(true)
    mocks.refreshWebRuntimeSessionTabsSnapshot.mockReset().mockImplementation(async () => {
      mocks.state = state(splitLeafId)
    })
  })

  it('keeps a split focus handoff valid when snapshot reconciliation already selected its leaf', async () => {
    const target = captureWebRuntimeSplitFocusTarget(sourcePtyId, {
      worktreeId,
      tabId: mirroredTabId,
      leafId: sourceLeafId
    })
    const request = beginWebRuntimeSplitFocusRequest(owner, worktreeId)

    await focusSplitWebRuntimeTerminalPane(owner, target, request, {
      tabId: hostTabId,
      leafId: splitLeafId
    })

    expect(mocks.refreshWebRuntimeSessionTabsSnapshot).toHaveBeenCalledWith(environmentId, worktreeId, {
      expectedEnvironmentPairingRevision: owner.pairingRevision,
      acceptCurrentSnapshot: true,
      afterCurrentInFlight: true
    })
    expect(mocks.activateTabAndFocusPane).toHaveBeenCalledWith(mirroredTabId, splitLeafId)
    expect(mocks.clearWebSessionFocusIntentIfMatches).not.toHaveBeenCalled()
    finishWebRuntimeSplitFocusRequest(request)
  })
})
