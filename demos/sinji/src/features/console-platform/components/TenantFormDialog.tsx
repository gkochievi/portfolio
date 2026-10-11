import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Dialog, Field, Input, Select } from '@/components/ui'
import type { Tenant } from '@/types'
import { useErrorText, useTenantMutations } from '../api'
import { INDUSTRIES, SLUG_PATTERN, type TenantWithKey } from '../types'

interface Props {
  tenant: Tenant | null
  onOpenChange: (open: boolean) => void
  /** Called after a save; `created` carries the one-time API key. */
  onSaved: (result: { tenant: Tenant; created?: TenantWithKey }) => void
}

/** Create (tenant = null) or edit a workspace. Mount it only while open so the draft starts fresh. */
export function TenantFormDialog({ tenant, onOpenChange, onSaved }: Props) {
  const { t } = useTranslation('consolePlatform')
  const errorText = useErrorText()
  const { create, update } = useTenantMutations()
  const [name, setName] = useState(tenant?.name ?? '')
  const [nameKa, setNameKa] = useState(tenant?.name_ka ?? '')
  const [slug, setSlug] = useState(tenant?.slug ?? '')
  const [industry, setIndustry] = useState<Tenant['industry']>(tenant?.industry ?? 'bank')
  const [region, setRegion] = useState(tenant?.region ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const busy = create.isPending || update.isPending

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: Record<string, string> = {}
    if (!name.trim()) next.name = 'required'
    if (!nameKa.trim()) next.name_ka = 'required'
    if (!region.trim()) next.region = 'required'
    if (!tenant) {
      const clean = slug.trim().toLowerCase()
      if (!clean) next.slug = 'required'
      else if (!SLUG_PATTERN.test(clean)) next.slug = 'slug_pattern'
    }
    if (Object.keys(next).length) {
      setErrors(Object.fromEntries(Object.entries(next).map(([k, code]) => [k, t(`errors.${code}`)])))
      return
    }
    try {
      if (tenant) {
        const saved = await update.mutateAsync({ id: tenant.id, name, name_ka: nameKa, industry, region })
        onSaved({ tenant: saved })
      } else {
        const created = await create.mutateAsync({ name, name_ka: nameKa, slug, industry, region })
        onSaved({ tenant: created.tenant, created })
      }
      onOpenChange(false)
    } catch (error) {
      setErrors(errorText.fields(error))
      if (!Object.keys(errorText.fields(error)).length) setErrors({ form: errorText.text(error) })
    }
  }

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      locked={busy}
      title={tenant ? t('tenants.form.editTitle', { name: tenant.name }) : t('tenants.form.createTitle')}
      description={tenant ? undefined : t('tenants.form.createBody')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" form="tenant-form" variant="primary" loading={busy}>
            {tenant ? t('tenants.form.save') : t('tenants.form.create')}
          </Button>
        </>
      }
    >
      <form id="tenant-form" onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        {errors.form ? <p role="alert" className="text-sm text-danger">{errors.form}</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('tenants.form.name')} error={errors.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} />
          </Field>
          <Field label={t('tenants.form.nameKa')} error={errors.name_ka}>
            <Input value={nameKa} onChange={(e) => setNameKa(e.target.value)} maxLength={80} lang="ka" />
          </Field>
        </div>
        <Field label={t('tenants.form.slug')} hint={tenant ? undefined : t('tenants.form.slugHint')} error={errors.slug}>
          <Input mono value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={Boolean(tenant)} maxLength={40} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('tenants.form.industry')} error={errors.industry}>
            <Select
              value={industry}
              onValueChange={(v) => setIndustry(v as Tenant['industry'])}
              options={INDUSTRIES.map((value) => ({ value, label: t(`industries.${value}`) }))}
            />
          </Field>
          <Field label={t('tenants.form.region')} error={errors.region}>
            <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder={t('tenants.form.regionPlaceholder')} maxLength={60} />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}
