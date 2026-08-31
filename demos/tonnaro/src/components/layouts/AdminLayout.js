import React, { useEffect, useState } from 'react';
import { Dropdown, Avatar, Grid, Switch, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined, FileTextOutlined,
  TeamOutlined, AppstoreOutlined, UserOutlined, LogoutOutlined,
  CarOutlined, MoonFilled, SunFilled, BarChartOutlined,
  GlobalOutlined, DesktopOutlined, ExportOutlined, IdcardOutlined,
  SettingOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ToolOutlined,
  CalculatorOutlined, BankOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationsBell from '../common/NotificationsBell';
import { APP_BASE } from '../../demo/base';

const { useBreakpoint } = Grid;

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 68;
const SIDEBAR_COLLAPSED_KEY = 'adminSidebarCollapsed';

export default function AdminLayout() {
  const branding = useBranding();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, changeLang, SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();

  const isMobile = !screens.md;
  const { unreadCount } = useNotifications();

  // Sidebar collapsed state — persists across reloads so the user's choice
  // sticks. Reading from localStorage at init avoids a flash on mount.
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const ordersIcon = (
    <Badge
      count={unreadCount}
      size="small"
      overflowCount={99}
      offset={[6, -2]}
      styles={{ indicator: { boxShadow: '0 0 0 2px var(--bg-primary)' } }}
    >
      <FileTextOutlined />
    </Badge>
  );

  const MENU_ITEMS = [
    { key: '/admin', icon: <DashboardOutlined />, label: t('nav.overview') },
    { key: '/admin/orders', icon: ordersIcon, label: t('nav.orders') },
    { key: '/admin/users', icon: <TeamOutlined />, label: t('nav.users') },
    { key: '/admin/vehicles', icon: <CarOutlined />, label: t('nav.vehicles') },
    { key: '/admin/drivers', icon: <IdcardOutlined />, label: t('nav.drivers') },
    { key: '/admin/car-owners', icon: <BankOutlined />, label: t('nav.carOwners') },
    { key: '/admin/analytics', icon: <BarChartOutlined />, label: t('nav.analytics') },
    { key: '/admin/categories', icon: <AppstoreOutlined />, label: t('nav.categories') },
    { key: '/admin/services', icon: <ToolOutlined />, label: t('nav.services') },
    { key: '/admin/pricing', icon: <CalculatorOutlined />, label: t('nav.pricing') },
    { key: '/admin/landing', icon: <DesktopOutlined />, label: t('nav.landing') },
    { key: '/admin/settings', icon: <SettingOutlined />, label: t('nav.settings') },
  ];

  const selectedKey = MENU_ITEMS.find((item) =>
    location.pathname === item.key || (item.key !== '/admin' && location.pathname.startsWith(item.key))
  )?.key || '/admin';

  const [dropdownOpen, setDropdownOpen] = useState(false);

  const userMenuItems = [
    {
      key: 'lang',
      icon: <GlobalOutlined />,
      label: t('profile.language'),
      children: SUPPORTED_LANGS.map((code) => ({
        key: `lang-${code}`,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{LANG_FLAGS[code]}</span>
            <span>{LANG_LABELS[code]}</span>
            {lang === code && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
          </span>
        ),
        onClick: () => changeLang(code),
      })),
    },
    {
      key: 'theme',
      icon: isDark ? <SunFilled /> : <MoonFilled />,
      label: (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minWidth: 140 }}>
          {isDark ? t('theme.lightMode') : t('theme.darkMode')}
          <Switch
            size="small"
            checked={isDark}
            checkedChildren={<MoonFilled />}
            unCheckedChildren={<SunFilled />}
          />
        </span>
      ),
      onClick: () => { toggleTheme(); },
    },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: t('auth.logout'), danger: true, onClick: () => { logout(); navigate('/'); } },
  ];

  const renderLogoIcon = () => {
    // Collapsed-sidebar variant — same dark/light pick as the full logo.
    const iconUrl = (isDark && branding.siteIconDarkUrl) || branding.siteIconUrl;
    return (
      <div
        onClick={() => navigate('/admin')}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {iconUrl ? (
          <img src={iconUrl} alt="Logo" style={{
            height: 34, width: 'auto', maxWidth: 56,
            borderRadius: 6, objectFit: 'contain',
          }} />
        ) : (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--fab-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 800,
          }}>
            TN
          </div>
        )}
      </div>
    );
  };

  const renderLogo = () => {
    const mode = branding.headerDisplay || 'both';
    // Dark-mode logo wins when set in dark mode; otherwise the light logo
    // covers both themes.
    const iconUrl = (isDark && branding.siteIconDarkUrl) || branding.siteIconUrl;
    const hasIcon = !!iconUrl;
    const showLogo = mode !== 'name_only' && hasIcon;
    const showPlaceholder = mode === 'both' && !hasIcon;
    const showName = mode !== 'logo_only' || !hasIcon;
    return (
      <div
        onClick={() => navigate('/admin')}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          cursor: 'pointer', flexShrink: 0,
          minWidth: 0,
        }}
      >
        {showLogo && (
          <img src={iconUrl} alt="Logo" style={{
            height: 34, width: 'auto', maxWidth: 160,
            borderRadius: 6, objectFit: 'contain', flexShrink: 0,
          }} />
        )}
        {showPlaceholder && (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'var(--fab-gradient)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0,
          }}>TN</div>
        )}
        {showName && (
          <span style={{
            fontWeight: 700, fontSize: 16, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {branding.siteName || t('common.admin')}
          </span>
        )}
      </div>
    );
  };

  const renderTopBarRight = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <NotificationsBell variant="admin" />
      <div
        onClick={() => window.open(`${APP_BASE}/`, '_blank')}
        title={t('adminLanding.goToWebsite')}
        style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 10,
          color: 'var(--text-secondary)', fontSize: 16,
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <ExportOutlined />
      </div>
      <Dropdown
        menu={{
          items: userMenuItems,
          onClick: ({ key }) => {
            if (key !== 'theme' && !key.startsWith('lang')) setDropdownOpen(false);
          },
        }}
        open={dropdownOpen}
        onOpenChange={setDropdownOpen}
        placement="bottomRight"
        trigger={['click']}
      >
        <div style={{
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 10,
          transition: 'background 0.15s',
          background: dropdownOpen ? 'var(--surface-hover)' : 'transparent',
        }}>
          <Avatar size={32} style={{
            background: 'var(--fab-gradient)',
            fontSize: 13, fontWeight: 600,
          }}>
            {(user?.first_name?.[0] || '?').toUpperCase()}
          </Avatar>
          {!isMobile && (
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
              {user?.first_name}
            </span>
          )}
        </div>
      </Dropdown>
    </div>
  );

  // ─── MOBILE LAYOUT ───
  // Mobile keeps the top logo bar + horizontally-scrollable bottom tab bar.
  // The bottom bar is the only mobile nav surface (no drawer or sidebar).
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px', height: 60,
          }}>
            {renderLogo()}
            {renderTopBarRight()}
          </div>
        </div>

        <div style={{
          padding: 16,
          minHeight: 'calc(100vh - 60px - 60px)',
          paddingBottom: 80,
        }}>
          <Outlet />
        </div>

        <div
          className="admin-mobile-tabbar"
          style={{
            position: 'fixed',
            bottom: 0, left: 0, right: 0,
            background: 'var(--tab-bar-bg)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderTop: '1px solid var(--tab-bar-border)',
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            alignItems: 'center',
            height: 62,
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            zIndex: 100,
            boxShadow: 'var(--tab-bar-shadow)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {MENU_ITEMS.map((item) => {
            const isActive = selectedKey === item.key;
            return (
              <div
                key={item.key}
                onClick={() => navigate(item.key)}
                style={{
                  flex: '0 0 auto',
                  minWidth: 72,
                  maxWidth: 96,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: '8px 6px',
                  cursor: 'pointer',
                  color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
                  fontSize: 19,
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'color 0.2s ease',
                }}
              >
                {item.icon}
                <span style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  textAlign: 'center',
                  lineHeight: 1.2,
                  width: '100%',
                  padding: '0 2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  // Fixed left sidebar carries the nav vertically — long Georgian/Russian
  // labels ("მომხმარებლები", "Пользователи") fit naturally because vertical
  // space is unbounded. Sidebar collapses to icon-only on demand; preference
  // persists in localStorage.
  // `--admin-sidebar-width` is exposed so descendant pages can position
  // fixed bottom bars to the right of the sidebar (mobile branch leaves it
  // unset so the variable falls back to 0).
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-secondary)',
      '--admin-sidebar-width': `${sidebarWidth}px`,
    }}>
      <aside style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: sidebarWidth,
        background: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'width 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{
          height: 60,
          display: 'flex', alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 18px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
          overflow: 'hidden',
        }}>
          {collapsed ? renderLogoIcon() : renderLogo()}
        </div>

        <nav style={{
          flex: 1,
          padding: collapsed ? '14px 10px' : '14px 12px',
          display: 'flex', flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {MENU_ITEMS.map((item) => {
            const isActive = selectedKey === item.key;
            const node = (
              <div
                onClick={() => navigate(item.key)}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : 12,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '10px 0' : '10px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--nav-active-bg)' : 'transparent',
                  transition: 'background 0.15s ease, color 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{
                  fontSize: 17, opacity: isActive ? 1 : 0.78,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, flexShrink: 0,
                }}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span style={{
                    flex: 1, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </span>
                )}
              </div>
            );
            return collapsed ? (
              <Tooltip key={item.key} title={item.label} placement="right">
                {node}
              </Tooltip>
            ) : (
              <React.Fragment key={item.key}>{node}</React.Fragment>
            );
          })}
        </nav>

        {/* Collapse toggle pinned at the bottom — discoverable, doesn't
            move when nav scrolls, mirrors the pattern in Linear/Notion. */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          padding: collapsed ? '10px' : '10px 12px',
          flexShrink: 0,
        }}>
          <Tooltip
            title={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
            placement="right"
          >
            <div
              onClick={toggleCollapsed}
              role="button"
              aria-label={collapsed ? t('common.expandSidebar') : t('common.collapseSidebar')}
              style={{
                display: 'flex', alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 12,
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-tertiary)';
              }}
            >
              <span style={{
                fontSize: 16,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 20, flexShrink: 0,
              }}>
                {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              </span>
              {!collapsed && (
                <span style={{
                  flex: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {t('common.collapseSidebar')}
                </span>
              )}
            </div>
          </Tooltip>
        </div>
      </aside>

      <div style={{
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
      }}>
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '0 28px', height: 60,
          }}>
            {renderTopBarRight()}
          </div>
        </div>

        <div style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: 28,
          minHeight: 'calc(100vh - 60px)',
        }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
