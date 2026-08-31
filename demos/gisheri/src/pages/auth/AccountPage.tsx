import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ordersApi, type Order, type OrderStatus } from '@/lib/orders-api';
import { formatMoneyGEL } from '@/lib/money';
import { cn } from '@/lib/utils';
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
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

const statusBadge: Record<OrderStatus, string> = {
  pending: 'bg-secondary text-foreground border-border',
  paid: 'bg-purpose-balance/15 text-purpose-balance border-purpose-balance/30',
  shipped: 'bg-purpose-luck/15 text-purpose-luck border-purpose-luck/30',
  delivered: 'bg-gold/15 text-foreground border-gold/30',
  cancelled: 'bg-destructive/15 text-destructive border-destructive/30',
};

const AccountPage = () => {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { toast } = useToast();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    ordersApi
      .listMine(1, 5)
      .then((res) => {
        if (!cancelled) setOrders(res.items);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const profileSchema = z.object({
    firstName: z.string().max(150),
    lastName: z.string().max(150),
  });
  type ProfileValues = z.infer<typeof profileSchema>;

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { firstName: user?.firstName ?? '', lastName: user?.lastName ?? '' },
  });

  const passwordSchema = z
    .object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, t('auth.passwordTooShort', { defaultValue: 'Password must be at least 8 characters' })),
      confirm: z.string(),
    })
    .refine((d) => d.newPassword === d.confirm, {
      message: t('auth.passwordMismatch', { defaultValue: 'Passwords do not match' }),
      path: ['confirm'],
    });
  type PasswordValues = z.infer<typeof passwordSchema>;

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  if (!user) return null;

  const onSaveProfile = async (values: ProfileValues) => {
    setSavingProfile(true);
    try {
      await updateProfile({ firstName: values.firstName, lastName: values.lastName });
      toast({ title: t('account.profileSaved', { defaultValue: 'Profile updated' }) });
    } catch (err) {
      toast({
        title: t('auth.unknownError', { defaultValue: 'Something went wrong' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const onChangePassword = async (values: PasswordValues) => {
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      passwordForm.reset();
      toast({ title: t('account.passwordChanged', { defaultValue: 'Password changed' }) });
    } catch (err) {
      toast({
        title: t('auth.unknownError', { defaultValue: 'Something went wrong' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Seo
        title={t('seo.pages.account.title', { defaultValue: 'My account | Gisheri' })}
        robots="noindex,nofollow"
      />
      <Header />
      <main className="flex-1 pt-20 pb-12 px-4">
        <div className="container-main max-w-3xl py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="heading-hero mb-1">{t('account.title', { defaultValue: 'My account' })}</h1>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span>{user.email}</span>
                <Badge variant="outline" className="bg-gold/10 border-gold/30 text-foreground capitalize">
                  {user.role}
                </Badge>
              </div>
            </div>
            <Button variant="outline" onClick={logout}>
              {t('account.signOut', { defaultValue: 'Sign out' })}
            </Button>
          </div>

          <Card className="p-6 mb-6">
            <h2 className="font-serif text-xl font-medium mb-4">
              {t('account.recentOrders', { defaultValue: 'Recent orders' })}
            </h2>
            {orders === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('account.noOrders', { defaultValue: "You haven't placed any orders yet." })}
              </p>
            ) : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/orders/${o.id}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-secondary/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">Order #{o.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className={cn('capitalize', statusBadge[o.status])}>
                        {o.status}
                      </Badge>
                      <span className="font-medium tabular-nums text-sm">
                        {formatMoneyGEL(Number(o.total))}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 mb-6">
            <h2 className="font-serif text-xl font-medium mb-4">
              {t('account.profile', { defaultValue: 'Profile' })}
            </h2>
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={profileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.firstName', { defaultValue: 'First name' })}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('auth.lastName', { defaultValue: 'Last name' })}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={savingProfile}>
                  {savingProfile
                    ? t('account.saving', { defaultValue: 'Saving…' })
                    : t('account.saveProfile', { defaultValue: 'Save profile' })}
                </Button>
              </form>
            </Form>
          </Card>

          <Card className="p-6">
            <h2 className="font-serif text-xl font-medium mb-4">
              {t('account.password', { defaultValue: 'Password' })}
            </h2>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('account.currentPassword', { defaultValue: 'Current password' })}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Separator />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
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
                  control={passwordForm.control}
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
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword
                    ? t('account.changing', { defaultValue: 'Changing…' })
                    : t('account.changePassword', { defaultValue: 'Change password' })}
                </Button>
              </form>
            </Form>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AccountPage;
