import { Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge, Banner, Button, Card, CardBody, CardHeader, DateText, Skeleton, toast } from '@/components/ui'
import { cn } from '@/lib/cn'

import { errorMessage, useRunJob, useSchedulerJobs } from '../api'

/** Demo-only: run the product's cron jobs by hand. */
export function SchedulerPanel() {
  const { t } = useTranslation('ops')
  const query = useSchedulerJobs()
  const run = useRunJob()

  const onRun = async (name: string) => {
    try {
      const result = await run.mutateAsync(name)
      if (result.ok) toast.success(t('scheduler.done', { job: name }), { description: result.summary })
      else toast.error(t('scheduler.failed', { job: name }), { description: result.summary })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const key = (name: string) => name.replace(/\./g, '_')

  return (
    <Card>
      <CardHeader title={t('scheduler.title')} description={t('scheduler.description')} actions={<Badge tone="accent" dot={false}>{t('scheduler.demoOnly')}</Badge>} />
      <CardBody className="p-0">
        {query.isError ? (
          <div className="p-4">
            <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
              {errorMessage(query.error)}
            </Banner>
          </div>
        ) : query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-hairline">
            {query.data!.jobs.map((job) => {
              const pending = run.isPending && run.variables === job.name
              return (
                <li key={job.name} className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-[13px] font-medium text-ink">{job.name}</span>
                      <span className="rounded bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-muted" title={t('scheduler.cron')}>
                        {job.cron}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted">{t(`scheduler.jobs.${key(job.name)}`)}</p>
                    <p className="text-[12px] text-subtle">
                      {job.lastRun ? (
                        <>
                          {t('scheduler.lastRun')}: <DateText value={job.lastRun.startedAt} withTime />
                          <span className={cn('ml-2', job.lastRun.ok ? 'text-success' : 'text-danger')}>{job.lastRun.summary}</span>
                        </>
                      ) : (
                        t('scheduler.neverRun')
                      )}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" icon={<Play />} loading={pending} disabled={run.isPending || !job.registered} title={job.registered ? undefined : t('scheduler.notRegistered')} onClick={() => onRun(job.name)}>
                    {t('scheduler.runNow')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
