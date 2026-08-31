import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { MailOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

const { Text } = Typography;

const RESEND_COOLDOWN = 30;

export default function VerifyEmailPage({ variant = 'desktop' }) {
  const { verifyEmail, resendVerification } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputs = useRef([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Cross-tab: if the user clicks the magic link in their email client, a
  // NEW tab opens at /verify-email/confirm and writes tokens to localStorage
  // on success. This effect listens for that write so the ORIGINAL tab
  // (the one stuck on the code-entry screen) auto-redirects instead of
  // leaving the user wondering why the code page is still showing.
  useEffect(() => {
    const checkAndRedirect = () => {
      const tokens = JSON.parse(localStorage.getItem('tokens') || 'null');
      const stored = JSON.parse(localStorage.getItem('user') || 'null');
      if (tokens?.access && stored && stored.email_verified) {
        navigate(stored.role === 'admin' ? '/admin' : '/app', { replace: true });
      }
    };
    // Initial check covers the rare case where the user came back to this
    // tab AFTER finishing the link flow on another tab.
    checkAndRedirect();
    const onStorage = (e) => {
      if (e.key === 'tokens' || e.key === 'user') checkAndRedirect();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [navigate]);

  const codeStr = useMemo(() => code.join(''), [code]);

  const onChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...code];
    next[i] = digit;
    setCode(next);
    if (digit && i < 5) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const onPaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setCode(next);
    inputs.current[Math.min(text.length, 5)]?.focus();
  };

  const onSubmit = async () => {
    if (codeStr.length !== 6) {
      message.error(t('auth.verifyCodePlaceholder'));
      return;
    }
    setLoading(true);
    try {
      const user = await verifyEmail({ email, code: codeStr });
      message.success(t('auth.verifySuccess'));
      navigate(user.role === 'admin' ? '/admin' : '/app');
    } catch (err) {
      const body = err.response?.data || {};
      const reason = body.code || 'invalid';
      const msg = ({
        invalid: t('auth.codeInvalid'),
        expired: t('auth.codeExpired'),
        locked:  t('auth.codeLocked'),
      })[reason] || body.detail || t('auth.codeInvalid');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    try {
      await resendVerification(email);
      setCooldown(RESEND_COOLDOWN);
      message.success(t('auth.verifyEmailSent'));
    } catch {
      message.error(t('auth.registrationFailed'));
    }
  };

  const isMobile = variant === 'mobile';

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: isMobile ? '100vh' : 'calc(100vh - 130px)',
      padding: 20,
      background: 'var(--bg-secondary)',
    }}>
      <Card style={{
        width: '100%', maxWidth: 460,
        borderRadius: 20, border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        background: 'var(--card-bg)',
      }} bodyStyle={{ padding: 0 }}>
        <div style={{ height: 4, background: 'var(--fab-gradient)' }} />
        <div style={{ padding: '32px 28px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <SafetyCertificateOutlined style={{ fontSize: 24, color: 'var(--accent)' }} />
          </div>
          <h2 style={{
            textAlign: 'center', fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)', margin: '0 0 8px',
          }}>{t('auth.verifyEmailTitle')}</h2>
          <p style={{
            textAlign: 'center', fontSize: 14,
            color: 'var(--text-secondary)', margin: '0 0 24px',
          }}>
            {t('auth.verifyEmailSubtitle', { email })}
          </p>

          <div onPaste={onPaste} style={{
            display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20,
          }}>
            {code.map((d, i) => (
              <Input
                key={i}
                ref={(el) => (inputs.current[i] = el)}
                value={d}
                maxLength={1}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                inputMode="numeric"
                style={{
                  width: 44, height: 56, textAlign: 'center',
                  fontSize: 22, fontWeight: 700, borderRadius: 12,
                  background: 'var(--input-bg)',
                  border: '1.5px solid var(--input-border)',
                }}
              />
            ))}
          </div>

          <Button
            type="primary" block loading={loading}
            onClick={onSubmit}
            style={{
              height: 48, borderRadius: 12, fontWeight: 700,
              background: 'var(--fab-gradient)', border: 'none',
            }}
          >
            {t('auth.verifyButton')}
          </Button>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            {cooldown > 0 ? (
              <Text style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                {t('auth.resendCooldown', { seconds: cooldown })}
              </Text>
            ) : (
              <span
                onClick={onResend}
                style={{
                  color: 'var(--accent)', fontSize: 14,
                  fontWeight: 600, cursor: 'pointer',
                }}
              >
                {t('auth.resendCode')}
              </span>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <Link to={isMobile ? '/app/login' : '/login'} style={{
              color: 'var(--text-tertiary)', fontSize: 13,
            }}>
              {t('auth.wrongEmail')}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
