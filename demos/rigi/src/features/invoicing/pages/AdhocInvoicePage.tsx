import { FilePlus2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Banner, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, NativeSelect, PageHeader, Textarea, toast } from '@/components/ui'

import { useCreateAdhoc, usePartnerOptions, useTemplateOptions } from '../api'
import { LinesEditor } from '../components/LinesEditor'
import { errorMessage, fieldErrorOf } from '../lib/errors'
import { blankLine, validateLines, type LinesValidation } from '../lib/lines'

export default function AdhocInvoicePage() {
  const { t } = useTranslation(['invoicing', 'common'])
  const navigate = useNavigate()
  const [search] = useSearchParams()

  const [partnerId, setPartnerId] = useState(search.get('partnerId') ?? '')
  const [templateId, setTemplateId] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState(() => [blankLine()])
  const [submitted, setSubmitted] = useState(false)
  const [validation, setValidation] = useState<LinesValidation | null>(null)

  const partners = usePartnerOptions()
  const activePartners = (partners.data ?? []).filter((p) => p.isActive)
  const partner = activePartners.find((p) => p.id === partnerId)
  const templates = useTemplateOptions(partnerId || null)
  const create = useCreateAdhoc()

  const titleError = !title.trim() ? t('validation.titleRequired') : title.length > 200 ? t('validation.max200') : undefined
  const notesError = notes.length > 4000 ? t('validation.max4000') : undefined
  const partnerError = !partnerId ? t('validation.partnerRequired') : undefined
  const serverError = create.error
  const show = (local: string | undefined, key: string) => (submitted ? local : undefined) ?? fieldErrorOf(serverError, key)

  const onSubmit = () => {
    setSubmitted(true)
    const result = validateLines(lines)
    setValidation(result)
    if (titleError || notesError || partnerError || result.error || Object.keys(result.rowErrors).length > 0) return
    create.mutate(
      { partnerId, templateId: templateId || null, title: title.trim(), notes, lines: result.lines },
      {
        onSuccess: (invoice) => {
          toast.success(t('adhoc.created', { number: invoice.invoiceNumber }))
          navigate(`/accountant/invoices/${invoice.id}`)
        },
      },
    )
  }

  const hasFieldErrors = ['partnerId', 'title', 'notes', 'templateId', 'lines'].some((k) => fieldErrorOf(serverError, k))

  return (
    <div>
      <PageHeader eyebrow={t('adhoc.eyebrow')} title={t('adhoc.title')} description={t('adhoc.description')} back={{ to: '/accountant/invoices', label: t('list.title') }} />
      <form
        className="grid max-w-4xl gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit()
        }}
      >
        <Card>
          <CardHeader title={t('adhoc.details')} />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            {serverError && !hasFieldErrors ? (
              <div className="sm:col-span-2">
                <Banner tone="danger">{errorMessage(t, serverError)}</Banner>
              </div>
            ) : null}
            <Field label={t('common:fields.partner')} htmlFor="adhoc-partner" required error={show(partnerError, 'partnerId')} hint={partner ? t('adhoc.currencyHint', { currency: partner.currency }) : undefined}>
              <NativeSelect
                id="adhoc-partner"
                value={partnerId}
                invalid={!!show(partnerError, 'partnerId')}
                onChange={(e) => {
                  setPartnerId(e.target.value)
                  setTemplateId('')
                }}
                options={[{ value: '', label: t('adhoc.choosePartner') }, ...activePartners.map((p) => ({ value: p.id, label: `${p.name} · ${p.currency}` }))]}
              />
            </Field>
            <Field label={t('generate.template')} htmlFor="adhoc-template" error={fieldErrorOf(serverError, 'templateId')} hint={partnerId ? undefined : t('generate.templateDisabledHint')}>
              <NativeSelect
                id="adhoc-template"
                value={templateId}
                disabled={!partnerId}
                onChange={(e) => setTemplateId(e.target.value)}
                options={[
                  { value: '', label: t('generate.templateAuto') },
                  ...(templates.data ?? []).map((tpl) => ({ value: tpl.id, label: `${tpl.name}${tpl.partnerId ? '' : ` (${t('generate.global')})`}` })),
                ]}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('adhoc.subject')} htmlFor="adhoc-title" required error={show(titleError, 'title')} hint={`${title.length}/200`}>
                <Input id="adhoc-title" value={title} maxLength={220} placeholder={t('adhoc.subjectPlaceholder')} invalid={!!show(titleError, 'title')} onChange={(e) => setTitle(e.target.value)} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t('common:fields.notes')} htmlFor="adhoc-notes" error={show(notesError, 'notes')} hint={`${notes.length}/4000`}>
                <Textarea id="adhoc-notes" rows={3} value={notes} invalid={!!show(notesError, 'notes')} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('adhoc.linesTitle')} description={partner ? t('adhoc.linesHint', { currency: partner.currency }) : t('adhoc.linesNoPartner')} />
          <CardBody>
            <LinesEditor
              value={lines}
              onChange={(next) => {
                setLines(next)
                if (submitted) setValidation(validateLines(next))
              }}
              currency={partner?.currency ?? 'GEL'}
              validation={validation}
            />
            {fieldErrorOf(serverError, 'lines') ? <p className="mt-2 text-sm text-danger">{fieldErrorOf(serverError, 'lines')}</p> : null}
          </CardBody>
          <CardFooter>
            <Button variant="ghost" onClick={() => navigate('/accountant/invoices')}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" icon={<FilePlus2 />} loading={create.isPending}>
              {t('adhoc.submit')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
