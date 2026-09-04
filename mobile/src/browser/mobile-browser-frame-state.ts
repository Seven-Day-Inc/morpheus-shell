import { Buffer } from 'buffer'
import type { View } from 'react-native'
import type { BrowserFrameImageHandle } from './MobileBrowserFrameImage'
import type { RpcFailure, RpcSuccess } from '../transport/types'
import type {
  BrowserScreencastFrame,
  BrowserScreencastFrameMetadata
} from '../transport/browser-screencast-protocol'
import { colors } from '../theme/mobile-theme'
import type { MobileBrowserViewMode } from './browser-screencast-request'

export type FrameLayer = 0 | 1
export type BrowserFrameCacheEntry = {
  uri: string
  metadata: BrowserScreencastFrameMetadata
}
export const MIN_ZOOM = 1
export const MAX_ZOOM = 3.5
const BROWSER_FRAME_CACHE_LIMIT = 4
const browserFrameCache = new Map<string, BrowserFrameCacheEntry>()

export function buttonColor(enabled: boolean): string {
  return enabled ? colors.textSecondary : colors.textMuted
}

export function createBrowserFrameDataUri(frame: BrowserScreencastFrame): string {
  return `data:image/${frame.format};base64,${Buffer.from(frame.image).toString('base64')}`
}

export function makeBrowserFrameCacheKey(
  worktreeId: string,
  browserPageId: string | null,
  viewMode: MobileBrowserViewMode
): string | null {
  return browserPageId ? `${worktreeId}:${browserPageId}:${viewMode}` : null
}

export function clearCachedBrowserFramesForWorktree(worktreeId: string): void {
  const prefix = `${worktreeId}:`
  for (const key of browserFrameCache.keys()) {
    if (key.startsWith(prefix)) {
      browserFrameCache.delete(key)
    }
  }
}

export function getCachedBrowserFrame(cacheKey: string | null): BrowserFrameCacheEntry | null {
  if (!cacheKey) {
    return null
  }
  const cached = browserFrameCache.get(cacheKey)
  if (!cached) {
    return null
  }
  browserFrameCache.delete(cacheKey)
  browserFrameCache.set(cacheKey, cached)
  return cached
}

export function peekCachedBrowserFrame(cacheKey: string | null): BrowserFrameCacheEntry | null {
  return cacheKey ? (browserFrameCache.get(cacheKey) ?? null) : null
}

export function cacheBrowserFrame(cacheKey: string | null, entry: BrowserFrameCacheEntry): void {
  if (!cacheKey) {
    return
  }
  browserFrameCache.delete(cacheKey)
  browserFrameCache.set(cacheKey, entry)
  while (browserFrameCache.size > BROWSER_FRAME_CACHE_LIMIT) {
    const oldestKey = browserFrameCache.keys().next().value
    if (typeof oldestKey !== 'string') {
      break
    }
    browserFrameCache.delete(oldestKey)
  }
}

export function updateBrowserLayerVisibility(
  layers: [View | null, View | null],
  visible: FrameLayer
): void {
  for (const [index, layer] of layers.entries()) {
    layer?.setNativeProps({ style: { opacity: index === visible ? 1 : 0 } })
  }
}

export function updateBrowserImageSource(image: BrowserFrameImageHandle | null, uri: string): void {
  // Why: browser frames are large strings; mutating only the native Image
  // source avoids re-rendering the whole tab view for every streamed frame.
  image?.setSource(uri)
}

export function assertRpcOk(
  response: RpcSuccess | RpcFailure,
  fallbackMessage: string
): asserts response is RpcSuccess {
  if (!response.ok) {
    throw new Error(response.error.message || fallbackMessage)
  }
}

export function browserFrameMetadataEqual(
  a: BrowserScreencastFrameMetadata | null,
  b: BrowserScreencastFrameMetadata
): boolean {
  return (
    a?.deviceWidth === b.deviceWidth &&
    a?.deviceHeight === b.deviceHeight &&
    a?.pageScaleFactor === b.pageScaleFactor
  )
}

export function browserErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function shouldSurfaceBrowserError(message: string): boolean {
  const normalized = message.toLowerCase()
  // Why: selector_not_found can be emitted by in-flight page automation while
  // the browser is still usable; replacing the frame with it feels like a crash.
  return !normalized.includes('selector_not_found') && !normalized.includes('selector not found')
}
