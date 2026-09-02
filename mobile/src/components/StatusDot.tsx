import { View, StyleSheet } from 'react-native'
import type { ConnectionState } from '../transport/types'
import type { ConnectionVerdict } from '../transport/connection-health'
import { statusDotColor } from './status-dot-color'

// Why: when caller passes a verdict, the dot color reflects the verdict's
// severity instead of the raw transport state. This avoids the "amber dot
// next to red 'Can't reach desktop' label" mismatch — the underlying
// transport is still 'reconnecting' (amber) but the user-visible meaning
// has escalated to error (red).
export function StatusDot({
  state,
  verdict
}: {
  state: ConnectionState
  verdict?: ConnectionVerdict
}) {
  const color = statusDotColor(state, verdict)
  return <View style={[styles.dot, { backgroundColor: color }]} />
}

const styles = StyleSheet.create({
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  }
})
