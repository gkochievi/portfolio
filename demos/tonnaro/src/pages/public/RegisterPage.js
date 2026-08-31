import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Divider, Radio } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, BankOutlined, TeamOutlined, IdcardOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../contexts/LanguageContext';
import PhoneInput, { isValidGeorgiaPhone } from '../../components/common/PhoneInput';
import { mapRegisterErrors } from '../../utils/registerErrors';
import TermsGate from '../../components/common/TermsGate';

const { Title, Text } = Typography;

export default function RegisterPage() {
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
      navigate(`/verify-email?email=${encodeURIComponent(values.email)}`);
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

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: 'calc(100vh - 130px)',
      padding: 20,
      background: 'var(--bg-secondary)',
    }}>
      <style>{`
        .register-card {
          width: 100%;
          max-width: 500px;
          border-radius: 20px !important;
          border: 1px solid var(--border-color) !important;
          box-shadow: var(--shadow-lg) !important;
          overflow: hidden;
          background: var(--card-bg) !important;
        }
        .register-card .ant-card-body {
          padding: 0 !important;
        }
        .register-form .ant-input,
        .register-form .ant-input-affix-wrapper {
          border-radius: 12px !important;
          height: 48px !important;
          background: var(--input-bg) !important;
          border: 1.5px solid var(--border-color) !important;
          font-size: 15px !important;
          transition: all 0.2s cubic-bezier(0.22,1,0.36,1) !important;
        }
        .register-form .ant-input-affix-wrapper:hover {
          border-color: var(--accent-light) !important;
        }
        .register-form .ant-input-affix-wrapper-focused {
          border-color: var(--accent) !important;
          box-shadow: 0 0 0 3px var(--ring-color) !important;
        }
        .register-form .ant-input-prefix {
          color: var(--text-tertiary) !important;
          margin-right: 10px !important;
        }
        .register-form .ant-input-affix-wrapper .ant-input {
          background: transparent !important;
          border: none !important;
          height: auto !important;
        }
        .register-submit-btn {
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
        .register-submit-btn:hover {
          box-shadow: 0 6px 20px var(--ring-color) !important;
          transform: translateY(-1px);
        }
        .register-submit-btn:active {
          transform: translateY(0);
        }
        .register-secondary-btn {
          height: 44px !important;
          border-radius: 12px !important;
          font-weight: 600 !important;
          border: 1.5px solid var(--border-color) !important;
          background: transparent !important;
          color: var(--text-primary) !important;
          transition: all 0.2s ease !important;
        }
        .register-secondary-btn:hover {
          border-color: var(--accent) !important;
          color: var(--accent) !important;
          background: var(--accent-bg) !important;
        }
        .register-type-toggle {
          width: 100%;
          display: flex !important;
        }
        .register-type-toggle .ant-radio-button-wrapper {
          flex: 1;
          text-align: center;
          height: 46px !important;
          line-height: 44px !important;
          border-radius: 0 !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          border: 1.5px solid var(--border-color) !important;
          background: var(--input-bg) !important;
          color: var(--text-secondary) !important;
          transition: all 0.25s cubic-bezier(0.22,1,0.36,1) !important;
        }
        .register-type-toggle .ant-radio-button-wrapper:first-child {
          border-radius: 12px 0 0 12px !important;
        }
        .register-type-toggle .ant-radio-button-wrapper:last-child {
          border-radius: 0 12px 12px 0 !important;
        }
        .register-type-toggle .ant-radio-button-wrapper-checked {
          background: var(--accent-bg) !important;
          color: var(--accent) !important;
          border-color: var(--accent) !important;
          box-shadow: none !important;
        }
        .register-type-toggle .ant-radio-button-wrapper-checked::before {
          display: none !important;
        }
        .register-type-toggle .ant-radio-button-wrapper::before {
          display: none !important;
        }
        .register-company-fields {
          animation: fadeInUp 0.35s cubic-bezier(0.22,1,0.36,1);
        }
        .register-form .ant-form-item {
          margin-bottom: 16px;
        }
      `}</style>

      <Card className="register-card">
        {/* Gradient accent bar at top */}
        <div style={{
          height: 4,
          background: 'var(--fab-gradient)',
        }} />

        <div style={{
          padding: '32px 32px 28px',
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
            <UserOutlined style={{ fontSize: 22, color: 'var(--accent)' }} />
          </div>

          <h2 style={{
            textAlign: 'center',
            fontSize: 24,
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            margin: '0 0 6px',
          }}>
            {t('auth.createAccount')}
          </h2>
          <p style={{
            textAlign: 'center',
            fontSize: 15,
            color: 'var(--text-secondary)',
            margin: '0 0 28px',
          }}>
            {t('auth.getStarted')}
          </p>

          <Form form={form} layout="vertical" onFinish={onFinish} size="large" className="register-form">
            {/* Name fields - two columns */}
            <div style={{ display: 'flex', gap: 12 }}>
              <Form.Item
                name="first_name"
                rules={[{ required: true, message: t('common.required') }]}
                style={{ flex: 1, marginBottom: 16 }}
              >
                <Input prefix={<UserOutlined />} placeholder={t('auth.firstName')} />
              </Form.Item>
              <Form.Item
                name="last_name"
                rules={[{ required: true, message: t('common.required') }]}
                style={{ flex: 1, marginBottom: 16 }}
              >
                <Input prefix={<UserOutlined />} placeholder={t('auth.lastName')} />
              </Form.Item>
            </div>

            <Form.Item
              name="email"
              rules={[
                { required: true, message: t('auth.enterEmail') },
                { type: 'email', message: t('auth.invalidEmail') },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder={t('auth.email')} inputMode="email" autoComplete="email" />
            </Form.Item>

            <Form.Item
              name="phone_number"
              rules={[
                { required: true, message: t('newOrder.enterPhone') },
                {
                  validator: (_, v) =>
                    !v || isValidGeorgiaPhone(v)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('auth.phoneInvalid'))),
                },
              ]}
            >
              <PhoneInput />
            </Form.Item>

            {/* User type toggle */}
            <Form.Item name="user_type" label={
              <span style={{
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}>
                {t('auth.userType')}
              </span>
            } initialValue="personal">
              <Radio.Group
                onChange={(e) => setUserType(e.target.value)}
                className="register-type-toggle"
              >
                <Radio.Button value="personal">
                  <TeamOutlined style={{ marginRight: 8 }} />{t('auth.personal')}
                </Radio.Button>
                <Radio.Button value="company">
                  <BankOutlined style={{ marginRight: 8 }} />{t('auth.company')}
                </Radio.Button>
              </Radio.Group>
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
                extra={<span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('auth.personalIdHelp')}</span>}
              >
                <Input
                  prefix={<IdcardOutlined />}
                  placeholder={t('auth.personalIdPlaceholder')}
                  maxLength={11}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Form.Item>
            )}

            {/* Company fields - animated reveal */}
            {userType === 'company' && (
              <div className="register-company-fields">
                <div style={{
                  background: 'var(--accent-bg)',
                  borderRadius: 14,
                  padding: '18px 16px',
                  marginBottom: 16,
                  border: '1px solid var(--accent-bg-strong)',
                }}>
                  <Form.Item
                    name="company_name"
                    preserve={false}
                    rules={[{ required: true, message: t('common.required') }]}
                    style={{ marginBottom: 12 }}
                  >
                    <Input prefix={<BankOutlined />} placeholder={t('auth.companyName')} />
                  </Form.Item>
                  <Form.Item
                    name="company_id"
                    preserve={false}
                    rules={[
                      { required: true, message: t('common.required') },
                      { pattern: /^\d{9}$/, message: t('auth.companyIdInvalid') },
                    ]}
                    extra={
                      <span style={{
                        fontSize: 12,
                        color: 'var(--text-tertiary)',
                        marginTop: 4,
                        display: 'block',
                      }}>
                        {t('auth.companyIdHelp')}
                      </span>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Input prefix={<BankOutlined />} placeholder={t('auth.companyIdPlaceholder')} maxLength={9} inputMode="numeric" />
                  </Form.Item>
                </div>
              </div>
            )}

            {/* Password fields */}
            <div style={{
              paddingTop: 4,
              borderTop: '1px solid var(--border-color)',
              marginTop: 4,
              marginBottom: 4,
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-tertiary)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 12,
                marginTop: 16,
              }}>
                Security
              </div>
            </div>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: t('auth.createPassword') },
                { min: 8, message: t('auth.minPassword') },
                { pattern: /\D/, message: t('auth.passwordNotAllNumeric') },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.password')} autoComplete="new-password" />
            </Form.Item>

            <Form.Item
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: t('auth.confirmPassword') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error(t('auth.passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder={t('auth.confirmPassword')} autoComplete="new-password" />
            </Form.Item>

            <TermsGate value={acceptedTerms} onChange={setAcceptedTerms} />
            <Form.Item style={{ marginBottom: 16, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                disabled={!acceptedTerms}
                className="register-submit-btn"
              >
                {t('auth.createAccount')}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain style={{ margin: '8px 0 16px', borderColor: 'var(--border-color)' }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 500 }}>
              {t('auth.hasAccount')}
            </span>
          </Divider>

          <Link to="/login">
            <Button block className="register-secondary-btn">
              {t('auth.login')}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
