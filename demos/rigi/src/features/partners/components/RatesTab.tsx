import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { fieldErrorsOf } from '@/api/client'
import { Badge, Button, Card, CardBody, CardHeader, DataTable, DateText, Field, Input, Money, Skeleton, type Column } from '@/components/ui'
import { formatDate } from '@/lib/format'
import type { Currency, PartnerRateHistory } from '@/types'

import { useAddRate, usePartnerRates } from '../api'
import { rateSchema, type RateInput } from '../lib/schema'

/** Today, or the day after the current row starts when that is today or later. */
function defaultEffectiveFrom(openFrom: string | null): string {
  const today = new Date().toISOString().slice(0, 10)
  if (!openFrom || openFrom < today) return today
  return new Date(Date.parse(`${openFrom}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
}

export function RatesTab({ partnerId, currency }: { partnerId: string; currency: Currency }) {
  const { t } = useTranslation('partners')
  const rates = usePartnerRates(partnerId)
  const add = useAddRate(partnerId)
  const data = rates.data
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<RateInput>({
    resolver: zodResolver(rateSchema),
    values: data
      ? { ratePerPoint: data.current.ratePerPoint, freeAllowance: data.current.freeAllowance, effectiveFrom: defaultEffectiveFrom(data.current.effectiveFrom) }
      : undefined,
  })
  const msg = (m?: string) => (m ? t(m) : undefined)

  const onSubmit = handleSubmit(async (values) => {
    try {
      await add.mutateAsync(values)
      toast.success(t('rates.saved'))
      reset(values)
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const keys = Object.keys(fields)
      if (keys.length === 0) toast.error(error instanceof Error ? error.message : t('errors.generic'))
      for (const key of keys) setError(key as keyof RateInput, { message: fields[key] })
    }
  })

  const columns: Column<PartnerRateHistory>[] = [
    { key: 'from', header: t('rates.columns.from'), sortable: true, sortValue: (r) => r.effectiveFrom, cell: (r) => <DateText value={r.effectiveFrom} /> },
    {
      key: 'to',
      header: t('rates.columns.to'),
      sortable: true,
      sortValue: (r) => r.effectiveTo ?? '9999',
      cell: (r) => (r.effectiveTo ? <DateText value={r.effectiveTo} /> : <Badge tone="success">{t('rates.open')}</Badge>),
    },
    { key: 'rate', header: t('rates.columns.rate'), align: 'right', cell: (r) => <Money amount={r.ratePerPoint} currency={currency} /> },
    { key: 'allowance', header: t('rates.columns.allowance'), align: 'right', cell: (r) => <span className="num">{t('rates.allowanceValue', { count: r.freeAllowance })}</span> },
    { key: 'by', header: t('rates.columns.by'), hideBelow: 'md', cell: (r) => r.createdByName ?? <span className="text-subtle">{t('rates.system')}</span> },
    { key: 'at', header: t('rates.columns.at'), hideBelow: 'lg', cell: (r) => <DateText value={r.createdAt} withTime /> },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card active>
          <CardHeader title={t('rates.current')} description={data?.current.effectiveFrom ? t('rates.effectiveSince', { date: formatDate(data.current.effectiveFrom) }) : undefined} />
          <CardBody className="grid grid-cols-2 gap-4">
            {data ? (
              <>
                <div>
                  <p className="eyebrow">{t('rates.rate')}</p>
                  <p className="mt-1 font-display text-2xl font-semibold"><Money amount={data.current.ratePerPoint} currency={currency} /></p>
                </div>
                <div>
                  <p className="eyebrow">{t('rates.allowance')}</p>
                  <p className="num mt-1 font-display text-xl font-semibold">{t('rates.allowanceValue', { count: data.current.freeAllowance })}</p>
                </div>
              </>
            ) : (
              <Skeleton className="col-span-2 h-14" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('rates.newRate')} description={t('rates.newRateHint')} />
          <CardBody>
            {data ? (
            <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-3">
              <Field label={t('rates.ratePerPoint')} required htmlFor="r-rate" error={msg(errors.ratePerPoint?.message)}>
                <Input id="r-rate" type="number" step="0.01" min={0} inputMode="decimal" invalid={Boolean(errors.ratePerPoint)} {...register('ratePerPoint', { valueAsNumber: true })} />
              </Field>
              <Field label={t('rates.freeAllowance')} required htmlFor="r-allow" error={msg(errors.freeAllowance?.message)}>
                <Input id="r-allow" type="number" step="1" min={0} inputMode="numeric" invalid={Boolean(errors.freeAllowance)} {...register('freeAllowance', { valueAsNumber: true })} />
              </Field>
              <Field label={t('rates.effectiveFrom')} required htmlFor="r-from" error={msg(errors.effectiveFrom?.message)}>
                <Input id="r-from" type="date" invalid={Boolean(errors.effectiveFrom)} {...register('effectiveFrom')} />
              </Field>
              <div className="sm:col-span-3 sm:text-right">
                <Button type="submit" loading={add.isPending}>{t('rates.submit')}</Button>
              </div>
            </form>
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </CardBody>
        </Card>
      </div>

      <section>
        <h3 className="mb-2 font-display text-base font-semibold">{t('rates.history')}</h3>
        <DataTable
          columns={columns}
          rows={data?.history}
          getRowId={(r) => r.id}
          loading={rates.isLoading}
          error={rates.error}
          onRetry={() => rates.refetch()}
          pageSize={0}
          activeRowId={data?.history.find((r) => r.effectiveTo === null)?.id}
          empty={{ title: t('common:states.empty') }}
        />
      </section>
    </div>
  )
}
