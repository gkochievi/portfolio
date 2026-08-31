import React, { useState } from 'react';
import { Layout, Button, Space, Grid, Dropdown, Switch } from 'antd';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { ArrowRightOutlined, GlobalOutlined, MoonFilled, SunFilled } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import ContactFab from '../common/ContactFab';

const { Content, Footer } = Layout;
const { useBreakpoint } = Grid;

export default function PublicLayout() {
  const branding = useBranding();
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, changeLang, SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS } = useLang();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [langOpen, setLangOpen] = useState(false);

  const langMenuItems = SUPPORTED_LANGS.map((code) => ({
    key: code,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{LANG_FLAGS[code]}</span>
        <span>{LANG_LABELS[code]}</span>
        {lang === code && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
      </span>
    ),
    onClick: () => changeLang(code),
  }));

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Modern floating header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: isMobile ? '8px 12px' : '10px 24px',
        paddingTop: isMobile ? 'calc(8px + env(safe-area-inset-top, 0px))' : '10px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isMobile ? '10px 16px' : '12px 24px',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderRadius: 16,
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <Link to="/" style={{
            fontSize: isMobile ? 17 : 19, fontWeight: 800, color: 'var(--accent)',
            textDecoration: 'none', letterSpacing: -0.5,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {/* Header display mode: admin chooses between logo, name, or both.
                "logo_only" with no uploaded logo falls back to the name so the
                header is never empty. Dark-mode logo wins when set, else
                light logo serves both themes. */}
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
                      height: isMobile ? 36 : 64, width: 'auto',
                      // Long Tonnaro logos (especially the wide one with
                      // "LOGISTICS" wordmark) used to crowd the mobile header
                      // and push the Register button out of the rounded card.
                      maxWidth: isMobile ? 100 : 300,
                      borderRadius: 8, objectFit: 'contain',
                    }} />
                  )}
                  {showPlaceholder && (
                    <div style={{
                      width: isMobile ? 36 : 64, height: isMobile ? 36 : 64, borderRadius: 10,
                      background: 'var(--fab-gradient)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: isMobile ? 14 : 19, fontWeight: 800,
                    }}>DG</div>
                  )}
                  {showName && !isMobile && (branding.siteName || t('common.appName'))}
                </>
              );
            })()}
          </Link>

          <Space size={isMobile ? 4 : 8}>
            {/* Language selector */}
            <Dropdown
              menu={{ items: langMenuItems }}
              open={langOpen}
              onOpenChange={setLangOpen}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="small"
                style={{
                  borderRadius: 10,
                  height: isMobile ? 32 : 36,
                  minWidth: isMobile ? 32 : 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: isMobile ? '0 6px' : '0 11px',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--surface-hover)',
                }}
              >
                <span style={{ fontSize: 16 }}>{LANG_FLAGS[lang]}</span>
                {!isMobile && <span style={{ fontSize: 12, fontWeight: 500 }}>{lang.toUpperCase()}</span>}
              </Button>
            </Dropdown>

            {/* Dark/Light mode toggle */}
            <Button
              type="text"
              size="small"
              onClick={toggleTheme}
              style={{
                borderRadius: 10,
                height: isMobile ? 32 : 36,
                width: isMobile ? 32 : 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                background: 'var(--surface-hover)',
                fontSize: 15,
              }}
            >
              {isDark ? <SunFilled /> : <MoonFilled />}
            </Button>

            {/* Auth buttons.
              * Mobile: drop the bare "Login" text button (it doesn't fit when
              * the language is Georgian — "შესვლა" plus "რეგისტრაცია" plus
              * logo + lang + theme already exceeds 390px). The Register
              * button covers the primary new-user CTA; existing users
              * scroll down the landing page and use the "Login" link in the
              * footer hero CTA section. On md+ we still show both. */}
            {user ? (
              <Button type="primary" onClick={() => navigate(user.role === 'admin' ? '/admin' : '/app')}
                icon={<ArrowRightOutlined />} iconPosition="end"
                style={{
                  borderRadius: 10, fontWeight: 600,
                  height: isMobile ? 32 : 38,
                  fontSize: isMobile ? 13 : 14,
                  padding: isMobile ? '0 12px' : '0 15px',
                }}>
                {user.role === 'admin' ? t('nav.dashboard') : t('nav.myAccount')}
              </Button>
            ) : (
              <>
                {!isMobile && (
                  <Button onClick={() => navigate('/login')}
                    style={{ borderRadius: 10, fontWeight: 500, height: 38, border: 'none', background: 'var(--surface-hover)' }}>
                    {t('auth.login')}
                  </Button>
                )}
                {isMobile && (
                  <Button
                    type="text"
                    onClick={() => navigate('/login')}
                    style={{
                      borderRadius: 10, fontWeight: 500,
                      height: 32, padding: '0 8px',
                      fontSize: 13, color: 'var(--text-primary)',
                    }}
                  >
                    {t('auth.login')}
                  </Button>
                )}
                <Button type="primary" onClick={() => navigate('/register')}
                  style={{
                    borderRadius: 10, fontWeight: 600,
                    height: isMobile ? 32 : 38,
                    fontSize: isMobile ? 13 : 14,
                    padding: isMobile ? '0 12px' : '0 15px',
                  }}>
                  {t('auth.register')}
                </Button>
              </>
            )}
          </Space>
        </div>
      </div>

      <Content>
        <Outlet />
      </Content>

      <Footer style={{
        textAlign: 'center', color: 'var(--text-tertiary)',
        padding: isMobile ? '16px' : '24px 50px',
        background: 'transparent', fontSize: 13,
      }}>
        {(() => {
          // Admin-controlled multilingual footer text takes precedence;
          // fall back to the localized brand string + dynamic year so a
          // blank footer_text keeps the historical rendering.
          const ft = branding?.footerText || {};
          const custom = ft[lang] || ft.en || ft.ka || ft.ru || '';
          if (custom) return custom;
          return `${t('footer.copyright')} © ${new Date().getFullYear()}`;
        })()}
      </Footer>

      <ContactFab />
    </Layout>
  );
}
