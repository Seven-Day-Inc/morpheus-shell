import { AgentStateDot } from '@/components/AgentStateDot'
import { translate } from '@/i18n/i18n'
import type { DashboardCard } from '../../../../shared/dashboard-snapshot'

export function AgentBoardLiveSummary({
  cards
}: {
  cards: readonly DashboardCard[]
}): React.JSX.Element {
  const needsYou = cards.filter((card) => card.bucket === 'attention').length
  const working = cards.filter((card) => card.bucket === 'working').length

  return (
    <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
      <span className="shrink-0 tabular-nums">
        {translate('dashboardPopout.total', '{{count}} total', { count: cards.length })}
      </span>
      {working > 0 ? (
        <span className="flex shrink-0 items-center gap-1 tabular-nums">
          <AgentStateDot state="working" />
          {translate('dashboardPopout.summary.working', '{{count}} working', { count: working })}
        </span>
      ) : null}
      {needsYou > 0 ? (
        <span className="flex shrink-0 items-center gap-1 tabular-nums text-amber-600 dark:text-amber-400">
          <AgentStateDot state="waiting" />
          {translate('dashboardPopout.summary.needsYou', '{{count}} need you', { count: needsYou })}
        </span>
      ) : null}
    </div>
  )
}
