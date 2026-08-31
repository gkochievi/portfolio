import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Typography, Tag, Modal, Form, Input, Select, Switch, Space,
  message, Grid, Empty, Segmented, Popconfirm, Statistic, Divider, Tooltip, Row, Col,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined,
  SearchOutlined, FilterOutlined, CarOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { StatusBadge } from '../../components/common/StatusBadge';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export default function AdminCarOwnersPage() {
  const screens = useBreakpoint();
  const { t } = useLang();
  const isMobile = !screens.md;
  const navigate = useNavigate();

  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [activity, setActivity] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Cars drilldown modal
  const [carsModalOpen, setCarsModalOpen] = useState(false);
  const [carsOwner, setCarsOwner] = useState(null);
  const [carsLoading, setCarsLoading] = useState(false);

  const ownerType = Form.useWatch('owner_type', form);

  const fetchOwners = () => {
    setLoading(true);
    api.get('/car-owners/admin/').then(({ data }) => {
      const results = data.results || data;
      setOwners(Array.isArray(results) ? results : []);
    }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchOwners(); }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return owners.filter((o) => {
      if (showArchived ? o.is_active !== false : o.is_active === false) return false;
      if (typeFilter && o.owner_type !== typeFilter) return false;
      if (activityFilter === 'active' && !(o.orders_active > 0)) return false;
      if (activityFilter === 'idle' && o.orders_active > 0) return false;
      if (q) {
        const hay = `${o.display_name || ''} ${o.phone || ''} ${o.email || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [owners, showArchived, search, typeFilter, activityFilter]);

  const openModal = (owner = null) => {
    setEditing(owner);
    setDetail(null);
    setActivity(null);
    if (owner) {
      form.setFieldsValue({ ...owner });
      api.get(`/car-owners/admin/${owner.id}/`).then(({ data }) => {
        setDetail(data);
        form.setFieldsValue(data);
      }).catch(() => {});
      api.get(`/car-owners/admin/${owner.id}/activity/`).then(({ data }) => setActivity(data)).catch(() => {});
    } else {
      form.resetFields();
      form.setFieldsValue({ owner_type: 'personal', is_active: true });
    }
    setModalOpen(true);
  };

  const openCarsModal = async (e, owner) => {
    e.stopPropagation();
    setCarsOwner(null);
    setCarsModalOpen(true);
    setCarsLoading(true);
    try {
      const { data } = await api.get(`/car-owners/admin/${owner.id}/`);
      setCarsOwner(data);
    } catch {
      message.error(t('carOwners.loadFailed'));
    } finally {
      setCarsLoading(false);
    }
  };

  const quickUpdate = async (owner, patch) => {
    try {
      await api.patch(`/car-owners/admin/${owner.id}/`, patch);
      setOwners((prev) => prev.map((o) => (o.id === owner.id ? { ...o, ...patch } : o)));
      message.success(t('carOwners.ownerUpdated'));
    } catch {
      message.error(t('carOwners.saveFailed'));
      fetchOwners();
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/car-owners/admin/${editing.id}/`, values);
        message.success(t('carOwners.ownerUpdated'));
      } else {
        await api.post('/car-owners/admin/', values);
        message.success(t('carOwners.ownerCreated'));
      }
      setModalOpen(false);
      fetchOwners();
    } catch (err) {
      const data = err.response?.data;
      const first = data ? Object.values(data).flat()[0] : null;
      message.error(typeof first === 'string' ? first : t('carOwners.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/car-owners/admin/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'car-owners.csv';
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('carOwners.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  const TYPE_OPTIONS = [
    { value: 'personal', label: t('carOwners.person') },
    { value: 'company', label: t('carOwners.company') },
  ];

  const ACTIVITY_OPTIONS = [
    { value: 'all', label: t('carOwners.activityAll') },
    { value: 'active', label: t('carOwners.activityActive') },
    { value: 'idle', label: t('carOwners.activityIdle') },
  ];

  const columns = [
    {
      title: t('carOwners.title'), dataIndex: 'display_name', ellipsis: true,
      render: (_, r) => <span style={{ fontWeight: 600 }}>{r.display_name}</span>,
    },
    {
      title: t('carOwners.type'), dataIndex: 'owner_type', width: 130,
      render: (v) => <Tag>{v === 'company' ? t('carOwners.company') : t('carOwners.person')}</Tag>,
    },
    { title: t('carOwners.phone'), dataIndex: 'phone', width: 160, ellipsis: true },
    {
      title: t('carOwners.vehicles'), dataIndex: 'vehicles_count', width: 100,
      render: (n, record) => (
        <Tooltip title={t('carOwners.viewCars')}>
          <Tag
            icon={<CarOutlined />}
            style={{ cursor: 'pointer' }}
            onClick={(e) => openCarsModal(e, record)}
          >
            {n || 0}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: t('carOwners.ordersColumn'), dataIndex: 'orders_total', width: 130,
      sorter: (a, b) => (a.orders_total || 0) - (b.orders_total || 0),
      render: (total, r) => (
        <Space size={4}>
          <span>{total || 0}</span>
          {r.orders_active > 0 && (
            <Tag color="blue" style={{ fontSize: 11, padding: '0 4px', lineHeight: '16px' }}>
              {r.orders_active} {t('carOwners.ordersActive')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('carOwners.revenue'), dataIndex: 'revenue_completed', width: 110,
      sorter: (a, b) => (a.revenue_completed || 0) - (b.revenue_completed || 0),
      render: (v) => v ? `₾${v}` : '—',
    },
    {
      title: t('carOwners.lastActivity'), dataIndex: 'last_activity', width: 140,
      sorter: (a, b) => {
        if (!a.last_activity && !b.last_activity) return 0;
        if (!a.last_activity) return 1;
        if (!b.last_activity) return -1;
        return dayjs(a.last_activity).unix() - dayjs(b.last_activity).unix();
      },
      render: (v) => v ? dayjs(v).format('MMM D, YYYY') : '—',
    },
    {
      title: '', width: 90,
      render: (_, record) => (
        <Space size={2} onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title={record.is_active ? t('common.confirmDisable') : t('common.confirmEnable')}
            onConfirm={() => quickUpdate(record, { is_active: !record.is_active })}
            okText={t('common.yes')} cancelText={t('common.no')}
            okButtonProps={{ danger: record.is_active }}
          >
            <Button size="small" type="text"
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              style={{ color: record.is_active ? 'var(--accent)' : 'var(--text-tertiary)' }} />
          </Popconfirm>
          <Button size="small" type="text" icon={<EditOutlined />}
            onClick={() => openModal(record)} style={{ color: 'var(--accent)' }} />
        </Space>
      ),
    },
  ];

  // Cars drilldown table columns
  const carsColumns = [
    { title: t('adminVehicles.vehicleName'), dataIndex: 'name', ellipsis: true },
    { title: t('adminVehicles.plateNumber'), dataIndex: 'plate_number', width: 130 },
    {
      title: t('adminVehicles.status'), dataIndex: 'status', width: 110,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: t('carOwners.ordersActive'), dataIndex: 'orders_active', width: 80,
      render: (v) => v > 0 ? <Tag color="blue">{v}</Tag> : <span style={{ color: 'var(--text-tertiary)' }}>0</span>,
    },
    {
      title: t('carOwners.ordersTotal'), dataIndex: 'orders_total', width: 80,
      render: (v) => v || 0,
    },
  ];

  return (
    <div className="page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <Title level={3} style={{ margin: 0, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          {t('carOwners.title')}
        </Title>
        <Space wrap>
          <Button
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
            style={{ borderRadius: 10, height: 40 }}
          >
            {exporting ? t('carOwners.exporting') : t('carOwners.export')}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}
            style={{ background: 'var(--accent)', borderColor: 'var(--accent)', borderRadius: 10, height: 40, fontWeight: 600 }}>
            {t('carOwners.addOwner')}
          </Button>
        </Space>
      </div>

      <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: isMobile ? '14px 16px' : '16px 20px', marginBottom: 20, boxShadow: 'var(--shadow-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, color: 'var(--text-tertiary)' }}>
          <FilterOutlined style={{ fontSize: 13 }} />
          <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('common.filters')}
          </Text>
        </div>
        <Space wrap>
          <Input placeholder={t('common.search')} prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />} allowClear
            style={{ width: 220, borderRadius: 10 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select placeholder={t('carOwners.type')} allowClear style={{ width: 170 }}
            value={typeFilter || undefined} onChange={(v) => setTypeFilter(v || '')} options={TYPE_OPTIONS} />
          <Select
            style={{ width: 190 }}
            value={activityFilter}
            onChange={(v) => setActivityFilter(v)}
            options={ACTIVITY_OPTIONS}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <Switch size="small" checked={showArchived} onChange={setShowArchived} />
            <Text style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{t('common.showArchived')}</Text>
          </div>
        </Space>
      </div>

      {visible.length === 0 && !loading ? (
        <Empty description={t('carOwners.noOwners')} />
      ) : (
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
          <Table columns={columns} dataSource={visible} rowKey="id" loading={loading}
            size="middle" pagination={false} scroll={{ x: 'max-content' }}
            onRow={(record) => ({ onClick: () => openModal(record) })} />
        </div>
      )}

      {/* Edit / Create Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 17 }}>{editing ? t('carOwners.editOwner') : t('carOwners.addOwner')}</span>}
        open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose
        width={isMobile ? '94vw' : 640}
        styles={{ content: { borderRadius: 16 }, body: { paddingTop: 8 } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          <Form.Item name="owner_type" label={<span style={{ fontWeight: 600 }}>{t('carOwners.type')}</span>}>
            <Segmented block options={TYPE_OPTIONS} />
          </Form.Item>

          {ownerType === 'company' ? (
            <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
              <Form.Item name="company_name" label={<span style={{ fontWeight: 600 }}>{t('carOwners.companyName')}</span>}
                rules={[{ required: true, message: t('common.required') }]} style={{ flex: 1 }}>
                <Input style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item name="company_id" label={<span style={{ fontWeight: 600 }}>{t('carOwners.companyId')}</span>}
                rules={[
                  { required: true, message: t('common.required') },
                  { pattern: /^\d{9}$/, message: t('common.invalidCompanyId') },
                ]} style={{ flex: 1 }}>
                <Input maxLength={9} style={{ borderRadius: 10 }} />
              </Form.Item>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
              <Form.Item name="first_name" label={<span style={{ fontWeight: 600 }}>{t('carOwners.firstName')}</span>}
                rules={[{ required: true, message: t('common.required') }]} style={{ flex: 1 }}>
                <Input style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item name="last_name" label={<span style={{ fontWeight: 600 }}>{t('carOwners.lastName')}</span>}
                rules={[{ required: true, message: t('common.required') }]} style={{ flex: 1 }}>
                <Input style={{ borderRadius: 10 }} />
              </Form.Item>
              <Form.Item name="personal_id" label={<span style={{ fontWeight: 600 }}>{t('carOwners.personalId')}</span>}
                rules={[
                  { pattern: /^\d{11}$/, message: t('common.invalidPersonalId') },
                ]} style={{ flex: 1 }}>
                <Input maxLength={11} style={{ borderRadius: 10 }} />
              </Form.Item>
            </div>
          )}

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item name="phone" label={<span style={{ fontWeight: 600 }}>{t('carOwners.phone')}</span>}
              rules={[
                { required: true, message: t('common.required') },
                { pattern: /^\+?\d[\d\s\-()]{5,30}\d$/, message: t('common.invalidPhone') },
              ]} style={{ flex: 1 }}>
              <Input placeholder="+995 555 12 34 56" style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item name="email" label={<span style={{ fontWeight: 600 }}>{t('carOwners.email')}</span>}
              rules={[{ type: 'email', message: t('common.required') }]} style={{ flex: 1 }}>
              <Input style={{ borderRadius: 10 }} />
            </Form.Item>
          </div>

          <Form.Item name="address" label={<span style={{ fontWeight: 600 }}>{t('carOwners.address')}</span>}>
            <Input style={{ borderRadius: 10 }} />
          </Form.Item>

          <Form.Item name="notes" label={<span style={{ fontWeight: 600 }}>{t('carOwners.notes')}</span>}>
            <TextArea rows={2} style={{ borderRadius: 10 }} />
          </Form.Item>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 12, marginBottom: 12 }}>
            <Text style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{t('common.active')}</Text>
            <Form.Item name="is_active" valuePropName="checked" style={{ margin: 0 }}>
              <Switch />
            </Form.Item>
          </div>

          {editing && (
            <>
              <Divider style={{ margin: '8px 0 12px' }}>{t('carOwners.vehicles')}</Divider>
              <Space wrap>
                {(detail?.vehicles_detail || []).map((v) => (
                  <Tag key={v.id} icon={<CarOutlined />}>{v.name} ({v.plate_number})</Tag>
                ))}
                {(detail?.vehicles_detail || []).length === 0 && (
                  <Text style={{ color: 'var(--text-tertiary)' }}>—</Text>
                )}
              </Space>

              <Divider style={{ margin: '16px 0 12px' }}>{t('carOwners.activityTitle')}</Divider>
              {activity && (
                <>
                  {/* Stats row */}
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}>
                      <Statistic title={t('carOwners.ordersTotal')} value={activity.orders_total || 0} />
                    </Col>
                    <Col span={6}>
                      <Statistic title={t('carOwners.ordersActive')} value={activity.orders_active || 0} valueStyle={{ color: activity.orders_active > 0 ? '#1677ff' : undefined }} />
                    </Col>
                    <Col span={6}>
                      <Statistic title={t('carOwners.ordersCompleted')} value={activity.orders_completed || 0} />
                    </Col>
                    <Col span={6}>
                      <Statistic title={t('carOwners.revenue')} value={activity.revenue_completed || 0} prefix="₾" />
                    </Col>
                  </Row>
                  <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <Text style={{ fontWeight: 600, marginRight: 6 }}>{t('carOwners.lastActivity')}:</Text>
                    {activity.last_activity ? dayjs(activity.last_activity).format('MMM D, YYYY HH:mm') : '—'}
                  </div>

                  {/* Orders by status */}
                  {activity.orders_by_status && Object.keys(activity.orders_by_status).length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                      <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 6 }}>
                        {t('carOwners.statusBreakdown')}
                      </Text>
                      <Space wrap>
                        {Object.entries(activity.orders_by_status).map(([status, count]) => (
                          <Space key={status} size={4}>
                            <StatusBadge status={status} />
                            <Text style={{ fontWeight: 600 }}>{count}</Text>
                          </Space>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* Recent jobs */}
                  <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
                    {t('carOwners.recentJobs')}
                  </Text>
                  {(activity.recent_orders || []).length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('carOwners.noJobs')} style={{ margin: '8px 0' }} />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(activity.recent_orders).map((job) => (
                        <div
                          key={job.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8,
                            cursor: 'pointer', flexWrap: 'wrap', gap: 6,
                          }}
                          onClick={() => { setModalOpen(false); navigate(`/admin/orders/${job.id}`); }}
                        >
                          <Space size={6} wrap>
                            <Text style={{ fontWeight: 600, fontSize: 13 }}>
                              #{job.public_id || job.id}
                            </Text>
                            <StatusBadge status={job.status} label={job.status_display} />
                            {job.vehicle && (
                              <Tag icon={<CarOutlined />} style={{ fontSize: 12 }}>{job.vehicle.plate_number}</Tag>
                            )}
                          </Space>
                          <Space size={12}>
                            {job.price != null && (
                              <Text style={{ fontWeight: 600, fontSize: 13 }}>₾{job.price}</Text>
                            )}
                            <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                              {job.last_event_at ? dayjs(job.last_event_at).format('MMM D, YYYY') : '—'}
                            </Text>
                          </Space>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
            <Button type="primary" htmlType="submit" block loading={saving} size="large"
              style={{ background: 'var(--accent)', borderColor: 'var(--accent)', borderRadius: 12, height: 46, fontWeight: 700, fontSize: 15 }}>
              {editing ? t('profile.saveChanges') : t('carOwners.addOwner')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Cars drilldown modal */}
      <Modal
        title={<span style={{ fontWeight: 700 }}>{t('carOwners.carsModalTitle')}</span>}
        open={carsModalOpen}
        onCancel={() => { setCarsModalOpen(false); setCarsOwner(null); }}
        footer={null}
        destroyOnClose
        width={isMobile ? '94vw' : 600}
        styles={{ content: { borderRadius: 16 } }}
      >
        {carsLoading || !carsOwner ? (
          <Empty description="…" />
        ) : (carsOwner.vehicles_detail || []).length === 0 ? (
          <Empty />
        ) : (
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            dataSource={carsOwner.vehicles_detail || []}
            columns={carsColumns}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Modal>
    </div>
  );
}
