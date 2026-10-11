/** Route /reset-password?token=: choose a new password (fake success). Owner: shell. */
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import { AuthScreen } from '@/components/layout/AuthScreen'
import { Banner, Button, Field, Input } from '@/components/ui'
import { http, isApiError } from '@/lib/api'

export default function ResetPasswordPage() {
  const { t } = useTranslation('shell')
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const schema = z
    .object({
      password: z.string().min(8, t('auth.errors.minPassword')),
      confirm: z.string().min(1, t('auth.errors.required')),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: t('auth.errors.mismatch') })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: '', confirm: '' } })
  const submit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      await http.post('/auth/reset-password', { token, ...values })
      setDone(true)
    } catch (e) {
      setError(isApiError(e, 400) ? t('auth.resetPage.invalidLink') : t('common:states.error'))
    }
  })
  return (
    <AuthScreen realm="staff">
      <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.02em]">{t('auth.resetPage.title')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.resetPage.subtitle')}</p>
      {!token ? (
        <div className="mt-6 flex flex-col gap-4">
          <Banner tone="warning" title={t('auth.resetPage.invalidLink')}>{t('auth.resetPage.invalidBody')}</Banner>
          <Button asChild variant="secondary" className="self-start"><Link to="/forgot-password">{t('auth.resetPage.requestNew')}</Link></Button>
        </div>
      ) : done ? (
        <div className="mt-6 flex flex-col gap-4">
          <Banner tone="success" title={t('auth.resetPage.doneTitle')}>{t('auth.resetPage.doneBody')}</Banner>
          <Button asChild className="self-start"><Link to="/login">{t('auth.backToSignIn')}</Link></Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
          {error ? <Banner tone="danger">{error}</Banner> : null}
          <Field label={t('auth.resetPage.newPassword')} htmlFor="password" hint={t('auth.resetPage.hint')} error={form.formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" autoFocus invalid={Boolean(form.formState.errors.password)} {...form.register('password')} />
          </Field>
          <Field label={t('auth.resetPage.confirm')} htmlFor="confirm" error={form.formState.errors.confirm?.message}>
            <Input id="confirm" type="password" autoComplete="new-password" invalid={Boolean(form.formState.errors.confirm)} {...form.register('confirm')} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Link to="/login" className="link text-[13px]">{t('auth.backToSignIn')}</Link>
            <Button type="submit" loading={form.formState.isSubmitting}>{t('auth.resetPage.submit')}</Button>
          </div>
        </form>
      )}
    </AuthScreen>
  )
}
