import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import type { DashboardBucket, DashboardCard } from '../../../../shared/dashboard-snapshot'
import type { RepoIcon } from '../../../../shared/repo-icon'
import { AgentKanbanCard } from './AgentKanbanCard'

function bucketLabel(bucket: DashboardBucket): string {
  switch (bucket) {
    case 'attention':
      return translate('dashboardPopout.bucket.attention', 'Needs You')
    case 'working':
      return translate('dashboardPopout.bucket.working', 'Working')
    case 'done':
      return translate('dashboardPopout.bucket.done', 'Done')
    case 'idle':
      return translate('dashboardPopout.bucket.idle', 'Idle')
  }
}

export function AgentBoardLane({
  bucket,
  cards,
  repoIconsByRepoId,
  now,
  onOpenTerminal
}: {
  bucket: DashboardBucket
  cards: DashboardCard[]
  repoIconsByRepoId: Record<string, RepoIcon | null> | undefined
  now: number
  onOpenTerminal: (card: DashboardCard) => void
}): React.JSX.Element {
  const collapsible = bucket === 'done' || bucket === 'idle'
  const [collapsed, setCollapsed] = useState(collapsible)
  const label = bucketLabel(bucket)
  const toggleLabel = collapsed
    ? translate('dashboardPopout.bucket.expand', 'Expand {{lane}} lane', { lane: label })
    : translate('dashboardPopout.bucket.collapse', 'Collapse {{lane}} lane', { lane: label })

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border bg-muted/20 transition-[width,flex-basis,border-color,background-color] duration-200 motion-reduce:transition-none',
        bucket === 'attention' && cards.length > 0
          ? 'border-amber-500/25 bg-amber-500/[0.025]'
          : 'border-border/60',
        collapsed ? 'w-[132px] min-w-[132px] flex-none' : 'min-w-[270px] flex-1'
      )}
      data-agent-board-lane={bucket}
      data-lane-collapsed={collapsed ? 'true' : 'false'}
    >
      <header className="flex h-10 shrink-0 items-center gap-2 px-3">
        {collapsible ? (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {label}
            </span>
          </button>
        ) : (
          <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {label}
          </span>
        )}
        <span className="ml-auto rounded-full bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground ring-1 ring-border/60">
          {cards.length}
        </span>
      </header>
      <div
        className={cn(
          'scrollbar-sleek min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2',
          collapsed ? 'hidden' : 'flex'
        )}
        aria-hidden={collapsed || undefined}
      >
        {cards.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-muted-foreground">
            {translate('dashboardPopout.bucket.empty', 'None')}
          </p>
        ) : (
          cards.map((card) => (
            <AgentKanbanCard
              key={card.paneKey}
              card={card}
              repoIcon={repoIconsByRepoId?.[card.repoId] ?? null}
              now={now}
              onOpenTerminal={onOpenTerminal}
            />
          ))
        )}
      </div>
      {collapsed ? (
        <p className="px-3 pb-3 text-[10px] leading-snug text-muted-foreground">
          {translate('dashboardPopout.bucket.collapsed', 'Folded away')}
        </p>
      ) : null}
    </section>
  )
}
