import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthAside } from '@/components/AuthAside';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useResetPassword } from '@/auth/hooks';
import { resetPasswordSchema, type ResetPasswordInput } from '@/auth/schemas';

export function ResetPassword() {
  const { t } = useTranslation('auth');
  const { t: tNav } = useTranslation('nav');
  const reset = useResetPassword();
  const navigate = useNavigate();
  const location = useLocation();
  // Phone carried from the forgot step via router state, with a query-param fallback.
  const statePhone = (location.state as { phone?: string } | null)?.phone;
  const queryPhone = new URLSearchParams(location.search).get('phone') ?? undefined;
  const phone = statePhone ?? queryPhone ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { phone },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await reset.mutateAsync(data);
      navigate('/login', { state: { passwordReset: true } });
    } catch {
      /* surfaced */
    }
  });

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <AuthAside title={t('reset.title')} />

      <section className="flex flex-col p-8 md:p-16">
        <div className="flex items-center justify-between lg:justify-end mb-10">
          <Link to="/" className="lg:hidden">
            <Logo size="sm" />
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="flex-1 flex items-center">
          <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-accent font-medium mb-2">
                {tNav('login')}
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink leading-[1.05] tracking-tight">
                {t('reset.title')}
              </h1>
              <p className="text-sm text-ink-muted mt-3">{t('reset.subtitle')}</p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                label={t('reset.phone_label')}
                placeholder={t('login.phone_placeholder')}
                error={errors.phone?.message}
                autoComplete="tel"
                {...register('phone')}
              />
              <Input
                label={t('reset.code_label')}
                placeholder={t('reset.code_placeholder')}
                error={errors.code?.message}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                {...register('code')}
              />
              <Input
                label={t('reset.new_password_label')}
                type="password"
                error={errors.new_password?.message}
                autoComplete="new-password"
                {...register('new_password')}
              />
              <Button
                type="submit"
                loading={reset.isPending}
                size="lg"
                variant="accent"
                className="mt-2 rounded-pill"
              >
                {t('reset.submit')}
              </Button>
              <ErrorMessage error={reset.error} />
            </form>

            <p className="text-sm text-ink-muted">
              {t('reset.no_code')}{' '}
              <Link to="/forgot-password" className="text-accent hover:underline font-medium">
                {t('reset.resend')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
