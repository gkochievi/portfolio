import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { api, ApiError } from '@/lib/api';
import { useTranslation } from 'react-i18next';

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z
    .object({
      password: z.string().min(8, t('auth.passwordTooShort', { defaultValue: 'Password must be at least 8 characters' })),
      confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
      message: t('auth.passwordMismatch', { defaultValue: 'Passwords do not match' }),
      path: ['confirm'],
    });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async (values: Values) => {
    if (!token) {
      setServerError(t('auth.resetMissingToken', { defaultValue: 'Reset link is missing the token.' }));
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await api.post<{ detail: string }>(
        '/auth/password/reset/confirm',
        { token, password: values.password },
        { skipAuth: true },
      );
      navigate('/login', { replace: true });
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={t('seo.pages.reset.title', { defaultValue: 'Reset password | Gisheri' })}
        robots="noindex,nofollow"
      />
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-2xl font-medium mb-1">
            {t('auth.resetTitle', { defaultValue: 'Choose a new password' })}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {t('auth.resetSubtitle', { defaultValue: 'Enter a new password for your account.' })}
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.newPassword', { defaultValue: 'New password' })}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.confirmPassword', { defaultValue: 'Confirm password' })}</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button type="submit" disabled={submitting || !token} className="w-full" size="lg">
                {submitting
                  ? t('auth.resetting', { defaultValue: 'Resetting…' })
                  : t('auth.resetPassword', { defaultValue: 'Reset password' })}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            <Link to="/login" className="hover:text-foreground transition-colors">
              {t('auth.backToSignIn', { defaultValue: 'Back to sign in' })}
            </Link>
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ResetPasswordPage;
