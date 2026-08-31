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
import { useLogin } from '@/auth/hooks';
import { loginSchema, type LoginInput } from '@/auth/schemas';

export function Login() {
  const { t } = useTranslation('auth');
  const { t: tNav } = useTranslation('nav');
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const next = new URLSearchParams(location.search).get('next') ?? '/profile';
  const nextParam = new URLSearchParams(location.search).get('next');
  const passwordReset = (location.state as { passwordReset?: boolean } | null)?.passwordReset;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await login.mutateAsync(data);
      navigate(next);
    } catch {
      /* surfaced */
    }
  });

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <AuthAside title={t('login.title')} />

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
                {t('login.title')}
              </h1>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                label={t('login.phone_label')}
                placeholder={t('login.phone_placeholder')}
                error={errors.phone?.message}
                autoComplete="tel"
                {...register('phone')}
              />
              <Input
                label={t('login.password_label')}
                type="password"
                error={errors.password?.message}
                autoComplete="current-password"
                {...register('password')}
              />
              <Link
                to="/forgot-password"
                className="text-sm text-accent hover:underline font-medium self-start -mt-1"
              >
                {t('login.forgot_password')}
              </Link>
              <Button
                type="submit"
                loading={login.isPending}
                size="lg"
                variant="accent"
                className="mt-2 rounded-pill"
              >
                {t('login.submit')}
              </Button>
              {passwordReset && (
                <span role="status" aria-live="polite" className="text-success text-sm">
                  {t('login.password_reset_success')}
                </span>
              )}
              <ErrorMessage error={login.error} />
            </form>

            <p className="text-sm text-ink-muted">
              {t('login.no_account')}{' '}
              <Link
                to={nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : '/register'}
                className="text-accent hover:underline font-medium"
              >
                {t('login.create_account')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
