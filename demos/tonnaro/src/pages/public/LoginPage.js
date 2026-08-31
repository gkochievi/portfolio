import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Divider } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

const { Title, Text } = Typography;

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const user = await login(values.email, values.password);
      if (user.must_change_password) {
        navigate('/force-password-change', { replace: true });
        return;
      }
      message.success(t('auth.welcome'));
      const redirectTo = location.state?.redirectTo;
      if (redirectTo && user.role !== 'admin') {
        navigate(redirectTo);
        return;
      }
      navigate(user.role === 'admin' ? '/admin' : '/app');
    } catch (err) {
      if (err.requiresVerification) {
        message.warning(t('auth.emailUnverified'));
        navigate(`/verify-email?email=${encodeURIComponent(err.email)}`);
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
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: 'calc(100vh - 130px)',
      padding: 20,
      background: 'var(--bg-secondary)',
    }}>
      <style>{`
        .login-card {
          width: 100%;
          max-width: 420px;
          border-radius: 20px !important;
          border: 1px solid var(--border-color) !important;
          box-shadow: var(--shadow-lg) !important;
          overflow: hidden;
          background: var(--card-bg) !important;
        }
        .login-card .ant-card-body {
          padding: 0 !important;
        }
        .login-input .ant-input,
        .login-input .ant-input-affix-wrapper {
          border-radius: 12px !important;
          height: 48px !important;
          background: var(--input-bg) !important;
          border: 1.5px solid var(--border-color) !important;
          font-size: 15px !important;
          transition: all 0.2s cubic-bezier(0.22,1,0.36,1) !important;
        }
        .login-input .ant-input-affix-wrapper:hover {
          border-color: var(--accent-light) !important;
        }
        .login-input .ant-input-affix-wrapper-focused {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--ring-color) !important;
        }
        .login-input .ant-input-prefix {
          color: var(--text-tertiary) !important;
          margin-right: 10px !important;
        }
        .login-input .ant-input-affix-wrapper .ant-input {
          background: transparent !important;
          border: none !important;
          height: auto !important;
        }
        .login-submit-btn {
          height: 48px !important;
          border-radius: 12px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          letter-spacing: -0.01em;
          background: var(--fab-gradient) !important;
          border: none !important;
          box-shadow: 0 4px 14px var(--ring-color) !important;
          transition: all 0.25s cubic-bezier(0.22,1,0.36,1) !important;
        }
        .login-submit-btn:hover {
          box-shadow: 0 6px 20px var(--ring-color) !important;
          transform: translateY(-1px);
        }
        .login-submit-btn:active {
          transform: translateY(0);
        }
        .login-secondary-btn {
          height: 44px !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          border: 1.5px solid var(--border-color) !important;
          background: transparent !important;
          color: var(--text-primary) !important;
          transition: all 0.2s ease !important;
        }
        .login-secondary-btn:hover {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
          background: var(--accent-bg) !important;
        }
      `}</style>

      <Card className="login-card">
        {/* Gradient accent bar at top */}
        <div style={{
          height: 4,
          background: 'var(--fab-gradient)',
          borderRadius: '0',
        }} />

        <div style={{
          padding: '36px 32px 32px',
          animation: 'fadeInUp 0.45s cubic-bezier(0.22,1,0.36,1)',
        }}>
          {/* Icon */}
          <div style={{
            width: 52, height: 52,
            borderRadius: 16,
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <LockOutlined style={{ fontSize: 22, color: 'var(--accent)' }} />
          </div>

          <h2 style={{
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            margin: '0 0 6px',
          }}>
            {t('auth.welcomeBack')}
          </h2>
          <p style={{
            textAlign: 'center',
            fontSize: 15,
            color: 'var(--text-secondary)',
            margin: '0 0 28px',
          }}>
            {t('auth.loginSubtitle')}
          </p>

          <Form layout="vertical" onFinish={onFinish} size="large" className="login-input">
            <Form.Item
              name="email"
              rules={[{ required: true, message: t('auth.enterEmail') }]}
              style={{ marginBottom: 16 }}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder={t('auth.email')}
                type="email"
                inputMode="email"
                autoComplete="email"
              />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: t('auth.enterPassword') }]}
              style={{ marginBottom: 24 }}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('auth.password')}
                autoComplete="current-password"
              />
            </Form.Item>
            <div style={{ textAlign: 'right', marginBottom: 16, marginTop: -8 }}>
              <Link to="/forgot-password" style={{
                color: 'var(--accent)',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}>
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <Form.Item style={{ marginBottom: 20 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="login-submit-btn"
              >
                {t('auth.login')}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain style={{ margin: '12px 0 20px', borderColor: 'var(--border-color)' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 500 }}>
              {t('auth.noAccount')}
            </span>
          </Divider>

          <Link to="/register">
            <Button block className="login-secondary-btn">
              {t('auth.createAccount')}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
