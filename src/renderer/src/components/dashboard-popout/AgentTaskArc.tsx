import { AgentStateDot } from '@/components/AgentStateDot'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import {
  dashboardCardDisplayState,
  type DashboardCard
} from '../../../../shared/dashboard-snapshot'

type AgentTaskPhase = 'plan' | 'execute' | 'verify'

const PHASES: readonly AgentTaskPhase[] = ['plan', 'execute', 'verify']

function phaseLabel(phase: AgentTaskPhase): string {
  switch (phase) {
    case 'plan':
      return translate('dashboardPopout.card.phase.plan', 'Plan')
    case 'execute':
      return translate('dashboardPopout.card.phase.execute', 'Execute')
    case 'verify':
      return translate('dashboardPopout.card.phase.verify', 'Verify')
  }
}

export function agentTaskPhase(card: Pick<DashboardCard, 'bucket'>): AgentTaskPhase {
  return card.bucket === 'done' || card.bucket === 'idle' ? 'verify' : 'execute'
}

export function agentActivityLabel(
  card: Pick<DashboardCard, 'bucket' | 'toolName' | 'toolInput'>
): string {
  if (card.toolName) {
    return card.toolInput ? `${card.toolName} · ${card.toolInput}` : card.toolName
  }
  switch (card.bucket) {
    case 'attention':
      return translate('dashboardPopout.card.activity.attention', 'Waiting for your input')
    case 'working':
      return translate('dashboardPopout.card.activity.working', 'Working')
    case 'done':
      return translate('dashboardPopout.card.activity.done', 'Ready to verify')
    case 'idle':
      return translate('dashboardPopout.card.activity.idle', 'Idle')
  }
}

export function AgentTaskArc({ card }: { card: DashboardCard }): React.JSX.Element {
  const currentPhase = agentTaskPhase(card)
  const currentIndex = PHASES.indexOf(currentPhase)
  const displayState = dashboardCardDisplayState(card)

  return (
    <div className="flex flex-col gap-1.5" data-task-arc="true">
      <div
        className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-1"
        aria-label={translate('dashboardPopout.card.phase.current', 'Current stage: {{stage}}', {
          stage: phaseLabel(currentPhase)
        })}
      >
        {PHASES.map((phase, index) => {
          const isCurrent = phase === currentPhase
          const isPast = index < currentIndex
          return (
            <div key={phase} className="contents">
              <span
                className={cn(
                  'flex items-center gap-1 text-[9.5px] font-medium uppercase tracking-[0.05em]',
                  isCurrent ? 'text-foreground' : 'text-muted-foreground/65'
                )}
                data-task-phase={phase}
                data-phase-state={isCurrent ? 'current' : isPast ? 'past' : 'upcoming'}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full ring-1 ring-inset',
                    isCurrent
                      ? 'bg-foreground ring-foreground'
                      : isPast
                        ? 'bg-muted-foreground/35 ring-transparent'
                        : 'bg-transparent ring-border'
                  )}
                  aria-hidden
                />
                {phaseLabel(phase)}
              </span>
              {index < PHASES.length - 1 ? (
                <span
                  className={cn('h-px', index < currentIndex ? 'bg-border' : 'bg-border/50')}
                  aria-hidden
                />
              ) : null}
            </div>
          )
        })}
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
        <AgentStateDot state={displayState} />
        <span className="truncate" title={agentActivityLabel(card)}>
          {agentActivityLabel(card)}
        </span>
      </div>
    </div>
  )
}
