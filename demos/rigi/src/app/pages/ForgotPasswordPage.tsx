/** Route /forgot-password: always answers with the same neutral success. Owner: shell. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import { AuthScreen } from '@/components/layout/AuthScreen'
import { Banner, Button, Field, Input } from '@/components/ui'
import { http } from '@/lib/api'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('shell')
  const [sent, setSent] = useState<string | null>(null)
  const schema = z.object({ email: z.string().trim().min(1, t('auth.errors.required')).email(t('auth.errors.email')) })
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' } })
  const submit = form.handleSubmit(async (values) => {
    await http.post('/auth/forgot-password', values)
    setSent(values.email)
  })
  return (
    <AuthScreen realm="staff">
      <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.02em]">{t('auth.forgotPage.title')}</h1>
      <p className="mt-1.5 text-sm text-muted">{t('auth.forgotPage.subtitle')}</p>
      {sent ? (
        <div className="mt-6 flex flex-col gap-4">
          <Banner tone="success" title={t('auth.forgotPage.sentTitle')}>{t('auth.forgotPage.sentBody', { email: sent })}</Banner>
          <p className="text-[13px] text-muted">{t('auth.forgotPage.demoHint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link to="/login">{t('auth.backToSignIn')}</Link></Button>
            <Button asChild variant="ghost"><Link to="/reset-password?token=demo-reset-token">{t('auth.forgotPage.openLink')}</Link></Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
          <Field label={t('common:fields.email')} htmlFor="email" error={form.formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoFocus invalid={Boolean(form.formState.errors.email)} {...form.register('email')} />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Link to="/login" className="link text-[13px]">{t('auth.backToSignIn')}</Link>
            <Button type="submit" loading={form.formState.isSubmitting}>{t('auth.forgotPage.submit')}</Button>
          </div>
        </form>
      )}
    </AuthScreen>
  )
}
