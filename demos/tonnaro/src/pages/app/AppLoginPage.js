import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import { MailOutlined, LockOutlined, CarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

const { Text } = Typography;

export default function AppLoginPage() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const user = await login(values.email, values.password);
      if (user.must_change_password) {
        navigate('/force-password-change', { replace: true });
        return;
      }
      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/app');
      }
    } catch (err) {
      if (err.requiresVerification) {
        message.warning(t('auth.emailUnverified'));
        navigate(`/app/verify-email?email=${encodeURIComponent(err.email)}`);
        return;
      }
      const detail = err.response?.data?.detail || t('auth.invalidCredentials');
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 520,
      margin: '0 auto',
      position: 'relative',
      overflow: 'hidden',
      padding: '0 20px',
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: 'absolute', top: -80, right: -60, width: 240, height: 240,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '20%', left: -60, width: 180, height: 180,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo area */}
      <div style={{
        paddingTop: 'calc(80px + env(safe-area-inset-top, 0px))',
        paddingBottom: 52,
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: 26,
          background: 'var(--header-gradient)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 22,
          boxShadow: '0 12px 32px var(--ring-color)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative shine layers */}
          <div style={{
            position: 'absolute', top: -12, right: -12, width: 48, height: 48,
            borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
          }} />
          <div style={{
            position: 'absolute', bottom: -8, left: -8, width: 32, height: 32,
            borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
          }} />
          <CarOutlined style={{ fontSize: 38, color: '#fff', position: 'relative', zIndex: 1 }} />
        </div>
        <div style={{
          fontSize: 28, fontWeight: 800, color: 'var(--text-primary)',
          letterSpacing: -0.6, lineHeight: 1.2,
        }}>
          {t('common.appName')}
        </div>
        <Text style={{
          fontSize: 14, color: 'var(--text-secondary)', marginTop: 8,
          display: 'block', letterSpacing: 0.1,
        }}>
          {t('auth.tagline')}
        </Text>
      </div>

      {/* Form */}
      <div style={{
        padding: '0 28px', flex: 1,
        position: 'relative', zIndex: 1,
        animation: 'fadeInUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s both',
      }}>
        <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, message: t('auth.enterEmail') }]}>
            <Input
              prefix={<MailOutlined style={{ color: 'var(--text-placeholder)' }} />}
              placeholder={t('auth.email')}
              inputMode="email"
              autoComplete="email"
              style={{
                padding: '14px 16px', borderRadius: 16, fontSize: 16,
                background: 'var(--input-bg)',
                border: '1.5px solid var(--input-border)',
              }}
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: t('auth.enterPassword') }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-placeholder)' }} />}
              placeholder={t('auth.password')}
              autoComplete="current-password"
              style={{
                padding: '14px 16px', borderRadius: 16, fontSize: 16,
                background: 'var(--input-bg)',
                border: '1.5px solid var(--input-border)',
              }}
            />
          </Form.Item>
          <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 8 }}>
            <span
              onClick={() => navigate('/app/forgot-password')}
              style={{
                color: 'var(--accent)', fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('auth.forgotPassword')}
            </span>
          </div>
          <Form.Item style={{ marginTop: 16 }}>
            <Button
              type="primary" htmlType="submit" block loading={loading}
              style={{
                height: 56, borderRadius: 16, fontSize: 16, fontWeight: 700,
                background: 'var(--header-gradient)',
                border: 'none',
                boxShadow: '0 6px 20px var(--ring-color)',
                letterSpacing: 0.2,
                transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {t('auth.login')}
            </Button>
          </Form.Item>
        </Form>
      </div>

      {/* Footer */}
      <div style={{
        padding: '32px 28px',
        paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <Text style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {t('auth.noAccount')}{' '}
        </Text>
        <span
          onClick={() => navigate('/app/register')}
          style={{
            color: 'var(--accent)', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', letterSpacing: -0.1,
          }}
        >
          {t('auth.signUp')}
        </span>
      </div>
    </div>
  );
}
