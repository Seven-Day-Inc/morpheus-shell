/* oxlint-disable react-doctor/no-adjust-state-on-prop-change -- Why: mobile browser state mirrors a remote desktop screencast session and CDP dialogs, which are external systems that cannot be derived during render. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AppState, type View } from 'react-native'
import type { RpcClient } from '../transport/rpc-client'
import type {
  BrowserScreencastFrame,
  BrowserScreencastFrameMetadata
} from '../transport/browser-screencast-protocol'
import type { MobileBrowserViewMode } from './browser-screencast-request'
import type { BrowserPointerModifier } from './MobileBrowserPointerModifiers'
import {
  getInitialMobileBrowserViewMode,
  saveMobileBrowserViewMode
} from './mobile-browser-view-mode-state'
import {
  clampBrowserZoomState,
  type BrowserTouchLayout,
  type BrowserZoomState
} from './browser-touch-geometry'
import {
  clearCachedBrowserFramesForWorktree,
  makeBrowserFrameCacheKey,
  MAX_ZOOM,
  MIN_ZOOM,
  peekCachedBrowserFrame,
  type FrameLayer
} from './mobile-browser-frame-state'
import { displayBrowserUrl, normalizeBrowserUrl } from './browser-url'
import { resolveMobileBrowserAddressSync } from './mobile-browser-address-sync'
import { MobileBrowserPaneView } from './MobileBrowserPaneView'
import type { BrowserFrameImageHandle } from './MobileBrowserFrameImage'
import { useMobileBrowserInteractions } from './use-mobile-browser-interactions'
import { useMobileBrowserPaneLayers } from './use-mobile-browser-pane-layers'
import { useMobileBrowserStream } from './use-mobile-browser-stream'

export type MobileBrowserTab = {
  type: 'browser'
  id: string
  title: string
  browserWorkspaceId: string
  browserPageId: string | null
  url: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  isActive: boolean
}

type MobileBrowserPaneProps = {
  client: RpcClient | null
  worktreeId: string
  tab: MobileBrowserTab
  screencastSupported: boolean | null
  keyboardLift: number
  bottomInset: number
  onToast: (message: string, durationMs?: number) => void
}

type BrowserDialogState = {
  dialogType: string
  message: string
}

const DEFAULT_ZOOM: BrowserZoomState = { scale: 1, offsetX: 0, offsetY: 0 }

export function MobileBrowserPane({
  client,
  worktreeId,
  tab,
  screencastSupported,
  keyboardLift,
  bottomInset,
  onToast
}: MobileBrowserPaneProps) {
  const [browserViewMode, setBrowserViewMode] = useState<MobileBrowserViewMode>(() =>
    getInitialMobileBrowserViewMode(worktreeId, tab.browserPageId, tab.url)
  )
  const cacheKey = makeBrowserFrameCacheKey(worktreeId, tab.browserPageId, browserViewMode)
  const cachedInitialFrame = peekCachedBrowserFrame(cacheKey)
  const [addressValue, setAddressValue] = useState(displayBrowserUrl(tab.url))
  const [addressFocused, setAddressFocused] = useState(false)
  const [addressSyncState, setAddressSyncState] = useState({
    focused: false,
    url: tab.url
  })
  const [keyboardValue, setKeyboardValue] = useState('')
  const [frameUri, setFrameUri] = useState<string | null>(cachedInitialFrame?.uri ?? null)
  const [frameMetadata, setFrameMetadata] = useState<BrowserScreencastFrameMetadata | null>(
    cachedInitialFrame?.metadata ?? null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<BrowserDialogState | null>(null)
  const [pointerModifiers, setPointerModifiers] = useState<BrowserPointerModifier[]>([])
  const [zoom, setZoom] = useState<BrowserZoomState>(DEFAULT_ZOOM)
  const [layout, setLayout] = useState<BrowserTouchLayout | null>(null)
  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  const streamGenerationRef = useRef(0)
  const layoutRef = useRef<BrowserTouchLayout | null>(null)
  const frameMetadataRef = useRef<BrowserScreencastFrameMetadata | null>(
    cachedInitialFrame?.metadata ?? null
  )
  const frameUriRef = useRef<string | null>(cachedInitialFrame?.uri ?? null)
  const frameMountedRef = useRef(cachedInitialFrame !== null)
  const browserImageRefs = useRef<[BrowserFrameImageHandle | null, BrowserFrameImageHandle | null]>(
    [null, null]
  )
  const browserLayerRefs = useRef<[View | null, View | null]>([null, null])
  const pendingFrameLayerRef = useRef<FrameLayer | null>(null)
  const visibleFrameLayerRef = useRef<FrameLayer>(0)
  const busyRef = useRef(false)
  const lastAppliedFrameAtRef = useRef(0)
  const pendingThrottledFrameRef = useRef<{
    frame: BrowserScreencastFrame
    cacheKey: string
  } | null>(null)
  const frameThrottleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dialogRef = useRef<BrowserDialogState | null>(null)
  const lastStreamCacheKeyRef = useRef<string | null>(cacheKey)
  const zoomRef = useRef<BrowserZoomState>(DEFAULT_ZOOM)
  const lastZoomResetUrlRef = useRef(tab.url || 'about:blank')

  const resetBrowserZoomState = useCallback(() => {
    zoomRef.current = DEFAULT_ZOOM
    setZoom(DEFAULT_ZOOM)
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active'
      if (!active) {
        clearCachedBrowserFramesForWorktree(worktreeId)
      }
      setAppActive(active)
    })
    return () => {
      subscription.remove()
    }
  }, [worktreeId])

  const addressSync = resolveMobileBrowserAddressSync(addressSyncState, {
    focused: addressFocused,
    url: tab.url
  })
  if (addressSync.nextState !== addressSyncState) {
    setAddressSyncState(addressSync.nextState)
    if (addressSync.shouldSyncValue) {
      // Why: keep browser stream/goto address updates intact, but avoid a
      // stale post-blur paint when the tab URL is the source of truth.
      setAddressValue(displayBrowserUrl(tab.url))
    }
  }

  useLayoutEffect(() => {
    // Why: gesture and stream handlers need committed values before passive
    // Effects flush, without leaking refs from an uncommitted render.
    frameMetadataRef.current = frameMetadata
    layoutRef.current = layout
    dialogRef.current = dialog
    zoomRef.current = zoom
  }, [dialog, frameMetadata, layout, zoom])

  useEffect(() => {
    lastZoomResetUrlRef.current = tab.url || 'about:blank'
    resetBrowserZoomState()
  }, [resetBrowserZoomState, tab.browserPageId, tab.url])

  useEffect(() => {
    setBrowserViewMode(getInitialMobileBrowserViewMode(worktreeId, tab.browserPageId, tab.url))
  }, [tab.browserPageId, tab.url, worktreeId])

  const { frameGeometry, pageParams, sendBrowserRequest } = useMobileBrowserStream({
    appActive,
    browserImageRefs,
    browserLayerRefs,
    browserViewMode,
    busyRef,
    cacheKey,
    client,
    frameMetadata,
    frameMetadataRef,
    frameMountedRef,
    frameThrottleTimerRef,
    frameUriRef,
    lastAppliedFrameAtRef,
    lastStreamCacheKeyRef,
    lastZoomResetUrlRef,
    layout,
    pendingFrameLayerRef,
    pendingThrottledFrameRef,
    resetBrowserZoomState,
    screencastSupported,
    setAddressValue,
    setBusy,
    setDialog,
    setError,
    setFrameMetadata,
    setFrameUri,
    streamGenerationRef,
    tab,
    visibleFrameLayerRef,
    worktreeId
  })

  useEffect(() => {
    if (!frameGeometry) {
      return
    }
    const current = zoomRef.current
    const next = clampBrowserZoomState(current, frameGeometry, MIN_ZOOM, MAX_ZOOM)
    if (
      next.scale === current.scale &&
      next.offsetX === current.offsetX &&
      next.offsetY === current.offsetY
    ) {
      return
    }
    // Why: layout changes can shrink the legal pan range for the current zoom.
    zoomRef.current = next
    setZoom(next)
  }, [frameGeometry])

  const navigateToAddress = useCallback(async () => {
    const url = normalizeBrowserUrl(addressValue)
    if (!url) {
      setError('Enter a valid URL.')
      return
    }
    const result = (await sendBrowserRequest(
      'browser.goto',
      { url },
      { showBusy: true, timeoutMs: 30_000 }
    )) as { url?: string } | null
    if (typeof result?.url === 'string') {
      setAddressValue(displayBrowserUrl(result.url))
      lastZoomResetUrlRef.current = result.url
      resetBrowserZoomState()
    }
  }, [addressValue, resetBrowserZoomState, sendBrowserRequest])

  const {
    browserGesture,
    sendDialogCommand,
    sendKeyboardText,
    sendKeypress,
    togglePointerModifier
  } = useMobileBrowserInteractions({
    client,
    dialogRef,
    frameGeometry,
    frameMetadataRef,
    keyboardValue,
    layoutRef,
    onToast,
    pageParams,
    pointerModifiers,
    sendBrowserRequest,
    setDialog,
    setError,
    setKeyboardValue,
    setPointerModifiers,
    setZoom,
    zoomRef
  })

  const {
    browserLayerRef,
    frameLayerErrorHandler,
    frameLayerLoadHandler,
    frameLayerRef,
    frameLayerStyle
  } = useMobileBrowserPaneLayers({
    browserImageRefs,
    browserLayerRefs,
    frameUriRef,
    pendingFrameLayerRef,
    visibleFrameLayerRef
  })

  const controlsDisabled = !client || !tab.browserPageId || screencastSupported !== true
  const goBack = useCallback(() => {
    if (controlsDisabled || !tab.canGoBack) {
      return
    }
    void sendBrowserRequest('browser.back', {}, { suppressError: true })
  }, [controlsDisabled, sendBrowserRequest, tab.canGoBack])
  const goForward = useCallback(() => {
    if (controlsDisabled || !tab.canGoForward) {
      return
    }
    void sendBrowserRequest('browser.forward', {}, { suppressError: true })
  }, [controlsDisabled, sendBrowserRequest, tab.canGoForward])
  const reloadPage = useCallback(() => {
    if (controlsDisabled) {
      return
    }
    void sendBrowserRequest('browser.reload', {}, { suppressError: true })
  }, [controlsDisabled, sendBrowserRequest])

  const selectBrowserViewMode = useCallback(
    (mode: MobileBrowserViewMode) => {
      if (browserViewMode === mode) {
        return
      }
      // Why: preserve explicit page-scoped choices across normal browser pane remounts.
      saveMobileBrowserViewMode(worktreeId, tab.browserPageId, mode)
      setBrowserViewMode(mode)
      resetBrowserZoomState()
    },
    [browserViewMode, resetBrowserZoomState, tab.browserPageId, worktreeId]
  )

  const renderedFrameSource =
    frameUriRef.current || frameUri ? { uri: frameUriRef.current ?? frameUri! } : null

  return (
    <MobileBrowserPaneView
      addressFocused={addressFocused}
      addressValue={addressValue}
      bottomInset={bottomInset}
      browserGesture={browserGesture}
      browserLayerRef={browserLayerRef}
      browserViewMode={browserViewMode}
      busy={busy}
      controlsDisabled={controlsDisabled}
      dialog={dialog}
      error={error}
      frameGeometry={frameGeometry}
      frameLayerErrorHandler={frameLayerErrorHandler}
      frameLayerLoadHandler={frameLayerLoadHandler}
      frameLayerRef={frameLayerRef}
      frameLayerStyle={frameLayerStyle}
      goBack={goBack}
      goForward={goForward}
      keyboardLift={keyboardLift}
      keyboardValue={keyboardValue}
      layoutRef={layoutRef}
      navigateToAddress={navigateToAddress}
      pointerModifiers={pointerModifiers}
      reloadPage={reloadPage}
      renderedFrameSource={renderedFrameSource}
      selectBrowserViewMode={selectBrowserViewMode}
      sendDialogCommand={sendDialogCommand}
      sendKeyboardText={sendKeyboardText}
      sendKeypress={sendKeypress}
      setAddressFocused={setAddressFocused}
      setAddressValue={setAddressValue}
      setKeyboardValue={setKeyboardValue}
      setLayout={setLayout}
      tab={tab}
      togglePointerModifier={togglePointerModifier}
      zoom={zoom}
    />
  )
}
