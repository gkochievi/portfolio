import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingBag,
  Tag,
  Settings,
  Search,
  Layers,
  Star,
  Sparkles,
  Menu,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/auth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import Seo from '@/components/Seo';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const SidebarBody = ({ items, userEmail, userRole, onLogout, onItemClick, signOutLabel }: {
  items: NavItem[];
  userEmail: string;
  userRole: string;
  onLogout: () => void;
  onItemClick?: () => void;
  signOutLabel: string;
}) => (
  <div className="flex flex-col h-full">
    <div className="px-6 py-6 border-b border-border">
      <span className="text-xl font-serif font-medium">
        <span className="text-gradient-gold">Gish</span>
        <span className="text-foreground">eri</span>
        <span className="ml-2 text-xs text-muted-foreground uppercase tracking-wider">Admin</span>
      </span>
    </div>
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/admin'}
          onClick={onItemClick}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              isActive
                ? 'bg-gold/10 text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40',
            )
          }
        >
          <Icon size={16} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
    <div className="px-4 py-4 border-t border-border text-xs">
      <p className="font-medium truncate">{userEmail}</p>
      <p className="text-muted-foreground capitalize mb-3">{userRole}</p>
      <button
        type="button"
        onClick={onLogout}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {signOutLabel}
      </button>
    </div>
  </div>
);

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!user) return null;

  const items: NavItem[] = [
    { to: '/admin', label: t('admin.nav.dashboard', { defaultValue: 'Dashboard' }), icon: LayoutDashboard },
    { to: '/admin/products', label: t('admin.nav.products', { defaultValue: 'Products' }), icon: Package },
    { to: '/admin/collections', label: t('admin.nav.collections', { defaultValue: 'Collections' }), icon: Layers },
    { to: '/admin/zodiac', label: t('admin.nav.zodiac', { defaultValue: 'Zodiac' }), icon: Star },
    { to: '/admin/quiz', label: t('admin.nav.quiz', { defaultValue: 'Quiz' }), icon: Sparkles },
    { to: '/admin/orders', label: t('admin.nav.orders', { defaultValue: 'Orders' }), icon: ShoppingBag },
    { to: '/admin/discounts', label: t('admin.nav.discounts', { defaultValue: 'Discounts' }), icon: Tag },
    { to: '/admin/settings', label: t('admin.nav.settings', { defaultValue: 'Site settings' }), icon: Settings },
    { to: '/admin/page-seo', label: t('admin.nav.pageSeo', { defaultValue: 'Page SEO' }), icon: Search },
    { to: '/admin/users', label: t('admin.nav.users', { defaultValue: 'Users' }), icon: Users, adminOnly: true },
  ].filter((item) => !item.adminOnly || user.isAdminRole);

  const signOutLabel = t('account.signOut', { defaultValue: 'Sign out' });

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={t('seo.pages.admin.title', { defaultValue: 'Admin | Gisheri' })}
        robots="noindex,nofollow"
      />

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-border bg-background/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="p-2 -ml-2 text-foreground/80 hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="text-lg font-serif font-medium">
          <span className="text-gradient-gold">Gish</span>
          <span className="text-foreground">eri</span>
          <span className="ml-2 text-[10px] text-muted-foreground uppercase tracking-wider">Admin</span>
        </span>
      </header>

      {/* Mobile drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
          </SheetHeader>
          <SidebarBody
            items={items}
            userEmail={user.email}
            userRole={user.role}
            onLogout={() => {
              setMobileNavOpen(false);
              logout();
            }}
            onItemClick={() => setMobileNavOpen(false)}
            signOutLabel={signOutLabel}
          />
        </SheetContent>
      </Sheet>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen border-r border-border bg-secondary/20">
          <SidebarBody
            items={items}
            userEmail={user.email}
            userRole={user.role}
            onLogout={logout}
            signOutLabel={signOutLabel}
          />
        </aside>
        <main className="min-w-0 px-4 py-6 md:px-8 md:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
