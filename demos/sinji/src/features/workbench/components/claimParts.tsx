import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Badge, type Tone } from '@/components/ui'
import { formatPercent } from '@/lib/format'
import type { Claim, Verdict } from '@/types'

export const verdictTone: Record<Verdict, Tone> = {
  SUPPORTED: 'success',
  PARTIALLY_SUPPORTED: 'warning',
  CONTRADICTED: 'danger',
  NOT_IN_KB: 'neutral',
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { t } = useTranslation('common')
  return (
    <Badge tone={verdictTone[verdict]} size="sm">
      {t(`verdicts.${verdict}`)}
    </Badge>
  )
}

/** The KB passage behind a verdict, with a link to the document's chunks. */
export function EvidenceBlock({ claim }: { claim: Claim }) {
  const { t, i18n } = useTranslation('workbench')
  const ev = claim.evidence
  if (!ev) {
    return <p className="text-xs text-muted">{t('fact.noEvidence')}</p>
  }
  return (
    <div className="rounded-ctl border border-line bg-sunken p-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-ink">
          <BookOpen className="size-3.5 shrink-0 text-muted" strokeWidth={1.75} />
          <span className="truncate">{ev.title}</span>
        </span>
        <span className="tabular shrink-0 font-mono text-muted">{formatPercent(ev.score, i18n.language)}</span>
      </div>
      <p className="mt-1.5 text-muted">{ev.snippet}</p>
      <Link
        to={`/workspace/kb/chunks?doc=${encodeURIComponent(ev.document_id)}`}
        className="mt-2 inline-block text-primary underline-offset-2 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {t('fact.viewChunks')}
      </Link>
    </div>
  )
}
