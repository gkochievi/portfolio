import { useTranslation } from 'react-i18next'
import { Bot, Lock, UserRound } from 'lucide-react'

import { ScorePill } from '@/components/brand'
import { Badge, Button, Drawer } from '@/components/ui'
import { pillTone, scoreBand } from '@/lib/scoring'
import { useFormat } from '@/lib/format'
import { useGloss } from '@/lib/gloss'
import type { Recording, ScoreBands } from '@/types'
import { levelText } from '../tones'

/** Revision history: revision 1 is the model (immutable); every later row is a reviewer edit with its note. */
export function ScoreRevisions({
  open,
  onOpenChange,
  recording,
  bands,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recording: Recording
  bands: ScoreBands
}) {
  const { t } = useTranslation('analysis')
  const fmt = useFormat()
  const gloss = useGloss()
  const dims = recording.scoring?.dimensions ?? []
  const nameOf = (key: string) => {
    const d = dims.find((x) => x.key === key)
    return d ? gloss.pick(d.name, d.name_en) : key
  }
  const revisions = [...recording.revisions].sort((a, b) => b.revision - a.revision)
  const latest = revisions[0]?.revision

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('score.history.title')}
      description={t('score.history.description')}
      width={460}
      footer={
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('score.history.close')}
        </Button>
      }
    >
      <ol className="space-y-4">
        {revisions.map((rev) => {
          const prev = recording.revisions.find((r) => r.revision === rev.revision - 1) ?? recording.revisions.filter((r) => r.revision < rev.revision).at(-1)
          const isModel = rev.revision === 1
          const deltaTotal = prev ? rev.weighted_total - prev.weighted_total : null
          const level = scoreBand(rev.weighted_total, bands)
          const changes = prev
            ? Object.keys(rev.scores)
                .filter((k) => rev.scores[k] !== prev.scores[k])
                .map((k) => ({ key: k, from: prev.scores[k] ?? null, to: rev.scores[k] ?? null }))
            : []
          return (
            <li key={rev.revision} className="rounded-card border border-line bg-panel p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={rev.revision === latest ? 'primary' : 'neutral'} shape="tag">
                    {t('score.revision', { n: rev.revision })}
                  </Badge>
                  {rev.revision === latest ? <Badge tone="success" size="sm">{t('score.history.current')}</Badge> : null}
                  {isModel ? (
                    <Badge tone="neutral" size="sm" icon={<Lock className="size-3" aria-hidden />}>
                      {t('score.history.immutable')}
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {deltaTotal !== null && deltaTotal !== 0 ? (
                    <span className={`tabular text-xs font-medium ${deltaTotal > 0 ? 'text-success' : 'text-danger'}`}>
                      {deltaTotal > 0 ? '+' : ''}
                      {deltaTotal}
                    </span>
                  ) : null}
                  <ScorePill score={rev.weighted_total} tone={level ? pillTone(rev.weighted_total) : 'muted'} size="lg" />
                </div>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                {isModel || rev.edited_by === 'Sinji model' ? <Bot className="size-3.5" aria-hidden /> : <UserRound className="size-3.5" aria-hidden />}
                <span className="font-medium text-ink">{isModel || rev.edited_by === 'Sinji model' ? t('score.history.model') : rev.edited_by}</span>
                <span>· {fmt.dateTime(rev.created_at)}</span>
              </p>
              {rev.note ? <p className="mt-2 rounded-ctl bg-sunken px-2.5 py-2 text-sm italic text-ink/90">&ldquo;{rev.note}&rdquo;</p> : null}
              {changes.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {changes.map((c) => {
                    const diff = c.from !== null && c.to !== null ? c.to - c.from : null
                    return (
                      <li key={c.key} className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-ink/90">{nameOf(c.key)}</span>
                        <span className="tabular shrink-0 text-muted">
                          {c.from ?? '-'} &rarr; <span className="font-medium text-ink">{c.to ?? '-'}</span>
                          {diff !== null ? (
                            <span className={`ml-1.5 text-xs ${diff > 0 ? levelText.good : levelText.bad}`}>
                              {diff > 0 ? '+' : ''}
                              {diff}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : !isModel ? (
                <p className="mt-2 text-xs text-subtle">{t('score.history.noChanges')}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </Drawer>
  )
}
