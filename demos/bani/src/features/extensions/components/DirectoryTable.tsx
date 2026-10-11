import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, Hash, KeyRound, RefreshCw, type LucideIcon } from 'lucide-react'

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  ErrorState,
  IconButton,
  SearchInput,
  StatusChip,
  Toolbar,
  toast,
  type Column,
} from '@/components/ui'
import { fmtNumber } from '@/lib/format'
import { useLang } from '@/shell/state'
import type { Extension } from '@/types'
import { useExtensions } from '../api'

const PAGE_STEP = 20
const MASK = '••••••••'

export function DirectoryTable({ highlight }: { highlight?: string | null }) {
  const { t } = useTranslation('extensions')
  const lang = useLang()
  const query = useExtensions()
  const [search, setSearch] = useState('')
  const [reveal, setReveal] = useState(false)
  const [visible, setVisible] = useState(PAGE_STEP)

  const all = query.data ?? []
  const needle = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!needle) return all
    return all.filter(
      (e) =>
        e.number.includes(needle) ||
        e.name.toLowerCase().includes(needle) ||
        e.email.toLowerCase().includes(needle) ||
        e.secret.toLowerCase().includes(needle),
    )
  }, [all, needle])
  const rows = filtered.slice(0, visible)

  const columns: Column<Extension>[] = [
    {
      id: 'number',
      header: t('directory.number'),
      mono: true,
      width: 96,
      sortValue: (e) => Number(e.number),
      cell: (e) => (
        <span className="inline-flex items-center gap-2">
          {e.number}
          {highlight === e.number && (
            <StatusChip tone="success" size="sm" icon={false}>
              {t('directory.new')}
            </StatusChip>
          )}
        </span>
      ),
    },
    {
      id: 'name',
      header: t('directory.name'),
      sortValue: (e) => e.name.toLowerCase(),
      cell: (e) => (
        <div className="min-w-0">
          <div className="truncate">{e.name}</div>
          <div className="truncate text-xs text-muted sm:hidden">{e.email}</div>
        </div>
      ),
    },
    {
      id: 'email',
      header: t('directory.email'),
      hideBelow: 'sm',
      sortValue: (e) => e.email.toLowerCase(),
      cell: (e) => <span className="text-muted">{e.email}</span>,
    },
    {
      id: 'password',
      header: t('directory.password'),
      mono: true,
      cell: (e) => (reveal ? <span className="select-all">{e.secret}</span> : <span className="text-faint" aria-label="hidden">{MASK}</span>),
    },
    {
      id: 'action',
      header: t('directory.action'),
      align: 'right',
      width: 132,
      cell: (e) => (
        <span className="inline-flex items-center justify-end gap-1">
          <CopyAction value={e.secret} label={t('directory.copyPassword')} icon={KeyRound} />
          <CopyAction value={e.number} label={t('directory.copyNumber')} icon={Hash} />
        </span>
      ),
    },
  ]

  const countLabel = needle
    ? t('directory.filtered', { shown: fmtNumber(filtered.length, lang), total: fmtNumber(all.length, lang) })
    : t('directory.count', { count: all.length })

  return (
    <Card>
      <CardHeader
        title={t('directory.title')}
        subtitle={query.isSuccess ? countLabel : undefined}
        actions={
          <IconButton
            label={t('directory.refresh')}
            icon={RefreshCw}
            variant="secondary"
            onClick={() => void query.refetch()}
            className={query.isFetching ? '[&_svg]:animate-spin' : undefined}
          />
        }
      />
      <CardBody>
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <Toolbar
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={reveal ? EyeOff : Eye}
                  onClick={() => setReveal((v) => !v)}
                  aria-pressed={reveal}
                >
                  {reveal ? t('directory.hidePasswords') : t('directory.showPasswords')}
                </Button>
              }
            >
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setVisible(PAGE_STEP)
                }}
                placeholder={t('directory.searchPlaceholder')}
                className="w-full sm:max-w-sm"
              />
            </Toolbar>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(e) => e.id}
              loading={query.isLoading}
              compact
              emptyTitle={needle ? t('directory.noMatchTitle') : t('directory.emptyTitle')}
              emptyBody={needle ? t('directory.noMatchBody') : t('directory.emptyBody')}
              rowClassName={(e) => (highlight === e.number ? 'bg-success/10' : undefined)}
            />
            {filtered.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span>{t('directory.showing', { shown: fmtNumber(rows.length, lang), total: fmtNumber(filtered.length, lang) })}</span>
                {filtered.length > visible && (
                  <Button variant="secondary" size="sm" onClick={() => setVisible((v) => v + PAGE_STEP)}>
                    {t('directory.showMore', { count: Math.min(PAGE_STEP, filtered.length - visible) })}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

/** Icon-only copy action; the accessible name says what is copied. */
function CopyAction({ value, label, icon }: { value: string; label: string; icon: LucideIcon }) {
  const { t } = useTranslation('common')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const handle = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(handle)
  }, [copied])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } finally {
        ta.remove()
      }
    }
    setCopied(true)
    toast.success(t('actions.copied'), { duration: 1200 })
  }
  return <IconButton size="sm" label={copied ? t('actions.copied') : label} icon={copied ? Check : icon} onClick={() => void copy()} />
}
