import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Seo from '@/components/Seo';
import { useAuth } from '@/context/auth';
import { ApiError } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { ADVERTISED_ACCOUNTS, DEMO_CUSTOMER, DEMO_PASSWORD, type DemoAccount } from '@/demo/accounts';

const LoginPage = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().email(t('auth.invalidEmail', { defaultValue: 'Invalid email' })),
    password: z.string().min(1, t('auth.passwordRequired', { defaultValue: 'Password is required' })),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    // Pre-filled, because signing out is otherwise a dead end: the credentials
    // live in a seed file and nobody can guess them. The banner offers the same
    // two accounts, but the banner is dismissible and this page is where you
    // land when a session expires.
    defaultValues: { email: DEMO_CUSTOMER.email, password: DEMO_CUSTOMER.password },
  });

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from ?? '/account';
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(
        err instanceof ApiError
          ? err.detail
          : t('auth.unknownError', { defaultValue: 'Something went wrong. Try again.' }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const fillWith = (account: DemoAccount) => {
    // `shouldValidate` so a stale "Invalid email" from a half-typed address
    // clears with the value that produced it.
    form.setValue('email', account.email, { shouldValidate: true });
    form.setValue('password', account.password, { shouldValidate: true });
    setServerError(null);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={t('seo.pages.login.title', { defaultValue: 'Sign in | Gisheri' })}
        description={t('seo.pages.login.description', { defaultValue: 'Sign in to your Gisheri account.' })}
        robots="noindex,nofollow"
      />
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-2xl font-medium mb-1">
            {t('auth.signInTitle', { defaultValue: 'Sign in' })}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {t('auth.signInSubtitle', { defaultValue: 'Welcome back to Gisheri.' })}
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.email', { defaultValue: 'Email' })}</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.password', { defaultValue: 'Password' })}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting
                  ? t('auth.signingIn', { defaultValue: 'Signing in…' })
                  : t('auth.signIn', { defaultValue: 'Sign in' })}
              </Button>
            </form>
          </Form>

          {/*
            * The one block on this page that is not upstream's. There is no
            * `demo.loginHint` string to hang it on — the `demo.*` group is
            * fixed at nine keys and a locale file belongs to another package —
            * so the line is composed from keys that already exist and from data
            * that needs no translating. It stays bilingual either way.
            *
            * The buttons refill the form rather than signing in, which is the
            * point: this is the page that proves the password is real, and the
            * administrator account is otherwise unreachable once the banner has
            * been dismissed.
            */}
          <div className="mt-6 rounded-xl border border-border bg-muted/40 px-3 py-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              {t('demo.signInAs')}
            </p>
            <div className="flex flex-col gap-1.5">
              {ADVERTISED_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => fillWith(account)}
                  className="flex items-center justify-between gap-3 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-gold hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                >
                  <span className="font-medium">{t(account.labelKey)}</span>
                  <span className="truncate">{account.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('auth.password', { defaultValue: 'Password' })}:{' '}
              <span className="text-foreground">{DEMO_PASSWORD}</span>
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 text-sm text-center text-muted-foreground">
            <Link to="/forgot-password" className="hover:text-foreground transition-colors">
              {t('auth.forgotPassword', { defaultValue: 'Forgot your password?' })}
            </Link>
            <span>
              {t('auth.noAccount', { defaultValue: "Don't have an account?" })}{' '}
              <Link to="/register" className="text-gold hover:underline">
                {t('auth.register', { defaultValue: 'Create one' })}
              </Link>
            </span>
          </div>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default LoginPage;
