import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Bell,
  CalendarCheck,
  CalendarOff,
  CalendarPlus,
  ClipboardList,
  Home,
  Image,
  LayoutGrid,
  Megaphone,
  Scissors,
  Settings,
  Star,
  UserCog,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useMe } from '@/auth/hooks';
import { cn } from '@/lib/cn';
import type { ComponentType } from 'react';

interface SidebarItem {
  to: string;
  /** Key under admin.page.* */
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}

interface SidebarGroup {
  /** Key under admin.nav.* */
  labelKey: string;
  items: SidebarItem[];
}

const GROUPS: SidebarGroup[] = [
  {
    labelKey: 'overview',
    items: [
      { to: '/', labelKey: 'dashboard', icon: Home },
      { to: '/analytics', labelKey: 'analytics', icon: BarChart3 },
    ],
  },
  {
    labelKey: 'bookings_section',
    items: [
      { to: '/bookings', labelKey: 'bookings', icon: CalendarCheck },
      { to: '/walk-in', labelKey: 'walk_in', icon: CalendarPlus },
      { to: '/time-off', labelKey: 'time_off', icon: CalendarOff },
      { to: '/customers', labelKey: 'customers', icon: Users },
    ],
  },
  {
    labelKey: 'catalogue',
    items: [
      { to: '/services', labelKey: 'services', icon: Scissors },
      { to: '/barbers', labelKey: 'barbers', icon: Users },
      { to: '/promotions', labelKey: 'promotions', icon: Megaphone },
    ],
  },
  {
    labelKey: 'site',
    items: [
      { to: '/landing', labelKey: 'landing', icon: Image },
      { to: '/reviews', labelKey: 'reviews', icon: Star },
      { to: '/settings', labelKey: 'settings', icon: Settings },
      { to: '/notifications', labelKey: 'notifications', icon: Bell },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { to: '/users', labelKey: 'users', icon: UserCog },
      { to: '/audit', labelKey: 'audit', icon: ClipboardList },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed }: Props) {
  const { t } = useTranslation('admin');
  const { data: user } = useMe();
  if (!user) return null;

  return (
    <aside
      className={cn(
        'sticky top-0 h-screen flex flex-col bg-surface border-r border-line transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'h-16 flex items-center border-b border-line shrink-0',
          collapsed ? 'justify-center' : 'px-5',
        )}
      >
        <Logo size="sm" iconOnly={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {GROUPS.map((group) => (
          <div key={group.labelKey} className="mb-5">
            {!collapsed && (
              <div className="px-5 mb-1.5 text-[10px] uppercase tracking-[0.15em] font-semibold text-ink-muted">
                {t(`nav.${group.labelKey}`)}
              </div>
            )}
            <ul className="flex flex-col gap-0.5 px-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const label = t(`page.${item.labelKey}`);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-md transition-colors text-[14px]',
                          collapsed ? 'justify-center h-10 w-12 mx-auto' : 'px-3 py-2',
                          isActive
                            ? 'bg-ink text-bg'
                            : 'text-ink-muted hover:bg-line/50 hover:text-ink',
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-line py-3 shrink-0', collapsed ? 'px-2' : 'px-3')}>
        <NavLink
          to="/profile"
          title={collapsed ? t('page.profile') : undefined}
          aria-label={t('page.profile')}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 text-sm rounded-md transition-colors',
              collapsed ? 'justify-center h-10 w-12 mx-auto' : 'px-2 py-1.5',
              isActive ? 'bg-line/60' : 'hover:bg-line/50',
            )
          }
        >
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-pill bg-accent text-bg font-medium shrink-0"
            aria-hidden
          >
            {user.first_name?.[0]?.toUpperCase() ?? '?'}
          </span>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-ink truncate">{user.first_name}</span>
              <span className="text-xs text-ink-muted capitalize">
                <LayoutGrid className="inline h-2.5 w-2.5 mr-1 -mt-0.5" />
                {user.role}
              </span>
            </div>
          )}
        </NavLink>
      </div>
    </aside>
  );
}
