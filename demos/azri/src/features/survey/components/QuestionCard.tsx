import { useTranslation } from 'react-i18next'

import { BubbleCard, ScorePill } from '@/components/ui'
import { cn } from '@/lib/utils'
import { StarRating } from './StarRating'

interface QuestionCardProps {
  index: number
  total: number
  text: string
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

/** One question: counter, text, the star control, end labels and the live rating pill. */
export function QuestionCard({ index, total, text, value, onChange, disabled }: QuestionCardProps) {
  const { t } = useTranslation(['survey', 'common'])
  const headingId = `q-${index}-text`
  return (
    <BubbleCard
      padding="md"
      className={cn('animate-fade-up transition-colors duration-200', value > 0 && 'border-brand/40')}
      style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
      aria-labelledby={headingId}
      role="group"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tabular text-muted">{t('survey:question.counter', { n: index + 1, total })}</span>
        <span className="min-h-6" aria-live="polite">
          {value > 0 ? (
            <ScorePill key={value} value={value} className="animate-pop" />
          ) : (
            <span className="text-xs text-subtle">{t('survey:question.tapToRate')}</span>
          )}
        </span>
      </div>
      <h2 id={headingId} className="mt-2 text-[17px] leading-snug font-semibold text-ink text-pretty">
        {text}
      </h2>
      <div className="mt-4">
        <StarRating value={value} onChange={onChange} label={text} disabled={disabled} />
        <div className="mt-1.5 flex justify-between px-1 text-xs text-muted" aria-hidden="true">
          <span>{t('common:rating.poor')}</span>
          <span>{t('common:rating.excellent')}</span>
        </div>
      </div>
    </BubbleCard>
  )
}
