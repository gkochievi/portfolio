import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, X } from 'lucide-react'

import { Badge, IconButton, toast } from '@/components/ui'
import { cn } from '@/lib/cn'
import type { TenantState } from '@/types'

import type { CheckResult } from '../types'

export function StateBadge({ state }: { state: TenantState }) {
  const { t } = useTranslation('superadmin')
  const tone = state === 'active' ? 'success' : state === 'disabled' ? 'warning' : 'danger'
  return (
    <Badge tone={tone} dot>
      {t(`state.${state}`)}
    </Badge>
  )
}

/** A small "copy to clipboard" button (falls back quietly where the clipboard is blocked). */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const { t } = useTranslation()
  const [done, setDone] = useState(false)
  return (
    <IconButton
      size="xs"
      variant="ghost"
      label={label ?? t('actions.copy')}
      icon={done ? <Check strokeWidth={1.75} /> : <Copy strokeWidth={1.75} />}
      onClick={() => {
        const finish = () => {
          setDone(true)
          toast.success(t('actions.copied'))
          window.setTimeout(() => setDone(false), 1500)
        }
        const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
        if (!clipboard) return finish()
        clipboard.writeText(value).then(finish, finish)
      }}
    />
  )
}

/** A pass/fail checklist (platform tests, AI key tests). */
export function ChecksList({ checks, scope }: { checks: CheckResult[]; scope: 'platform' | 'ai' }) {
  const { t } = useTranslation('superadmin')
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-ui border border-line bg-panel" aria-live="polite">
      {checks.map((check) => (
        <li key={check.id} className="flex items-start gap-3 px-3 py-2.5 text-[13px]">
          <span
            className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full', check.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}
            aria-hidden
          >
            {check.ok ? <Check size={13} strokeWidth={2} /> : <X size={13} strokeWidth={2} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{t(`checks.${scope}.${check.id}.label`)}</p>
            <p className="break-words text-muted">
              {t(`checks.${scope}.${check.id}.${check.ok ? 'ok' : 'fail'}`, { value: check.value ?? '' })}
            </p>
          </div>
          <span className="sr-only">{check.ok ? t('checks.passed') : t('checks.failed')}</span>
        </li>
      ))}
    </ul>
  )
}

export function Panel({ title, description, actions, children }: { title: string; description?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-modal border border-line bg-panel">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}
