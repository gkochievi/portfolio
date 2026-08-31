import React, { useEffect, useRef, useState } from 'react';
import { Grid } from 'antd';
import { PhoneFilled, MessageOutlined, MailFilled, CloseOutlined } from '@ant-design/icons';
import { useBranding } from '../../contexts/BrandingContext';
import { useLang } from '../../contexts/LanguageContext';

/**
 * Floating contact bubble shown on public + customer-side pages.
 * Tap the bubble → it expands into up to three actions:
 *   - Call (tel:<contact_phone>)
 *   - WhatsApp (https://wa.me/<digits_of_whatsapp_number>)
 *   - Email (mailto:<contact_email>)
 *
 * Auto-hides when all three are blank — admin controls visibility
 * entirely by filling in the Site Settings fields. Renders nothing on
 * admin routes (mount it from PublicLayout / AppLayout only).
 */
export default function ContactFab() {
  const { contactPhone, whatsappNumber, contactEmail } = useBranding();
  const { t } = useLang();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const hasCall = !!(contactPhone && contactPhone.trim());
  const hasWhatsApp = !!(whatsappNumber && whatsappNumber.trim());
  const hasEmail = !!(contactEmail && contactEmail.trim() && contactEmail.includes('@'));

  // Click-outside to collapse.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  if (!hasCall && !hasWhatsApp && !hasEmail) return null;

  // wa.me wants digits only — strip "+", spaces, dashes, parentheses.
  const waDigits = (whatsappNumber || '').replace(/[^0-9]/g, '');
  const callHref = hasCall ? `tel:${contactPhone.replace(/\s+/g, '')}` : null;
  const waHref = hasWhatsApp && waDigits ? `https://wa.me/${waDigits}` : null;
  const mailHref = hasEmail ? `mailto:${contactEmail.trim()}` : null;

  // Mobile lifts the FAB above the 62px bottom tab bar; desktop sits in
  // the lower-right corner with a comfortable inset.
  const bottomOffset = isMobile
    ? 'calc(76px + env(safe-area-inset-bottom, 0px))'
    : 'calc(28px + env(safe-area-inset-bottom, 0px))';

  const actionStyle = {
    width: 52, height: 52, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', textDecoration: 'none', fontSize: 20,
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
    transition: 'transform 160ms ease, opacity 160ms ease',
    transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.7)',
    opacity: open ? 1 : 0,
    pointerEvents: open ? 'auto' : 'none',
  };

  return (
    <div ref={rootRef} style={{
      position: 'fixed', right: isMobile ? 16 : 28, bottom: bottomOffset,
      zIndex: 200, display: 'flex', flexDirection: 'column',
      alignItems: 'flex-end', gap: 12,
    }}>
      {hasEmail && mailHref && (
        <a
          href={mailHref}
          aria-label={t('contact.email')}
          title={t('contact.email')}
          style={{
            ...actionStyle,
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
          }}
        >
          <MailFilled />
        </a>
      )}
      {hasWhatsApp && waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('contact.whatsapp')}
          title={t('contact.whatsapp')}
          style={{
            ...actionStyle,
            background: '#25D366',
            transitionDelay: open ? '40ms' : '0ms',
          }}
        >
          <MessageOutlined />
        </a>
      )}
      {hasCall && callHref && (
        <a
          href={callHref}
          aria-label={t('contact.call')}
          title={t('contact.call')}
          style={{
            ...actionStyle,
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            transitionDelay: open ? '80ms' : '0ms',
          }}
        >
          <PhoneFilled />
        </a>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('contact.close') : t('contact.title')}
        aria-expanded={open}
        title={open ? t('contact.close') : t('contact.title')}
        style={{
          width: 60, height: 60, borderRadius: '50%',
          border: 'none', cursor: 'pointer',
          // Fixed dark slate when open so the white X stays readable in
          // both light and dark themes. Using `var(--text-primary)` made
          // the bubble white-on-white in dark mode (text-primary inverts).
          background: open
            ? '#1f2937'
            : 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover, var(--accent)) 100%)',
          color: '#fff', fontSize: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: open
            ? '0 8px 24px rgba(0, 0, 0, 0.22)'
            : '0 10px 28px rgba(0, 184, 86, 0.42)',
          transform: open ? 'rotate(0deg)' : 'rotate(0deg)',
          transition: 'background 200ms ease, box-shadow 200ms ease',
        }}
      >
        {open ? <CloseOutlined /> : <MessageOutlined />}
      </button>
    </div>
  );
}
