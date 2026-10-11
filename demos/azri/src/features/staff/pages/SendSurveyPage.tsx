/**
 * Send survey SMS (/console/send): a simulated CRM action. The agent (or an
 * admin) picks a campaign and a recipient; a persona's SMS then lands in their
 * inbox on the start page about 1.2 s later. Default export: src/routes.tsx
 * lazy-imports this file.
 *
 * Owner: feature group staff.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CheckCircle2, Lock, Phone, Send, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { isApiError } from '@/api/client'
import {
  BarsLoader,
  Button,
  Card,
  CardHeader,
  CenteredLoader,
  ErrorState,
  Field,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  toast,
} from '@/components/ui'
import { bus, clock } from '@/demo/core'
import { useLang } from '@/hooks/useLang'
import { lt } from '@/lib/utils'
import { useSendOptions, useSendSurvey } from '../api'
import { RecentSends } from '../components/RecentSends'
import { SmsPreview } from '../components/SmsPreview'
import { FAKE_PHONE_RE, formatPhoneDigits } from '../sms'
import type { SendOptions } from '../types'

type Mode = 'persona' | 'phone'
type Phase = 'idle' | 'sending' | 'delivered' | 'created'

const MS_DAY = 86_400_000
const toLocalInput = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm")

/** Server field messages (English) mapped to our translated keys. */
const SERVER_MESSAGES: Record<string, string> = {
  'Choose a campaign.': 'send.errors.campaign',
  'Choose a branch.': 'send.errors.branch',
  'Choose a staff member.': 'send.errors.staff',
  'Use the demo pattern 5XX 00 00 XX.': 'send.errors.phonePattern',
  'Enter a valid date and time.': 'send.errors.dateInvalid',
  'The interaction cannot be in the future.': 'send.errors.dateFuture',
  'The interaction must be within the last 30 days.': 'send.errors.dateOld',
}

function useSchema() {
  const { t } = useTranslation('staff')
  return useMemo(
    () =>
      z
        .object({
          campaignId: z.string().min(1, t('send.errors.campaign')),
          branchId: z.string().min(1, t('send.errors.branch')),
          staffId: z.string().min(1, t('send.errors.staff')),
          mode: z.enum(['persona', 'phone']),
          recipientId: z.string(),
          phone: z.string(),
          interactionAt: z.string(),
        })
        .superRefine((v, ctx) => {
          if (v.mode === 'persona' && !v.recipientId) {
            ctx.addIssue({ code: 'custom', path: ['recipientId'], message: t('send.errors.persona') })
          }
          if (v.mode === 'phone') {
            if (!v.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: t('send.errors.phoneRequired') })
            else if (!FAKE_PHONE_RE.test(v.phone)) {
              ctx.addIssue({ code: 'custom', path: ['phone'], message: t('send.errors.phonePattern') })
            }
          }
          const when = new Date(v.interactionAt)
          const now = clock.now().getTime()
          if (!v.interactionAt || Number.isNaN(when.getTime())) {
            ctx.addIssue({ code: 'custom', path: ['interactionAt'], message: t('send.errors.dateInvalid') })
          } else if (when.getTime() > now + 5 * 60_000) {
            ctx.addIssue({ code: 'custom', path: ['interactionAt'], message: t('send.errors.dateFuture') })
          } else if (when.getTime() < now - 30 * MS_DAY) {
            ctx.addIssue({ code: 'custom', path: ['interactionAt'], message: t('send.errors.dateOld') })
          }
        }),
    [t],
  )
}

type FormValues = z.infer<ReturnType<typeof useSchema>>

export default function SendSurveyPage() {
  const { t } = useTranslation('staff')
  const options = useSendOptions()

  return (
    <div>
      <PageHeader eyebrow={t('send.eyebrow')} title={t('send.title')} description={t('send.description')} />
      {options.isError ? (
        <ErrorState title={t('send.errorTitle')} onRetry={() => void options.refetch()} />
      ) : !options.data ? (
        <CenteredLoader className="py-24" />
      ) : (
        <SendForm options={options.data} />
      )}
    </div>
  )
}

/** Resolve after the persona's SMS has landed (or after a safety timeout). */
function waitForSms(recipientId: string): { promise: Promise<void>; cancel: () => void } {
  let cancel = () => {}
  const promise = new Promise<void>((resolve) => {
    const off = bus.on('sms:received', (payload) => {
      if (payload.recipientId !== recipientId) return
      done()
    })
    const timer = setTimeout(() => done(), 4000)
    function done() {
      off()
      clearTimeout(timer)
      resolve()
    }
    cancel = done
  })
  return { promise, cancel }
}

function SendForm({ options }: { options: SendOptions }) {
  const { t } = useTranslation('staff')
  const lang = useLang()
  const navigate = useNavigate()
  const schema = useSchema()
  const send = useSendSurvey()
  const [phase, setPhase] = useState<Phase>('idle')
  const [lastId, setLastId] = useState<string | null>(null)

  const firstCampaign = options.campaigns[0]
  const firstBranch = options.branches.find((b) => b.tenantId === firstCampaign?.tenantId) ?? options.branches[0]
  const firstStaff = options.staff.find((s) => s.branchId === firstBranch?.id) ?? options.staff[0]

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      campaignId: firstCampaign?.id ?? '',
      branchId: firstBranch?.id ?? '',
      staffId: firstStaff?.id ?? '',
      mode: 'persona',
      recipientId: options.recipients[0]?.id ?? '',
      phone: '',
      interactionAt: toLocalInput(clock.now()),
    },
  })
  const { control, handleSubmit, setValue, setError, formState } = form
  const [campaignId, branchId, mode, recipientId, phone] = useWatch({
    control,
    name: ['campaignId', 'branchId', 'mode', 'recipientId', 'phone'],
  })

  const campaign = options.campaigns.find((c) => c.id === campaignId)
  const tenant = options.tenants.find((x) => x.id === campaign?.tenantId)
  const branches = options.branches.filter((b) => b.tenantId === campaign?.tenantId)
  const branch = branches.find((b) => b.id === branchId)
  const staff = options.staff.filter((s) => s.branchId === branchId)
  const recipient = options.recipients.find((r) => r.id === recipientId)

  // Admin cascade: campaign -> branch (same business) -> staff (same branch).
  useEffect(() => {
    if (options.locked || !campaign) return
    if (!branches.some((b) => b.id === branchId)) setValue('branchId', branches[0]?.id ?? '')
  }, [campaign, branchId, branches, options.locked, setValue])
  useEffect(() => {
    if (options.locked) return
    const current = form.getValues('staffId')
    if (!staff.some((s) => s.id === current)) setValue('staffId', staff[0]?.id ?? '')
  }, [branchId, staff, options.locked, setValue, form])

  const busy = phase === 'sending'

  const onSubmit = handleSubmit(async (values) => {
    const persona = values.mode === 'persona' ? options.recipients.find((r) => r.id === values.recipientId) : undefined
    const waiter = persona ? waitForSms(persona.id) : null
    setPhase('sending')
    try {
      const link = await send.mutateAsync({
        campaignId: values.campaignId,
        branchId: values.branchId,
        staffId: values.staffId,
        recipientId: persona?.id,
        phone: values.mode === 'phone' ? values.phone : undefined,
        interactionAt: new Date(values.interactionAt).toISOString(),
      })
      setLastId(link.id)
      if (persona && waiter && tenant) {
        await waiter.promise
        setPhase('delivered')
        const name = lt(persona.name, lang)
        toast.success(t('send.toast.deliveredTitle'), {
          description: t('send.toast.deliveredDescription', { sender: tenant.smsSender, name, token: link.id }),
          action: { label: t('send.toast.openInbox', { name }), onClick: () => navigate(`/?recipient=${persona.id}`) },
        })
      } else {
        setPhase('created')
        toast.success(t('send.toast.createdTitle'), {
          description: t('send.toast.createdDescription', { phone: link.phoneMasked, token: link.id }),
        })
      }
    } catch (error) {
      waiter?.cancel()
      setPhase('idle')
      if (isApiError(error) && Object.keys(error.fieldErrors).length) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          const message = messages?.[0] ?? ''
          const key = SERVER_MESSAGES[message]
          const name = (['campaignId', 'branchId', 'staffId', 'recipientId', 'phone', 'interactionAt'] as const).find(
            (f) => f === field,
          )
          if (name) setError(name, { message: key ? t(key) : message })
        }
      } else {
        toast.error(t('send.errors.generic'))
      }
    }
  })

  // Any edit after a send returns the button to its idle state.
  useEffect(() => {
    if (phase === 'delivered' || phase === 'created') {
      const sub = form.watch(() => setPhase('idle'))
      return () => sub.unsubscribe()
    }
  }, [phase, form])

  const recipientLine =
    mode === 'persona'
      ? recipient
        ? `${lt(recipient.name, lang)} · ${recipient.phoneMasked}`
        : null
      : phone
        ? `+995 ${formatPhoneDigits(phone)}`
        : null

  const lockIcon = <Lock size={16} strokeWidth={1.75} />

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-5">
        <Card padding="lg" className="lg:col-span-3">
          <CardHeader icon={<Send strokeWidth={1.75} />} title={t('send.form.title')} />
          <form noValidate onSubmit={onSubmit} className="space-y-4">
            <Controller
              control={control}
              name="campaignId"
              render={({ field, fieldState }) => (
                <Field label={t('send.form.campaign')} error={fieldState.error?.message}>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t('send.form.campaignPlaceholder')}
                    invalid={Boolean(fieldState.error)}
                    disabled={busy}
                    options={options.campaigns.map((c) => ({
                      value: c.id,
                      label: lt(c.title, lang),
                      description: lt(options.tenants.find((x) => x.id === c.tenantId)?.name ?? { en: '', ka: '' }, lang),
                    }))}
                  />
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={control}
                name="branchId"
                render={({ field, fieldState }) => (
                  <Field
                    label={t('send.form.branch')}
                    error={fieldState.error?.message}
                    hint={options.locked ? t('send.form.lockedHint') : undefined}
                  >
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('send.form.branchPlaceholder')}
                      invalid={Boolean(fieldState.error)}
                      disabled={options.locked || busy}
                      icon={options.locked ? lockIcon : undefined}
                      options={branches.map((b) => ({ value: b.id, label: lt(b.name, lang) }))}
                    />
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="staffId"
                render={({ field, fieldState }) => (
                  <Field label={t('send.form.staff')} error={fieldState.error?.message}>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('send.form.staffPlaceholder')}
                      invalid={Boolean(fieldState.error)}
                      disabled={options.locked || busy}
                      icon={options.locked ? lockIcon : undefined}
                      options={staff.map((s) => ({ value: s.id, label: lt(s.name, lang), description: lt(s.title, lang) }))}
                    />
                  </Field>
                )}
              />
            </div>

            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Field label={t('send.form.recipientMode')}>
                  <SegmentedControl<Mode>
                    label={t('send.form.recipientMode')}
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v)
                      form.clearErrors(['recipientId', 'phone'])
                    }}
                    fullWidth
                    options={[
                      { value: 'persona', label: t('send.form.modePersona'), icon: <UserRound size={16} strokeWidth={1.75} /> },
                      { value: 'phone', label: t('send.form.modePhone'), icon: <Phone size={16} strokeWidth={1.75} /> },
                    ]}
                  />
                </Field>
              )}
            />

            {mode === 'persona' ? (
              <Controller
                control={control}
                name="recipientId"
                render={({ field, fieldState }) => (
                  <Field label={t('send.form.persona')} hint={t('send.form.personaHint')} error={fieldState.error?.message}>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('send.form.personaPlaceholder')}
                      invalid={Boolean(fieldState.error)}
                      disabled={busy}
                      options={options.recipients.map((r) => ({
                        value: r.id,
                        label: lt(r.name, lang),
                        description: r.phoneMasked,
                      }))}
                    />
                  </Field>
                )}
              />
            ) : (
              <Controller
                control={control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Field label={t('send.form.phone')} hint={t('send.form.phoneHint')} error={fieldState.error?.message}>
                    <Input
                      ref={field.ref}
                      name={field.name}
                      onBlur={field.onBlur}
                      value={formatPhoneDigits(field.value)}
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 9))}
                      inputMode="numeric"
                      autoComplete="off"
                      mono
                      disabled={busy}
                      placeholder={t('send.form.phonePlaceholder')}
                      invalid={Boolean(fieldState.error)}
                      leftIcon={<span className="font-mono text-sm text-muted">+995</span>}
                    />
                  </Field>
                )}
              />
            )}

            <Controller
              control={control}
              name="interactionAt"
              render={({ field, fieldState }) => (
                <Field label={t('send.form.interactionAt')} hint={t('send.form.interactionHint')} error={fieldState.error?.message}>
                  <Input
                    {...field}
                    type="datetime-local"
                    disabled={busy}
                    max={toLocalInput(clock.now())}
                    invalid={Boolean(fieldState.error)}
                  />
                </Field>
              )}
            />

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Button
                type="submit"
                size="lg"
                disabled={busy || formState.isSubmitting}
                leftIcon={busy ? undefined : <Send size={18} strokeWidth={1.75} />}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <BarsLoader size="xs" className="text-current" />
                    {t('send.form.sending')}
                  </span>
                ) : (
                  t('send.form.submit')
                )}
              </Button>
              <span aria-live="polite" className="text-sm">
                {phase === 'delivered' && (
                  <span className="inline-flex animate-pop items-center gap-1.5 font-medium text-success">
                    <CheckCircle2 size={18} strokeWidth={1.75} />
                    {t('send.form.delivered')}
                    {lastId && <span className="font-mono text-muted">· {lastId}</span>}
                  </span>
                )}
                {phase === 'created' && (
                  <span className="inline-flex animate-pop items-center gap-1.5 font-medium text-success">
                    <CheckCircle2 size={18} strokeWidth={1.75} />
                    {t('send.form.created')}
                    {lastId && <span className="font-mono text-muted">· {lastId}</span>}
                  </span>
                )}
              </span>
            </div>
          </form>
        </Card>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-4">
            <SmsPreview tenant={tenant} branch={branch} recipient={recipientLine} />
          </div>
        </div>
      </div>

      <RecentSends admin={!options.locked} highlightId={lastId} />
    </>
  )
}
