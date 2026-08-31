import { useState } from 'react';
import { Link } from 'react-router-dom';
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

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    email: z.string().email(t('auth.invalidEmail', { defaultValue: 'Invalid email' })),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await api.post<{ detail: string }>('/auth/password/reset', { email: values.email }, { skipAuth: true });
      setSubmitted(true);
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
        title={t('seo.pages.forgot.title', { defaultValue: 'Forgot password | Gisheri' })}
        robots="noindex,nofollow"
      />
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-2xl font-medium mb-1">
            {t('auth.forgotTitle', { defaultValue: 'Reset your password' })}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {t('auth.forgotSubtitle', {
              defaultValue: "Enter your email and we'll send you a link to reset your password.",
            })}
          </p>

          {submitted ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                {t('auth.forgotSent', {
                  defaultValue: 'If an account with that email exists, a reset link has been sent.',
                })}
              </p>
              <Link to="/login" className="block">
                <Button variant="outline" className="w-full">
                  {t('auth.backToSignIn', { defaultValue: 'Back to sign in' })}
                </Button>
              </Link>
            </div>
          ) : (
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

                {serverError && <p className="text-sm text-destructive">{serverError}</p>}

                <Button type="submit" disabled={submitting} className="w-full" size="lg">
                  {submitting
                    ? t('auth.sending', { defaultValue: 'Sending…' })
                    : t('auth.sendReset', { defaultValue: 'Send reset link' })}
                </Button>
              </form>
            </Form>
          )}

          {!submitted && (
            <p className="mt-6 text-sm text-center text-muted-foreground">
              <Link to="/login" className="hover:text-foreground transition-colors">
                {t('auth.backToSignIn', { defaultValue: 'Back to sign in' })}
              </Link>
            </p>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
