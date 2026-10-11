/** Small pieces shared by the archive sections. */
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog, Field, Input, StatusChip, type Tone } from '@/components/ui'
import { cn } from '@/lib/cn'
import { errorMessage, fieldErrors } from '@/api/client'
import { tenantDate } from '@/lib/format'
import type { BackupFlow, BackupSourceKey, JobStatus, LogLevel } from '@/types'
import { useVerifyPassword } from '../api'

export const MAX_RANGE_DAYS = 31
const DAY_MS = 86_400_000

/** Tenant calendar day `offset` days from today. */
export function dayOffset(offset: number): string {
  return tenantDate(Date.now() + offset * DAY_MS)
}

export const STATUS_TONE: Record<JobStatus, Tone> = {
  running: 'info',
  completed: 'success',
  failed: 'danger',
  canceled: 'neutral',
}

export function JobStatusChip({ status, size = 'sm' }: { status: JobStatus; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('common')
  return (
    <StatusChip tone={STATUS_TONE[status]} size={size}>
      {t(`jobStatus.${status}`)}
    </StatusChip>
  )
}

export const LEVEL_TONE: Record<LogLevel, Tone> = { debug: 'neutral', info: 'info', warn: 'warning', error: 'danger' }

export function useSourceLabel(): (flow: BackupFlow, sourceKey: BackupSourceKey) => string {
  const { t } = useTranslation('archive')
  return (flow, sourceKey) => {
    if (flow === 'voice_archive') return t('sources.voice_archive')
    return sourceKey === 'secondary' ? t('sources.edge_secondary') : t('sources.edge_primary')
  }
}

/* ------------------------------------------------------------ ranges */

export type RangeError = null | { field: 'fromDate' | 'toDate'; key: string; vars?: Record<string, unknown> }

/** Client-side range validation with translated messages (the handler repeats it). */
export function validateRange(from: string, to: string, opts: { lastDay: string }): RangeError {
  if (!from) return { field: 'fromDate', key: 'form.errors.fromRequired' }
  if (!to) return { field: 'toDate', key: 'form.errors.toRequired' }
  if (to < from) return { field: 'toDate', key: 'form.errors.toBeforeFrom' }
  if (to > opts.lastDay) return { field: 'toDate', key: opts.lastDay === dayOffset(0) ? 'form.errors.future' : 'form.errors.yesterday' }
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1
  if (days > MAX_RANGE_DAYS) return { field: 'toDate', key: 'form.errors.tooLong', vars: { max: MAX_RANGE_DAYS } }
  return null
}

interface DateRangeFieldsProps {
  idPrefix: string
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  lastDay: string
  error?: RangeError
  disabled?: boolean
}

export function DateRangeFields({ idPrefix, from, to, onFrom, onTo, lastDay, error, disabled }: DateRangeFieldsProps) {
  const { t } = useTranslation('archive')
  const msg = error ? t(error.key, error.vars) : undefined
  return (
    <>
      <Field label={t('form.from')} htmlFor={`${idPrefix}-from`} error={error?.field === 'fromDate' ? msg : undefined}>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          max={lastDay}
          disabled={disabled}
          invalid={error?.field === 'fromDate'}
          onChange={(e) => onFrom(e.target.value)}
        />
      </Field>
      <Field label={t('form.to')} htmlFor={`${idPrefix}-to`} error={error?.field === 'toDate' ? msg : undefined}>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          max={lastDay}
          disabled={disabled}
          invalid={error?.field === 'toDate'}
          onChange={(e) => onTo(e.target.value)}
        />
      </Field>
    </>
  )
}

/* ---------------------------------------------------------- progress */

export function ProgressBar({ value, max, tone = 'primary', label }: { value: number; max: number; tone?: 'primary' | 'success' | 'danger'; label?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-sunken"
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'success' ? 'bg-success' : tone === 'danger' ? 'bg-danger' : 'bg-primary',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/* ------------------------------------------------------ password gate */

interface PasswordConfirmProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  body: ReactNode
  confirmLabel: ReactNode
  tone?: 'default' | 'danger'
  /** Runs after the password was accepted; the dialog closes when it resolves. */
  onVerified: () => Promise<unknown>
}

/** Password-confirm dialog in front of the destructive Core Cluster actions. */
export function PasswordConfirmDialog({ open, onOpenChange, title, body, confirmLabel, tone = 'danger', onVerified }: PasswordConfirmProps) {
  const { t } = useTranslation('archive')
  const verify = useVerifyPassword()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const close = (next: boolean) => {
    if (busy) return
    if (!next) {
      setPassword('')
      setError(null)
    }
    onOpenChange(next)
  }

  const confirm = async () => {
    if (!password.trim()) {
      setError(t('password.required'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await verify.mutateAsync(password)
      await onVerified()
      setPassword('')
      onOpenChange(false)
    } catch (err) {
      setError(fieldErrors(err).password ?? errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={close}
      title={title}
      body={body}
      confirmLabel={busy ? t('password.verifying') : confirmLabel}
      tone={tone}
      busy={busy}
      confirmDisabled={!password}
      onConfirm={() => void confirm()}
    >
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void confirm()
        }}
      >
        <Field label={t('password.label')} htmlFor="archive-password" error={error ?? undefined}>
          <Input
            id="archive-password"
            type="password"
            autoComplete="off"
            value={password}
            invalid={!!error}
            placeholder={t('password.placeholder')}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(null)
            }}
          />
        </Field>
        <p className="text-[12.5px] text-muted">{t('password.simulated')}</p>
      </form>
    </ConfirmDialog>
  )
}

/** Responsive grid of tiles. */
export function TileGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 | 7 }) {
  const map = {
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
    7: 'grid-cols-2 md:grid-cols-4 xl:grid-cols-7',
  }
  return <div className={cn('grid gap-3', map[cols])}>{children}</div>
}
