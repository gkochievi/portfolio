/** Shared create / edit form (react-hook-form + zod). */
import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { Controller, useForm, type Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { fieldErrorsOf } from '@/api/client'
import {
  Banner,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  NativeSelect,
  SegmentedControl,
  Switch,
  Textarea,
} from '@/components/ui'
import type { Architecture, Partner } from '@/types'

import { useCreatePartner, useUpdatePartner } from '../api'
import {
  ARCHITECTURES,
  CONTACT_ROLES,
  CURRENCIES,
  emptyPartnerValues,
  isEmail,
  isPhone,
  MAX_BILLING_EMAILS,
  MAX_PHONE_NUMBERS,
  partnerCreateSchema,
  partnerUpdateSchema,
  type PartnerFormValues,
} from '../lib/schema'
import { ChipListInput } from './ChipListInput'

function toFormValues(partner: Partner): PartnerFormValues {
  return {
    name: partner.name,
    legalName: partner.legalName,
    companyId: partner.companyId,
    currency: partner.currency,
    ratePerPoint: partner.ratePerPoint,
    freeMonthlyAllowance: partner.freeMonthlyAllowance,
    onboardedAt: partner.onboardedAt.slice(0, 10),
    contractStartOn: partner.contractStartOn ?? '',
    contractEndOn: partner.contractEndOn ?? '',
    invoiceGenerationDay: partner.invoiceGenerationDay,
    contactEmail: partner.contactEmail,
    billingEmails: partner.billingEmails,
    pbxServerIp: partner.pbxServerIp,
    webServerIp: partner.webServerIp,
    webServerDomain: partner.webServerDomain,
    architecture: partner.architecture,
    vpnType: partner.vpnType,
    phoneNumbers: partner.phoneNumbers,
    contacts: CONTACT_ROLES.map((role) => {
      const c = partner.contacts.find((x) => x.role === role)
      return { role, name: c?.name ?? '', phone: c?.phone ?? '', email: c?.email ?? '' }
    }),
    notes: partner.notes,
    isActive: partner.isActive,
  }
}

export function PartnerForm({ partner }: { partner?: Partner }) {
  const { t } = useTranslation('partners')
  const navigate = useNavigate()
  const edit = Boolean(partner)
  const create = useCreatePartner()
  const update = useUpdatePartner(partner?.id ?? '')

  const defaults = useMemo(
    () => (partner ? toFormValues(partner) : emptyPartnerValues(new Date().toISOString().slice(0, 10))),
    [partner],
  )
  const resolver = zodResolver(edit ? partnerUpdateSchema : partnerCreateSchema) as unknown as Resolver<PartnerFormValues>
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PartnerFormValues>({ defaultValues: defaults, resolver })

  const msg = (m?: string) => (m ? t(m) : undefined)
  const pending = create.isPending || update.isPending || isSubmitting
  const hasErrors = Object.keys(errors).length > 0

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (edit && partner) {
        const saved = await update.mutateAsync(values)
        toast.success(t('edit.success'))
        navigate(`/admin/partners/${saved.id}`)
      } else {
        const saved = await create.mutateAsync(values)
        toast.success(t('create.success', { name: saved.name }))
        navigate(`/admin/partners/${saved.id}`)
      }
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const keys = Object.keys(fields)
      if (keys.length === 0) toast.error(error instanceof Error ? error.message : t('errors.generic'))
      for (const key of keys) setError(key as never, { message: fields[key] })
    }
  })

  const cancelTo = partner ? `/admin/partners/${partner.id}` : '/admin/partners'

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-busy={pending}>
      {hasErrors ? <Banner tone="danger">{t('form.unsaved')}</Banner> : null}

      {/* Account */}
      <Card>
        <CardHeader title={t('form.sections.account')} description={t('form.sections.accountHint')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.fields.name')} required htmlFor="p-name" error={msg(errors.name?.message)}>
            <Input id="p-name" autoComplete="off" invalid={Boolean(errors.name)} {...register('name')} />
          </Field>
          <Field label={t('form.fields.legalName')} htmlFor="p-legal" error={msg(errors.legalName?.message)}>
            <Input id="p-legal" placeholder={t('form.fields.legalNamePlaceholder')} invalid={Boolean(errors.legalName)} {...register('legalName')} />
          </Field>
          <Field label={t('form.fields.companyId')} hint={t('form.fields.companyIdHint')} htmlFor="p-company" error={msg(errors.companyId?.message)}>
            <Input id="p-company" inputMode="numeric" mono invalid={Boolean(errors.companyId)} {...register('companyId')} />
          </Field>
          <Field label={t('form.fields.currency')} required htmlFor="p-currency" error={msg(errors.currency?.message)}>
            <NativeSelect id="p-currency" options={CURRENCIES.map((c) => ({ value: c, label: c }))} invalid={Boolean(errors.currency)} {...register('currency')} />
          </Field>
          {edit ? null : (
            <>
              <Field label={t('form.fields.ratePerPoint')} hint={t('form.fields.ratePerPointHint')} required htmlFor="p-rate" error={msg(errors.ratePerPoint?.message)}>
                <Input id="p-rate" type="number" step="0.01" min={0} inputMode="decimal" invalid={Boolean(errors.ratePerPoint)} {...register('ratePerPoint', { valueAsNumber: true })} />
              </Field>
              <Field label={t('form.fields.freeMonthlyAllowance')} hint={t('form.fields.freeMonthlyAllowanceHint')} required htmlFor="p-allow" error={msg(errors.freeMonthlyAllowance?.message)}>
                <Input id="p-allow" type="number" step="1" min={0} inputMode="numeric" invalid={Boolean(errors.freeMonthlyAllowance)} {...register('freeMonthlyAllowance', { valueAsNumber: true })} />
              </Field>
            </>
          )}
          <Field label={t('form.fields.onboardedAt')} htmlFor="p-onboarded" error={msg(errors.onboardedAt?.message)}>
            <Input id="p-onboarded" type="date" invalid={Boolean(errors.onboardedAt)} {...register('onboardedAt')} />
          </Field>
          {edit ? (
            <div className="sm:col-span-2">
              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} label={t('form.fields.isActive')} description={t('form.fields.isActiveHint')} />
                )}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      {/* Contract */}
      <Card>
        <CardHeader title={t('form.sections.contract')} description={t('form.sections.contractHint')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.fields.contractStartOn')} htmlFor="p-cstart" error={msg(errors.contractStartOn?.message)}>
            <Input id="p-cstart" type="date" invalid={Boolean(errors.contractStartOn)} {...register('contractStartOn')} />
          </Field>
          <Field label={t('form.fields.contractEndOn')} htmlFor="p-cend" error={msg(errors.contractEndOn?.message)}>
            <Input id="p-cend" type="date" invalid={Boolean(errors.contractEndOn)} {...register('contractEndOn')} />
          </Field>
          <Field label={t('form.fields.invoiceGenerationDay')} hint={t('form.fields.invoiceGenerationDayHint')} required htmlFor="p-day" error={msg(errors.invoiceGenerationDay?.message)}>
            <Input id="p-day" type="number" min={1} max={28} step={1} inputMode="numeric" invalid={Boolean(errors.invoiceGenerationDay)} {...register('invoiceGenerationDay', { valueAsNumber: true })} />
          </Field>
          <Field label={t('form.fields.contactEmail')} htmlFor="p-email" error={msg(errors.contactEmail?.message)}>
            <Input id="p-email" type="email" autoComplete="off" invalid={Boolean(errors.contactEmail)} {...register('contactEmail')} />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label={t('form.fields.billingEmails')}
              hint={t('form.fields.billingEmailsHint', { max: MAX_BILLING_EMAILS })}
              htmlFor="p-billing"
              error={undefined}
            >
              <Controller
                control={control}
                name="billingEmails"
                render={({ field }) => (
                  <ChipListInput
                    id="p-billing"
                    value={field.value}
                    onChange={field.onChange}
                    max={MAX_BILLING_EMAILS}
                    validate={isEmail}
                    invalidMessage={t('form.chips.invalidEmail')}
                    placeholder={t('form.fields.billingEmailsPlaceholder')}
                    inputMode="email"
                    error={msg(errors.billingEmails?.message)}
                  />
                )}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Technical */}
      <Card>
        <CardHeader title={t('form.sections.technical')} description={t('form.sections.technicalHint')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('form.fields.pbxServerIp')} htmlFor="p-pbx" error={msg(errors.pbxServerIp?.message)}>
            <Input id="p-pbx" mono inputMode="decimal" placeholder="10.0.0.1" invalid={Boolean(errors.pbxServerIp)} {...register('pbxServerIp')} />
          </Field>
          <Field label={t('form.fields.webServerIp')} htmlFor="p-webip" error={msg(errors.webServerIp?.message)}>
            <Input id="p-webip" mono inputMode="decimal" placeholder="10.0.0.2" invalid={Boolean(errors.webServerIp)} {...register('webServerIp')} />
          </Field>
          <Field label={t('form.fields.webServerDomain')} htmlFor="p-domain" error={msg(errors.webServerDomain?.message)}>
            <Input id="p-domain" mono placeholder="portal.partner.example" invalid={Boolean(errors.webServerDomain)} {...register('webServerDomain')} />
          </Field>
          <Field label={t('form.fields.vpnType')} htmlFor="p-vpn" error={msg(errors.vpnType?.message)}>
            <Input id="p-vpn" placeholder={t('form.fields.vpnTypePlaceholder')} invalid={Boolean(errors.vpnType)} {...register('vpnType')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('form.fields.architecture')}>
              <Controller
                control={control}
                name="architecture"
                render={({ field }) => (
                  <SegmentedControl<Architecture>
                    aria-label={t('form.fields.architecture')}
                    value={field.value}
                    onChange={field.onChange}
                    options={ARCHITECTURES.map((a) => ({ value: a, label: t(`common:architecture.${a}`) }))}
                  />
                )}
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t('form.fields.phoneNumbers')} hint={t('form.fields.phoneNumbersHint', { max: MAX_PHONE_NUMBERS })} htmlFor="p-phones">
              <Controller
                control={control}
                name="phoneNumbers"
                render={({ field }) => (
                  <ChipListInput
                    id="p-phones"
                    value={field.value}
                    onChange={field.onChange}
                    max={MAX_PHONE_NUMBERS}
                    validate={isPhone}
                    invalidMessage={t('form.chips.invalidPhone')}
                    placeholder={t('form.fields.phoneNumbersPlaceholder')}
                    inputMode="tel"
                    error={msg(errors.phoneNumbers?.message)}
                  />
                )}
              />
            </Field>
          </div>
        </CardBody>
      </Card>

      {/* Contacts */}
      <Card>
        <CardHeader title={t('form.sections.contacts')} description={t('form.sections.contactsHint')} />
        <CardBody className="space-y-5">
          {CONTACT_ROLES.map((role, i) => {
            const e = errors.contacts?.[i]
            return (
              <fieldset key={role} className="grid gap-3 sm:grid-cols-3">
                <legend className="eyebrow mb-2">{t(`common:contactRole.${role}`)}</legend>
                <input type="hidden" {...register(`contacts.${i}.role` as const)} />
                <Field label={t('form.fields.contactName')} htmlFor={`c-${role}-name`} error={msg(e?.name?.message)}>
                  <Input id={`c-${role}-name`} autoComplete="off" invalid={Boolean(e?.name)} {...register(`contacts.${i}.name` as const)} />
                </Field>
                <Field label={t('form.fields.contactPhone')} htmlFor={`c-${role}-phone`} error={msg(e?.phone?.message)}>
                  <Input id={`c-${role}-phone`} type="tel" invalid={Boolean(e?.phone)} {...register(`contacts.${i}.phone` as const)} />
                </Field>
                <Field label={t('form.fields.contactEmail2')} htmlFor={`c-${role}-email`} error={msg(e?.email?.message)}>
                  <Input id={`c-${role}-email`} type="email" autoComplete="off" invalid={Boolean(e?.email)} {...register(`contacts.${i}.email` as const)} />
                </Field>
              </fieldset>
            )
          })}
        </CardBody>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader title={t('form.sections.notes')} />
        <CardBody>
          <Field htmlFor="p-notes" error={msg(errors.notes?.message)}>
            <Textarea id="p-notes" rows={4} placeholder={t('form.fields.notesPlaceholder')} invalid={Boolean(errors.notes)} {...register('notes')} />
          </Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 border-t border-hairline bg-surface/95 px-1 py-3 backdrop-blur">
        <Button type="button" variant="ghost" onClick={() => navigate(cancelTo)} disabled={pending}>
          {t('common:actions.cancel')}
        </Button>
        <Button type="submit" loading={pending} disabled={edit && !isDirty && !pending}>
          {edit ? t('edit.submit') : t('create.submit')}
        </Button>
      </div>
    </form>
  )
}
