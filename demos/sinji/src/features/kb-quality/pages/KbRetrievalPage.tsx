import { ArrowUpRight, Search, SearchCheck, SearchX } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { Badge, Button, Callout, EmptyState, Field, Input, Panel, SearchInput, Skeleton, Slider } from '@/components/ui'
import { useFormat } from '@/lib/format'
import { ApiError } from '@/lib/api'
import type { RetrievalHit, RetrievalResult } from '@/types'
import { useQuickSearch, useRetrieve } from '../api'
import { ConfidencePill, errorText, ScoreBar, VisibilityBadge } from '../components/bits'

const EXAMPLES = ['ex1', 'ex2', 'ex3', 'ex4', 'ex5', 'ex6'] as const

function lowReason(result: RetrievalResult, threshold: number): string {
  if (result.method === 'none') return 'empty'
  if (result.hits.length === 0 && result.top_score < threshold) return 'threshold'
  if (result.top_score <= 0.5) return 'lowScore'
  return 'narrow'
}

function HitRow({ hit, rank, threshold }: { hit: RetrievalHit; rank?: number; threshold?: number }) {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  return (
    <li className="rounded-card border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {rank !== undefined ? (
          <span className="font-display tabular text-lg text-subtle" aria-hidden>
            {rank}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{hit.title}</div>
          <div className="mt-0.5 text-xs text-muted">
            {t('retrieval.hit.chunk', { n: hit.chunk_index + 1 })} · {t(`docType.${hit.doc_type}`, { defaultValue: hit.doc_type })}
          </div>
        </div>
        <VisibilityBadge visibility={hit.visibility} />
        <div className="flex w-40 items-center gap-2" title={t('retrieval.hit.score')}>
          <ScoreBar value={hit.score} {...(threshold !== undefined ? { tick: threshold } : {})} />
          <span className="tabular font-mono text-sm">{f.number(hit.score, 3)}</span>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-line text-sm text-ink/90">{hit.snippet}</p>
      <div className="mt-3">
        <Button asChild size="xs" variant="link" iconRight={<ArrowUpRight className="size-3.5" />}>
          <Link to={`/workspace/kb/chunks?doc=${encodeURIComponent(hit.document_id)}`}>{t('retrieval.openChunks')}</Link>
        </Button>
      </div>
    </li>
  )
}

function QuickSearch() {
  const { t } = useTranslation('kbQuality')
  const [text, setText] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(text.trim()), 300)
    return () => clearTimeout(id)
  }, [text])
  const query = useQuickSearch(debounced)

  return (
    <Panel title={t('quick.title')} description={t('quick.description')}>
      <SearchInput value={text} onChange={setText} placeholder={t('quick.placeholder')} />
      <div className="mt-4">
        {!debounced ? (
          <p className="text-sm text-muted">{t('quick.idle')}</p>
        ) : query.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : query.isError ? (
          <Callout tone="danger">{errorText(query.error, t('common.loadError'))}</Callout>
        ) : query.data && query.data.hits.length > 0 ? (
          <ul className="space-y-3">
            {query.data.hits.map((hit) => (
              <HitRow key={hit.chunk_id} hit={hit} />
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={<SearchX className="size-5" />} title={t('quick.none')} />
        )}
      </div>
    </Panel>
  )
}

export default function KbRetrievalPage() {
  const { t } = useTranslation('kbQuality')
  const f = useFormat()
  const [query, setQuery] = useState('')
  const [topK, setTopK] = useState('5')
  const [threshold, setThreshold] = useState(0)
  const [ranWith, setRanWith] = useState(0)
  const retrieve = useRetrieve()

  const fieldErrors = retrieve.error instanceof ApiError ? retrieve.error.fieldErrors : {}
  const err = (key: string) => fieldErrors[key]?.[0]

  const run = (q: string = query) => {
    setRanWith(threshold)
    retrieve.mutate({ query: q, top_k: Number(topK), threshold })
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run()
  }
  const result = retrieve.data

  return (
    <div className="space-y-6">
      <Panel title={t('retrieval.title')} description={t('retrieval.description')}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label={t('retrieval.query')} error={err('query')}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('retrieval.queryPlaceholder')}
              leading={<Search className="size-4" />}
              maxLength={500}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <Field label={t('retrieval.topK')} error={err('top_k')}>
              <Input type="number" min={1} max={20} value={topK} onChange={(e) => setTopK(e.target.value)} className="tabular" />
            </Field>
            <Field label={t('retrieval.threshold')} hint={t('retrieval.thresholdHint')} error={err('threshold')}>
              <Slider value={threshold} onValueChange={setThreshold} min={0} max={1} step={0.05} format={(v) => f.number(v, 2)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" loading={retrieve.isPending} icon={<SearchCheck className="size-4" />}>
              {t('retrieval.run')}
            </Button>
            <span className="text-xs text-muted">{t('retrieval.examples')}</span>
            {EXAMPLES.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  const text = t(`retrieval.${key}`)
                  setQuery(text)
                  run(text)
                }}
                className="rounded-pill border border-line bg-sunken px-3 py-1 text-left text-[13px] text-ink/90 transition-colors hover:border-line-strong hover:bg-panel"
              >
                {t(`retrieval.${key}`)}
              </button>
            ))}
          </div>
        </form>
      </Panel>

      {retrieve.isPending ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : retrieve.isError && Object.keys(fieldErrors).length === 0 ? (
        <Callout tone="danger" title={t('common.loadError')}>
          {errorText(retrieve.error, t('common.loadError'))}
        </Callout>
      ) : result ? (
        <section className="space-y-4" aria-live="polite">
          <div className="grid gap-3 rounded-card border border-line bg-panel p-4 sm:grid-cols-5">
            <Stat label={t('retrieval.method')} value={t(`retrieval.methods.${result.method}`)} />
            <Stat label={t('retrieval.topScore')} value={f.number(result.top_score, 3)} mono />
            <Stat label={t('retrieval.margin')} value={f.number(result.margin, 3)} mono />
            <Stat label={t('retrieval.took')} value={`${f.number(result.took_ms)} ms`} mono />
            <div>
              <div className="caps text-[11px] text-muted">{t('retrieval.confidence')}</div>
              <div className="mt-1">
                <ConfidencePill level={result.confidence} />
              </div>
            </div>
          </div>

          {result.confidence === 'low' ? (
            <Callout tone="warning" title={t('retrieval.low.title')}>
              {t(`retrieval.low.${lowReason(result, ranWith)}`)}
            </Callout>
          ) : null}

          {result.hits.length > 0 ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted">
                <Badge tone="neutral">{t('retrieval.hits', { count: result.hits.length })}</Badge>
                <span>{t('retrieval.hitsHint')}</span>
              </div>
              <ol className="space-y-3">
                {result.hits.map((hit, i) => (
                  <HitRow key={hit.chunk_id} hit={hit} rank={i + 1} threshold={ranWith} />
                ))}
              </ol>
            </>
          ) : (
            <EmptyState icon={<SearchX className="size-5" />} title={t('retrieval.noHits')} body={t('retrieval.noHitsBody')} />
          )}
        </section>
      ) : null}

      <QuickSearch />
    </div>
  )
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="caps text-[11px] text-muted">{label}</div>
      <div className={mono ? 'tabular mt-1 font-mono text-lg' : 'mt-1 text-lg'}>{value}</div>
    </div>
  )
}
