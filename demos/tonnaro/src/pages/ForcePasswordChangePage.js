import React, { useState } from 'react';
import { Form, Input, Button, Typography, message, Card } from 'antd';
import { LockOutlined, KeyOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../contexts/LanguageContext';

const { Title, Text } = Typography;

export default function ForcePasswordChangePage() {
  const { user, logout, refreshProfile } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const onFinish = async (values) => {
    setSaving(true);
    try {
      await api.post('/auth/profile/change-password/', {
        new_password: values.new_password,
        confirm_password: values.confirm_password,
      });
      await refreshProfile();
      message.success(t('auth.passwordUpdated'));
      navigate(user?.role === 'admin' ? '/admin' : '/app', { replace: true });
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('profile.failedPassword');
      message.error(typeof firstErr === 'string' ? firstErr : t('profile.failedPassword'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
      background: 'var(--bg-secondary)',
    }}>
      <Card style={{
        width: '100%', maxWidth: 460,
        borderRadius: 20,
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-lg)',
        background: 'var(--card-bg)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 18,
            background: 'var(--accent-bg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16,
          }}>
            <KeyOutlined style={{ fontSize: 26, color: 'var(--accent)' }} />
          </div>
          <Title level={3} style={{
            margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            {t('auth.forceChangeTitle')}
          </Title>
          <Text style={{
            display: 'block', marginTop: 8,
            color: 'var(--text-secondary)', fontSize: 14,
          }}>
            {t('auth.forceChangeSubtitle')}
          </Text>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="new_password"
            label={<span style={{ fontWeight: 600 }}>{t('profile.newPassword')}</span>}
            rules={[
              { required: true, message: t('profile.newPasswordRequired') },
              { min: 8, message: t('auth.minPassword') },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
              style={{ borderRadius: 12, height: 44 }}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label={<span style={{ fontWeight: 600 }}>{t('profile.confirmPassword')}</span>}
            dependencies={['new_password']}
            rules={[
              { required: true, message: t('profile.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error(t('profile.passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)' }} />}
              style={{ borderRadius: 12, height: 44 }}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              block
              size="large"
              style={{
                background: 'var(--accent)', borderColor: 'var(--accent)',
                borderRadius: 12, height: 48, fontWeight: 700,
              }}
            >
              {t('auth.setNewPassword')}
            </Button>
          </Form.Item>
          <Button
            type="text"
            block
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{ color: 'var(--text-tertiary)' }}
          >
            {t('auth.logout')}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
