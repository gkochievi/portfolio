import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Grid, Tooltip, message } from 'antd';
import {
  CloseOutlined, ReloadOutlined, UpOutlined, ArrowRightOutlined,
  UserOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';

import { useLang } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { resetStore } from '../../demo/store';
import { DEMO_ADMIN, DEMO_CUSTOMER } from '../../demo/accounts';
import { PORTFOLIO_URL } from '../../demo/base';

/**
 * The only piece of chrome that is not part of the product.
 *
 * It exists to answer three questions a visitor has in their first five
 * seconds — what is this, how do I get in, and can I break it — because the
 * alternative is a beautiful ordering platform whose admin console is behind a
 * login form with credentials nobody can guess.
 *
 * Anchored bottom-left: `ContactFab` owns bottom-right in this app, and the
 * customer surface has a fixed tab bar along the bottom on phones, so the
 * banner lifts clear of it. It sits above page content but below Ant Design's
 * modals and the two full-screen map pickers (z-index 1899 and 1999), so it
 * can never trap a visitor inside a dialog. Left open on a phone it would
 * cover the last row of every list, so below `md` it starts as the badge alone
 * and expands on tap. Dismissible, for anyone who wants the product on its own.
 */
export default function DemoBanner() {
  const { t } = useLang();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const screens = Grid.useBreakpoint();

  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(null);

  if (dismissed) return null;

  const isDesktop = !!screens.md;
  const open = isDesktop || expanded;

  const viewAs = async (account) => {
    setBusy(account.email);
    try {
      // Signing in through the real AuthContext rather than writing a token
      // directly: the demo should exercise the same login path a visitor would.
      if (user) await logout();
      await login(account.email, account.password);
      navigate(account.home);
    } catch {
      message.error(t('demo.switchFailed'));
    } finally {
      setBusy(null);
    }
  };

  // The store lives in memory, so a reload already restores the pristine seed.
  // Calling resetStore() first frees the object URLs minted for uploaded
  // images, which a reload alone would leak until the tab closed.
  const reset = () => {
    resetStore();
    window.location.reload();
  };

  const pill = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '3px 9px', borderRadius: 999,
    background: 'var(--accent-bg-strong)', color: 'var(--accent-dark)',
    fontSize: 11, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  };

  const button = {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 28, padding: '0 10px', borderRadius: 8,
    border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <aside
      aria-label={t('demo.badge')}
      style={{
        position: 'fixed',
        left: 12,
        // Clear of the customer app's fixed tab bar on phones.
        bottom: isDesktop ? 16 : 'calc(env(safe-area-inset-bottom, 0px) + 74px)',
        zIndex: 300,
        maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap',
        gap: 10, padding: '8px 10px',
        borderRadius: 12, border: '1px solid var(--border-color)',
        background: 'var(--glass-bg)', backdropFilter: 'blur(12px)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {isDesktop ? (
          <span style={pill}>{t('demo.badge')}</span>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            style={{ ...pill, border: 'none', cursor: 'pointer' }}
          >
            {t('demo.badge')}
            <UpOutlined style={{
              fontSize: 9,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </button>
        )}

        {open && (
          <>
            <p style={{
              margin: 0, maxWidth: 260, fontSize: 12, lineHeight: 1.45,
              color: 'var(--text-secondary)',
            }}>
              {t('demo.body')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                style={button}
                disabled={!!busy}
                onClick={() => viewAs(DEMO_CUSTOMER)}
              >
                <UserOutlined style={{ fontSize: 11 }} />
                {t('demo.asCustomer')}
              </button>

              <button
                type="button"
                style={button}
                disabled={!!busy}
                onClick={() => viewAs(DEMO_ADMIN)}
              >
                <SafetyCertificateOutlined style={{ fontSize: 11 }} />
                {t('demo.asAdmin')}
              </button>

              <Tooltip title={t('demo.resetHint')}>
                <button type="button" style={button} onClick={reset}>
                  <ReloadOutlined style={{ fontSize: 11 }} />
                  {t('demo.reset')}
                </button>
              </Tooltip>

              <a
                href={PORTFOLIO_URL}
                style={{ ...button, textDecoration: 'none' }}
              >
                {t('demo.portfolio')}
                <ArrowRightOutlined style={{ fontSize: 10 }} />
              </a>

              <button
                type="button"
                aria-label={t('demo.dismiss')}
                style={{ ...button, padding: '0 7px' }}
                onClick={() => setDismissed(true)}
              >
                <CloseOutlined style={{ fontSize: 10 }} />
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
