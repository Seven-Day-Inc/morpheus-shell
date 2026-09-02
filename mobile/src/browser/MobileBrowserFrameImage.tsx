import { forwardRef, useImperativeHandle, useState, type Ref } from 'react'
import { Image, type ImageContentFit } from 'expo-image'
import type { ImageStyle, StyleProp } from 'react-native'

export type BrowserFrameImageHandle = {
  setSource: (uri: string) => void
}

type MobileBrowserFrameImageProps = {
  contentFit: ImageContentFit
  initialSource: { uri: string }
  onError: () => void
  onLoad: () => void
  style: StyleProp<ImageStyle>
}

function MobileBrowserFrameImageComponent(
  { contentFit, initialSource, onError, onLoad, style }: MobileBrowserFrameImageProps,
  ref: Ref<BrowserFrameImageHandle>
) {
  const [source, setSource] = useState(initialSource)
  useImperativeHandle(
    ref,
    () => ({
      setSource: (uri: string) => setSource({ uri })
    }),
    []
  )
  return (
    <Image
      cachePolicy="none"
      contentFit={contentFit}
      onError={onError}
      onLoad={onLoad}
      source={source}
      style={style}
      transition={0}
    />
  )
}

export const MobileBrowserFrameImage = forwardRef(MobileBrowserFrameImageComponent)
