import React, { useEffect, useState } from 'react';
import {
  Table, Button, Input, Select, Typography, Space, Grid, Tag, message, Empty, Switch,
  Modal, Upload, Tooltip, Badge, Spin, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, SearchOutlined, StopOutlined,
  CheckCircleOutlined, FilterOutlined, RightOutlined, ShoppingOutlined,
  FileAddOutlined, UploadOutlined, FileTextOutlined, DownloadOutlined,
  DeleteOutlined, KeyOutlined, MailOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';

const ACCEPT_CONTRACT = '.pdf,.doc,.docx,.odt,.rtf,.txt,.jpg,.jpeg,.png,.webp';
const MAX_CONTRACT_SIZE = 20 * 1024 * 1024;

function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { t } = useLang();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [contractUser, setContractUser] = useState(null);
  const [contractTitle, setContractTitle] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  const fetchContracts = async (userId) => {
    setContractsLoading(true);
    try {
      const { data } = await api.get(`/auth/admin/users/${userId}/contracts/`);
      setContracts(Array.isArray(data) ? data : []);
    } catch {
      setContracts([]);
    } finally {
      setContractsLoading(false);
    }
  };

  const openContractModal = (user) => {
    setContractUser(user);
    setContractTitle('');
    setPendingFile(null);
    setContracts([]);
    fetchContracts(user.id);
  };

  const closeContractModal = () => {
    setContractUser(null);
    setContractTitle('');
    setPendingFile(null);
    setContracts([]);
  };

  const refreshContractCount = (userId, nextCount) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, contract_count: nextCount } : u)));
  };

  const handleContractUpload = async () => {
    if (!contractUser) return;
    if (!pendingFile) {
      message.warning(t('adminUsers.selectContractFile'));
      return;
    }
    setUploadingContract(true);
    try {
      const fd = new FormData();
      fd.append('document', pendingFile);
      if (contractTitle.trim()) fd.append('title', contractTitle.trim());
      await api.post(`/auth/admin/users/${contractUser.id}/contracts/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(t('adminUsers.contractUploaded'));
      setPendingFile(null);
      setContractTitle('');
      await fetchContracts(contractUser.id);
      refreshContractCount(contractUser.id, (contractUser.contract_count || 0) + 1);
      setContractUser((cu) => (cu ? { ...cu, contract_count: (cu.contract_count || 0) + 1 } : cu));
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : null;
      message.error(typeof firstErr === 'string' ? firstErr : t('adminUsers.contractUploadFailed'));
    } finally {
      setUploadingContract(false);
    }
  };

  const handleContractDelete = async (contractId) => {
    if (!contractUser) return;
    try {
      await api.delete(`/auth/admin/users/${contractUser.id}/contracts/${contractId}/`);
      message.success(t('adminUsers.contractDeleted'));
      const nextContracts = contracts.filter((c) => c.id !== contractId);
      setContracts(nextContracts);
      refreshContractCount(contractUser.id, Math.max(0, (contractUser.contract_count || 1) - 1));
      setContractUser((cu) => (cu ? { ...cu, contract_count: Math.max(0, (cu.contract_count || 1) - 1) } : cu));
    } catch {
      message.error(t('adminUsers.contractDeleteFailed'));
    }
  };

  const fetchUsers = (page = 1) => {
    setLoading(true);
    const params = { page };
    if (search) params.search = search;
    if (emailFilter) params.email_q = emailFilter;
    if (phoneFilter) params.phone_q = phoneFilter;
    if (roleFilter) params.role = roleFilter;
    params.is_active = showArchived ? 'false' : 'true';

    api.get('/auth/admin/users/', { params }).then(({ data }) => {
      const results = data.results || data;
      setUsers(Array.isArray(results) ? results : []);
      setPagination((p) => ({ ...p, current: page, total: data.count || results.length }));
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [roleFilter, showArchived]); // eslint-disable-line

  const toggleActive = async (user) => {
    try {
      await api.patch(`/auth/admin/users/${user.id}/`, { is_active: !user.is_active });
      message.success(user.is_active ? t('adminUsers.userDeactivated') : t('adminUsers.userActivated'));
      fetchUsers(pagination.current);
    } catch {
      message.error(t('adminUsers.failedUpdateUser'));
    }
  };

  const sendPasswordReset = async (user) => {
    try {
      await api.post(`/auth/admin/users/${user.id}/send-password-reset/`);
      message.success(t('adminUsers.passwordResetEmailSent'));
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail && typeof detail === 'object'
        ? Object.values(detail).flat()[0] : null;
      message.error(typeof firstErr === 'string' ? firstErr : t('adminUsers.failedResetPassword'));
    }
  };

  const sendVerifyEmail = async (user) => {
    try {
      await api.post(`/auth/admin/users/${user.id}/resend-verification/`);
      message.success(t('adminUsers.verifyEmailSent'));
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail && typeof detail === 'object'
        ? Object.values(detail).flat()[0] : null;
      message.error(typeof firstErr === 'string' ? firstErr : t('adminUsers.failedSendVerify'));
    }
  };

  const isMobile = !screens.md;

  const columns = [
    {
      title: t('adminUsers.name'), dataIndex: 'full_name', ellipsis: true,
      render: (name) => <span style={{ fontWeight: 600 }}>{name}</span>,
    },
    { title: t('adminUsers.email'), dataIndex: 'email', ellipsis: true },
    { title: t('adminUsers.phone'), dataIndex: 'phone_number', width: 140, ellipsis: true },
    {
      title: t('adminUsers.role'), dataIndex: 'role', width: 110,
      render: (role) => (
        <Tag color={role === 'admin' ? 'purple' : 'blue'}
             style={{ whiteSpace: 'nowrap' }} title={role}>
          {role}
        </Tag>
      ),
    },
    {
      title: t('adminUsers.userType'), dataIndex: 'user_type', width: 120,
      render: (type) => {
        const label = type === 'company' ? t('adminUsers.company') : t('adminUsers.personal');
        return (
          <Tag color={type === 'company' ? 'gold' : 'default'}
               style={{ whiteSpace: 'nowrap' }} title={label}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: t('adminOrders.status'), dataIndex: 'is_active', width: 120,
      render: (active) => {
        const label = active ? t('common.active') : t('common.inactive');
        return (
          <Tag color={active ? 'green' : 'red'}
               style={{ whiteSpace: 'nowrap' }} title={label}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: t('adminUsers.verified'), dataIndex: 'email_verified', width: 170,
      render: (verified) => {
        const label = verified ? t('adminUsers.verified') : t('adminUsers.unverified');
        return (
          <Tag color={verified ? 'green' : 'orange'}
               style={{ whiteSpace: 'nowrap' }} title={label}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: t('adminUsers.ordersCount'), dataIndex: 'order_count', width: 90,
      render: (count, record) => record.role === 'customer' && count > 0 ? (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontWeight: 600 }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/orders?user_id=${record.id}&user_name=${encodeURIComponent(record.full_name)}`);
          }}
        >
          {count}
        </Button>
      ) : count,
    },
    {
      title: '', width: 240,
      render: (_, record) => {
        const isCompany = record.user_type === 'company';
        return (
          <Space size={4}>
            {record.role === 'customer' && (
              <Button
                size="small"
                type="text"
                icon={<ShoppingOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/admin/orders?user_id=${record.id}&user_name=${encodeURIComponent(record.full_name)}`);
                }}
                title={t('adminUsers.viewOrders')}
                style={{ color: 'var(--text-secondary)' }}
              />
            )}
            <Tooltip
              title={!isCompany
                ? t('adminUsers.uploadContractOnlyCompany')
                : (record.contract_count > 0
                    ? t('adminUsers.contractsUploadedCount', { count: record.contract_count })
                    : t('adminUsers.uploadContract'))}
            >
              <Badge
                count={record.contract_count || 0}
                size="small"
                offset={[-2, 4]}
                color="var(--accent)"
              >
                <Button
                  size="small"
                  type="text"
                  icon={<FileAddOutlined />}
                  disabled={!isCompany}
                  onClick={(e) => { e.stopPropagation(); openContractModal(record); }}
                  style={{
                    color: !isCompany
                      ? undefined
                      : (record.contract_count > 0 ? 'var(--accent)' : 'var(--text-secondary)'),
                  }}
                />
              </Badge>
            </Tooltip>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={(e) => { e.stopPropagation(); navigate(`/admin/users/${record.id}`); }}
              style={{ color: 'var(--accent)' }}
              title={t('common.edit')}
            />
            {!record.email_verified && record.is_active && (
              <Popconfirm
                title={t('adminUsers.sendVerifyConfirm', { email: record.email })}
                onConfirm={(e) => { e.stopPropagation?.(); sendVerifyEmail(record); }}
                onCancel={(e) => e.stopPropagation?.()}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Button
                  size="small"
                  type="text"
                  icon={<MailOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--text-secondary)' }}
                  title={t('adminUsers.sendVerifyEmail')}
                />
              </Popconfirm>
            )}
            {record.is_active && (
              <Popconfirm
                title={t('adminUsers.sendResetConfirm', { email: record.email })}
                onConfirm={(e) => { e.stopPropagation?.(); sendPasswordReset(record); }}
                onCancel={(e) => e.stopPropagation?.()}
                okText={t('common.yes')}
                cancelText={t('common.no')}
              >
                <Button
                  size="small"
                  type="text"
                  icon={<KeyOutlined />}
                  onClick={(e) => e.stopPropagation()}
                  style={{ color: 'var(--text-secondary)' }}
                  title={t('adminUsers.sendResetEmail')}
                />
              </Popconfirm>
            )}
            <Popconfirm
              title={record.is_active
                ? t('adminUsers.disableConfirm', { name: record.full_name })
                : t('adminUsers.enableConfirm', { name: record.full_name })}
              onConfirm={(e) => { e.stopPropagation?.(); toggleActive(record); }}
              onCancel={(e) => e.stopPropagation?.()}
              okText={t('common.yes')}
              cancelText={t('common.no')}
              okButtonProps={{ danger: record.is_active }}
            >
              <Button
                size="small"
                type="text"
                danger={record.is_active}
                icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                onClick={(e) => e.stopPropagation()}
                title={record.is_active ? t('common.disable') : t('common.enable')}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // Width grew by ~80px to fit the extra two buttons. Update the action column width.

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          {t('adminUsers.userManagement')}
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/admin/users/new')}
          style={{
            background: 'var(--accent)', borderColor: 'var(--accent)',
            borderRadius: 10, height: 40, fontWeight: 600,
          }}
        >
          {t('adminUsers.newUser')}
        </Button>
      </div>

      {/* Filter bar */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        padding: isMobile ? '14px 16px' : '16px 20px',
        marginBottom: 20,
        boxShadow: 'var(--shadow-xs)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 12, color: 'var(--text-tertiary)',
        }}>
          <FilterOutlined style={{ fontSize: 13 }} />
          <Text style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {t('common.filters')}
          </Text>
        </div>
        <Space wrap>
          <Input
            placeholder={t('common.search')}
            prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
            allowClear
            style={{ width: 200, borderRadius: 10 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => fetchUsers()}
          />
          <Input
            placeholder={t('auth.email')}
            allowClear
            style={{ width: 180, borderRadius: 10 }}
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            onPressEnter={() => fetchUsers()}
            onBlur={() => fetchUsers()}
          />
          <Input
            placeholder={t('auth.phone')}
            allowClear
            style={{ width: 160, borderRadius: 10 }}
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
            onPressEnter={() => fetchUsers()}
            onBlur={() => fetchUsers()}
          />
          <Select
            placeholder={t('adminUsers.role')}
            allowClear
            style={{ width: 130 }}
            value={roleFilter || undefined}
            onChange={(v) => setRoleFilter(v || '')}
            options={[
              { value: 'customer', label: t('adminUsers.customer') },
              { value: 'admin', label: t('common.admin') },
            ]}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <Switch
              size="small"
              checked={showArchived}
              onChange={setShowArchived}
            />
            <Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('common.showArchived')}
            </Text>
          </div>
        </Space>
      </div>

      {/* Content */}
      {isMobile ? (
        <>
          {loading && users.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
              {t('common.loading')}
            </div>
          ) : users.length === 0 ? (
            <Empty description={t('adminUsers.noUsers')} />
          ) : (
            <>
              {users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                  style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    marginBottom: 10,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 6, gap: 8,
                  }}>
                    <Text
                      style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15, flex: 1, minWidth: 0 }}
                      ellipsis={{ tooltip: u.full_name }}
                    >
                      {u.full_name}
                    </Text>
                    <Space size={4} style={{ flexShrink: 0 }}>
                      {!u.email_verified && (
                        <Tag color="orange" style={{ margin: 0 }}>
                          {t('adminUsers.unverified')}
                        </Tag>
                      )}
                      <Tag color={u.is_active ? 'green' : 'red'} style={{ margin: 0 }}>
                        {u.is_active ? t('common.active') : t('common.inactive')}
                      </Tag>
                    </Space>
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {u.email}
                    {u.user_type === 'company' && u.company_name && (
                      <span style={{ color: 'var(--text-tertiary)' }}> · {u.company_name}</span>
                    )}
                    {u.company_id && (
                      <span style={{ color: 'var(--text-tertiary)' }}> · {u.company_id}</span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Tag color={u.role === 'admin' ? 'purple' : 'blue'}>{u.role}</Tag>
                      <Tag color={u.user_type === 'company' ? 'gold' : 'default'}>
                        {u.user_type === 'company' ? t('adminUsers.company') : t('adminUsers.personal')}
                      </Tag>
                      {u.role === 'customer' && u.order_count != null && (
                        <Tag
                          color="cyan"
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/admin/orders?user_id=${u.id}&user_name=${encodeURIComponent(u.full_name)}`);
                          }}
                        >
                          <ShoppingOutlined /> {u.order_count} {t('adminUsers.ordersCount').toLowerCase()}
                        </Tag>
                      )}
                    </div>
                    <Space size={0}>
                      {u.user_type === 'company' && (
                        <Badge
                          count={u.contract_count || 0}
                          size="small"
                          offset={[-2, 4]}
                          color="var(--accent)"
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<FileAddOutlined />}
                            title={u.contract_count > 0
                              ? t('adminUsers.contractsUploadedCount', { count: u.contract_count })
                              : t('adminUsers.uploadContract')}
                            onClick={(e) => { e.stopPropagation(); openContractModal(u); }}
                            style={{
                              color: u.contract_count > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                            }}
                          />
                        </Badge>
                      )}
                      <RightOutlined style={{ color: 'var(--text-tertiary)', fontSize: 11 }} />
                    </Space>
                  </div>
                </div>
              ))}
              {pagination.current * pagination.pageSize < pagination.total && (
                <Button
                  block
                  loading={loading}
                  onClick={() => fetchUsers(pagination.current + 1)}
                  style={{
                    marginTop: 12, height: 46, borderRadius: 12,
                    fontWeight: 600, border: '1px solid var(--border-color)',
                  }}
                >
                  {t('common.loadMore')}
                </Button>
              )}
            </>
          )}
        </>
      ) : (
        <div style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            size="middle"
            scroll={{ x: 1280 }}
            pagination={{
              ...pagination,
              onChange: fetchUsers,
              showSizeChanger: false,
              style: { padding: '0 16px' },
            }}
          />
        </div>
      )}

      <Modal
        title={contractUser
          ? t('adminUsers.uploadContractFor', { name: contractUser.full_name })
          : t('adminUsers.uploadContract')}
        open={!!contractUser}
        onCancel={closeContractModal}
        onOk={handleContractUpload}
        okText={t('adminUsers.uploadContract')}
        cancelText={t('common.close')}
        confirmLoading={uploadingContract}
        okButtonProps={{ disabled: !pendingFile }}
        destroyOnClose
        width={isMobile ? '94vw' : 560}
        styles={{
          content: { borderRadius: 16 },
          body: { padding: isMobile ? '12px 18px 18px' : '16px 24px 24px' },
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Existing contracts */}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
            }}>
              {t('adminUsers.existingContracts')}
            </div>
            {contractsLoading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : contracts.length === 0 ? (
              <div style={{
                padding: '18px 14px', textAlign: 'center',
                background: 'var(--bg-secondary)', borderRadius: 10,
                color: 'var(--text-tertiary)', fontSize: 13,
              }}>
                {t('adminUsers.noContracts')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {contracts.map((c) => (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: 'var(--bg-secondary)', borderRadius: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: 'var(--accent-bg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent)', fontSize: 14, flexShrink: 0,
                    }}>
                      <FileTextOutlined />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {c.title || c.original_filename || `Contract #${c.id}`}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {dayjs(c.created_at).format('DD MMM YYYY')}
                        {c.file_size ? ` · ${formatBytes(c.file_size)}` : ''}
                      </div>
                    </div>
                    <Button
                      size="small"
                      href={c.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      icon={<DownloadOutlined />}
                      style={{ borderRadius: 8 }}
                    />
                    <Popconfirm
                      title={t('adminUsers.deleteContractConfirm')}
                      onConfirm={() => handleContractDelete(c.id)}
                      okText={t('common.yes')}
                      cancelText={t('common.no')}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload new */}
          <div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
            }}>
              {t('adminUsers.uploadNewContract')}
            </div>
            <Text style={{ color: 'var(--text-secondary)', fontSize: 13, display: 'block', marginBottom: 10 }}>
              {t('adminUsers.contractsHint')}
            </Text>
            <Input
              placeholder={t('adminUsers.contractTitlePlaceholder')}
              value={contractTitle}
              onChange={(e) => setContractTitle(e.target.value)}
              maxLength={200}
              style={{ borderRadius: 10, marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Upload
                accept={ACCEPT_CONTRACT}
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > MAX_CONTRACT_SIZE) {
                    message.error(t('adminUsers.contractTooLarge'));
                    return false;
                  }
                  setPendingFile(file);
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                  {pendingFile ? t('adminUsers.changeFile') : t('adminUsers.chooseFile')}
                </Button>
              </Upload>
              {pendingFile && (
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {pendingFile.name}
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {' '}({formatBytes(pendingFile.size)})
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
