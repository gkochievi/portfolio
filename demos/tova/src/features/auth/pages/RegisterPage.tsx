/** Registration = lead capture. Always creates a PLAYER and goes straight to /play. */
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { Button, Card, Field, Input, PageHeader, toast } from '@/components/ui'
import { ApiError, http } from '@/lib/api'
import { useCurrentUser } from '@/shell/session'
import type { SessionUser } from '@/types'
import { AuthTopBar } from '../components/AuthTopBar'

const required = 'auth:errors.required'
const schema = z.object({
  firstName: z.string().trim().min(1, required).max(80),
  lastName: z.string().trim().min(1, required).max(80),
  phone: z.string().trim().min(3, required).max(40),
  email: z.string().trim().min(1, required).email('auth:errors.invalidEmail'),
  company: z.string().trim().min(1, required).max(120),
  position: z.string().trim().min(1, required).max(120),
  password: z.string().min(6, 'auth:errors.passwordShort'),
})
type Values = z.infer<typeof schema>
const FIELDS = ['firstName', 'lastName', 'phone', 'email', 'company', 'position', 'password'] as const

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', phone: '', email: '', company: '', position: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: Values) => http.post<SessionUser>('/auth/register', values),
    onSuccess: (session) => {
      toast.success(t('auth:welcome', { name: session.firstName }))
      navigate('/play', { replace: true })
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        for (const [field, messages] of Object.entries(error.fieldErrors)) {
          if ((FIELDS as readonly string[]).includes(field)) setError(field as keyof Values, { message: messages[0] })
        }
      }
    },
  })

  if (user && !mutation.isPending && !mutation.isSuccess) return <Navigate to="/play" replace />

  const formError =
    mutation.error instanceof ApiError && Object.keys(mutation.error.fieldErrors).length === 0
      ? mutation.error.message
      : mutation.error && !(mutation.error instanceof ApiError)
        ? 'common:errors.generic'
        : null

  const text = (name: keyof Values, autoComplete: string, type = 'text', placeholder?: string) => (
    <Field label={t(`auth:register.${name}`)} htmlFor={`reg-${name}`} error={errors[name]?.message} required>
      <Input
        id={`reg-${name}`}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        invalid={Boolean(errors[name])}
        {...register(name)}
      />
    </Field>
  )

  return (
    <div className="min-h-dvh bg-surface px-4">
      <AuthTopBar className="mx-auto w-full max-w-[520px]" />
      <main className="mx-auto w-full max-w-[520px] pb-10 pt-4">
        <PageHeader variant="player" title={t('auth:register.title')} description={t('auth:register.subtitle')} />
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} noValidate>
          <Card padding="lg" className="flex flex-col gap-4">
            {formError && (
              <p role="alert" className="rounded-chip bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
                {t(formError)}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('firstName', 'given-name')}
              {text('lastName', 'family-name')}
            </div>
            {text('phone', 'tel', 'tel', t('auth:register.phonePlaceholder'))}
            {text('email', 'email', 'email')}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('company', 'organization')}
              {text('position', 'organization-title')}
            </div>
            <Field
              label={t('auth:register.password')}
              htmlFor="reg-password"
              hint={t('auth:register.passwordHint')}
              error={errors.password?.message}
              required
            >
              <Input id="reg-password" type="password" autoComplete="new-password" invalid={Boolean(errors.password)} {...register('password')} />
            </Field>
          </Card>
          <div className="sticky bottom-0 z-10 -mx-4 mt-6 bg-surface px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:bg-transparent sm:p-0">
            <Button type="submit" size="lg" block loading={mutation.isPending}>
              {t('auth:register.submit')}
            </Button>
          </div>
        </form>
        <p className="mt-6 text-center text-[15px] text-muted">
          {t('auth:register.haveAccount')}{' '}
          <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">
            {t('auth:register.signIn')}
          </Link>
        </p>
      </main>
    </div>
  )
}
