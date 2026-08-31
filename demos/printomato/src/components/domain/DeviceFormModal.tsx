import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react'

import { ApiError } from '@/lib/api'
import { useOptions, useSaveDevice } from '@/lib/queries'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Button, IconButton } from '@/components/ui/primitives'
import { Checkbox, Field, Input, MultiSelect, Switch } from '@/components/ui/form'
import type { Device } from '@/types'

interface FormState {
  name: string
  device_id: string
  location: string
  is_active: boolean
  paper_count: string
  paper_capacity: string
  requires_payment: boolean
  photo_price: string
  keepz_receiver_id: string
  payment_token: string
  campaign_ids: number[]
}

const BLANK: FormState = {
  name: '',
  device_id: '',
  location: '',
  is_active: true,
  paper_count: '0',
  paper_capacity: '200',
  requires_payment: false,
  photo_price: '',
  keepz_receiver_id: '',
  payment_token: '',
  campaign_ids: [],
}

function toFormState(device: Device | null): FormState {
  if (!device) return { ...BLANK }
  return {
    name: device.name,
    device_id: device.device_id,
    location: device.location ?? '',
    is_active: device.is_active,
    paper_count: String(device.paper_count),
    paper_capacity: String(device.paper_capacity),
    requires_payment: device.requires_payment,
    photo_price: device.photo_price ?? '',
    keepz_receiver_id: device.keepz_receiver_id ?? '',
    payment_token: device.payment_token ?? '',
    campaign_ids: device.campaigns.map((campaign) => campaign.id),
  }
}

export function DeviceFormModal({
  open,
  device,
  onClose,
}: {
  open: boolean
  device: Device | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const save = useSaveDevice()
  const { data: options } = useOptions(open)

  const [form, setForm] = useState<FormState>(() => toFormState(device))
  const [revealToken, setRevealToken] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(toFormState(device))
      setRevealToken(false)
      setCopied(false)
      save.reset()
    }
    // `save` is a stable mutation object; re-running on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device])

  const campaignOptions = useMemo(
    () =>
      (options?.campaigns ?? []).map((campaign) => ({
        value: campaign.id,
        label: campaign.name,
        meta: campaign.sponsor,
      })),
    [options],
  )

  const error = save.error instanceof ApiError ? save.error : null
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const generateToken = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    set('payment_token', Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''))
    setRevealToken(true)
  }

  const copyToken = async () => {
    if (!form.payment_token) return
    try {
      await navigator.clipboard.writeText(form.payment_token)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(t('common.somethingWentWrong'))
    }
  }

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    save.mutate(
      {
        id: device?.id,
        name: form.name.trim(),
        device_id: form.device_id.trim(),
        location: form.location.trim(),
        is_active: form.is_active,
        paper_count: Number(form.paper_count || 0),
        paper_capacity: Number(form.paper_capacity || 0),
        requires_payment: form.requires_payment,
        photo_price: form.requires_payment && form.photo_price ? form.photo_price : null,
        keepz_receiver_id: form.keepz_receiver_id.trim() || null,
        payment_token: form.payment_token.trim() || null,
        campaign_ids: form.campaign_ids,
      },
      {
        onSuccess: (saved) => {
          toast.success(
            device
              ? t('devices.saved', { name: saved.name })
              : t('devices.created', { name: saved.name }),
            t('devices.form.saveHint'),
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
      title={device ? t('devices.edit') : t('devices.add')}
      description={device?.device_id}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" form="device-form" type="submit" loading={save.isPending}>
            {save.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </>
      }
    >
      <form id="device-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {error && Object.keys(error.fieldErrors).length === 0 && (
          <p role="alert" className="rounded-control border border-danger/30 bg-danger/8 px-3.5 py-2.5 text-sm text-danger">
            {error.message}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('devices.form.name')} required error={error?.fieldError('name')}>
            <Input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              required
              data-autofocus
              invalid={Boolean(error?.fieldError('name'))}
            />
          </Field>

          <Field
            label={t('devices.form.deviceId')}
            required
            hint={t('devices.form.deviceIdHint')}
            error={error?.fieldError('device_id')}
          >
            <Input
              value={form.device_id}
              onChange={(event) => set('device_id', event.target.value)}
              required
              className="font-mono"
              invalid={Boolean(error?.fieldError('device_id'))}
            />
          </Field>

          <Field label={t('devices.form.location')} error={error?.fieldError('location')}>
            <Input value={form.location} onChange={(event) => set('location', event.target.value)} />
          </Field>

          <div className="flex items-end pb-1">
            <Checkbox
              checked={form.is_active}
              onChange={(value) => set('is_active', value)}
              label={t('devices.form.isActive')}
            />
          </div>
        </div>

        <fieldset className="rounded-control border border-hairline p-4">
          <legend className="label-caps px-1.5">{t('devices.paper')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('devices.form.paperCount')} error={error?.fieldError('paper_count')}>
              <Input
                type="number"
                min={0}
                value={form.paper_count}
                onChange={(event) => set('paper_count', event.target.value)}
                className="numeral"
                invalid={Boolean(error?.fieldError('paper_count'))}
              />
            </Field>
            <Field label={t('devices.form.paperCapacity')} error={error?.fieldError('paper_capacity')}>
              <Input
                type="number"
                min={1}
                value={form.paper_capacity}
                onChange={(event) => set('paper_capacity', event.target.value)}
                className="numeral"
              />
            </Field>
          </div>
        </fieldset>

        <Field
          label={t('devices.form.campaigns')}
          hint={t('devices.form.campaignsHint')}
          error={error?.fieldError('campaign_ids')}
        >
          <MultiSelect
            options={campaignOptions}
            value={form.campaign_ids}
            onChange={(value) => set('campaign_ids', value)}
            placeholder={t('devices.noCampaigns')}
          />
        </Field>

        <fieldset className="rounded-control border border-hairline p-4">
          <legend className="label-caps px-1.5">{t('devices.mode')}</legend>

          <Switch
            checked={form.requires_payment}
            onChange={(value) => set('requires_payment', value)}
            label={t('devices.form.requiresPayment')}
          />

          {form.requires_payment && (
            <div className="animate-fade mt-4 grid gap-4 border-t border-hairline pt-4 sm:grid-cols-2">
              <Field
                label={t('devices.form.photoPrice')}
                required
                error={error?.fieldError('photo_price')}
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="2.50"
                  value={form.photo_price}
                  onChange={(event) => set('photo_price', event.target.value)}
                  className="numeral"
                  invalid={Boolean(error?.fieldError('photo_price'))}
                />
              </Field>

              <Field
                label={t('devices.form.keepzReceiverId')}
                error={error?.fieldError('keepz_receiver_id')}
              >
                <Input
                  value={form.keepz_receiver_id}
                  onChange={(event) => set('keepz_receiver_id', event.target.value)}
                  className="font-mono"
                />
              </Field>

              <Field
                label={t('devices.form.paymentToken')}
                hint={t('devices.form.paymentTokenHint')}
                error={error?.fieldError('payment_token')}
                className="sm:col-span-2"
              >
                <div className="flex items-center gap-2">
                  <Input
                    type={revealToken ? 'text' : 'password'}
                    autoComplete="off"
                    value={form.payment_token}
                    onChange={(event) => set('payment_token', event.target.value)}
                    className="font-mono"
                  />
                  <IconButton
                    label={revealToken ? t('common.hide') : t('common.show')}
                    onClick={() => setRevealToken((previous) => !previous)}
                  >
                    {revealToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </IconButton>
                  <IconButton label={t('common.generate')} variant="gold" onClick={generateToken}>
                    <RefreshCw className="size-4" />
                  </IconButton>
                  <IconButton
                    label={copied ? t('common.copied') : t('common.copy')}
                    onClick={copyToken}
                    disabled={!form.payment_token}
                    className={copied ? 'border-online/40 text-online' : undefined}
                  >
                    <Copy className="size-4" />
                  </IconButton>
                </div>
              </Field>
            </div>
          )}
        </fieldset>
      </form>
    </Modal>
  )
}
