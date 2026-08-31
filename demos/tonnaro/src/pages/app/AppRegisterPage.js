import React, { useState } from 'react';
import { Form, Input, Button, Typography, message } from 'antd';
import {
  UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, CarOutlined,
  BankOutlined, TeamOutlined, IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import PhoneInput, { isValidGeorgiaPhone } from '../../components/common/PhoneInput';
import { mapRegisterErrors } from '../../utils/registerErrors';
import TermsGate from '../../components/common/TermsGate';

const { Text } = Typography;

export default function AppRegisterPage() {
  const { register } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState('personal');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      await register({ ...values, accepted_terms: acceptedTerms });
      message.success(t('auth.verifyEmailSent'));
      navigate(`/app/verify-email?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      const data = err.response?.data;
      const { fieldErrors, firstMessage } = mapRegisterErrors(data, t);
      if (fieldErrors.length) {
        form.setFields(fieldErrors);
        message.error(firstMessage || t('auth.registrationFailed'));
      } else {
        message.error(t('auth.registrationFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    padding: '13px 16px', borderRadius: 16, fontSize: 15,
    background: 'var(--input-bg)',
    border: '1.5px solid var(--input-border)',
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
        position: 'absolute', top: -60, right: -50, width: 200, height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '30%', left: -50, width: 160, height: 160,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--accent-bg) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo area */}
      <div style={{
        paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))',
        paddingBottom: 32,
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20,
          background: 'var(--header-gradient)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 8px 24px var(--ring-color)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -8, right: -8, width: 32, height: 32,
            borderRadius: '50%', background: 'rgba(255,255,255,0.15)',
          }} />
          <div style={{
            position: 'absolute', bottom: -6, left: -6, width: 24, height: 24,
            borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
          }} />
          <CarOutlined style={{ fontSize: 28, color: '#fff', position: 'relative', zIndex: 1 }} />
        </div>
        <div style={{
          fontSize: 26, fontWeight: 800, color: 'var(--text-primary)',
          letterSpacing: -0.6, lineHeight: 1.2,
        }}>
          {t('auth.createAccount')}
        </div>
        <Text style={{
          fontSize: 13, color: 'var(--text-secondary)',
          marginTop: 6, display: 'block', letterSpacing: 0.1,
        }}>
          {t('auth.getStarted')}
        </Text>
      </div>

      {/* Form */}
      <div style={{
        padding: '0 28px', flex: 1,
        position: 'relative', zIndex: 1,
        animation: 'fadeInUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.1s both',
      }}>
        <Form form={form} layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Form.Item name="first_name" rules={[{ required: true, message: t('common.required') }]} style={{ flex: 1 }}>
              <Input
                prefix={<UserOutlined style={{ color: 'var(--text-placeholder)' }} />}
                placeholder={t('auth.firstName')}
                autoComplete="given-name"
                style={inputStyle}
              />
            </Form.Item>
            <Form.Item name="last_name" rules={[{ required: true, message: t('common.required') }]} style={{ flex: 1 }}>
              <Input
                prefix={<UserOutlined style={{ color: 'var(--text-placeholder)' }} />}
                placeholder={t('auth.lastName')}
                autoComplete="family-name"
                style={inputStyle}
              />
            </Form.Item>
          </div>

          <Form.Item name="email" rules={[
            { required: true, message: t('auth.enterEmail') },
            { type: 'email', message: t('auth.invalidEmail') },
          ]}>
            <Input
              prefix={<MailOutlined style={{ color: 'var(--text-placeholder)' }} />}
              placeholder={t('auth.email')}
              inputMode="email"
              autoComplete="email"
              style={inputStyle}
            />
          </Form.Item>

          <Form.Item name="phone_number" rules={[
            { required: true, message: t('newOrder.enterPhone') },
            {
              validator: (_, v) =>
                !v || isValidGeorgiaPhone(v)
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('auth.phoneInvalid'))),
            },
          ]}>
            <PhoneInput style={inputStyle} />
          </Form.Item>

          {/* User type toggle */}
          <Form.Item name="user_type" initialValue="personal">
            <UserTypeToggle value={userType} onChange={(val) => setUserType(val)} t={t} />
          </Form.Item>

          {/* Personal ID — individual accounts only */}
          {userType === 'personal' && (
            <Form.Item
              name="personal_id"
              preserve={false}
              rules={[
                { required: true, message: t('auth.personalIdRequired') },
                { pattern: /^\d{11}$/, message: t('auth.personalIdInvalid') },
              ]}
              extra={
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                  {t('auth.personalIdHelp')}
                </span>
              }
            >
              <Input
                prefix={<IdcardOutlined style={{ color: 'var(--text-placeholder)' }} />}
                placeholder={t('auth.personalIdPlaceholder')}
                maxLength={11}
                inputMode="numeric"
                autoComplete="off"
                style={inputStyle}
              />
            </Form.Item>
          )}

          {/* Company fields with animation */}
          <div style={{
            maxHeight: userType === 'company' ? 300 : 0,
            opacity: userType === 'company' ? 1 : 0,
            overflow: 'hidden',
            transition: 'all 0.35s cubic-bezier(0.22,1,0.36,1)',
          }}>
            <Form.Item
              name="company_name"
              rules={userType === 'company' ? [{ required: true, message: t('common.required') }] : []}
            >
              <Input
                prefix={<BankOutlined style={{ color: 'var(--text-placeholder)' }} />}
                placeholder={t('auth.companyName')}
                style={inputStyle}
              />
            </Form.Item>
            <Form.Item
              name="company_id"
              rules={userType === 'company' ? [
                { required: true, message: t('common.required') },
                { pattern: /^\d{9}$/, message: t('auth.companyIdInvalid') },
              ] : []}
              extra={
                userType === 'company' ? (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                    {t('auth.companyIdHelp')}
                  </span>
                ) : null
              }
            >
              <Input
                prefix={<BankOutlined style={{ color: 'var(--text-placeholder)' }} />}
                placeholder={t('auth.companyIdPlaceholder')}
                maxLength={9}
                inputMode="numeric"
                style={inputStyle}
              />
            </Form.Item>
          </div>

          <Form.Item name="password" rules={[
            { required: true, message: t('auth.createPassword') },
            { min: 8, message: t('auth.minPassword') },
            { pattern: /\D/, message: t('auth.passwordNotAllNumeric') },
            () => ({
              validator(_, value) {
                if (!value) return Promise.resolve();
                const hasUpper = /[A-Z]/.test(value);
                const hasLower = /[a-z]/.test(value);
                const hasDigit = /\d/.test(value);
                const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value);
                if (hasUpper && hasLower && hasDigit && hasSpecial) return Promise.resolve();
                return Promise.reject(new Error(t('auth.passwordStrength')));
              },
            }),
          ]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-placeholder)' }} />}
              placeholder={t('auth.password')}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Form.Item>

          <Form.Item name="confirm_password" dependencies={['password']} rules={[
            { required: true, message: t('auth.confirmPassword') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error(t('auth.passwordMismatch')));
              },
            }),
          ]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-placeholder)' }} />}
              placeholder={t('auth.confirmPassword')}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Form.Item>

          <TermsGate value={acceptedTerms} onChange={setAcceptedTerms} />
          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary" htmlType="submit" block loading={loading}
              disabled={!acceptedTerms}
              style={{
                height: 56, borderRadius: 16, fontSize: 16, fontWeight: 700,
                background: 'var(--header-gradient)',
                border: 'none',
                boxShadow: '0 6px 20px var(--ring-color)',
                letterSpacing: 0.2,
                transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
              }}
            >
              {t('auth.createAccount')}
            </Button>
          </Form.Item>
        </Form>
      </div>

      {/* Footer */}
      <div style={{
        padding: '24px 28px',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <Text style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {t('auth.hasAccount')}{' '}
        </Text>
        <span
          onClick={() => navigate('/app/login')}
          style={{
            color: 'var(--accent)', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', letterSpacing: -0.1,
          }}
        >
          {t('auth.login')}
        </span>
      </div>
    </div>
  );
}

/* Custom toggle that works as a controlled Ant Design form field */
function UserTypeToggle({ value, onChange, t }) {
  const types = ['personal', 'company'];
  return (
    <div style={{ display: 'flex', gap: 10, width: '100%' }}>
      {types.map((type) => {
        const isActive = value === type;
        return (
          <div
            key={type}
            onClick={() => onChange(type)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '14px 16px',
              borderRadius: 16,
              fontSize: 15,
              fontWeight: 650,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              background: isActive ? 'var(--accent-bg-strong)' : 'var(--input-bg)',
              border: isActive
                ? '1.5px solid var(--accent)'
                : '1.5px solid var(--input-border)',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              transition: 'all 0.25s cubic-bezier(0.22,1,0.36,1)',
              letterSpacing: -0.1,
              userSelect: 'none',
            }}
          >
            {type === 'personal'
              ? <TeamOutlined style={{ fontSize: 16 }} />
              : <BankOutlined style={{ fontSize: 16 }} />}
            {t(`auth.${type}`)}
          </div>
        );
      })}
    </div>
  );
}
