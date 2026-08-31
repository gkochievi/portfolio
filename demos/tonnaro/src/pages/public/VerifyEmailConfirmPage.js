import React, { useEffect, useState } from 'react';
import { Card, Spin, Typography, Button } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

const { Text } = Typography;

export default function VerifyEmailConfirmPage({ variant = 'desktop' }) {
  const { verifyEmail } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [state, setState] = useState('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!token) {
      setState('failed');
      setErrorMsg(t('auth.verifyLinkExpired'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const user = await verifyEmail({ token });
        if (cancelled) return;
        setState('success');
        setTimeout(() => {
          navigate(user.role === 'admin' ? '/admin' : '/app', { replace: true });
        }, 800);
      } catch (err) {
        if (cancelled) return;
        const reason = err.response?.data?.code;
        setState('failed');
        setErrorMsg(
          reason === 'expired'
            ? t('auth.codeExpired')
            : t('auth.verifyLinkExpired'),
        );
      }
    })();
    return () => { cancelled = true; };
  }, [token, verifyEmail, navigate, t]);

  const isMobile = variant === 'mobile';

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: isMobile ? '100vh' : 'calc(100vh - 130px)',
      padding: 20,
      background: 'var(--bg-secondary)',
    }}>
      <Card style={{
        width: '100%', maxWidth: 420, textAlign: 'center',
        borderRadius: 20, border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
      }}>
        {state === 'verifying' && (
          <div style={{ padding: '20px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: 'var(--text-secondary)' }}>
              {t('auth.verifyingLink')}
            </p>
          </div>
        )}
        {state === 'success' && (
          <div style={{ padding: '20px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: 'var(--accent)' }} />
            <p style={{ marginTop: 16, color: 'var(--text-primary)', fontWeight: 600 }}>
              {t('auth.verifySuccess')}
            </p>
          </div>
        )}
        {state === 'failed' && (
          <div style={{ padding: '20px 0' }}>
            <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
            <p style={{ marginTop: 16, color: 'var(--text-primary)' }}>{errorMsg}</p>
            <Button
              type="primary" block style={{ marginTop: 16 }}
              onClick={() => navigate(isMobile ? '/app/login' : '/login')}
            >
              {t('auth.login')}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
