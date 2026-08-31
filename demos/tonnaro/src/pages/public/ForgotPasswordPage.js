import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { MailOutlined, KeyOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

const { Text } = Typography;

export default function ForgotPasswordPage({ variant = 'desktop' }) {
  const { requestPasswordReset } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState('');

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await requestPasswordReset(values.email);
      setEmail(values.email);
      setSent(true);
      message.success(t('auth.resetEmailSent'));
    } catch {
      message.error(t('auth.registrationFailed'));
    } finally {
      setLoading(false);
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
        width: '100%', maxWidth: 420,
        borderRadius: 20, border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }} bodyStyle={{ padding: 0 }}>
        <div style={{ height: 4, background: 'var(--fab-gradient)' }} />
        <div style={{ padding: '32px 28px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <KeyOutlined style={{ fontSize: 22, color: 'var(--accent)' }} />
          </div>
          <h2 style={{
            textAlign: 'center', fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)', margin: '0 0 8px',
          }}>{t('auth.forgotPasswordTitle')}</h2>
          <p style={{
            textAlign: 'center', fontSize: 14,
            color: 'var(--text-secondary)', margin: '0 0 24px',
          }}>{t('auth.forgotPasswordSubtitle')}</p>

          {sent ? (
            <>
              <Text style={{
                display: 'block', textAlign: 'center',
                color: 'var(--text-secondary)', marginBottom: 16,
              }}>
                {t('auth.resetEmailSent')}
              </Text>
              <Button
                type="primary" block
                onClick={() => navigate(`${isMobile ? '/app' : ''}/reset-password?email=${encodeURIComponent(email)}`)}
                style={{
                  height: 48, borderRadius: 12, fontWeight: 700,
                  background: 'var(--fab-gradient)', border: 'none',
                }}
              >
                {t('auth.resetButton')}
              </Button>
            </>
          ) : (
            <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
              <Form.Item name="email" rules={[
                { required: true, message: t('auth.enterEmail') },
                { type: 'email', message: t('auth.invalidEmail') },
              ]}>
                <Input
                  prefix={<MailOutlined />}
                  placeholder={t('auth.email')}
                  inputMode="email" autoComplete="email"
                />
              </Form.Item>
              <Button
                type="primary" htmlType="submit" block loading={loading}
                style={{
                  height: 48, borderRadius: 12, fontWeight: 700,
                  background: 'var(--fab-gradient)', border: 'none',
                }}
              >
                {t('auth.sendResetCode')}
              </Button>
            </Form>
          )}

          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to={isMobile ? '/app/login' : '/login'} style={{
              color: 'var(--text-tertiary)', fontSize: 13,
            }}>
              {t('auth.login')}
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
