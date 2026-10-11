import { ArrowRight, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BirdBadge } from '@/components/brand'
import { cn } from '@/lib/cn'
import { formatSmartDate, personName } from '@/lib/format'
import type { AiHandoff, SessionAssignment } from '@/types'

export interface HandoverChainProps {
  assignments: SessionAssignment[]
  handoff: AiHandoff | null
  className?: string
}

interface Step {
  key: string
  at: string
  node: 'ai' | 'human' | 'release'
  title: string
  detail?: string
}

/** Who held the conversation, in order: the AI assistant, the handover reason, each operator and why they let go. */
export function HandoverChain({ assignments, handoff, className }: HandoverChainProps) {
  const { t, i18n } = useTranslation('common')
  const lang = i18n.language

  const steps: Step[] = []
  if (handoff) {
    steps.push({
      key: 'ai',
      at: handoff.at,
      node: 'ai',
      title: t('chat.handover.ai'),
      detail: `${t(`handoffReason.${handoff.reason}`)}${handoff.summary ? `: ${handoff.summary}` : ''}`,
    })
  }
  for (const assignment of assignments) {
    steps.push({
      key: `a-${assignment.id}`,
      at: assignment.assignedAt,
      node: 'human',
      title: personName(assignment.operatorName, lang),
      detail: t(`assignedVia.${assignment.assignedVia}`),
    })
    if (assignment.releasedAt) {
      steps.push({
        key: `r-${assignment.id}`,
        at: assignment.releasedAt,
        node: 'release',
        title: t('chat.handover.released', { name: personName(assignment.operatorName, lang) }),
        detail: assignment.releaseReason ? t(`releaseReason.${assignment.releaseReason}`) : undefined,
      })
    }
  }
  steps.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  return (
    <ol className={cn('m-0 flex list-none flex-col gap-0 p-0', className)} aria-label={t('chat.handover.label')}>
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex gap-2.5 pb-3 last:pb-0">
          {index < steps.length - 1 ? <span aria-hidden className="absolute bottom-0 left-[11px] top-6 w-0 border-l-2 border-dotted border-line-strong" /> : null}
          <span
            aria-hidden
            className={cn(
              'z-[1] grid size-6 shrink-0 place-items-center rounded-full ring-1',
              step.node === 'ai' && 'bg-bot ring-line',
              step.node === 'human' && 'bg-primary text-on-primary ring-ink/60',
              step.node === 'release' && 'bg-sunken text-muted ring-line',
            )}
          >
            {step.node === 'ai' ? <BirdBadge size={16} /> : step.node === 'human' ? <UserRound size={13} strokeWidth={2} /> : <ArrowRight size={12} strokeWidth={2} />}
          </span>
          <span className="min-w-0 flex-1 pt-px">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className={cn('text-[13px] font-medium', step.node === 'release' ? 'text-muted' : 'text-ink')}>{step.title}</span>
              <span className="tabular text-[11px] text-muted">{formatSmartDate(step.at, lang)}</span>
            </span>
            {step.detail ? <span className="block text-xs leading-snug text-muted">{step.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  )
}
