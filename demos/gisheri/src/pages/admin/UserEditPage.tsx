import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import PageHeader from '@/components/admin/PageHeader';
import FormActionsBar from '@/components/admin/FormActionsBar';
import ActivityFeed from '@/components/admin/ActivityFeed';
import { adminUsers, type AdminUserDetail } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { formatMoneyGEL } from '@/lib/money';
import { useToast } from '@/components/ui/use-toast';
import { useAuth, type Role } from '@/context/auth';

const schema = z.object({
  firstName: z.string().max(150),
  lastName: z.string().max(150),
  role: z.enum(['customer', 'staff', 'admin']),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const UserEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user: me } = useAuth();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isSelf = me?.id === Number(id);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', role: 'customer', isActive: true },
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    adminUsers
      .get(Number(id))
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        form.reset({
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          isActive: u.isActive,
        });
      })
      .catch((err) => {
        toast({
          title: t('admin.users.loadFailed', { defaultValue: 'Failed to load user' }),
          description: err instanceof ApiError ? err.detail : undefined,
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, form, toast]);

  const onSubmit = async (values: Values) => {
    setSubmitting(true);
    try {
      const updated = await adminUsers.update(Number(id), {
        firstName: values.firstName,
        lastName: values.lastName,
        role: values.role as Role,
        isActive: values.isActive,
      });
      setUser(updated);
      toast({ title: t('admin.users.userSaved', { defaultValue: 'User saved' }) });
    } catch (err) {
      toast({
        title: t('admin.users.saveFailed', { defaultValue: 'Failed to save' }),
        description: err instanceof ApiError ? err.detail : undefined,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-muted-foreground text-sm">{t('admin.common.loading', { defaultValue: 'Loading…' })}</div>;
  }
  if (!user) return null;

  return (
    <div>
      <PageHeader
        title={user.email}
        description={t('admin.users.joinedAt', {
          when: new Date(user.dateJoined).toLocaleDateString(),
          defaultValue: `Joined ${new Date(user.dateJoined).toLocaleDateString()}`,
        })}
        back={{ to: '/admin/users', label: t('admin.users.backToUsers', { defaultValue: 'Back to users' }) }}
      />

      <Card className="p-6 mb-6 max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg font-medium inline-flex items-center gap-2">
            <ShoppingBag size={18} className="text-gold" />
            {t('admin.users.activityTitle', { defaultValue: 'Customer activity' })}
          </h2>
          {user.orderCount > 0 && (
            <Link
              to={`/admin/orders?userId=${user.id}&customerEmail=${encodeURIComponent(user.email)}`}
              className="text-xs text-muted-foreground hover:text-gold inline-flex items-center gap-1"
            >
              {t('admin.users.viewOrders', { defaultValue: 'View orders' })}
              <span aria-hidden>→</span>
            </Link>
          )}
        </div>
        {user.orderCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('admin.users.noOrders', { defaultValue: 'No orders yet.' })}
          </p>
        ) : (
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('admin.users.lifetimeOrders', { defaultValue: 'Lifetime orders' })}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{user.orderCount}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('admin.users.totalSpent', { defaultValue: 'Total spent' })}
              </dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {formatMoneyGEL(Number(user.totalSpent))}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('admin.users.lastOrder', { defaultValue: 'Last order' })}
              </dt>
              <dd className="mt-1 text-sm sm:text-base">
                {user.lastOrderAt ? new Date(user.lastOrderAt).toLocaleDateString() : '—'}
              </dd>
            </div>
          </dl>
        )}
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.users.profile', { defaultValue: 'Profile' })}</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.users.firstName', { defaultValue: 'First name' })}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.users.lastName', { defaultValue: 'Last name' })}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="font-serif text-lg font-medium">{t('admin.users.access', { defaultValue: 'Access' })}</h2>
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.users.role', { defaultValue: 'Role' })}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSelf}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{t('admin.users.roleCustomer', { defaultValue: 'Customer' })}</SelectItem>
                      <SelectItem value="staff">{t('admin.users.roleStaff', { defaultValue: 'Staff' })}</SelectItem>
                      <SelectItem value="admin">{t('admin.users.roleAdmin', { defaultValue: 'Admin' })}</SelectItem>
                    </SelectContent>
                  </Select>
                  {isSelf && (
                    <p className="text-xs text-muted-foreground">
                      {t('admin.users.selfRoleHint', { defaultValue: "You can't change your own role — ask another admin." })}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <Label>{t('admin.users.active', { defaultValue: 'Active' })}</Label>
                    {isSelf && (
                      <p className="text-xs text-muted-foreground">{t('admin.users.selfActiveHint', { defaultValue: "You can't deactivate yourself." })}</p>
                    )}
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSelf} />
                  </FormControl>
                </FormItem>
              )}
            />
          </Card>

          <FormActionsBar>
            <Button type="submit" disabled={submitting}>
              {submitting ? t('admin.common.saving', { defaultValue: 'Saving…' }) : t('admin.common.saveChanges', { defaultValue: 'Save changes' })}
            </Button>
          </FormActionsBar>
        </form>
      </Form>

      <div className="max-w-2xl mt-6">
        <ActivityFeed targetType="user" targetId={user.id} reloadKey={user.dateJoined + user.role + String(user.isActive)} />
      </div>
    </div>
  );
};

export default UserEditPage;
