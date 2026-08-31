import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthAside } from '@/components/AuthAside';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useForgotPassword } from '@/auth/hooks';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/auth/schemas';

export function ForgotPassword() {
  const { t } = useTranslation('auth');
  const { t: tNav } = useTranslation('nav');
  const forgot = useForgotPassword();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await forgot.mutateAsync(data);
      // Backend always returns 204 (no leak). Carry the phone into the reset step.
      navigate('/reset-password', { state: { phone: data.phone } });
    } catch {
      /* surfaced */
    }
  });

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <AuthAside title={t('forgot.title')} />

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
                {t('forgot.title')}
              </h1>
              <p className="text-sm text-ink-muted mt-3">{t('forgot.subtitle')}</p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Input
                label={t('forgot.phone_label')}
                placeholder={t('login.phone_placeholder')}
                error={errors.phone?.message}
                autoComplete="tel"
                {...register('phone')}
              />
              <Button
                type="submit"
                loading={forgot.isPending}
                size="lg"
                variant="accent"
                className="mt-2 rounded-pill"
              >
                {t('forgot.submit')}
              </Button>
              <ErrorMessage error={forgot.error} />
            </form>

            <p className="text-sm text-ink-muted">
              {t('forgot.remembered')}{' '}
              <Link to="/login" className="text-accent hover:underline font-medium">
                {t('register.sign_in')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
