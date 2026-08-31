import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Checkbox } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import DOMPurify from 'dompurify';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';

/**
 * Scroll-gated Terms & Conditions acceptance.
 * - Fetches terms HTML for the active language from /site-settings/terms/.
 * - If no terms are configured, renders nothing and reports accepted=true
 *   (so the parent's submit isn't blocked).
 * - Otherwise shows a scrollable box; the agree checkbox stays disabled until
 *   the user scrolls to the bottom (or the content is short enough not to scroll).
 *
 * Props: value (bool), onChange(bool)
 */
export default function TermsGate({ value, onChange }) {
  const { t, lang } = useLang();
  const [terms, setTerms] = useState(null); // {en,ka,ru} | null while loading
  const [reachedBottom, setReachedBottom] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    api.get('/site-settings/terms/')
      .then(({ data }) => setTerms(data || { en: '', ka: '', ru: '' }))
      .catch(() => setTerms({ en: '', ka: '', ru: '' }));
  }, []);

  const html = terms ? (terms[lang] || terms.en || '') : '';
  const required = Boolean((html || '').trim());

  // When terms aren't required, report accepted once so the parent unblocks.
  useEffect(() => {
    if (terms !== null && !required && value !== true) {
      onChange?.(true);
    }
  }, [terms, required, value, onChange]);

  // Enable immediately if the content fits without scrolling.
  const checkFits = useCallback(() => {
    const el = boxRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 4) setReachedBottom(true);
  }, []);

  useEffect(() => {
    if (required) checkFits();
  }, [required, html, checkFits]);

  if (terms === null || !required) return null;

  const sanitized = DOMPurify.sanitize(html);

  const onScroll = (e) => {
    const el = e.target;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
      setReachedBottom(true);
    }
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
        {t('auth.termsTitle')}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
        {t('auth.termsReadHint')}
      </div>
      <div
        ref={boxRef}
        onScroll={onScroll}
        style={{
          maxHeight: 220, overflowY: 'auto',
          border: '1px solid var(--input-border)', borderRadius: 12,
          padding: '12px 14px', background: 'var(--input-bg)',
          fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
        }}
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
      {!reachedBottom && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', marginTop: 6,
        }}>
          <DownOutlined style={{ fontSize: 12 }} />
          {t('auth.termsScrollHint')}
        </div>
      )}
      <Checkbox
        checked={value === true}
        disabled={!reachedBottom}
        onChange={(e) => onChange?.(e.target.checked)}
        style={{ marginTop: 10, fontSize: 13 }}
      >
        {t('auth.agreeTerms')}
      </Checkbox>
    </div>
  );
}
