import { Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Banner, Button, Card, CardBody, CardFooter, CardHeader, Dialog, Field, Mono, Money, NativeSelect, PageHeader, toast } from '@/components/ui'
import { InvoiceStatusChip } from '@/components/status'
import { isApiError } from '@/lib/api'
import { monthName } from '@/lib/format'

import { useGenerateInvoices, useInvoices, usePartnerOptions, useTemplateOptions } from '../api'
import { errorMessage, fieldErrorOf } from '../lib/errors'

function previousMonth(): { year: number; month: number } {
  const d = new Date()
  const m = d.getMonth() // 0-based current month = 1-based previous month
  return m === 0 ? { year: d.getFullYear() - 1, month: 12 } : { year: d.getFullYear(), month: m }
}

export default function InvoiceGeneratePage() {
  const { t } = useTranslation(['invoicing', 'common'])
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const prev = useMemo(previousMonth, [])

  const [partnerId, setPartnerId] = useState(search.get('partnerId') ?? '')
  const [year, setYear] = useState(String(prev.year))
  const [month, setMonth] = useState(String(prev.month))
  const [templateId, setTemplateId] = useState('')
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [formError, setFormError] = useState<unknown>(null)

  const partners = usePartnerOptions()
  const activePartners = (partners.data ?? []).filter((p) => p.isActive)
  const templates = useTemplateOptions(partnerId || null)
  const generate = useGenerateInvoices()

  const thisYear = new Date().getFullYear()
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2]

  // The duplicate modal lists what already exists for the chosen partner and period.
  const existing = useInvoices({ partnerId, year, month }, duplicateOpen && !!partnerId)
  const duplicates = (existing.data?.items ?? []).filter((i) => i.kind === 'monthly')
  const latest = [...duplicates].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  const submit = (allowDuplicate = false) => {
    setFormError(null)
    generate.mutate(
      { partnerId: partnerId || null, year: Number(year), month: Number(month), templateId: partnerId ? templateId || null : null, allowDuplicate },
      {
        onSuccess: (result) => {
          setDuplicateOpen(false)
          if ('id' in result) {
            toast.success(t('generate.created', { number: result.invoiceNumber }))
            navigate(`/accountant/invoices/${result.id}`)
          } else {
            toast.success(t('generate.enqueued', { count: result.enqueued }), {
              description: result.skipped > 0 ? t('generate.skipped', { count: result.skipped }) : undefined,
            })
            navigate(`/accountant/invoices?year=${year}&month=${month}`)
          }
        },
        onError: (error) => {
          if (isApiError(error, 409, 'invoice_duplicate_period')) setDuplicateOpen(true)
          else setFormError(error)
        },
      },
    )
  }

  const yearError = fieldErrorOf(formError, 'year')
  const monthError = fieldErrorOf(formError, 'month')
  const partnerError = fieldErrorOf(formError, 'partnerId')
  const templateError = fieldErrorOf(formError, 'templateId')
  const generalError = formError && !yearError && !monthError && !partnerError && !templateError ? errorMessage(t, formError) : null

  return (
    <div>
      <PageHeader
        eyebrow={t('generate.eyebrow')}
        title={t('generate.title')}
        description={t('generate.description')}
        back={{ to: '/accountant/invoices', label: t('list.title') }}
      />
      <form
        className="max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          submit(false)
        }}
      >
        <Card>
          <CardHeader title={t('generate.formTitle')} description={partnerId ? t('generate.onePartnerHint') : t('generate.allPartnersHint')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {generalError ? (
              <div className="sm:col-span-2">
                <Banner tone="danger">{generalError}</Banner>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <Field label={t('common:fields.partner')} htmlFor="gen-partner" hint={t('generate.partnerHint')} error={partnerError}>
                <NativeSelect
                  id="gen-partner"
                  value={partnerId}
                  invalid={!!partnerError}
                  onChange={(e) => {
                    setPartnerId(e.target.value)
                    setTemplateId('')
                  }}
                  options={[{ value: '', label: t('generate.allActive', { count: activePartners.length }) }, ...activePartners.map((p) => ({ value: p.id, label: `${p.name} · ${p.currency}` }))]}
                />
              </Field>
            </div>
            <Field label={t('filters.year')} htmlFor="gen-year" required error={yearError}>
              <NativeSelect id="gen-year" value={year} invalid={!!yearError} onChange={(e) => setYear(e.target.value)} options={years.map((y) => ({ value: String(y), label: String(y) }))} />
            </Field>
            <Field label={t('filters.month')} htmlFor="gen-month" required error={monthError}>
              <NativeSelect
                id="gen-month"
                value={month}
                invalid={!!monthError}
                onChange={(e) => setMonth(e.target.value)}
                options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: monthName(i + 1) }))}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('generate.template')} htmlFor="gen-template" hint={partnerId ? undefined : t('generate.templateDisabledHint')} error={templateError}>
                <NativeSelect
                  id="gen-template"
                  value={templateId}
                  disabled={!partnerId}
                  invalid={!!templateError}
                  onChange={(e) => setTemplateId(e.target.value)}
                  options={[
                    { value: '', label: t('generate.templateAuto') },
                    ...(templates.data ?? []).map((tpl) => ({ value: tpl.id, label: `${tpl.name}${tpl.partnerId ? '' : ` (${t('generate.global')})`}${tpl.isDefault ? ' ★' : ''}` })),
                  ]}
                />
              </Field>
            </div>
          </CardBody>
          <CardFooter>
            <Button variant="ghost" onClick={() => navigate('/accountant/invoices')}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" icon={<Wand2 />} loading={generate.isPending && !duplicateOpen}>
              {partnerId ? t('generate.submitOne') : t('generate.submitAll')}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Dialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        title={t('generate.duplicate.title')}
        description={t('generate.duplicate.description', { period: `${monthName(Number(month))} ${year}` })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDuplicateOpen(false)} disabled={generate.isPending}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="secondary" disabled={!latest || generate.isPending} onClick={() => latest && navigate(`/accountant/invoices/${latest.id}`)}>
              {t('generate.duplicate.openLatest')}
            </Button>
            <Button loading={generate.isPending} onClick={() => submit(true)}>
              {t('generate.duplicate.createAnother')}
            </Button>
          </>
        }
      >
        {existing.isLoading ? (
          <p className="text-sm text-muted">{t('common:states.loading')}</p>
        ) : (
          <ul className="divide-y divide-hairline rounded-md border border-hairline">
            {duplicates.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="flex items-center gap-2">
                  <Mono>{inv.invoiceNumber}</Mono>
                  <InvoiceStatusChip status={inv.status} />
                </span>
                <Money amount={inv.total} currency={inv.currency} />
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </div>
  )
}
