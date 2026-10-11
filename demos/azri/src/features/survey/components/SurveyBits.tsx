import { Check, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BarsLoader, Button, SignalBars } from '@/components/ui'
import { cn } from '@/lib/utils'

/** Five ascending bars that fill as questions get answered (answered / total, staggered rise). */
export function SurveyProgress({ answered, total }: { answered: number; total: number }) {
  const { t } = useTranslation('survey')
  const filled = total > 0 ? Math.round((answered / total) * 5) : 0
  return (
    <div className="flex items-center gap-2.5">
      <SignalBars value={filled} max={5} animateIn size="sm" label={t('progress.label', { answered, total })} />
      <span className="text-xs font-semibold tabular text-muted" aria-hidden="true">
        {t('progress.short', { answered, total })}
      </span>
    </div>
  )
}

export type SubmitPhase = 'idle' | 'sending' | 'done'

/** The single 56px pill. While sending it morphs into pulsing bars, then a check. */
export function SubmitButton({ phase, onClick }: { phase: SubmitPhase; onClick?: () => void }) {
  const { t } = useTranslation('survey')
  const busy = phase !== 'idle'
  return (
    <Button
      type="submit"
      variant="brand"
      size="xl"
      onClick={onClick}
      disabled={busy}
      aria-disabled={busy}
      aria-live="polite"
      className={cn('relative transition-[background-color,filter,transform] duration-200 disabled:opacity-100', phase === 'done' && 'brightness-105')}
    >
      {phase === 'idle' && (
        <span className="inline-flex animate-fade-in items-center gap-2">
          {t('submit.send')}
          <Send aria-hidden="true" strokeWidth={1.75} />
        </span>
      )}
      {phase === 'sending' && (
        <span className="inline-flex animate-fade-in items-center gap-3">
          <BarsLoader size="sm" label="" className="text-on-brand" />
          <span>{t('submit.sending')}</span>
        </span>
      )}
      {phase === 'done' && (
        <span className="inline-flex items-center gap-2">
          <span className="grid size-7 animate-pop place-items-center rounded-full bg-on-brand text-brand">
            <Check aria-hidden="true" strokeWidth={2.25} className="!size-4" />
          </span>
          {t('submit.sent')}
        </span>
      )}
    </Button>
  )
}
