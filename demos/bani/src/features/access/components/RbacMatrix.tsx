import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, CheckCircle2, Lock, Minus, Undo2, X } from 'lucide-react'

import { Banner, Button, Card, StatusChip, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import { errorMessage } from '@/lib/api'
import type { FeatureKey, RbacMatrixResponse, RbacOverrides, RbacRole } from '@/types'
import { useSaveRbac } from '../api'

/* ----------------------------------------------------------------- helpers */

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'

function effective(data: RbacMatrixResponse, overrides: RbacOverrides, role: RbacRole, feature: FeatureKey): boolean {
  const o = overrides[role]?.[feature]
  return isBool(o) ? o : data.defaults[role].includes(feature)
}

function setCell(data: RbacMatrixResponse, overrides: RbacOverrides, role: RbacRole, feature: FeatureKey, value: boolean): RbacOverrides {
  const next: RbacOverrides = { ...overrides, [role]: { ...overrides[role] } }
  const row = next[role] as Partial<Record<FeatureKey, boolean>>
  if (data.defaults[role].includes(feature) === value) delete row[feature]
  else row[feature] = value
  if (Object.keys(row).length === 0) delete next[role]
  return next
}

/* -------------------------------------------------------------------- cell */

interface CellProps {
  on: boolean
  modified: boolean
  pending: boolean
  locked: boolean
  readOnly: boolean
  label: string
  title?: string
  onToggle: () => void
}

function Cell({ on, modified, pending, locked, readOnly, label, title, onToggle }: CellProps) {
  const inert = locked || readOnly
  const tone = locked || (readOnly && !modified)
    ? on
      ? 'bg-sunken text-muted'
      : 'text-faint'
    : modified
      ? on
        ? 'bg-primary text-on-primary'
        : 'border border-primary/60 bg-transparent text-primary'
      : on
        ? 'bg-success/12 text-success'
        : 'border border-line text-faint hover:border-line-strong hover:bg-hover'
  const Icon = on ? Check : modified ? X : Minus
  return (
    <span className="relative inline-flex" title={title}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        aria-disabled={inert || undefined}
        disabled={inert}
        onClick={onToggle}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-[160ms] ease-out',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          tone,
          inert ? 'cursor-not-allowed' : 'cursor-pointer',
          readOnly && !locked && 'opacity-60',
          pending && 'outline-2 outline-offset-2 outline-primary/60',
        )}
      >
        <Icon size={16} strokeWidth={on ? 2.25 : 1.75} aria-hidden />
      </button>
      {modified && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-panel"
          aria-hidden
          data-testid="modified-dot"
        />
      )}
    </span>
  )
}

/* ------------------------------------------------------------------ legend */

function Legend() {
  const { t } = useTranslation('access')
  const item = (swatch: React.ReactNode, text: string) => (
    <li className="flex items-center gap-2 text-[13px] text-muted">
      {swatch}
      <span>{text}</span>
    </li>
  )
  const box = 'inline-flex h-6 w-6 items-center justify-center rounded-[6px]'
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t('roles.legend.title')}>
      {item(
        <span className={cn(box, 'bg-success/12 text-success')}>
          <Check size={14} strokeWidth={2.25} />
        </span>,
        t('roles.legend.defaultOn'),
      )}
      {item(
        <span className={cn(box, 'relative bg-primary text-on-primary')}>
          <Check size={14} strokeWidth={2.25} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-panel" />
        </span>,
        t('roles.legend.overrideOn'),
      )}
      {item(
        <span className={cn(box, 'relative border border-primary/60 text-primary')}>
          <X size={14} strokeWidth={1.75} />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-panel" />
        </span>,
        t('roles.legend.overrideOff'),
      )}
      {item(
        <span className={cn(box, 'bg-sunken text-muted')}>
          <Lock size={13} strokeWidth={1.75} />
        </span>,
        t('roles.legend.locked'),
      )}
    </ul>
  )
}

/* ------------------------------------------------------------------ editor */

export function RbacMatrix({ data }: { data: RbacMatrixResponse }) {
  const { t } = useTranslation('access')
  const { t: tc } = useTranslation('common')
  const save = useSaveRbac()
  const [draft, setDraft] = useState<RbacOverrides>(data.overrides)
  const [justSaved, setJustSaved] = useState(false)
  const savedKey = JSON.stringify(data.overrides)

  const isSuper = data.yourRole === 'superadmin'
  const ownRole = isSuper ? null : (data.yourRole as RbacRole)

  const pendingCells = useMemo(() => {
    const out: { role: RbacRole; feature: FeatureKey }[] = []
    for (const f of data.features) {
      if (!f.overridable) continue
      for (const role of data.roles) {
        if (effective(data, draft, role, f.key) !== effective(data, data.overrides, role, f.key)) out.push({ role, feature: f.key })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, draft])
  const pendingSet = useMemo(() => new Set(pendingCells.map((c) => `${c.role}:${c.feature}`)), [pendingCells])
  const dirty = pendingCells.length > 0

  // Follow the server (another tab, a reset) unless the visitor has unsaved edits.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    if (!dirtyRef.current) setDraft(data.overrides)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey])

  useEffect(() => {
    if (!justSaved) return
    const timer = setTimeout(() => setJustSaved(false), 3200)
    return () => clearTimeout(timer)
  }, [justSaved])

  const overrideCount = useMemo(() => {
    let n = 0
    for (const role of data.roles) n += Object.keys(data.overrides[role] ?? {}).length
    return n
  }, [data])

  const onSave = () => {
    save.mutate(draft, {
      onSuccess: (next) => {
        setDraft(next.overrides)
        setJustSaved(true)
        toast.success(t('roles.toastSaved'))
      },
    })
  }

  const onDiscard = () => {
    save.reset()
    setDraft(data.overrides)
  }

  const enabledCount = (role: RbacRole) => data.features.filter((f) => effective(data, draft, role, f.key)).length

  return (
    <div className="flex flex-col gap-4">
      {!isSuper && (
        <Banner tone="info">{t('roles.ownColumnNote', { role: tc(`roles.${data.yourRole}`) })}</Banner>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left">
            <caption className="sr-only">{t('roles.tableCaption')}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 w-[140px] min-w-[140px] border-b sm:w-[260px] sm:min-w-[190px] border-line bg-sunken px-4 py-3 text-[12.5px] font-semibold text-muted"
                >
                  {t('roles.featureColumn')}
                </th>
                {data.roles.map((role) => {
                  const own = role === ownRole
                  return (
                    <th
                      key={role}
                      scope="col"
                      className={cn('min-w-[96px] border-b border-line px-2 py-3 text-center align-top', own ? 'bg-hover' : 'bg-sunken')}
                    >
                      <div className="text-[13px] font-semibold leading-snug text-ink">{tc(`roles.${role}`)}</div>
                      <div className="mt-1 text-[12px] font-normal text-muted tabular">
                        {t('roles.countOf', { count: enabledCount(role), total: data.features.length })}
                      </div>
                      {own && (
                        <div className="mt-1.5">
                          <StatusChip tone="bronze" size="sm" icon={Lock}>
                            {t('roles.yourRole')}
                          </StatusChip>
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.features.map((feature, idx) => {
                const last = idx === data.features.length - 1
                const lockedRow = !feature.overridable
                const border = last ? '' : 'border-b border-line'
                return (
                  <tr key={feature.key} className="group">
                    <th
                      scope="row"
                      className={cn('sticky left-0 z-10 bg-panel px-4 py-3 text-left font-normal group-hover:bg-hover', border)}
                    >
                      <div className="flex items-start gap-2">
                        {lockedRow && (
                          <span title={t('roles.lockedHint')} className="mt-0.5 text-muted">
                            <Lock size={14} strokeWidth={1.75} aria-label={t('roles.lockedHint')} />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="text-[14px] font-medium leading-snug text-ink">{tc(`features.${feature.key}`)}</div>
                          <div className="mt-0.5 hidden text-[12.5px] leading-snug text-muted sm:block">{t(`features.${feature.key}`)}</div>
                        </div>
                      </div>
                    </th>
                    {data.roles.map((role) => {
                      const own = role === ownRole
                      const on = effective(data, draft, role, feature.key)
                      const isDefault = data.defaults[role].includes(feature.key)
                      const modified = feature.overridable && on !== isDefault
                      const rowLabel = `${tc(`roles.${role}`)}: ${tc(`features.${feature.key}`)}`
                      return (
                        <td key={role} className={cn('px-2 py-3 text-center group-hover:bg-hover', own && 'bg-hover', border)}>
                          <Cell
                            on={on}
                            modified={modified}
                            pending={pendingSet.has(`${role}:${feature.key}`)}
                            locked={lockedRow}
                            readOnly={own}
                            label={rowLabel}
                            title={lockedRow ? t('roles.lockedHint') : own ? t('roles.ownColumnHint') : modified ? t('roles.modifiedHint') : undefined}
                            onToggle={() => setDraft((d) => setCell(data, d, role, feature.key, !effective(data, d, role, feature.key)))}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken px-4 py-3">
          <Legend />
          <p className="text-[12.5px] text-muted">{t('roles.superadminNote')}</p>
        </div>
      </Card>

      <p className="text-[12.5px] text-muted tabular">{t('roles.overrideCount', { count: overrideCount })}</p>

      {(dirty || save.isPending || save.isError || justSaved) && (
        <div
          role="status"
          aria-live="polite"
          className="sticky bottom-[132px] z-20 sm:bottom-[72px] flex flex-col gap-3 rounded-[10px] border border-line-strong bg-panel p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:px-4"
        >
          <div className="min-w-0">
            {save.isError ? (
              <Banner tone="danger" title={t('roles.saveError')}>
                {errorMessage(save.error)}
              </Banner>
            ) : justSaved && !dirty ? (
              <div className="flex items-center gap-2 text-[14px] font-medium text-success">
                <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden />
                {t('roles.saved')}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                {t('roles.pending', { count: pendingCells.length })}
              </div>
            )}
          </div>
          {(dirty || save.isPending) && (
            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button variant="ghost" icon={Undo2} onClick={onDiscard} disabled={save.isPending}>
                {t('roles.discard')}
              </Button>
              <Button variant="primary" onClick={onSave} loading={save.isPending}>
                {save.isPending ? t('roles.saving') : save.isError ? t('roles.retry') : t('roles.save')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
