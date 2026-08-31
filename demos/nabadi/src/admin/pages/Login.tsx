import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLogin } from '@/auth/hooks';
import { loginSchema, type LoginInput } from '@/auth/schemas';

/**
 * Only honor same-app relative paths ('/bookings?x=y'). Anything absolute or
 * protocol-relative ('//evil.com') is discarded — no open-redirect.
 */
function safeNextPath(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

export function Login() {
  const { t } = useTranslation('auth');
  const login = useLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (data) => {
    try {
      const user = await login.mutateAsync(data);
      if (user.role !== 'admin') {
        navigate('/unauthorized', { replace: true });
      } else {
        // RequireStaff / the api client sent us here with ?next=<original
        // path> — return the receptionist to where their session expired.
        navigate(safeNextPath(searchParams.get('next')), { replace: true });
      }
    } catch {
      /* surfaced via ErrorMessage */
    }
  });

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface border border-line rounded-md p-8 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Logo size="sm" />
          <LanguageSwitcher />
        </div>
        <header className="flex flex-col gap-1">
          <h1 className="font-display text-2xl text-ink">{t('login.title')}</h1>
          <p className="text-ink-muted text-sm">{t('login.subtitle')}</p>
        </header>
        <form onSubmit={onSubmit} className="flex flex-col">
          <Input
            label={t('login.phone_label')}
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
          <Button type="submit" loading={login.isPending} className="mt-2 rounded-pill">
            {t('login.submit')}
          </Button>
          <ErrorMessage error={login.error} />
        </form>
      </div>
    </main>
  );
}
