import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const RegisterPage = () => {
  const { t } = useTranslation();
  const { register } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    firstName: z.string().max(150).optional().default(''),
    lastName: z.string().max(150).optional().default(''),
    email: z.string().email(t('auth.invalidEmail', { defaultValue: 'Invalid email' })),
    password: z.string().min(8, t('auth.passwordTooShort', { defaultValue: 'Password must be at least 8 characters' })),
  });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '' },
  });

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    setServerError(null);
    try {
      await register({
        email: values.email,
        password: values.password,
        firstName: values.firstName ?? '',
        lastName: values.lastName ?? '',
      });
      navigate('/account', { replace: true });
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
        title={t('seo.pages.register.title', { defaultValue: 'Create account | Gisheri' })}
        description={t('seo.pages.register.description', { defaultValue: 'Create your Gisheri account.' })}
        robots="noindex,nofollow"
      />
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4 flex items-center justify-center">
        <Card className="w-full max-w-md p-8">
          <h1 className="font-serif text-2xl font-medium mb-1">
            {t('auth.registerTitle', { defaultValue: 'Create account' })}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {t('auth.registerSubtitle', { defaultValue: 'Join Gisheri to track orders and save favourites.' })}
          </p>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.firstName', { defaultValue: 'First name' })}</FormLabel>
                      <FormControl>
                        <Input autoComplete="given-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('auth.lastName', { defaultValue: 'Last name' })}</FormLabel>
                      <FormControl>
                        <Input autoComplete="family-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {serverError && <p className="text-sm text-destructive">{serverError}</p>}

              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting
                  ? t('auth.creating', { defaultValue: 'Creating…' })
                  : t('auth.createAccount', { defaultValue: 'Create account' })}
              </Button>
            </form>
          </Form>

          <p className="mt-6 text-sm text-center text-muted-foreground">
            {t('auth.haveAccount', { defaultValue: 'Already have an account?' })}{' '}
            <Link to="/login" className="text-gold hover:underline">
              {t('auth.signIn', { defaultValue: 'Sign in' })}
            </Link>
          </p>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default RegisterPage;
