import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'

import { Button, Card, ErrorState, PageHeader, SectionTitle, Skeleton } from '@/components/ui'
import { ConnectionCard } from '../components/ConnectionCard'
import { useConnections } from '../api'
import { SECTIONS } from '../schema'

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      {[3, 3, 2].map((n, i) => (
        <div key={i} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: n }, (_, j) => (
            <Card key={j} className="p-4">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="mt-2 h-3 w-80 max-w-full" />
            </Card>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function ConnectionsPage() {
  const { t } = useTranslation('access')
  const query = useConnections()
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  const list = query.data
  const stats = useMemo(
    () => ({
      total: list?.length ?? 0,
      configured: list?.filter((c) => c.configured).length ?? 0,
      enabled: list?.filter((c) => c.enabled).length ?? 0,
    }),
    [list],
  )

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const allOpen = !!list && list.length > 0 && open.size >= list.length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('connections.title')}
        subtitle={t('connections.subtitle')}
        meta={
          list ? (
            <span className="text-[13px] text-muted tabular">
              {t('connections.summary', { configured: stats.configured, total: stats.total, enabled: stats.enabled })}
            </span>
          ) : undefined
        }
        actions={
          list ? (
            <Button
              size="sm"
              icon={allOpen ? ChevronsDownUp : ChevronsUpDown}
              onClick={() => setOpen(allOpen ? new Set() : new Set(list.map((c) => c.key)))}
            >
              {allOpen ? t('connections.collapseAll') : t('connections.expandAll')}
            </Button>
          ) : undefined
        }
      />

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError || !list ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        SECTIONS.map((section) => {
          const items = list.filter((c) => c.section === section)
          if (items.length === 0) return null
          return (
            <section key={section} aria-labelledby={`sec-${section}`} className="flex flex-col gap-3">
              <div>
                <SectionTitle>
                  <span id={`sec-${section}`}>{t(`connections.sections.${section}.title`)}</span>
                </SectionTitle>
                <p className="mt-0.5 text-[13px] text-muted">{t(`connections.sections.${section}.description`)}</p>
              </div>
              {items.map((c) => (
                <ConnectionCard key={c.key} config={c} open={open.has(c.key)} onToggle={() => toggle(c.key)} />
              ))}
            </section>
          )
        })
      )}
    </div>
  )
}
