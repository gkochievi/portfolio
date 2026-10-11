/**
 * Small pieces shared by the campaigns screens. Owner: feature group campaigns.
 */
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { SegmentedControl, TenantMark } from '@/components/ui'
import { useLang } from '@/hooks/useLang'
import { cn, lt } from '@/lib/utils'
import type { Tenant } from '@/types'

export const WINDOW_OPTIONS = ['7', '30', '90'] as const
export type WindowOption = (typeof WINDOW_OPTIONS)[number]

/** Read/write URL search params, dropping blanks and resetting `page` when a filter changes. */
export function useParamState() {
  const [params, setParams] = useSearchParams()
  const set = useCallback(
    (patch: Record<string, string | null | undefined>, keepPage = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === undefined || value === '') next.delete(key)
            else next.set(key, value)
          }
          if (!keepPage && !('page' in patch)) next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )
  return [params, set] as const
}

export function readWindow(params: URLSearchParams, fallback: WindowOption = '30'): WindowOption {
  const raw = params.get('days')
  return (WINDOW_OPTIONS as readonly string[]).includes(raw ?? '') ? (raw as WindowOption) : fallback
}

export function WindowControl({ value, onChange }: { value: WindowOption; onChange: (value: WindowOption) => void }) {
  const { t } = useTranslation('campaigns')
  return (
    <SegmentedControl<WindowOption>
      label={t('window.label')}
      size="sm"
      value={value}
      onChange={onChange}
      options={WINDOW_OPTIONS.map((days) => ({ value: days, label: t('window.option', { count: Number(days) }) }))}
    />
  )
}

/** Tenant monogram tile + name in the current language. */
export function TenantLabel({
  tenant,
  size = 'xs',
  className,
  hideName,
}: {
  tenant: Pick<Tenant, 'monogram' | 'primary' | 'onPrimary' | 'name'>
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  hideName?: boolean
}) {
  const lang = useLang()
  const name = lt(tenant.name, lang)
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <TenantMark monogram={tenant.monogram} primary={tenant.primary} onPrimary={tenant.onPrimary} size={size} title={name} />
      {!hideName && <span className="truncate">{name}</span>}
    </span>
  )
}
