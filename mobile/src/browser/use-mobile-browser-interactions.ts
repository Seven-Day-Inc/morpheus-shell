import { useMemo, useRef, type Dispatch, type SetStateAction } from 'react'
import { Gesture, type ComposedGesture } from 'react-native-gesture-handler'
import type { RpcClient } from '../transport/rpc-client'
import type { BrowserScreencastFrameMetadata } from '../transport/browser-screencast-protocol'
import { MAX_ZOOM, MIN_ZOOM } from './mobile-browser-frame-state'
import {
  clampBrowserZoomState,
  type BrowserFrameGeometry,
  type BrowserPoint,
  type BrowserTouchLayout,
  type BrowserZoomState
} from './browser-touch-geometry'
import type { BrowserPointerModifier } from './MobileBrowserPointerModifiers'
import { useMobileBrowserCommands } from './use-mobile-browser-commands'

const TAP_SLOP = 16
const SCROLL_START_SLOP = 22
const LONG_PRESS_MS = 550
const WHEEL_INTERVAL_MS = 70

type BrowserPageParams = { worktree: string; page: string }
type SendBrowserRequest = (
  method: string,
  params?: Record<string, unknown>,
  options?: { showBusy?: boolean; suppressError?: boolean; timeoutMs?: number }
) => Promise<unknown | null>

type MobileBrowserInteractionArgs = {
  client: RpcClient | null
  dialogRef: { current: { dialogType: string; message: string } | null }
  frameGeometry: BrowserFrameGeometry | null
  frameMetadataRef: { current: BrowserScreencastFrameMetadata | null }
  keyboardValue: string
  layoutRef: { current: BrowserTouchLayout | null }
  onToast: (message: string, durationMs?: number) => void
  pageParams: () => BrowserPageParams | null
  pointerModifiers: BrowserPointerModifier[]
  sendBrowserRequest: SendBrowserRequest
  setDialog: Dispatch<SetStateAction<{ dialogType: string; message: string } | null>>
  setError: Dispatch<SetStateAction<string | null>>
  setKeyboardValue: Dispatch<SetStateAction<string>>
  setPointerModifiers: Dispatch<SetStateAction<BrowserPointerModifier[]>>
  setZoom: Dispatch<SetStateAction<BrowserZoomState>>
  zoomRef: { current: BrowserZoomState }
}

type PanStart = { offsetX: number; offsetY: number }
type PinchStart = { anchorX: number; anchorY: number; scale: number }

export function useMobileBrowserInteractions(args: MobileBrowserInteractionArgs): {
  browserGesture: ComposedGesture
  sendDialogCommand: (method: 'browser.dialogDismiss' | 'browser.dialogAccept') => Promise<void>
  sendKeyboardText: () => Promise<void>
  sendKeypress: (key: string) => Promise<void>
  togglePointerModifier: (modifier: BrowserPointerModifier) => void
} {
  const {
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
  } = args
  const lastWheelRef = useRef({ dx: 0, dy: 0, at: 0 })
  const wheelGestureIdRef = useRef(0)
  const panStartRef = useRef<PanStart | null>(null)
  const pinchStartRef = useRef<PinchStart | null>(null)
  const {
    mapTouchPoint,
    sendDialogCommand,
    sendKeyboardText,
    sendKeypress,
    sendPointerClick,
    sendWheel,
    togglePointerModifier
  } = useMobileBrowserCommands({
    client,
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
    zoomRef
  })

  const browserGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDistance(TAP_SLOP)
      .runOnJS(true)
      .onEnd((event, successful) => {
        if (!successful || dialogRef.current) {
          return
        }
        const point = mapTouchPoint(event.x, event.y)
        if (point) {
          void sendPointerClick(point, 'left')
        }
      })

    const longPress = Gesture.LongPress()
      .minDuration(LONG_PRESS_MS)
      .maxDistance(TAP_SLOP)
      .runOnJS(true)
      .onStart((event) => {
        if (dialogRef.current) {
          return
        }
        const point = mapTouchPoint(event.x, event.y)
        if (point) {
          void sendPointerClick(point, 'right')
          onToast('Right click')
        }
      })

    const pan = Gesture.Pan()
      .minDistance(SCROLL_START_SLOP)
      .maxPointers(1)
      .runOnJS(true)
      .onBegin(() => {
        panStartRef.current = {
          offsetX: zoomRef.current.offsetX,
          offsetY: zoomRef.current.offsetY
        }
        wheelGestureIdRef.current += 1
        lastWheelRef.current = { dx: 0, dy: 0, at: 0 }
      })
      .onUpdate((event) => {
        if (dialogRef.current) {
          return
        }
        const panStart = panStartRef.current
        if (panStart && frameGeometry && zoomRef.current.scale > MIN_ZOOM) {
          const nextZoom = clampBrowserZoomState(
            {
              scale: zoomRef.current.scale,
              offsetX: panStart.offsetX + event.translationX,
              offsetY: panStart.offsetY + event.translationY
            },
            frameGeometry,
            MIN_ZOOM,
            MAX_ZOOM
          )
          zoomRef.current = nextZoom
          setZoom(nextZoom)
          return
        }
        // Gesture callbacks run after render, so reading the clock here is safe.
        // oxlint-disable-next-line react/purity
        const now = Date.now()
        if (now - lastWheelRef.current.at < WHEEL_INTERVAL_MS) {
          return
        }
        const deltaX = event.translationX - lastWheelRef.current.dx
        const deltaY = event.translationY - lastWheelRef.current.dy
        if (Math.abs(deltaX) + Math.abs(deltaY) < 8) {
          return
        }
        const point: BrowserPoint | null = mapTouchPoint(event.x, event.y)
        if (!point) {
          return
        }
        lastWheelRef.current = {
          dx: event.translationX,
          dy: event.translationY,
          at: now
        }
        sendWheel(point, deltaX, deltaY, wheelGestureIdRef.current)
      })
      .onFinalize(() => {
        panStartRef.current = null
      })

    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onBegin((event) => {
        if (dialogRef.current || !frameGeometry) {
          pinchStartRef.current = null
          return
        }
        const zoom = zoomRef.current
        const frameCenterX = frameGeometry.offsetX + frameGeometry.renderedWidth / 2 + zoom.offsetX
        const frameCenterY = frameGeometry.offsetY + frameGeometry.renderedHeight / 2 + zoom.offsetY
        pinchStartRef.current = {
          anchorX: (event.focalX - frameCenterX) / zoom.scale,
          anchorY: (event.focalY - frameCenterY) / zoom.scale,
          scale: zoom.scale
        }
      })
      .onUpdate((event) => {
        const pinchStart = pinchStartRef.current
        if (!pinchStart || !frameGeometry) {
          return
        }
        const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStart.scale * event.scale))
        const frameCenterX = frameGeometry.offsetX + frameGeometry.renderedWidth / 2
        const frameCenterY = frameGeometry.offsetY + frameGeometry.renderedHeight / 2
        const nextZoom = clampBrowserZoomState(
          {
            scale,
            offsetX: event.focalX - frameCenterX - pinchStart.anchorX * scale,
            offsetY: event.focalY - frameCenterY - pinchStart.anchorY * scale
          },
          frameGeometry,
          MIN_ZOOM,
          MAX_ZOOM
        )
        zoomRef.current = nextZoom
        setZoom(nextZoom)
      })
      .onFinalize(() => {
        pinchStartRef.current = null
      })

    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(longPress, tap))
  }, [
    dialogRef,
    frameGeometry,
    mapTouchPoint,
    onToast,
    sendPointerClick,
    sendWheel,
    setZoom,
    zoomRef
  ])

  return {
    browserGesture,
    sendDialogCommand,
    sendKeyboardText,
    sendKeypress,
    togglePointerModifier
  }
}
