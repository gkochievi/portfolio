import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Typography, Tag, Modal, Form, Input, Select, DatePicker, Switch, Space,
  message, Grid, Empty, Avatar, Tooltip, Upload, Popconfirm, Segmented,
} from 'antd';
import {
  PlusOutlined, EditOutlined, UserOutlined, StopOutlined, CheckCircleOutlined,
  SearchOutlined, FilterOutlined, FileTextOutlined, CameraOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/common/StatusBadge';
import dayjs from 'dayjs';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import {
  LICENSE_CATEGORIES, parseLicenseCategories, formatLicenseCategories,
  driverCoversVehicle,
} from '../../utils/licenseCategories';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const DRIVER_STATUS_COLORS = {
  active: 'green',
  on_leave: 'orange',
  inactive: 'default',
};

const DATE_FIELDS = ['license_expiry', 'date_of_birth', 'hire_date'];

export default function AdminDriversPage() {
  const screens = useBreakpoint();
  const { t } = useLang();
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState(null);
  const [editingDriverDetail, setEditingDriverDetail] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [licenseNumberFilter, setLicenseNumberFilter] = useState('');
  const [licenseCatsFilter, setLicenseCatsFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [clearPhoto, setClearPhoto] = useState(false);
  const driverLicenseCats = Form.useWatch('license_categories', form);

  const visibleDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const phoneQ = phoneFilter.trim().toLowerCase();
    const lnQ = licenseNumberFilter.trim().toLowerCase();
    const lcQ = licenseCatsFilter.trim().toLowerCase();
    return drivers.filter((d) => {
      if (showArchived ? d.is_active !== false : d.is_active === false) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      if (phoneQ && !(d.phone || '').toLowerCase().includes(phoneQ)) return false;
      if (lnQ && !(d.license_number || '').toLowerCase().includes(lnQ)) return false;
      if (lcQ && !(d.license_categories || '').toLowerCase().includes(lcQ)) return false;
      if (vehicleFilter) {
        // d.vehicles is an array of {id, name, plate_number, ...}
        const hasVehicle = (d.vehicles || []).some((v) => String(v.id) === String(vehicleFilter));
        if (!hasVehicle) return false;
      }
      if (q) {
        const hay = `${d.full_name || ''} ${d.phone || ''} ${d.email || ''} ${d.license_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [drivers, showArchived, search, statusFilter, phoneFilter, licenseNumberFilter, licenseCatsFilter, vehicleFilter]);

  const DRIVER_STATUS_OPTIONS = [
    { value: 'active', label: t('adminDrivers.active') },
    { value: 'on_leave', label: t('adminDrivers.onLeave') },
    { value: 'inactive', label: t('adminDrivers.inactive') },
  ];

  const fetchDrivers = () => {
    setLoading(true);
    api.get('/drivers/admin/').then(({ data }) => {
      const results = data.results || data;
      setDrivers(Array.isArray(results) ? results : []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDrivers();
    api.get('/vehicles/admin/').then(({ data }) => {
      const results = data.results || data;
      setVehicles(Array.isArray(results) ? results : []);
    });
  }, []);

  const openModal = (driver = null) => {
    setEditingDriver(driver);
    setEditingDriverDetail(null);
    setPhotoFile(null);
    setClearPhoto(false);
    setPhotoPreview(driver?.photo || null);
    if (driver) {
      const values = { ...driver };
      DATE_FIELDS.forEach((f) => { values[f] = driver[f] ? dayjs(driver[f]) : null; });
      values.vehicles = (driver.vehicles || []).map((v) => v.id);
      values.license_categories = parseLicenseCategories(driver.license_categories);
      form.setFieldsValue(values);
      // Fetch detail for active orders (list endpoint omits them).
      api.get(`/drivers/admin/${driver.id}/`).then(({ data }) => {
        setEditingDriverDetail(data);
      }).catch(() => {});
    } else {
      form.resetFields();
      form.setFieldsValue({
        status: 'active', is_active: true, vehicles: [], license_categories: [],
      });
    }
    setModalOpen(true);
  };

  const onPickPhoto = (file) => {
    setPhotoFile(file);
    setClearPhoto(false);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target.result);
    reader.readAsDataURL(file);
    return false;
  };

  const onRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setClearPhoto(true);
  };

  const quickUpdate = async (driver, patch) => {
    try {
      await api.patch(`/drivers/admin/${driver.id}/`, patch);
      setDrivers((prev) => prev.map((d) => (d.id === driver.id ? { ...d, ...patch } : d)));
      message.success(t('adminDrivers.driverUpdated'));
    } catch {
      message.error(t('adminDrivers.driverUpdated'));
      fetchDrivers();
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        license_categories: formatLicenseCategories(values.license_categories),
      };
      DATE_FIELDS.forEach((f) => {
        payload[f] = values[f] ? values[f].format('YYYY-MM-DD') : null;
      });
      let saved;
      if (editingDriver) {
        ({ data: saved } = await api.patch(`/drivers/admin/${editingDriver.id}/`, payload));
        message.success(t('adminDrivers.driverUpdated'));
      } else {
        ({ data: saved } = await api.post('/drivers/admin/', payload));
        message.success(t('adminDrivers.driverCreated'));
      }
      if (saved?.id && photoFile) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        await api.patch(`/drivers/admin/${saved.id}/`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else if (saved?.id && clearPhoto) {
        await api.patch(`/drivers/admin/${saved.id}/`, { photo: null });
      }
      setModalOpen(false);
      fetchDrivers();
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('adminDrivers.driverUpdated');
      message.error(typeof firstErr === 'string' ? firstErr : t('adminDrivers.driverUpdated'));
    } finally {
      setSaving(false);
    }
  };

  const isMobile = !screens.md;

  const getDriverStatusLabel = (status) => {
    const labels = {
      active: t('adminDrivers.active'),
      on_leave: t('adminDrivers.onLeave'),
      inactive: t('adminDrivers.inactive'),
    };
    return labels[status] || status;
  };

  const renderVehicleTags = (vs) => {
    if (!vs || vs.length === 0) {
      return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
    }
    return (
      <Space size={4} wrap>
        {vs.slice(0, 3).map((v) => (
          <Tag key={v.id} style={{ margin: 0 }}>{v.plate_number}</Tag>
        ))}
        {vs.length > 3 && <Tag style={{ margin: 0 }}>+{vs.length - 3}</Tag>}
      </Space>
    );
  };

  const columns = [
    {
      title: '', width: 52,
      render: (_, r) => (
        <Avatar
          size={42}
          src={r.photo || undefined}
          icon={<UserOutlined />}
          style={{ background: 'var(--nav-active-bg)', color: 'var(--accent)' }}
        />
      ),
    },
    {
      title: t('adminUsers.name'), dataIndex: 'full_name', ellipsis: true,
      render: (_, r) => <span style={{ fontWeight: 600 }}>{r.full_name}</span>,
    },
    { title: t('adminDrivers.phone'), dataIndex: 'phone', width: 150, ellipsis: true },
    { title: t('adminDrivers.licenseNumber'), dataIndex: 'license_number', width: 140, ellipsis: true },
    {
      title: t('adminDrivers.licenseCategories'), dataIndex: 'license_categories',
      width: 130, ellipsis: true,
      render: (v) => v || <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      title: t('adminDrivers.assignedVehicles'), dataIndex: 'vehicles',
      render: renderVehicleTags,
    },
    {
      title: t('adminVehicles.status'), dataIndex: 'status', width: 140,
      render: (s, r) => (
        <Space size={4} direction="vertical" style={{ lineHeight: 1 }}>
          <Tag color={DRIVER_STATUS_COLORS[s]} style={{ margin: 0 }}>
            {getDriverStatusLabel(s)}
          </Tag>
          {r.is_busy && (
            <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
              {t('adminDrivers.busy')} · {r.active_orders_count}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '', width: 90,
      render: (_, record) => (
        <Space size={2} onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title={record.is_active
              ? t('common.confirmDisable')
              : t('common.confirmEnable')}
            onConfirm={() => quickUpdate(record, { is_active: !record.is_active })}
            okText={t('common.yes')}
            cancelText={t('common.no')}
            okButtonProps={{ danger: record.is_active }}
          >
            <Button
              size="small" type="text"
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              style={{ color: record.is_active ? 'var(--accent)' : 'var(--text-tertiary)' }}
              title={record.is_active ? t('common.disable') : t('common.enable')}
            />
          </Popconfirm>
          <Button
            size="small" type="text"
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
            style={{ color: 'var(--accent)' }}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="page-enter">
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          {t('adminDrivers.title')}
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
          style={{
            background: 'var(--accent)', borderColor: 'var(--accent)',
            borderRadius: 10, height: 40, fontWeight: 600,
          }}
        >
          {t('adminDrivers.addDriver')}
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
          />
          <Input
            placeholder={t('auth.phone')}
            allowClear
            style={{ width: 150, borderRadius: 10 }}
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
          />
          <Input
            placeholder={t('adminDrivers.licenseNumber')}
            allowClear
            style={{ width: 170, borderRadius: 10 }}
            value={licenseNumberFilter}
            onChange={(e) => setLicenseNumberFilter(e.target.value)}
          />
          <Input
            placeholder={t('adminVehicles.licenseCategories')}
            allowClear
            style={{ width: 170, borderRadius: 10 }}
            value={licenseCatsFilter}
            onChange={(e) => setLicenseCatsFilter(e.target.value)}
          />
          <Select
            placeholder={t('adminVehicles.status')}
            allowClear
            style={{ width: 150 }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            options={DRIVER_STATUS_OPTIONS}
          />
          <Select
            placeholder={t('adminDrivers.assignedVehicles')}
            allowClear
            showSearch
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            style={{ width: 200 }}
            value={vehicleFilter || undefined}
            onChange={(v) => setVehicleFilter(v || '')}
            options={vehicles.map((v) => ({
              value: String(v.id),
              label: `${v.name} (${v.plate_number})`,
            }))}
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

      {isMobile ? (
        loading && visibleDrivers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            {t('common.loading')}
          </div>
        ) : visibleDrivers.length === 0 ? (
          <Empty description={t('adminDrivers.noDrivers')} />
        ) : (
          visibleDrivers.map((d) => (
            <div
              key={d.id}
              onClick={() => openModal(d)}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 14,
                padding: '16px',
                marginBottom: 10,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar
                  size={48}
                  src={d.photo || undefined}
                  icon={<UserOutlined />}
                  style={{ background: 'var(--nav-active-bg)', color: 'var(--accent)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 15, color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {d.full_name}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {d.phone} · {d.license_number}
                  </div>
                  <div style={{ marginTop: 6 }}>{renderVehicleTags(d.vehicles)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <Tag color={DRIVER_STATUS_COLORS[d.status]} style={{ margin: 0 }}>
                    {getDriverStatusLabel(d.status)}
                  </Tag>
                  <Popconfirm
                    title={d.is_active
                      ? t('common.confirmDisable')
                      : t('common.confirmEnable')}
                    onConfirm={(e) => { e.stopPropagation?.(); quickUpdate(d, { is_active: !d.is_active }); }}
                    onCancel={(e) => e.stopPropagation?.()}
                    okText={t('common.yes')}
                    cancelText={t('common.no')}
                    okButtonProps={{ danger: d.is_active }}
                  >
                    <Button
                      size="small" type="text"
                      icon={d.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: d.is_active ? 'var(--accent)' : 'var(--text-tertiary)' }}
                    />
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))
        )
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
            dataSource={visibleDrivers}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      <Modal
        title={
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>
            {editingDriver ? t('adminDrivers.editDriver') : t('adminDrivers.addDriver')}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={isMobile ? '94vw' : 620}
        styles={{
          content: { borderRadius: 16, padding: 0 },
          header: { padding: isMobile ? '16px 18px 0' : '20px 24px 0', borderBottom: 'none' },
          body: { padding: isMobile ? '12px 18px 18px' : '16px 24px 24px' },
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          {editingDriver && editingDriverDetail?.active_orders?.length > 0 && (
            <div style={{
              marginBottom: 18, padding: 14,
              background: 'var(--bg-secondary)', borderRadius: 12,
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <FileTextOutlined style={{ color: 'var(--accent)' }} />
                <Text style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                  {t('adminDrivers.activeOrders')} · {editingDriverDetail.active_orders.length}
                </Text>
              </div>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                {editingDriverDetail.active_orders.map((o) => (
                  <Link
                    key={o.id}
                    to={`/admin/orders/${o.id}`}
                    onClick={() => setModalOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 8,
                      background: 'var(--card-bg)', border: '1px solid var(--border-color)',
                      textDecoration: 'none',
                    }}
                  >
                    <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>#{o.id}</Text>
                    <StatusBadge status={o.status} />
                    <Text style={{
                      color: 'var(--text-secondary)', fontSize: 12, flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {o.pickup_location}
                    </Text>
                    {o.scheduled_from && (
                      <Text style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        {dayjs(o.scheduled_from).format('MMM D HH:mm')}
                      </Text>
                    )}
                  </Link>
                ))}
              </Space>
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            padding: '8px 0 16px', marginBottom: 4,
          }}>
            <Avatar
              size={72}
              src={photoPreview || undefined}
              icon={<UserOutlined />}
              style={{ background: 'var(--nav-active-bg)', color: 'var(--accent)', flexShrink: 0 }}
            />
            <Space size={8} wrap>
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={onPickPhoto}
              >
                <Button icon={<CameraOutlined />} style={{ borderRadius: 10 }}>
                  {photoPreview ? t('adminDrivers.changePhoto') : t('adminDrivers.uploadPhoto')}
                </Button>
              </Upload>
              {photoPreview && (
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={onRemovePhoto}
                  style={{ borderRadius: 10 }}
                >
                  {t('adminDrivers.removePhoto')}
                </Button>
              )}
            </Space>
          </div>

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="first_name"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.firstName')}</span>}
              rules={[{ required: true, message: t('common.required') }]}
              style={{ flex: 1 }}
            >
              <Input style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item
              name="last_name"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.lastName')}</span>}
              rules={[{ required: true, message: t('common.required') }]}
              style={{ flex: 1 }}
            >
              <Input style={{ borderRadius: 10 }} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="phone"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.phone')}</span>}
              rules={[
                { required: true, message: t('common.required') },
                { pattern: /^\+?\d[\d\s\-()]{5,30}\d$/, message: t('common.invalidPhone') },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="+995 555 12 34 56" style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.email')}</span>}
              rules={[{ type: 'email', message: t('common.required') }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="driver@example.com" style={{ borderRadius: 10 }} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="license_number"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.licenseNumber')}</span>}
              rules={[
                { required: true, message: t('common.required') },
                { min: 3, message: t('common.invalidLicenseNumber') },
              ]}
              style={{ flex: 1 }}
            >
              <Input style={{ borderRadius: 10 }} />
            </Form.Item>
            <Form.Item
              name="license_categories"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.licenseCategories')}</span>}
              style={{ flex: 1 }}
            >
              <Select
                mode="multiple"
                placeholder={t('adminDrivers.selectCategories')}
                options={LICENSE_CATEGORIES}
                style={{ borderRadius: 10 }}
                onChange={(newCats) => {
                  const selectedVehicleIds = form.getFieldValue('vehicles') || [];
                  const allowed = vehicles
                    .filter((v) => driverCoversVehicle(newCats, v.license_categories))
                    .map((v) => v.id);
                  form.setFieldsValue({
                    vehicles: selectedVehicleIds.filter((id) => allowed.includes(id)),
                  });
                }}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="license_expiry"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.licenseExpiry')}</span>}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%', borderRadius: 10 }} />
            </Form.Item>
            <Form.Item
              name="hire_date"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.hireDate')}</span>}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%', borderRadius: 10 }} />
            </Form.Item>
            <Form.Item
              name="date_of_birth"
              label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.dateOfBirth')}</span>}
              style={{ flex: 1 }}
            >
              <DatePicker style={{ width: '100%', borderRadius: 10 }} />
            </Form.Item>
          </div>

          <Form.Item
            name="vehicles"
            label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.assignedVehicles')}</span>}
            tooltip={t('adminDrivers.vehiclesHint')}
          >
            <Select
              mode="multiple"
              placeholder={t('adminDrivers.selectVehicles')}
              showSearch
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={vehicles
                .filter((v) => driverCoversVehicle(driverLicenseCats, v.license_categories))
                .map((v) => ({
                  value: v.id,
                  label: v.license_categories
                    ? `${v.name} (${v.plate_number}) — ${v.license_categories}`
                    : `${v.name} (${v.plate_number})`,
                }))}
              notFoundContent={
                (driverLicenseCats || []).length === 0
                  ? t('adminDrivers.selectLicenseFirst')
                  : t('adminDrivers.noMatchingVehicles')
              }
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label={<span style={{ fontWeight: 600 }}>{t('adminDrivers.notes')}</span>}
          >
            <TextArea rows={3} style={{ borderRadius: 10 }} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 14, alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="status"
              label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.status')}</span>}
              style={{ flex: 1 }}
            >
              <Select options={DRIVER_STATUS_OPTIONS} />
            </Form.Item>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'var(--bg-secondary)',
              borderRadius: 12, marginTop: isMobile ? 0 : 30, marginBottom: isMobile ? 16 : 0,
              minWidth: isMobile ? 'auto' : 120, gap: 10,
            }}>
              <Text style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>
                {t('common.active')}
              </Text>
              <Form.Item name="is_active" valuePropName="checked" style={{ margin: 0 }}>
                <Switch />
              </Form.Item>
            </div>
          </div>

          {/* Driver VAT tier — drives the Driver VAT row in the pricing
              breakdown. True = 18% (standard VAT-registered);
              False = 1% (small-business income-tax tier). */}
          <Form.Item
            name="vat_18_percent"
            label={<span style={{ fontWeight: 600 }}>{t('adminPricing.driverVatRate')}</span>}
            initialValue={true}
          >
            <Segmented
              options={[
                { value: true,  label: '18%' },
                { value: false, label: '1%'  },
              ]}
              block
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={saving}
              size="large"
              style={{
                background: 'var(--accent)', borderColor: 'var(--accent)',
                borderRadius: 12, height: 46, fontWeight: 700, fontSize: 15,
              }}
            >
              {editingDriver ? t('profile.saveChanges') : t('adminDrivers.addDriver')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
