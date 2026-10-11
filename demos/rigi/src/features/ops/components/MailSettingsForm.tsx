import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, PlugZap, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Banner, Button, Card, CardBody, CardFooter, CardHeader, Field, Input, Skeleton, Switch, toast } from '@/components/ui'

import { errorMessage, fieldErrorsOf, useConnectionTest, useMailSettings, useSaveMailSettings } from '../api'
import type { ConnectionTestResult } from '../lib/types'

const port = z.string().trim().regex(/^\d{1,5}$/, 'validation.port').refine((v) => Number(v) >= 1 && Number(v) <= 65535, 'validation.port')

const schema = z.object({
  imap: z.object({
    host: z.string().trim().min(1, 'validation.required').max(253, 'validation.tooLong'),
    port,
    user: z.string().trim().max(254, 'validation.tooLong'),
    password: z.string().max(200, 'validation.tooLong'),
    tls: z.boolean(),
  }),
  smtp: z.object({
    host: z.string().trim().min(1, 'validation.required').max(253, 'validation.tooLong'),
    port,
    user: z.string().trim().max(254, 'validation.tooLong'),
    password: z.string().max(200, 'validation.tooLong'),
    from: z.string().trim().regex(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/, 'validation.email'),
    tls: z.boolean(),
  }),
  appBaseUrl: z.string().trim().regex(/^https?:\/\/[^\s/]+\.[^\s]+$/, 'validation.url').max(500, 'validation.tooLong'),
})

type FormValues = z.infer<typeof schema>
type Section = 'imap' | 'smtp'

const EMPTY: FormValues = {
  imap: { host: '', port: '993', user: '', password: '', tls: true },
  smtp: { host: '', port: '587', user: '', password: '', from: '', tls: true },
  appBaseUrl: '',
}

export function MailSettingsForm() {
  const { t } = useTranslation('ops')
  const query = useMailSettings()
  const save = useSaveMailSettings()
  const {
    register,
    handleSubmit,
    reset,
    setError,
    getValues,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  const data = query.data
  useEffect(() => {
    if (!data) return
    reset({
      imap: { host: data.imap.host, port: String(data.imap.port), user: data.imap.user, password: '', tls: data.imap.tls },
      smtp: { host: data.smtp.host, port: String(data.smtp.port), user: data.smtp.user, password: '', from: data.smtp.from, tls: data.smtp.tls },
      appBaseUrl: data.appBaseUrl,
    })
  }, [data, reset])

  const msg = (key?: string) => (key ? t(key) : undefined)

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({
        imap: { ...v.imap, port: Number(v.imap.port) },
        smtp: { ...v.smtp, port: Number(v.smtp.port) },
        appBaseUrl: v.appBaseUrl,
      })
      toast.success(t('settings.saved'))
    } catch (error) {
      const fields = fieldErrorsOf(error)
      const names = Object.keys(fields)
      names.forEach((n) => setError(n as 'appBaseUrl', { message: fields[n] }))
      if (!names.length) toast.error(errorMessage(error))
    }
  })

  if (query.isError) {
    return (
      <Banner tone="danger" title={t('common:states.error')} action={<Button size="sm" variant="outline" onClick={() => query.refetch()}>{t('common:actions.retry')}</Button>}>
        {errorMessage(query.error)}
      </Banner>
    )
  }
  if (query.isLoading) return <Skeleton className="h-72 w-full" />

  const pwPlaceholder = (has: boolean | undefined) => (has ? t('settings.passwordKept') : t('settings.passwordNone'))

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('settings.imap.title')} description={t('settings.imap.description')} />
          <CardBody className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <Field label={t('settings.host')} required htmlFor="imap-host" error={msg(errors.imap?.host?.message)}>
              <Input id="imap-host" mono invalid={!!errors.imap?.host} placeholder="imap.example.com" {...register('imap.host')} />
            </Field>
            <Field label={t('settings.port')} required htmlFor="imap-port" error={msg(errors.imap?.port?.message)}>
              <Input id="imap-port" mono inputMode="numeric" invalid={!!errors.imap?.port} {...register('imap.port')} />
            </Field>
            <Field label={t('settings.user')} htmlFor="imap-user" error={msg(errors.imap?.user?.message)}>
              <Input id="imap-user" autoComplete="off" invalid={!!errors.imap?.user} {...register('imap.user')} />
            </Field>
            <div className="hidden sm:block" />
            <Field label={t('settings.password')} htmlFor="imap-pass" error={msg(errors.imap?.password?.message)} className="sm:col-span-2">
              <Input id="imap-pass" type="password" autoComplete="new-password" placeholder={pwPlaceholder(data?.imap.hasPassword)} invalid={!!errors.imap?.password} {...register('imap.password')} />
            </Field>
            <div className="sm:col-span-2">
              <Switch checked={watch('imap.tls')} onCheckedChange={(c) => setValue('imap.tls', c, { shouldDirty: true })} label={t('settings.tls')} />
            </div>
          </CardBody>
          <CardFooter className="justify-start">
            <TestButton kind="imap" values={() => ({ ...getValues('imap'), port: Number(getValues('imap.port')) })} />
          </CardFooter>
        </Card>

        <Card>
          <CardHeader title={t('settings.smtp.title')} description={t('settings.smtp.description')} />
          <CardBody className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px]">
            <Field label={t('settings.host')} required htmlFor="smtp-host" error={msg(errors.smtp?.host?.message)}>
              <Input id="smtp-host" mono invalid={!!errors.smtp?.host} placeholder="smtp.example.com" {...register('smtp.host')} />
            </Field>
            <Field label={t('settings.port')} required htmlFor="smtp-port" error={msg(errors.smtp?.port?.message)}>
              <Input id="smtp-port" mono inputMode="numeric" invalid={!!errors.smtp?.port} {...register('smtp.port')} />
            </Field>
            <Field label={t('settings.user')} htmlFor="smtp-user" error={msg(errors.smtp?.user?.message)}>
              <Input id="smtp-user" autoComplete="off" invalid={!!errors.smtp?.user} {...register('smtp.user')} />
            </Field>
            <div className="hidden sm:block" />
            <Field label={t('settings.password')} htmlFor="smtp-pass" error={msg(errors.smtp?.password?.message)} className="sm:col-span-2">
              <Input id="smtp-pass" type="password" autoComplete="new-password" placeholder={pwPlaceholder(data?.smtp.hasPassword)} invalid={!!errors.smtp?.password} {...register('smtp.password')} />
            </Field>
            <Field label={t('settings.smtp.from')} required htmlFor="smtp-from" error={msg(errors.smtp?.from?.message)} className="sm:col-span-2">
              <Input id="smtp-from" type="email" invalid={!!errors.smtp?.from} placeholder="support@example.com" {...register('smtp.from')} />
            </Field>
            <div className="sm:col-span-2">
              <Switch checked={watch('smtp.tls')} onCheckedChange={(c) => setValue('smtp.tls', c, { shouldDirty: true })} label={t('settings.tls')} />
            </div>
          </CardBody>
          <CardFooter className="justify-start">
            <TestButton kind="smtp" values={() => ({ ...getValues('smtp'), port: Number(getValues('smtp.port')) })} />
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader title={t('settings.baseUrl.title')} description={t('settings.baseUrl.description')} />
        <CardBody>
          <Field label={t('settings.baseUrl.label')} required htmlFor="base-url" error={msg(errors.appBaseUrl?.message)}>
            <Input id="base-url" mono type="url" invalid={!!errors.appBaseUrl} placeholder="https://app.example.com" {...register('appBaseUrl')} />
          </Field>
        </CardBody>
        <CardFooter>
          <Button variant="ghost" disabled={!isDirty || save.isPending} onClick={() => data && reset({ imap: { host: data.imap.host, port: String(data.imap.port), user: data.imap.user, password: '', tls: data.imap.tls }, smtp: { host: data.smtp.host, port: String(data.smtp.port), user: data.smtp.user, password: '', from: data.smtp.from, tls: data.smtp.tls }, appBaseUrl: data.appBaseUrl })}>
            {t('common:actions.reset')}
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            {t('settings.saveAll')}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function TestButton({ kind, values }: { kind: Section; values: () => { host: string; port: number; user: string; password: string } }) {
  const { t } = useTranslation('ops')
  const test = useConnectionTest(kind)
  const [result, setResult] = useState<ConnectionTestResult | null>(null)

  const run = async () => {
    setResult(null)
    try {
      setResult(await test.mutateAsync(values()))
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error), latencyMs: 0 })
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <Button type="button" variant="outline" size="sm" icon={<PlugZap />} loading={test.isPending} onClick={run}>
        {test.isPending ? t('settings.testing') : t('settings.test')}
      </Button>
      <div aria-live="polite" className="min-w-0 text-[13px]">
        {result &&
          (result.ok ? (
            <span className="inline-flex items-center gap-1.5 text-success">
              <CheckCircle2 className="size-4 shrink-0 stroke-[1.75]" aria-hidden />
              <span className="min-w-0 break-words">{t('settings.testOk', { ms: result.latencyMs })}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-danger">
              <XCircle className="size-4 shrink-0 stroke-[1.75]" aria-hidden />
              <span className="min-w-0 break-words">{result.message === 'Connection refused' ? t('settings.refused') : result.message}</span>
            </span>
          ))}
      </div>
    </div>
  )
}
