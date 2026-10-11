import { useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ListChecks, PhoneCall } from 'lucide-react'

import { Alert, Badge, Button, DateTimeInput, EmptyState, Field, Kbd, Panel, Skeleton, Textarea, ToneDot } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatDuration, formatPhone, formatTime, toDateTimeInput } from '@/lib/format'
import { useLocalized } from '@/lib/localized'
import { toneClasses } from '@/lib/tone'
import type { CallRecordView, Disposition, OperatorCall } from '@/types'
import { ICON } from './shared'

export interface DispositionDraft {
  code: string | null
  callbackAt: string
  notes: string
}

/** Recently used (last 3 codes from the KPIs) first, then the rest by sortOrder. */
export function groupDispositions(list: Disposition[], recentCodes: string[]): { recent: Disposition[]; rest: Disposition[] } {
  const active = list.filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  const recent = recentCodes.map((code) => active.find((d) => d.code === code)).filter((d): d is Disposition => !!d)
  return { recent, rest: active.filter((d) => !recent.includes(d)) }
}

function Chip({ disposition, selected, disabled, onSelect }: { disposition: Disposition; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const l = useLocalized()
  const tone = toneClasses(disposition.color)
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex min-h-11 w-full items-center gap-2 rounded-control border px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        selected ? cn('border-carbon bg-carbon text-on-carbon') : 'border-hairline bg-panel text-ink hover:border-hairline-strong hover:bg-sunken',
      )}
    >
      <span className={cn('size-2.5 shrink-0 rounded-full', tone.dot)} aria-hidden />
      <span className="min-w-0 flex-1 leading-tight [overflow-wrap:anywhere]">{l(disposition.name)}</span>
      {disposition.sortOrder >= 1 && disposition.sortOrder <= 9 && <Kbd>{disposition.sortOrder}</Kbd>}
    </button>
  )
}

export function DispositionPanel({
  dispositions,
  recentCodes,
  call,
  draft,
  onDraft,
  onSubmit,
  submitting,
  errors,
  bare,
}: {
  dispositions: Disposition[] | undefined
  recentCodes: string[]
  call: OperatorCall | null
  draft: DispositionDraft
  onDraft: (patch: Partial<DispositionDraft>) => void
  onSubmit: () => void
  submitting: boolean
  errors: Record<string, string>
  /** Inside the narrow-screen modal: no panel frame. */
  bare?: boolean
}) {
  const { t } = useTranslation('agent')
  const awaiting = !!call?.awaitingDisposition
  const canPick = !!call && call.phase !== 'incoming'
  const selected = dispositions?.find((d) => d.code === draft.code) ?? null
  const groups = groupDispositions(dispositions ?? [], recentCodes)
  const onNotesKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (awaiting) onSubmit()
    }
  }
  const body = (
    <div className="grid gap-4">
      {awaiting ? (
        <Alert tone="warning" title={t('disposition.required')}>
          {t('disposition.requiredHint')}
        </Alert>
      ) : !call ? (
        <p className="text-sm text-muted">{t('disposition.idleHint')}</p>
      ) : null}
      {!dispositions ? (
        <Skeleton className="h-48" />
      ) : (
        <>
          {groups.recent.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted">{t('disposition.recent')}</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {groups.recent.map((d) => (
                  <Chip key={d.id} disposition={d} selected={draft.code === d.code} disabled={!canPick} onSelect={() => onDraft({ code: d.code })} />
                ))}
              </div>
            </div>
          )}
          <div>
            {groups.recent.length > 0 && <p className="mb-1.5 text-xs font-semibold text-muted">{t('disposition.all')}</p>}
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {groups.rest.map((d) => (
                <Chip key={d.id} disposition={d} selected={draft.code === d.code} disabled={!canPick} onSelect={() => onDraft({ code: d.code })} />
              ))}
            </div>
          </div>
        </>
      )}
      {errors.code && <p className="text-sm text-danger">{errors.code}</p>}
      {call && call.suggestedDisposition && draft.code === call.suggestedDisposition && awaiting && (
        <p className="text-xs text-muted">{t('disposition.suggested')}</p>
      )}
      {selected?.scheduleCallback && canPick && (
        <Field label={t('disposition.callback')} htmlFor="callback-at" required error={errors.callbackAt}>
          <DateTimeInput
            id="callback-at"
            value={draft.callbackAt}
            min={toDateTimeInput(new Date())}
            invalid={!!errors.callbackAt}
            onChange={(event) => onDraft({ callbackAt: event.target.value })}
          />
        </Field>
      )}
      {awaiting && (
        <>
          <Field label={t('disposition.notes')} htmlFor="disposition-notes" aside={<Kbd>Enter</Kbd>}>
            <Textarea
              id="disposition-notes"
              rows={2}
              value={draft.notes}
              placeholder={t('notes.placeholder')}
              onChange={(event) => onDraft({ notes: event.target.value })}
              onKeyDown={onNotesKey}
            />
          </Field>
          <Button variant="dial" block loading={submitting} disabled={!draft.code} onClick={onSubmit}>
            {t('disposition.submit')}
          </Button>
        </>
      )}
    </div>
  )
  if (bare) return body
  return (
    <Panel
      title={t('disposition.title')}
      icon={<ListChecks {...ICON} />}
      className={cn(awaiting && 'border-warning ring-1 ring-warning')}
      actions={awaiting ? <Badge tone="warning">{t('disposition.requiredShort')}</Badge> : undefined}
    >
      {body}
    </Panel>
  )
}

/* ---------------------------------------------------------- today's calls */

export function TodayCalls({ calls, loading }: { calls: CallRecordView[] | undefined; loading: boolean }) {
  const { t } = useTranslation('agent')
  const l = useLocalized()
  const [open, setOpen] = useState<string | null>(null)
  return (
    <Panel title={t('today.title')} icon={<PhoneCall {...ICON} />} padded={false} actions={calls ? <Badge>{calls.length}</Badge> : undefined}>
      {loading ? (
        <div className="p-4">
          <Skeleton className="h-32" />
        </div>
      ) : !calls || calls.length === 0 ? (
        <EmptyState compact title={t('today.empty')} description={t('today.emptyHint')} />
      ) : (
        <ul className="max-h-[420px] divide-y divide-hairline overflow-y-auto">
          {calls.map((call) => {
            const expanded = open === call.id
            return (
              <li key={call.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-sunken"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : call.id)}
                >
                  <ToneDot tone={call.dispositionColor ?? (call.outcome === 'ANSWERED' ? 'success' : 'muted')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{l(call.customerName) || formatPhone(call.destinationNumber)}</span>
                    <span className="block font-mono text-xs tabular text-muted">
                      {formatTime(call.callInitiatedAt)} · {formatDuration(call.talkDuration)}
                    </span>
                  </span>
                  {call.dispositionName ? (
                    <Badge size="sm" tone={call.dispositionColor ?? 'muted'}>
                      {l(call.dispositionName)}
                    </Badge>
                  ) : (
                    <Badge size="sm" variant="outline">
                      {t(`common:callOutcome.${call.outcome}`)}
                    </Badge>
                  )}
                  <ChevronDown size={16} strokeWidth={1.75} className={cn('shrink-0 text-muted transition-transform', expanded && 'rotate-180')} aria-hidden />
                </button>
                {expanded && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 bg-sunken/60 px-4 py-3 text-sm">
                    <dt className="text-muted">{t('today.phone')}</dt>
                    <dd className="font-mono tabular text-ink">{formatPhone(call.destinationNumber)}</dd>
                    <dt className="text-muted">{t('today.campaign')}</dt>
                    <dd className="text-ink">{l(call.campaignName)}</dd>
                    <dt className="text-muted">{t('today.disposition')}</dt>
                    <dd>
                      {call.dispositionName ? (
                        <Badge size="sm" tone={call.dispositionColor ?? 'muted'}>
                          {l(call.dispositionName)}
                        </Badge>
                      ) : (
                        <span className="text-muted">{t('today.noDisposition')}</span>
                      )}
                    </dd>
                    <dt className="text-muted">{t('today.notes')}</dt>
                    <dd className="whitespace-pre-wrap text-ink">{call.dispositionNote || <span className="text-muted">{t('today.noNotes')}</span>}</dd>
                  </dl>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
