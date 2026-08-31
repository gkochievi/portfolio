import React, { useState } from 'react';
import { Grid, Dropdown, Avatar, Switch, Select, Badge } from 'antd';
import {
  HomeOutlined, HomeFilled,
  FileTextOutlined, FileTextFilled,
  UserOutlined,
  PlusOutlined,
  LogoutOutlined,
  MoonFilled, SunFilled,
  GlobalOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import ContactFab from '../common/ContactFab';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationsBell from '../common/NotificationsBell';

const { useBreakpoint } = Grid;

export default function AppLayout() {
  const branding = useBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, changeLang, SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS } = useLang();
  const { unreadCount } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const ordersBadge = unreadCount || 0;

  const TAB_ITEMS = [
    { key: '/app', icon: <HomeOutlined />, activeIcon: <HomeFilled />, label: t('nav.home') },
    {
      key: '/app/orders',
      icon: <FileTextOutlined />,
      activeIcon: <FileTextFilled />,
      label: t('nav.orders'),
      badge: ordersBadge,
    },
    { key: '/app/profile', icon: <UserOutlined />, activeIcon: <UserOutlined />, label: t('nav.profile') },
  ];

  const NAV_ITEMS = [
    { key: '/app', icon: <HomeOutlined />, label: t('nav.home') },
    {
      key: '/app/orders',
      icon: (
        <Badge count={ordersBadge} size="small" overflowCount={99} offset={[6, -2]}>
          <FileTextOutlined />
        </Badge>
      ),
      label: t('nav.orders'),
    },
  ];

  const activeTab = TAB_ITEMS.find((item) =>
    item.key !== '/app'
      ? location.pathname.startsWith(item.key)
      : location.pathname === '/app'
  )?.key || '/app';

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: t('nav.profile'),
      onClick: () => { navigate('/app/profile'); setDropdownOpen(false); },
    },
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
            {lang === code && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>&#10003;</span>}
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
      onClick: () => toggleTheme(),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('auth.logout'),
      danger: true,
      onClick: () => { logout(); navigate('/'); setDropdownOpen(false); },
    },
  ];

  // ─── MOBILE LAYOUT ───
  if (isMobile) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: 90,
          WebkitOverflowScrolling: 'touch',
        }}>
          <Outlet />
        </div>

        {/* Bottom tab bar */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 12px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 100,
        }}>
          <div style={{
            background: 'var(--tab-bar-bg)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            borderRadius: '20px 20px 0 0',
            border: '1px solid var(--tab-bar-border)',
            borderBottom: 'none',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'stretch',
            boxShadow: 'var(--tab-bar-shadow)',
          }}>
            <TabItem
              item={TAB_ITEMS[0]}
              isActive={activeTab === TAB_ITEMS[0].key}
              onClick={() => navigate(TAB_ITEMS[0].key)}
            />
            <TabItem
              item={TAB_ITEMS[1]}
              isActive={activeTab === TAB_ITEMS[1].key}
              onClick={() => navigate(TAB_ITEMS[1].key)}
            />

            {/* Center FAB */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 0',
            }}>
              <div
                onClick={() => navigate('/app/order/new')}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  background: 'var(--fab-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 20,
                  boxShadow: 'var(--fab-shadow)',
                  cursor: 'pointer',
                  transition: 'transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease',
                }}
              >
                <PlusOutlined />
              </div>
            </div>

            <TabItem
              item={TAB_ITEMS[2]}
              isActive={activeTab === TAB_ITEMS[2].key}
              onClick={() => navigate(TAB_ITEMS[2].key)}
            />

            <div style={{ flex: 1 }} />
          </div>
        </div>

        <ContactFab />
      </div>
    );
  }

  // ─── DESKTOP LAYOUT ───
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Top navigation bar */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 60,
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          {/* Logo — clicking takes the customer back to the landing page */}
          <div
            onClick={() => navigate('/')}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {(() => {
              const mode = branding.headerDisplay || 'both';
              const iconUrl = (isDark && branding.siteIconDarkUrl) || branding.siteIconUrl;
              const hasIcon = !!iconUrl;
              const showLogo = mode !== 'name_only' && hasIcon;
              const showPlaceholder = mode === 'both' && !hasIcon;
              const showName = mode !== 'logo_only' || !hasIcon;
              return (
                <>
                  {showLogo && (
                    <img src={iconUrl} alt="Logo" style={{
                      height: 48, width: 'auto', maxWidth: 200,
                      borderRadius: 8, objectFit: 'contain',
                    }} />
                  )}
                  {showPlaceholder && (
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: 'var(--fab-gradient)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 16, fontWeight: 800,
                    }}>TN</div>
                  )}
                  {showName && (
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
                      {branding.siteName || t('common.appName')}
                    </span>
                  )}
                </>
              );
            })()}
          </div>

          {/* Desktop horizontal nav */}
          <nav style={{
            display: 'flex', alignItems: 'center', gap: 2,
            marginLeft: 28,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
          }}>
            {NAV_ITEMS.map((item) => {
              const isActive = item.key === '/app'
                ? location.pathname === '/app'
                : location.pathname.startsWith(item.key);
              return (
                <div
                  key={item.key}
                  onClick={() => navigate(item.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--nav-active-bg)' : 'transparent',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 16, opacity: isActive ? 1 : 0.78 }}>{item.icon}</span>
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 160,
                  }}>{item.label}</span>
                </div>
              );
            })}
          </nav>

          {/* New Order button */}
          <div
            onClick={() => navigate('/app/order/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 20px',
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: 'var(--fab-gradient)',
              boxShadow: 'var(--fab-shadow)',
              transition: 'all 0.2s ease',
              marginRight: 16,
              flexShrink: 0,
              maxWidth: 200,
            }}
          >
            <PlusOutlined style={{ fontSize: 13, flexShrink: 0 }} />
            <span style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {t('orders.newOrder')}
            </span>
          </div>

          {/* Notifications bell */}
          <div style={{ marginRight: 4 }}>
            <NotificationsBell variant="customer" />
          </div>

          {/* User dropdown */}
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
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {user?.first_name}
              </span>
            </div>
          </Dropdown>
        </div>
      </div>

      {/* Main content */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        minHeight: 'calc(100vh - 60px)',
      }}>
        <Outlet />
      </div>

      <ContactFab />
    </div>
  );
}

function TabItem({ item, isActive, onClick }) {
  const iconNode = isActive ? item.activeIcon : item.icon;
  const wrappedIcon = item.badge > 0 ? (
    <Badge count={item.badge} size="small" overflowCount={99} offset={[4, -2]}>
      {iconNode}
    </Badge>
  ) : iconNode;

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '12px 0 10px',
        cursor: 'pointer',
        color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
        fontSize: 20,
        transition: 'color 0.2s ease',
        position: 'relative',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 24,
          height: 3,
          borderRadius: '0 0 4px 4px',
          background: 'var(--accent)',
          transition: 'width 0.2s ease',
        }} />
      )}
      <span style={{
        transition: 'transform 0.2s ease',
        transform: isActive ? 'scale(1.1)' : 'scale(1)',
      }}>
        {wrappedIcon}
      </span>
      <span style={{
        fontSize: 10,
        fontWeight: isActive ? 600 : 400,
        letterSpacing: 0.2,
        maxWidth: '100%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 4px',
      }}>
        {item.label}
      </span>
    </div>
  );
}
