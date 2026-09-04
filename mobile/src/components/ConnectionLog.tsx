import { useMemo, useRef } from 'react'
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native'
import type { ConnectionLogEntry } from '../transport/types'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

type Props = {
  entries: ConnectionLogEntry[]
  // Tag printed before the first entry so it's clear what's being logged
  // (e.g. 'Pairing' vs 'Reconnect').
  title?: string
  fillAvailableHeight?: boolean
}

const LEVEL_COLOR: Record<ConnectionLogEntry['level'], string> = {
  info: colors.textSecondary,
  success: colors.statusGreen,
  warn: colors.statusAmber,
  error: colors.statusRed
}

const LEVEL_GLYPH: Record<ConnectionLogEntry['level'], string> = {
  info: '•',
  success: '✓',
  warn: '!',
  error: '✕'
}

function formatTime(ts: number, baseTs: number): string {
  // Why: show elapsed seconds since the first entry — absolute wall-clock
  // time isn't actionable when debugging "why is connecting stuck".
  const elapsed = Math.max(0, ts - baseTs) / 1000
  if (elapsed < 10) {
    return `+${elapsed.toFixed(2)}s`
  }
  if (elapsed < 100) {
    return `+${elapsed.toFixed(1)}s`
  }
  return `+${Math.round(elapsed)}s`
}

type RenderedConnectionLogEntry = {
  elapsed: string
  entry: ConnectionLogEntry
  renderKey: string
}

function buildRenderedEntries(entries: ConnectionLogEntry[]): RenderedConnectionLogEntry[] {
  const baseTs = entries[0]?.ts ?? 0
  const keyOccurrences = new Map<string, number>()
  return entries.map((entry) => {
    const occurrence = keyOccurrences.get(entry.id) ?? 0
    keyOccurrences.set(entry.id, occurrence + 1)
    return {
      elapsed: formatTime(entry.ts, baseTs),
      entry,
      renderKey: occurrence === 0 ? entry.id : `${entry.id}:${occurrence}`
    }
  })
}

function renderConnectionLogEntry({ item }: ListRenderItemInfo<RenderedConnectionLogEntry>) {
  return (
    <View style={styles.row}>
      <Text style={styles.timestamp}>{item.elapsed}</Text>
      <Text style={[styles.glyph, { color: LEVEL_COLOR[item.entry.level] }]}>
        {LEVEL_GLYPH[item.entry.level]}
      </Text>
      <View style={styles.rowText}>
        <Text style={[styles.message, { color: LEVEL_COLOR[item.entry.level] }]}>
          {item.entry.message}
        </Text>
        {item.entry.detail && (
          <Text style={styles.detail} numberOfLines={2}>
            {item.entry.detail}
          </Text>
        )}
      </View>
    </View>
  )
}

export function ConnectionLog({ entries, title, fillAvailableHeight = false }: Props) {
  const scrollRef = useRef<FlatList<RenderedConnectionLogEntry> | null>(null)
  const renderedEntries = useMemo(() => buildRenderedEntries(entries), [entries])

  if (entries.length === 0) {
    return null
  }
  return (
    <View
      style={[
        styles.container,
        fillAvailableHeight ? styles.fillContainer : styles.boundedContainer
      ]}
    >
      {title && <Text style={styles.title}>{title}</Text>}
      <FlatList
        ref={scrollRef}
        data={renderedEntries}
        renderItem={renderConnectionLogEntry}
        keyExtractor={(item) => item.renderKey}
        style={fillAvailableHeight ? styles.fillScroll : styles.boundedScroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  boundedContainer: {
    maxHeight: 240
  },
  fillContainer: {
    flex: 1
  },
  title: {
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs
  },
  boundedScroll: {
    maxHeight: 200
  },
  fillScroll: {
    flex: 1
  },
  scrollContent: {
    gap: 6
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm
  },
  timestamp: {
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    color: colors.textMuted,
    width: 52,
    paddingTop: 1
  },
  glyph: {
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    width: 12,
    textAlign: 'center',
    paddingTop: 1
  },
  rowText: {
    flex: 1
  },
  message: {
    fontFamily: typography.monoFamily,
    fontSize: typography.metaSize,
    lineHeight: 16
  },
  detail: {
    fontFamily: typography.monoFamily,
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 14,
    marginTop: 1
  }
})
