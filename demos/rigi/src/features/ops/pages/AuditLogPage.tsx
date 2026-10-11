import { ChevronRight, Info, ShieldAlert } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Avatar, Badge, Banner, Button, Card, DateText, EmptyState, Field, Input, JsonView, Mono, NativeSelect, PageHeader, Skeleton } from '@/components/ui'
import { cn } from '@/lib/cn'
import { localName } from '@/lib/format'

import { useAuditLog } from '../api'
import { JsonBlock, PageNav, useUrlFilters } from '../components/FilterFields'
import type { AuditRow } from '../lib/types'

const KEYS = ['entityType', 'actorId', 'partnerId', 'since', 'until'] as const
const ENTITY_TYPES = ['task', 'user', 'invoice', 'partner', 'mail', 'license', 'settings', 'template', 'project'] as const

export default function AuditLogPage() {
  const { t } = useTranslation('ops')
  const { applied, page, apply, setPage } = useUrlFilters(KEYS)
  const [draft, setDraft] = useState(applied)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const appliedKey = KEYS.map((k) => applied[k]).join('|')

  // Keep the draft in step with the URL (back/forward, Clear).
  useEffect(() => setDraft(applied), [appliedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const query = useAuditLog({ ...applied, page })
  const data = query.data
  const hasFilter = KEYS.some((k) => applied[k])

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const set = (k: (typeof KEYS)[number]) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const dateInvalid = !!draft.since && !!draft.until && draft.since > draft.until

  const actorOptions = useMemo(() => (data?.facets.actors ?? []).map((a) => ({ value: a.id, label: localName({ name: a.name, nameKa: a.nameKa }) })), [data])
  const partnerOptions = useMemo(() => (data?.facets.partners ?? []).map((p) => ({ value: p.id, label: p.name })), [data])

  return (
    <>
      <PageHeader eyebrow={t('audit.eyebrow')} title={t('audit.title')} description={t('audit.description')} icon={<ShieldAlert />} />

      <Banner tone="info" className="mb-4">
        <span className="inline-flex items-start gap-2">
          <Info className="mt-0.5 size-4 shrink-0 stroke-[1.75]" aria-hidden />
          {t('audit.note')}
        </span>
      </Banner>

      <Card className="mb-4">
        <form
          className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault()
            if (!dateInvalid) apply(draft)
          }}
        >
          <Field label={t('audit.filters.entityType')} htmlFor="aud-entity">
            <NativeSelect id="aud-entity" value={draft.entityType} onChange={(e) => set('entityType')(e.target.value)} placeholder={t('common:filters.all')} options={ENTITY_TYPES.map((v) => ({ value: v, label: t(`audit.entity.${v}`) }))} />
          </Field>
          <Field label={t('audit.filters.actor')} htmlFor="aud-actor">
            <NativeSelect id="aud-actor" value={draft.actorId} onChange={(e) => set('actorId')(e.target.value)} placeholder={t('common:filters.all')} options={actorOptions} />
          </Field>
          <Field label={t('audit.filters.partner')} htmlFor="aud-partner">
            <NativeSelect id="aud-partner" value={draft.partnerId} onChange={(e) => set('partnerId')(e.target.value)} placeholder={t('common:filters.allPartners')} options={partnerOptions} />
          </Field>
          <Field label={t('common:filters.from')} htmlFor="aud-since">
            <Input id="aud-since" type="date" value={draft.since} onChange={(e) => set('since')(e.target.value)} />
          </Field>
          <Field label={t('common:filters.to')} htmlFor="aud-until" error={dateInvalid ? t('validation.dateRange') : undefined}>
            <Input id="aud-until" type="date" value={draft.until} invalid={dateInvalid} onChange={(e) => set('until')(e.target.value)} />
          </Field>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
            <Button type="submit" size="sm" disabled={dateInvalid}>
              {t('common:actions.apply')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!hasFilter && !KEYS.some((k) => draft[k])}
              onClick={() => {
                apply({})
                setDraft(Object.fromEntries(KEYS.map((k) => [k, ''])) as typeof draft)
              }}
            >
              {t('common:actions.clear')}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        {query.isError ? (
          <div className="p-4">
            <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
              {query.error.message}
            </Banner>
          </div>
        ) : query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={hasFilter ? t('common:states.noResults') : t('audit.empty.title')} description={hasFilter ? undefined : t('audit.empty.description')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-hairline text-muted">
                  <th className="w-9 px-2 py-2" aria-label={t('audit.cols.expand')} />
                  <th className="px-3 py-2 font-medium">{t('audit.cols.time')}</th>
                  <th className="px-3 py-2 font-medium">{t('audit.cols.actor')}</th>
                  <th className="px-3 py-2 font-medium">{t('audit.cols.action')}</th>
                  <th className="px-3 py-2 font-medium">{t('audit.cols.entity')}</th>
                  <th className="px-3 py-2 font-medium">{t('audit.cols.partner')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => (
                  <AuditRows key={row.id} row={row} open={open.has(row.id)} onToggle={() => toggle(row.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.total > 0 && <PageNav page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} loading={query.isFetching} />}
      </Card>
    </>
  )
}

function AuditRows({ row, open, onToggle }: { row: AuditRow; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation('ops')
  const name = localName({ name: row.actorName, nameKa: row.actorNameKa })
  return (
    <Fragment>
      <tr className={cn('border-b border-hairline align-top hover:bg-row-hover', open && 'serving bg-row-hover')}>
        <td className="px-2 py-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-label={t(open ? 'audit.collapse' : 'audit.expand')}
            className="grid size-7 place-items-center rounded text-muted hover:bg-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-signal"
          >
            <ChevronRight className={cn('size-4 stroke-[1.75] transition-transform', open && 'rotate-90')} />
          </button>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5">
          <DateText value={row.createdAt} withTime />
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-2">
            <Avatar name={name} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium text-ink">{name}</div>
              <div className="truncate text-[12px] text-muted">
                {row.actorEmail} · {t(`common:role.${row.actorRole}`)}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-2.5">
          <span className="inline-block rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-ink">{row.action}</span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Badge tone="outline" dot={false}>
              {t(`audit.entity.${row.entityType}`)}
            </Badge>
            <Mono>{row.entityId.slice(0, 8)}</Mono>
          </div>
        </td>
        <td className="px-3 py-2.5">{row.partnerName ?? <span className="text-subtle">—</span>}</td>
      </tr>
      {open && (
        <tr className="border-b border-hairline bg-sunken/40">
          <td />
          <td colSpan={5} className="px-3 py-3">
            <div className="grid gap-3 lg:grid-cols-3">
              <JsonBlock label={t('audit.json.before')}>
                <JsonView value={row.before} />
              </JsonBlock>
              <JsonBlock label={t('audit.json.after')}>
                <JsonView value={row.after} />
              </JsonBlock>
              <JsonBlock label={t('audit.json.diff')}>
                <JsonView value={row.diff} />
              </JsonBlock>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              <span>
                {t('audit.json.requestId')}: <Mono>{row.requestId}</Mono>
              </span>
              <span>
                {t('audit.json.ip')}: <span className="font-mono">{row.actorIp}</span>
              </span>
              <span>
                {t('audit.json.entityId')}: <span className="font-mono">{row.entityId}</span>
              </span>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
