import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Typography, message, Modal, Switch, Select, Grid } from 'antd';
import {
  UserOutlined, PhoneOutlined, LockOutlined,
  LogoutOutlined, RightOutlined, EditOutlined,
  FileTextOutlined, ClockCircleOutlined, CheckCircleOutlined,
  MoonFilled, SunFilled, TranslationOutlined,
  CameraOutlined, DeleteOutlined, LoadingOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLang } from '../../contexts/LanguageContext';
import PhoneInput, { isValidGeorgiaPhone } from '../../components/common/PhoneInput';

function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const { Text } = Typography;
const { useBreakpoint } = Grid;

export default function AppProfilePage() {
  const { user, logout, refreshProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t, lang, changeLang, SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS } = useLang();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [stats, setStats] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = React.useRef(null);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      message.error(t('profile.avatarInvalidType'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error(t('profile.avatarTooLarge'));
      return;
    }
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      await api.patch('/auth/profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await refreshProfile();
      message.success(t('profile.avatarUpdated'));
    } catch {
      message.error(t('profile.avatarFailed'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = () => {
    Modal.confirm({
      title: t('profile.removeAvatarConfirm'),
      okText: t('profile.remove'),
      okType: 'danger',
      onOk: async () => {
        setUploadingAvatar(true);
        try {
          const formData = new FormData();
          formData.append('avatar', '');
          await api.patch('/auth/profile/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          await refreshProfile();
          message.success(t('profile.avatarRemoved'));
        } catch {
          message.error(t('profile.avatarFailed'));
        } finally {
          setUploadingAvatar(false);
        }
      },
    });
  };

  useEffect(() => {
    api.get('/auth/profile/stats/').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  useEffect(() => {
    if (user?.user_type !== 'company') return;
    setContractsLoading(true);
    api.get('/auth/profile/contracts/')
      .then(({ data }) => setContracts(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setContractsLoading(false));
  }, [user?.user_type]);

  const handleProfileSave = async (values) => {
    setSaving(true);
    try {
      await api.patch('/auth/profile/', values);
      await refreshProfile();
      message.success(t('profile.profileUpdated'));
      setEditMode(false);
    } catch {
      message.error(t('profile.failedUpdate'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (values) => {
    setSaving(true);
    try {
      await api.post('/auth/profile/change-password/', values);
      passwordForm.resetFields();
      message.success(t('profile.passwordChanged'));
      setPasswordMode(false);
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('profile.failedPassword');
      message.error(typeof firstErr === 'string' ? firstErr : t('profile.failedPassword'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Modal.confirm({
      title: t('auth.logoutConfirm'),
      okText: t('auth.logout'),
      okType: 'danger',
      onOk: () => {
        logout();
        navigate('/');
      },
    });
  };

  const inputStyle = { height: 50, borderRadius: 14, fontSize: 15 };

  return (
    <div style={{ background: 'var(--bg-secondary)', minHeight: '100vh', maxWidth: isMobile ? '100%' : 800, margin: isMobile ? 0 : '0 auto', padding: isMobile ? 0 : '24px 40px' }}>
      {/* Header with gradient avatar area */}
      <div style={{
        paddingTop: isMobile ? 'calc(24px + env(safe-area-inset-top, 0px))' : 0,
        background: 'var(--bg-primary)',
        borderRadius: isMobile ? '0 0 24px 24px' : 16,
        marginBottom: 12,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        border: isMobile ? 'none' : '1px solid var(--border-color)',
      }}>
        {/* Avatar centered */}
        <div style={{ padding: '24px 20px 20px', textAlign: 'center' }}>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{
              width: 84, height: 84, borderRadius: 24,
              background: user?.avatar_url ? 'var(--bg-secondary)' : 'var(--header-gradient)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, color: '#fff', fontWeight: 700,
              boxShadow: 'var(--shadow-md)',
              overflow: 'hidden',
            }}>
              {uploadingAvatar ? (
                <LoadingOutlined style={{ fontSize: 28, color: 'var(--accent)' }} />
              ) : user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (user?.first_name?.[0] || '?').toUpperCase()
              )}
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              aria-label={t('profile.changeAvatar')}
              style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                border: '3px solid var(--bg-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: uploadingAvatar ? 'default' : 'pointer',
                boxShadow: 'var(--shadow-sm)',
                padding: 0,
              }}
            >
              <CameraOutlined style={{ fontSize: 13 }} />
            </button>
            {user?.avatar_url && !uploadingAvatar && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                aria-label={t('profile.removeAvatar')}
                style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 26, height: 26, borderRadius: '50%',
                  background: '#ef4444', color: '#fff',
                  border: '3px solid var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  padding: 0,
                }}
              >
                <DeleteOutlined style={{ fontSize: 11 }} />
              </button>
            )}
          </div>
          <div style={{
            fontSize: 19, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: -0.3, marginTop: 12,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.first_name} {user?.last_name}
          </div>
          <div style={{
            fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user?.email}
          </div>
          {user?.personal_id && (
            <div style={{
              fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2,
              fontFamily: 'monospace', letterSpacing: 0.5,
            }}>
              {t('auth.personalId')}: {user.personal_id}
            </div>
          )}

          {/* User type badge */}
          {user?.user_type && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 12,
              fontSize: 12, fontWeight: 500,
              padding: '4px 12px', borderRadius: 10,
              background: user.user_type === 'company' ? '#f59e0b10' : 'var(--accent-bg)',
              color: user.user_type === 'company' ? 'var(--warning-color)' : 'var(--accent)',
            }}>
              {user.user_type === 'company'
                ? `${user.company_name || t('auth.company')}${user.company_id ? ` \u00B7 ${user.company_id}` : ''}`
                : t('auth.personal')}
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div style={{
              display: 'flex', gap: 0, marginTop: 16,
              background: 'var(--stats-bg)', borderRadius: 16, overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}>
              {[
                { label: t('profile.total'), value: stats.total_orders, icon: <FileTextOutlined />, color: 'var(--accent)' },
                { label: t('orders.activeTab'), value: stats.active_orders, icon: <ClockCircleOutlined />, color: 'var(--warning-color)' },
                { label: t('profile.done'), value: stats.completed_orders, icon: <CheckCircleOutlined />, color: 'var(--success-color)' },
              ].map((s, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', padding: '14px 8px',
                  borderRight: i < 2 ? '1px solid var(--border-light)' : 'none',
                  transition: 'background 0.2s ease',
                }}>
                  <div style={{
                    fontSize: 12, color: s.color, marginBottom: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                    {s.icon}
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 800, color: s.color,
                    letterSpacing: -0.5,
                  }}>
                    {s.value || 0}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }} title={s.label}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Settings menu */}
      <div style={{ padding: isMobile ? '0 16px' : 0 }}>
        <SettingsCard>
          <SettingsItem
            icon={<EditOutlined />}
            label={t('profile.editProfile')}
            iconBg="var(--accent-bg)"
            iconColor="var(--accent)"
            onClick={() => {
              profileForm.setFieldsValue({
                first_name: user?.first_name,
                last_name: user?.last_name,
                phone_number: user?.phone_number,
              });
              setEditMode(true);
            }}
          />
          <SettingsItem
            icon={<LockOutlined />}
            label={t('profile.changePassword')}
            iconBg="var(--accent-bg)"
            iconColor="var(--accent)"
            onClick={() => setPasswordMode(true)}
          />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-light)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: isDark ? 'var(--accent-bg-strong)' : '#f59e0b14',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: isDark ? 'var(--accent)' : '#f59e0b',
              flexShrink: 0,
            }}>
              {isDark ? <MoonFilled /> : <SunFilled />}
            </div>
            <span style={{ flex: 1, fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
              {t('profile.darkMode')}
            </span>
            <Switch
              checked={isDark}
              onChange={toggleTheme}
              checkedChildren={<MoonFilled />}
              unCheckedChildren={<SunFilled />}
            />
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: '#3b82f614',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#3b82f6',
              flexShrink: 0,
            }}>
              <TranslationOutlined />
            </div>
            <span style={{ flex: 1, fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
              {t('profile.language')}
            </span>
            <Select
              value={lang}
              onChange={changeLang}
              style={{ width: 140 }}
              options={SUPPORTED_LANGS.map((l) => ({
                value: l,
                label: `${LANG_FLAGS[l]} ${LANG_LABELS[l]}`,
              }))}
            />
          </div>
        </SettingsCard>

        {user?.user_type === 'company' && (
          <SettingsCard>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px',
              borderBottom: contracts.length > 0 || contractsLoading
                ? '1px solid var(--border-light)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: 'var(--accent)',
                flexShrink: 0,
              }}>
                <FileTextOutlined />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 15, color: 'var(--text-primary)', fontWeight: 500,
                }}>
                  {t('profile.contractsTitle')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {t('profile.contractsHint')}
                </div>
              </div>
            </div>
            {contractsLoading ? (
              <div style={{ padding: '20px 16px', textAlign: 'center' }}>
                <LoadingOutlined style={{ color: 'var(--accent)', fontSize: 18 }} />
              </div>
            ) : contracts.length === 0 ? (
              <div style={{
                padding: '18px 16px', fontSize: 13,
                color: 'var(--text-tertiary)', textAlign: 'center',
              }}>
                {t('profile.noContracts')}
              </div>
            ) : (
              contracts.map((c, idx) => (
                <a
                  key={c.id}
                  href={c.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px',
                    borderBottom: idx < contracts.length - 1
                      ? '1px solid var(--border-light)' : 'none',
                    color: 'inherit', textDecoration: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: 'var(--text-secondary)',
                    flexShrink: 0,
                  }}>
                    <FileTextOutlined />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.title || c.original_filename || `Contract #${c.id}`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                      {dayjs(c.created_at).format('DD MMM YYYY')}
                      {c.file_size ? ` · ${formatBytes(c.file_size)}` : ''}
                    </div>
                  </div>
                  <DownloadOutlined style={{ color: 'var(--accent)', fontSize: 16 }} />
                </a>
              ))
            )}
          </SettingsCard>
        )}

        <SettingsCard>
          <SettingsItem
            icon={<LogoutOutlined />}
            label={t('auth.logout')}
            danger
            iconBg="var(--danger-bg)"
            iconColor="#ef4444"
            onClick={handleLogout}
            hideBorder
          />
        </SettingsCard>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        open={editMode}
        onCancel={() => setEditMode(false)}
        footer={null}
        title={t('profile.editProfile')}
        destroyOnClose
        styles={{ body: { paddingTop: 16 } }}
      >
        <Form form={profileForm} layout="vertical" onFinish={handleProfileSave} requiredMark={false}>
          <Form.Item name="first_name" label={t('auth.firstName')} rules={[{ required: true }]}>
            <Input prefix={<UserOutlined style={{ color: 'var(--text-placeholder)' }} />} style={inputStyle} />
          </Form.Item>
          <Form.Item name="last_name" label={t('auth.lastName')} rules={[{ required: true }]}>
            <Input prefix={<UserOutlined style={{ color: 'var(--text-placeholder)' }} />} style={inputStyle} />
          </Form.Item>
          <Form.Item
            name="phone_number"
            label={t('auth.phone')}
            rules={[
              {
                validator: (_, v) =>
                  !v || isValidGeorgiaPhone(v)
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('auth.phoneInvalid'))),
              },
            ]}
          >
            <PhoneInput style={inputStyle} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saving}
            style={{
              height: 50, borderRadius: 14, fontWeight: 600, fontSize: 15,
              background: 'var(--fab-gradient)', border: 'none',
              boxShadow: 'var(--fab-shadow)',
            }}>
            {t('profile.saveChanges')}
          </Button>
        </Form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={passwordMode}
        onCancel={() => setPasswordMode(false)}
        footer={null}
        title={t('profile.changePassword')}
        destroyOnClose
        styles={{ body: { paddingTop: 16 } }}
      >
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange} requiredMark={false}>
          <Form.Item
            name="old_password"
            label={t('profile.currentPassword')}
            rules={[{ required: true, message: t('profile.currentPasswordRequired') }]}
          >
            <Input.Password style={inputStyle} autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label={t('profile.newPassword')}
            dependencies={['old_password']}
            rules={[
              { required: true, message: t('profile.newPasswordRequired') },
              { min: 8, message: t('auth.minPassword') },
              { pattern: /\D/, message: t('auth.passwordNotAllNumeric') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || value !== getFieldValue('old_password')) return Promise.resolve();
                  return Promise.reject(new Error(t('profile.newSameAsOld')));
                },
              }),
            ]}
            hasFeedback
          >
            <Input.Password style={inputStyle} autoComplete="new-password" />
          </Form.Item>

          <Form.Item shouldUpdate={(prev, cur) => prev.new_password !== cur.new_password} noStyle>
            {({ getFieldValue }) => (
              <PasswordStrength value={getFieldValue('new_password') || ''} t={t} />
            )}
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label={t('profile.confirmPassword')}
            dependencies={['new_password']}
            rules={[
              { required: true, message: t('profile.confirmPasswordRequired') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || value === getFieldValue('new_password')) return Promise.resolve();
                  return Promise.reject(new Error(t('profile.passwordMismatch')));
                },
              }),
            ]}
            hasFeedback
          >
            <Input.Password style={inputStyle} autoComplete="new-password" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={saving}
            style={{
              height: 50, borderRadius: 14, fontWeight: 600, fontSize: 15,
              background: 'var(--fab-gradient)', border: 'none',
              boxShadow: 'var(--fab-shadow)',
            }}>
            {t('profile.changePassword')}
          </Button>
        </Form>
      </Modal>
    </div>
  );
}


function SettingsCard({ children }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 16, overflow: 'hidden',
      marginBottom: 12, boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-color)',
    }}>
      {children}
    </div>
  );
}

function SettingsItem({ icon, label, onClick, danger, iconBg, iconColor, hideBorder }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        borderBottom: hideBorder ? 'none' : '1px solid var(--border-light)',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.15s ease',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: iconBg || 'var(--badge-muted-bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, color: iconColor || 'var(--text-secondary)',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <span style={{
        flex: 1, fontSize: 15,
        color: danger ? '#ef4444' : 'var(--text-primary)',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <RightOutlined style={{ color: 'var(--text-placeholder)', fontSize: 12 }} />
    </div>
  );
}

function PasswordStrength({ value, t }) {
  const checks = [
    { key: 'len', ok: value.length >= 8, label: t('profile.pwReqLength') },
    { key: 'letter', ok: /[A-Za-z]/.test(value), label: t('profile.pwReqLetter') },
    { key: 'number', ok: /\d/.test(value), label: t('profile.pwReqNumber') },
    { key: 'mixed', ok: /[A-Z]/.test(value) && /[a-z]/.test(value), label: t('profile.pwReqMixed') },
  ];
  const score = checks.filter((c) => c.ok).length;
  const levels = [
    { color: 'transparent', label: '' },
    { color: '#ef4444', label: t('profile.pwWeak') },
    { color: '#f59e0b', label: t('profile.pwFair') },
    { color: '#3b82f6', label: t('profile.pwGood') },
    { color: '#10b981', label: t('profile.pwStrong') },
  ];
  const level = levels[score];

  if (!value) return null;

  return (
    <div style={{ marginTop: -12, marginBottom: 18 }}>
      <div style={{
        display: 'flex', gap: 4, marginBottom: 8,
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i < score ? level.color : 'var(--border-light)',
            transition: 'background 0.2s ease',
          }} />
        ))}
      </div>
      {level.label && (
        <div style={{ fontSize: 12, color: level.color, fontWeight: 600, marginBottom: 6 }}>
          {level.label}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {checks.map((c) => (
          <span key={c.key} style={{
            fontSize: 11,
            color: c.ok ? 'var(--success-color)' : 'var(--text-tertiary)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 10 }}>{c.ok ? '✓' : '○'}</span>
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
