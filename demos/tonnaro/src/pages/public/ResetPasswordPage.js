import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import {
  LockOutlined, MailOutlined, SafetyCertificateOutlined, ArrowLeftOutlined,
} from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';

// Two-step UX for the code-mode reset:
//   Step 1: email + 6-digit code → /auth/password-reset/verify-code/
//   Step 2: new password (+ confirm) → /auth/password-reset/confirm/
// We split so the user only types a strong password AFTER the code is
// confirmed server-side — avoids the "typed all that just to be told the
// code was wrong" frustration.
//
// Token-mode (magic link, ?token=…) stays one step: clicking the link IS
// the proof of identity, so we go straight to the password fields.
export default function ResetPasswordPage({ variant = 'desktop' }) {
  const { verifyResetCode, confirmPasswordReset } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const emailPrefill = params.get('email') || '';

  // step: 1 = code entry, 2 = password entry. Token mode skips straight to 2.
  const [step, setStep] = useState(token ? 2 : 1);
  // Verified-code carries from step 1 to step 2 so the final POST has the
  // exact same code (the token row is still active server-side).
  const [verifiedEmail, setVerifiedEmail] = useState('');
  const [verifiedCode, setVerifiedCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [codeForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const isMobile = variant === 'mobile';

  const onStep1 = async (values) => {
    setLoading(true);
    try {
      await verifyResetCode({ email: values.email, code: values.code });
      setVerifiedEmail(values.email);
      setVerifiedCode(values.code);
      setStep(2);
    } catch (err) {
      const body = err.response?.data || {};
      const reason = body.code;
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

  const onStep2 = async (values) => {
    setLoading(true);
    try {
      await confirmPasswordReset({
        ...(token ? { token } : { email: verifiedEmail, code: verifiedCode }),
        new_password: values.new_password,
      });
      message.success(t('auth.resetSuccess'));
      navigate(isMobile ? '/app/login' : '/login', { replace: true });
    } catch (err) {
      const body = err.response?.data || {};
      const reason = body.code;
      const msg = ({
        invalid: t('auth.codeInvalid'),
        expired: token ? t('auth.resetTokenInvalid') : t('auth.codeExpired'),
        locked:  t('auth.codeLocked'),
        same_password: t('auth.samePassword'),
      })[reason] || body.detail || body.new_password?.[0] || t('auth.registrationFailed');
      message.error(msg);
      // If the code itself was rejected at step 2, kick back to step 1 so
      // the user can re-enter it (or request a fresh code). same_password
      // is a step-2-only condition, so we stay on step 2 and let the user
      // change just the password fields.
      if (!token && (reason === 'invalid' || reason === 'expired' || reason === 'locked')) {
        setStep(1);
        passwordForm.resetFields();
      }
      if (reason === 'same_password') {
        // Highlight the password fields by clearing them — the user will
        // see the error toast and have empty inputs to retype.
        passwordForm.resetFields();
      }
    } finally {
      setLoading(false);
    }
  };

  const subtitle = step === 1
    ? t('auth.resetCodeSubtitle')
    : t('auth.resetPasswordSubtitle');

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
      }} bodyStyle={{ padding: 0 }}>
        <div style={{ height: 4, background: 'var(--fab-gradient)' }} />
        <div style={{ padding: '32px 28px' }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'var(--accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <SafetyCertificateOutlined style={{ fontSize: 22, color: 'var(--accent)' }} />
          </div>
          <h2 style={{
            textAlign: 'center', fontSize: 22, fontWeight: 800,
            color: 'var(--text-primary)', margin: '0 0 8px',
          }}>{t('auth.resetPasswordTitle')}</h2>
          <p style={{
            textAlign: 'center', fontSize: 14,
            color: 'var(--text-secondary)', margin: '0 0 24px',
          }}>{subtitle}</p>

          {step === 1 && (
            <Form
              form={codeForm}
              layout="vertical"
              onFinish={onStep1}
              size="large"
              requiredMark={false}
              initialValues={{ email: emailPrefill }}
            >
              <Form.Item name="email" rules={[
                { required: true, message: t('auth.enterEmail') },
                { type: 'email', message: t('auth.invalidEmail') },
              ]}>
                <Input
                  prefix={<MailOutlined />}
                  placeholder={t('auth.email')}
                  autoComplete="email"
                />
              </Form.Item>
              <Form.Item name="code" rules={[
                { required: true, message: t('auth.verifyCodePlaceholder') },
                { pattern: /^\d{6}$/, message: t('auth.codeInvalid') },
              ]}>
                <Input
                  placeholder={t('auth.verifyCodePlaceholder')}
                  inputMode="numeric" maxLength={6}
                />
              </Form.Item>

              <Button
                type="primary" htmlType="submit" block loading={loading}
                style={{
                  height: 48, borderRadius: 12, fontWeight: 700,
                  background: 'var(--fab-gradient)', border: 'none',
                }}
              >
                {t('auth.continueLabel')}
              </Button>
            </Form>
          )}

          {step === 2 && (
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={onStep2}
              size="large"
              requiredMark={false}
            >
              <Form.Item name="new_password" rules={[
                { required: true, message: t('auth.createPassword') },
                { min: 8, message: t('auth.minPassword') },
                { pattern: /\D/, message: t('auth.passwordNotAllNumeric') },
              ]}>
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('auth.password')}
                  autoComplete="new-password"
                  autoFocus
                />
              </Form.Item>

              <Form.Item name="confirm_password" dependencies={['new_password']} rules={[
                { required: true, message: t('auth.confirmPassword') },
                ({ getFieldValue }) => ({
                  validator(_, v) {
                    if (!v || getFieldValue('new_password') === v) return Promise.resolve();
                    return Promise.reject(new Error(t('auth.passwordMismatch')));
                  },
                }),
              ]}>
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder={t('auth.confirmPassword')}
                  autoComplete="new-password"
                />
              </Form.Item>

              <Button
                type="primary" htmlType="submit" block loading={loading}
                style={{
                  height: 48, borderRadius: 12, fontWeight: 700,
                  background: 'var(--fab-gradient)', border: 'none',
                }}
              >
                {t('auth.resetButton')}
              </Button>

              {!token && (
                <div style={{ textAlign: 'center', marginTop: 12 }}>
                  <span
                    onClick={() => { setStep(1); passwordForm.resetFields(); }}
                    style={{
                      color: 'var(--text-tertiary)', fontSize: 13,
                      cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    <ArrowLeftOutlined style={{ marginRight: 6 }} />
                    {t('auth.backToCode')}
                  </span>
                </div>
              )}
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
