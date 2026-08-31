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
import { useRegister } from '@/auth/hooks';
import { registerSchema, type RegisterInput } from '@/auth/schemas';

export function Register() {
  const { t } = useTranslation('auth');
  const { t: tNav } = useTranslation('nav');
  const registerMut = useRegister();
  const navigate = useNavigate();
  const location = useLocation();
  const nextParam = new URLSearchParams(location.search).get('next');
  const next = nextParam ?? '/profile';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (data) => {
    const payload = {
      ...data,
      email: data.email && data.email !== '' ? data.email : undefined,
    };
    try {
      await registerMut.mutateAsync(payload);
      navigate(next);
    } catch {
      /* surfaced */
    }
  });

  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <AuthAside title={t('register.title')} />

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
                {tNav('register')}
              </p>
              <h1 className="font-display font-semibold text-4xl md:text-5xl text-ink leading-[1.05] tracking-tight">
                {t('register.title')}
              </h1>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={t('register.first_name_label')}
                  error={errors.first_name?.message}
                  autoComplete="given-name"
                  {...register('first_name')}
                />
                <Input
                  label={t('register.last_name_label')}
                  error={errors.last_name?.message}
                  autoComplete="family-name"
                  {...register('last_name')}
                />
              </div>
              <Input
                label={t('register.phone_label')}
                placeholder={t('login.phone_placeholder')}
                error={errors.phone?.message}
                autoComplete="tel"
                {...register('phone')}
              />
              <Input
                label={`${t('register.email_label')} ${t('register.email_optional')}`}
                type="email"
                error={errors.email?.message}
                autoComplete="email"
                {...register('email')}
              />
              <Input
                label={t('register.password_label')}
                type="password"
                error={errors.password?.message}
                autoComplete="new-password"
                {...register('password')}
              />
              <Button
                type="submit"
                loading={registerMut.isPending}
                size="lg"
                variant="accent"
                className="mt-2 rounded-pill"
              >
                {t('register.submit')}
              </Button>
              <ErrorMessage error={registerMut.error} />
            </form>

            <p className="text-sm text-ink-muted">
              {t('register.have_account')}{' '}
              <Link
                to={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
                className="text-accent hover:underline font-medium"
              >
                {t('register.sign_in')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
