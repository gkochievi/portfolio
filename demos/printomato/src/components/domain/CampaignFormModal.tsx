import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/lib/api'
import { toDateTimeLocal } from '@/lib/format'
import { useOptions, useSaveCampaign } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'
import { Checkbox, Field, FileField, Input, MultiSelect } from '@/components/ui/form'
import type { Campaign } from '@/types'

interface FormState {
  name: string
  sponsor: string
  start_time: string
  end_time: string
  location: string
  line_1: string
  line_2: string
  qr_link: string
  photo_quantity: string
  is_default: boolean
  device_ids: number[]
}

const BLANK: FormState = {
  name: '',
  sponsor: '',
  start_time: '',
  end_time: '',
  location: '',
  line_1: '',
  line_2: '',
  qr_link: '',
  photo_quantity: '10',
  is_default: false,
  device_ids: [],
}

function toFormState(campaign: Campaign | null): FormState {
  if (!campaign) return { ...BLANK }
  return {
    name: campaign.name,
    sponsor: campaign.sponsor,
    start_time: toDateTimeLocal(campaign.start_time),
    end_time: toDateTimeLocal(campaign.end_time),
    location: campaign.location ?? '',
    line_1: campaign.line_1 ?? '',
    line_2: campaign.line_2 ?? '',
    qr_link: campaign.qr_link ?? '',
    photo_quantity: String(campaign.photo_quantity),
    is_default: campaign.is_default,
    device_ids: campaign.devices.map((device) => device.id),
  }
}

const FILE_FIELDS = ['banner', 'main_logo', 'secondary_logo', 'icon'] as const
type FileFieldName = (typeof FILE_FIELDS)[number]

export function CampaignFormModal({
  open,
  campaign,
  onClose,
}: {
  open: boolean
  campaign: Campaign | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSaveCampaign()
  const { data: options } = useOptions(open)

  const [form, setForm] = useState<FormState>(() => toFormState(campaign))
  const [files, setFiles] = useState<Partial<Record<FileFieldName, File>>>({})
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toFormState(campaign))
      setFiles({})
      setLocalError(null)
      save.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign])

  const deviceOptions = useMemo(
    () =>
      (options?.devices ?? []).map((device) => ({
        value: device.id,
        label: device.name,
        meta: device.device_id,
      })),
    [options],
  )

  const error = save.error instanceof ApiError ? save.error : null
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    // The form is noValidate, so required= does not stop submission. Without
    // this guard `new Date('').toISOString()` threw RangeError and the submit
    // handler died silently, leaving the dialog frozen.
    const start = new Date(form.start_time)
    const end = new Date(form.end_time)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setLocalError(t('campaigns.form.datesRequired'))
      return
    }
    if (start > end) {
      setLocalError(t('campaigns.form.datesOrder'))
      return
    }
    setLocalError(null)

    const body = new FormData()
    body.append('name', form.name.trim())
    body.append('sponsor', form.sponsor.trim())
    body.append('start_time', start.toISOString())
    body.append('end_time', end.toISOString())
    body.append('location', form.location.trim())
    body.append('line_1', form.line_1.trim())
    body.append('line_2', form.line_2.trim())
    body.append('photo_quantity', form.photo_quantity || '0')
    body.append('is_default', String(form.is_default))
    // Always sent, including empty, so an existing QR link can be removed.
    body.append('qr_link', form.qr_link.trim())

    if (form.device_ids.length) {
      form.device_ids.forEach((id) => body.append('device_ids', String(id)))
    } else {
      // Sentinel the API understands as "detach every device".
      body.append('device_ids', '')
    }

    for (const field of FILE_FIELDS) {
      const file = files[field]
      if (file) body.append(field, file)
    }

    save.mutate(
      { id: campaign?.id, body },
      {
        onSuccess: (saved) => {
          toast.success(
            campaign
              ? t('campaigns.saved', { name: saved.name })
              : t('campaigns.created', { name: saved.name }),
          )
          onClose()
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={campaign ? t('campaigns.edit') : t('campaigns.add')}
      description={campaign?.sponsor}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" form="campaign-form" type="submit" loading={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {(localError || (error && Object.keys(error.fieldErrors).length === 0)) && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-sm text-danger">
            {localError ?? error?.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('campaigns.form.name')} required error={error?.fieldError('name')}>
            <Input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              required
              data-autofocus
              invalid={Boolean(error?.fieldError('name'))}
            />
          </Field>
          <Field label={t('campaigns.form.sponsor')} required error={error?.fieldError('sponsor')}>
            <Input
              value={form.sponsor}
              onChange={(event) => set('sponsor', event.target.value)}
              required
              invalid={Boolean(error?.fieldError('sponsor'))}
            />
          </Field>
          <Field label={t('campaigns.form.startTime')} required error={error?.fieldError('start_time')}>
            <Input
              type="datetime-local"
              value={form.start_time}
              onChange={(event) => set('start_time', event.target.value)}
              required
              className="numeral"
              invalid={Boolean(error?.fieldError('start_time'))}
            />
          </Field>
          <Field label={t('campaigns.form.endTime')} required error={error?.fieldError('end_time')}>
            <Input
              type="datetime-local"
              value={form.end_time}
              onChange={(event) => set('end_time', event.target.value)}
              required
              className="numeral"
              invalid={Boolean(error?.fieldError('end_time'))}
            />
          </Field>
          <Field label={t('campaigns.form.location')} error={error?.fieldError('location')}>
            <Input value={form.location} onChange={(event) => set('location', event.target.value)} />
          </Field>
          <Field
            label={t('campaigns.form.photoQuantity')}
            hint={t('campaigns.form.photoQuantityHint')}
            error={error?.fieldError('photo_quantity')}
          >
            <Input
              type="number"
              min={0}
              value={form.photo_quantity}
              onChange={(event) => set('photo_quantity', event.target.value)}
              className="numeral"
            />
          </Field>
        </div>

        <fieldset className="rounded-control border border-hairline p-4">
          <legend className="label-caps px-1.5">Kiosk screen</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('campaigns.form.line1')} error={error?.fieldError('line_1')}>
              <Input value={form.line_1} onChange={(event) => set('line_1', event.target.value)} />
            </Field>
            <Field label={t('campaigns.form.line2')} error={error?.fieldError('line_2')}>
              <Input value={form.line_2} onChange={(event) => set('line_2', event.target.value)} />
            </Field>
            <Field label={t('campaigns.form.qrLink')} error={error?.fieldError('qr_link')} className="sm:col-span-2">
              <Input
                type="url"
                placeholder="https://"
                value={form.qr_link}
                onChange={(event) => set('qr_link', event.target.value)}
                invalid={Boolean(error?.fieldError('qr_link'))}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-control border border-hairline p-4">
          <legend className="label-caps px-1.5">Artwork</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t('campaigns.form.banner')}
              required={!campaign}
              hint={t('campaigns.form.bannerHint')}
              error={error?.fieldError('banner')}
            >
              <FileField
                name="banner"
                currentUrl={campaign?.banner}
                onPick={(file) => setFiles((current) => ({ ...current, banner: file ?? undefined }))}
              />
            </Field>
            <Field label={t('campaigns.form.mainLogo')} error={error?.fieldError('main_logo')}>
              <FileField
                name="main_logo"
                currentUrl={campaign?.main_logo}
                onPick={(file) => setFiles((current) => ({ ...current, main_logo: file ?? undefined }))}
              />
            </Field>
            <Field label={t('campaigns.form.secondaryLogo')} error={error?.fieldError('secondary_logo')}>
              <FileField
                name="secondary_logo"
                currentUrl={campaign?.secondary_logo}
                onPick={(file) => setFiles((current) => ({ ...current, secondary_logo: file ?? undefined }))}
              />
            </Field>
            <Field label={t('campaigns.form.icon')} error={error?.fieldError('icon')}>
              <FileField
                name="icon"
                currentUrl={campaign?.icon}
                onPick={(file) => setFiles((current) => ({ ...current, icon: file ?? undefined }))}
              />
            </Field>
          </div>
        </fieldset>

        <Field label={t('campaigns.form.devices')} error={error?.fieldError('device_ids')}>
          <MultiSelect
            options={deviceOptions}
            value={form.device_ids}
            onChange={(value) => set('device_ids', value)}
            placeholder={t('common.none')}
          />
        </Field>

        <Checkbox
          checked={form.is_default}
          onChange={(value) => set('is_default', value)}
          label={t('campaigns.form.isDefault')}
        />
      </form>
    </Modal>
  )
}
