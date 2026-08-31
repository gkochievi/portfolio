import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Typography, Tag, Modal, Form, Input, Select, InputNumber, Switch, Space,
  message, Grid, Empty, Upload, Dropdown, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, PictureOutlined, DeleteOutlined,
  StopOutlined, CheckCircleOutlined, DownOutlined, SearchOutlined, FilterOutlined,
  FileTextOutlined, UserOutlined, StarOutlined, StarFilled,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { StatusBadge } from '../../components/common/StatusBadge';
import api from '../../api/client';
import { CategoryImage } from '../../utils/categoryIcons';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import {
  LICENSE_CATEGORIES, parseLicenseCategories, formatLicenseCategories,
} from '../../utils/licenseCategories';
import { DEFAULT_CURRENCY } from '../../utils/currency';

const MAX_VEHICLE_IMAGES = 5;

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

const VEHICLE_STATUS_COLORS = {
  available: 'green',
  in_use: 'blue',
  maintenance: 'orange',
  retired: 'red',
};

export default function AdminVehiclesPage() {
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const { currency = DEFAULT_CURRENCY } = useBranding();
  const localized = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v[lang] || v['en'] || '';
  };
  const [vehicles, setVehicles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [carOwners, setCarOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [vehicleImages, setVehicleImages] = useState([]);
  const [vehicleDetail, setVehicleDetail] = useState(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [plateFilter, setPlateFilter] = useState('');
  const [capacityFilter, setCapacityFilter] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');

  const visibleVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const plateQ = plateFilter.trim().toLowerCase();
    const licQ = licenseFilter.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (showArchived ? v.is_active !== false : v.is_active === false) return false;
      if (categoryFilter && !(v.categories || []).includes(categoryFilter)) return false;
      if (statusFilter && v.status !== statusFilter) return false;
      if (plateQ && !(v.plate_number || '').toLowerCase().includes(plateQ)) return false;
      if (capacityFilter !== '' && capacityFilter != null && !(Number(v.capacity) >= Number(capacityFilter))) return false;
      if (licQ && !(v.license_categories || '').toLowerCase().includes(licQ)) return false;
      if (q) {
        const hay = `${v.name || ''} ${v.plate_number || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vehicles, showArchived, search, categoryFilter, statusFilter, plateFilter, capacityFilter, licenseFilter]);

  const VEHICLE_STATUS_OPTIONS = [
    { value: 'available', label: t('adminVehicles.available') },
    { value: 'in_use', label: t('adminVehicles.inUse') },
    { value: 'maintenance', label: t('adminVehicles.maintenance') },
    { value: 'retired', label: t('adminVehicles.retired') },
  ];

  const fetchVehicles = () => {
    setLoading(true);
    api.get('/vehicles/admin/').then(({ data }) => {
      const results = data.results || data;
      setVehicles(Array.isArray(results) ? results : []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVehicles();
    api.get('/categories/').then(({ data }) => {
      setCategories(Array.isArray(data) ? data : data.results || []);
    });
    api.get('/car-owners/admin/').then(({ data }) => {
      const results = data.results || data;
      setCarOwners(Array.isArray(results) ? results : []);
    }).catch(() => {});
  }, []);

  const openModal = (vehicle = null) => {
    setEditingVehicle(vehicle);
    setVehicleDetail(null);
    if (vehicle) {
      form.setFieldsValue({
        ...vehicle,
        categories: vehicle.categories || [],
        license_categories: parseLicenseCategories(vehicle.license_categories),
      });
      setVehicleImages(vehicle.images || []);
      api.get(`/vehicles/admin/${vehicle.id}/`).then(({ data }) => {
        setVehicleDetail(data);
      }).catch(() => {});
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'available', is_active: true, categories: [], license_categories: [] });
      setVehicleImages([]);
    }
    setModalOpen(true);
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        license_categories: formatLicenseCategories(values.license_categories),
      };
      if (editingVehicle) {
        await api.patch(`/vehicles/admin/${editingVehicle.id}/`, payload);
        message.success(t('adminVehicles.vehicleUpdated'));
      } else {
        await api.post('/vehicles/admin/', payload);
        message.success(t('adminVehicles.vehicleCreated'));
      }
      setModalOpen(false);
      fetchVehicles();
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('adminVehicles.vehicleUpdated');
      message.error(typeof firstErr === 'string' ? firstErr : t('adminVehicles.vehicleUpdated'));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhotos = async (files) => {
    if (!editingVehicle) {
      message.info(t('adminVehicles.saveFirst'));
      return;
    }
    const remaining = MAX_VEHICLE_IMAGES - vehicleImages.length;
    if (remaining <= 0) {
      message.warning(t('adminVehicles.maxImagesReached'));
      return;
    }
    const toUpload = files.slice(0, remaining);
    const fd = new FormData();
    toUpload.forEach((f) => fd.append('images', f));
    setUploadingImages(true);
    try {
      const { data } = await api.post(
        `/vehicles/admin/${editingVehicle.id}/images/`, fd,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setVehicleImages((prev) => [...prev, ...data]);
      fetchVehicles();
    } catch (err) {
      const detail = err.response?.data?.detail || t('adminVehicles.uploadFailed');
      message.error(detail);
    } finally {
      setUploadingImages(false);
    }
  };

  const quickUpdate = async (vehicle, patch) => {
    try {
      await api.patch(`/vehicles/admin/${vehicle.id}/`, patch);
      setVehicles((prev) => prev.map((v) => (v.id === vehicle.id ? { ...v, ...patch } : v)));
      message.success(t('adminVehicles.vehicleUpdated'));
    } catch {
      message.error(t('adminVehicles.vehicleUpdated'));
      fetchVehicles();
    }
  };

  const deletePhoto = async (imageId) => {
    if (!editingVehicle) return;
    try {
      await api.delete(`/vehicles/admin/${editingVehicle.id}/images/${imageId}/`);
      setVehicleImages((prev) => {
        const next = prev.filter((i) => i.id !== imageId);
        // If we deleted the primary, the backend promoted a new one;
        // refresh to pick up the new is_primary flag in the local list.
        const removed = prev.find((i) => i.id === imageId);
        if (removed?.is_primary && next.length > 0) {
          return next.map((img, idx) => ({ ...img, is_primary: idx === 0 }));
        }
        return next;
      });
      fetchVehicles();
    } catch {
      message.error(t('adminVehicles.deleteFailed'));
    }
  };

  const setPrimaryPhoto = async (imageId) => {
    if (!editingVehicle) return;
    try {
      await api.post(`/vehicles/admin/${editingVehicle.id}/images/${imageId}/primary/`);
      setVehicleImages((prev) => {
        const next = prev.map((i) => ({ ...i, is_primary: i.id === imageId }));
        // Re-sort so the primary lands first locally too (matches backend ordering).
        return next.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
      });
      fetchVehicles();
    } catch {
      message.error(t('adminVehicles.setPrimaryFailed'));
    }
  };

  const isMobile = !screens.md;

  const getVehicleStatusLabel = (status) => {
    const labels = {
      available: t('adminVehicles.available'),
      in_use: t('adminVehicles.inUse'),
      maintenance: t('adminVehicles.maintenance'),
      retired: t('adminVehicles.retired'),
    };
    return labels[status] || status;
  };

  const columns = [
    {
      title: '', width: 52,
      render: (_, r) => {
        const primary = (r.categories_detail || [])[0];
        const color = primary?.color || 'var(--accent)';
        return (
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color, overflow: 'hidden',
          }}>
            <CategoryImage imageUrl={primary?.image} icon={primary?.icon} size={primary?.image ? 42 : 30} />
          </div>
        );
      },
    },
    {
      title: t('adminUsers.name'), dataIndex: 'name', ellipsis: true,
      render: (name) => <span style={{ fontWeight: 600 }}>{name}</span>,
    },
    { title: t('adminVehicles.plateNumber'), dataIndex: 'plate_number', width: 120, ellipsis: true },
    {
      title: t('adminOrders.category'), dataIndex: 'categories_detail', width: 180,
      render: (list) => {
        const cats = list || [];
        if (cats.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        return (
          <Space size={4} wrap>
            {cats.map((c) => (
              <Tag key={c.id} color={c.color} style={{ margin: 0 }}>{localized(c.name)}</Tag>
            ))}
          </Space>
        );
      },
    },
    { title: t('adminVehicles.capacity'), dataIndex: 'capacity', width: 90, ellipsis: true,
      render: (c) => (c != null && c !== '' ? `${c} t` : '—') },
    {
      title: t('adminVehicles.licenseCategories'), dataIndex: 'license_categories', width: 130,
      render: (v) => {
        const cats = parseLicenseCategories(v);
        if (cats.length === 0) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        return (
          <Space size={4} wrap>
            {cats.map((c) => <Tag key={c} style={{ margin: 0 }}>{c}</Tag>)}
          </Space>
        );
      },
    },
    {
      title: t('adminVehicles.status'), dataIndex: 'status', width: 170,
      render: (s, record) => (
        <Dropdown
          trigger={['click']}
          menu={{
            items: VEHICLE_STATUS_OPTIONS.map((opt) => ({
              key: opt.value,
              label: (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={VEHICLE_STATUS_COLORS[opt.value]} style={{ margin: 0 }}>
                    {opt.label}
                  </Tag>
                  {s === opt.value && <span style={{ color: 'var(--accent)' }}>✓</span>}
                </span>
              ),
              onClick: () => { if (s !== opt.value) quickUpdate(record, { status: opt.value }); },
            })),
          }}
        >
          <Tag
            color={VEHICLE_STATUS_COLORS[s]}
            style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            {getVehicleStatusLabel(s)}
            {record.active_orders_count > 0 && ` · ${record.active_orders_count}`}
            <DownOutlined style={{ fontSize: 9 }} />
          </Tag>
        </Dropdown>
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
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          {t('adminVehicles.title')}
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
          {t('adminVehicles.addVehicle')}
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
            placeholder={t('adminVehicles.plateNumber')}
            allowClear
            style={{ width: 150, borderRadius: 10 }}
            value={plateFilter}
            onChange={(e) => setPlateFilter(e.target.value)}
          />
          <InputNumber
            min={0}
            placeholder={t('adminVehicles.capacityMin')}
            value={capacityFilter === '' ? null : capacityFilter}
            onChange={(val) => setCapacityFilter(val == null ? '' : val)}
            style={{ width: 150 }}
          />
          <Input
            placeholder={t('adminVehicles.licenseCategories')}
            allowClear
            style={{ width: 170, borderRadius: 10 }}
            value={licenseFilter}
            onChange={(e) => setLicenseFilter(e.target.value)}
          />
          <Select
            placeholder={t('adminOrders.category')}
            allowClear
            showSearch
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            style={{ width: 180 }}
            value={categoryFilter || undefined}
            onChange={(v) => setCategoryFilter(v || '')}
            options={categories.map((c) => ({ value: c.id, label: localized(c.name) }))}
          />
          <Select
            placeholder={t('adminVehicles.status')}
            allowClear
            style={{ width: 150 }}
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            options={VEHICLE_STATUS_OPTIONS}
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
        loading && visibleVehicles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            {t('common.loading')}
          </div>
        ) : visibleVehicles.length === 0 ? (
          <Empty description={t('adminVehicles.noVehicles')} />
        ) : (
          visibleVehicles.map((v) => (
            <div
              key={v.id}
              onClick={() => openModal(v)}
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
                {(() => {
                  const primary = (v.categories_detail || [])[0];
                  const color = primary?.color || 'var(--accent)';
                  const catNames = (v.categories_detail || []).map((c) => localized(c.name)).filter(Boolean).join(', ');
                  return (
                    <>
                      <div style={{
                        width: 48, height: 48, borderRadius: 14,
                        background: `color-mix(in srgb, ${color} 12%, transparent)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color, flexShrink: 0, overflow: 'hidden',
                      }}>
                        <CategoryImage imageUrl={primary?.image} icon={primary?.icon} size={primary?.image ? 48 : 34} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontWeight: 700, fontSize: 15, color: 'var(--text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {v.name}
                        </div>
                        <div style={{
                          fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {v.plate_number} · {catNames || '—'} · {v.capacity != null ? `${v.capacity} t` : '—'}
                        </div>
                      </div>
                    </>
                  );
                })()}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: VEHICLE_STATUS_OPTIONS.map((opt) => ({
                        key: opt.value,
                        label: (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tag color={VEHICLE_STATUS_COLORS[opt.value]} style={{ margin: 0 }}>
                              {opt.label}
                            </Tag>
                            {v.status === opt.value && <span style={{ color: 'var(--accent)' }}>✓</span>}
                          </span>
                        ),
                        onClick: () => { if (v.status !== opt.value) quickUpdate(v, { status: opt.value }); },
                      })),
                    }}
                  >
                    <Tag
                      color={VEHICLE_STATUS_COLORS[v.status]}
                      style={{ margin: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getVehicleStatusLabel(v.status)} <DownOutlined style={{ fontSize: 9 }} />
                    </Tag>
                  </Dropdown>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-color)',
              }}>
                <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
                  {parseLicenseCategories(v.license_categories).length > 0 ? (
                    parseLicenseCategories(v.license_categories).map((c) => (
                      <Tag key={c} style={{ margin: 0, fontSize: 11 }}>{c}</Tag>
                    ))
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {t('adminVehicles.licenseCategories')}: —
                    </span>
                  )}
                </Space>
                <Popconfirm
                  title={v.is_active
                    ? t('common.confirmDisable')
                    : t('common.confirmEnable')}
                  onConfirm={(e) => { e.stopPropagation?.(); quickUpdate(v, { is_active: !v.is_active }); }}
                  onCancel={(e) => e.stopPropagation?.()}
                  okText={t('common.yes')}
                  cancelText={t('common.no')}
                  okButtonProps={{ danger: v.is_active }}
                >
                  <Button
                    size="small" type="text"
                    icon={v.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: v.is_active ? 'var(--accent)' : 'var(--text-tertiary)' }}
                  />
                </Popconfirm>
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
            dataSource={visibleVehicles}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}

      {/* Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>
            {editingVehicle ? t('adminVehicles.editVehicle') : t('adminVehicles.addVehicle')}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={isMobile ? '94vw' : 580}
        styles={{
          content: { borderRadius: 16, padding: 0 },
          header: { padding: isMobile ? '16px 18px 0' : '20px 24px 0', borderBottom: 'none' },
          body: { padding: isMobile ? '12px 18px 18px' : '16px 24px 24px' },
        }}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          {editingVehicle && vehicleDetail && (
            (vehicleDetail.drivers?.length > 0 || vehicleDetail.active_orders?.length > 0) && (
              <div style={{
                marginBottom: 18, padding: 14,
                background: 'var(--bg-secondary)', borderRadius: 12,
                border: '1px solid var(--border-color)',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                {vehicleDetail.drivers?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <UserOutlined style={{ color: 'var(--accent)' }} />
                      <Text style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {t('adminVehicles.linkedDrivers')} · {vehicleDetail.drivers.length}
                      </Text>
                    </div>
                    <Space size={6} wrap>
                      {vehicleDetail.drivers.map((d) => {
                        const label = `${d.full_name} · ${d.phone}`;
                        return (
                          <Tooltip key={d.id} title={label}>
                            <Tag
                              color={d.status === 'active' ? 'green' : 'default'}
                              style={{
                                margin: 0, maxWidth: 220,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}
                            >
                              {label}
                            </Tag>
                          </Tooltip>
                        );
                      })}
                    </Space>
                  </div>
                )}
                {vehicleDetail.active_orders?.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <FileTextOutlined style={{ color: 'var(--accent)' }} />
                      <Text style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {t('adminVehicles.activeOrders')} · {vehicleDetail.active_orders.length}
                      </Text>
                    </div>
                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      {vehicleDetail.active_orders.map((o) => (
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
                          {o.assigned_driver_name && (
                            <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                              {o.assigned_driver_name}
                            </Text>
                          )}
                          <Text style={{
                            color: 'var(--text-tertiary)', fontSize: 12, flex: 1,
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
              </div>
            )
          )}
          <Form.Item
            name="name"
            label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.vehicleName')}</span>}
            rules={[{ required: true, message: t('common.required') }]}
          >
            <Input placeholder={t('adminVehicles.vehicleNamePlaceholder')} style={{ borderRadius: 10 }} />
          </Form.Item>

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="categories"
              label={<span style={{ fontWeight: 600 }}>{t('adminOrders.category')}</span>}
              rules={[{ required: true, type: 'array', min: 1, message: t('common.required') }]}
              style={{ flex: 1 }}
            >
              <Select
                mode="multiple"
                placeholder={t('adminOrderDetail.selectFinalCategory')}
                showSearch
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={categories.map((c) => ({ value: c.id, label: localized(c.name) }))}
              />
            </Form.Item>
            <Form.Item
              name="plate_number"
              label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.plateNumber')}</span>}
              rules={[
                { required: true, message: t('common.required') },
                { min: 2, message: t('common.invalidPlate') },
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder={t('adminVehicles.plateNumberPlaceholder')} style={{ borderRadius: 10 }} />
            </Form.Item>
          </div>

          <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="year"
              label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.year')}</span>}
              style={{ flex: 1 }}
            >
              <InputNumber placeholder="2023" style={{ width: '100%', borderRadius: 10 }} min={1990} max={new Date().getFullYear() + 1} />
            </Form.Item>
            <Form.Item
              name="capacity"
              label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.capacity')}</span>}
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                max={9999}
                step={0.5}
                addonAfter="t"
                style={{ width: '100%', borderRadius: 10 }}
                placeholder={t('adminVehicles.capacityPlaceholder')}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="license_categories"
            label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.licenseCategories')}</span>}
            tooltip={t('adminVehicles.licenseCategoriesHint')}
          >
            <Select
              mode="multiple"
              placeholder={t('adminDrivers.selectCategories')}
              options={LICENSE_CATEGORIES}
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label={<span style={{ fontWeight: 600 }}>{t('orders.description')}</span>}
          >
            <TextArea rows={3} placeholder={t('adminVehicles.vehicleNamePlaceholder')} style={{ borderRadius: 10 }} />
          </Form.Item>

          {/* Vehicle photos (max 5) */}
          <Form.Item
            label={
              <span style={{ fontWeight: 600 }}>
                {t('adminVehicles.photos')}{' '}
                <Text style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: 12 }}>
                  ({vehicleImages.length}/{MAX_VEHICLE_IMAGES})
                </Text>
              </span>
            }
          >
            {!editingVehicle ? (
              <div style={{
                padding: 12, background: 'var(--bg-secondary)', borderRadius: 10,
                color: 'var(--text-tertiary)', fontSize: 13,
              }}>
                {t('adminVehicles.saveFirst')}
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {vehicleImages.map((img) => (
                    <div key={img.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div
                        style={{
                          position: 'relative', width: 88, height: 88,
                          borderRadius: 10, overflow: 'hidden',
                          border: img.is_primary
                            ? '2px solid var(--accent)'
                            : '1px solid var(--border-color)',
                        }}
                      >
                        <img
                          src={img.image}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Star: filled = current main. Outline = "set as main" action. */}
                        <Tooltip title={img.is_primary ? t('adminVehicles.mainPhoto') : t('adminVehicles.setAsMain')}>
                          <Button
                            size="small"
                            type="primary"
                            shape="circle"
                            icon={img.is_primary
                              ? <StarFilled style={{ color: '#fff' }} />
                              : <StarOutlined />}
                            onClick={() => { if (!img.is_primary) setPrimaryPhoto(img.id); }}
                            style={{
                              position: 'absolute', top: 4, left: 4,
                              width: 22, height: 22, minWidth: 22,
                              background: img.is_primary ? '#f59e0b' : 'rgba(0,0,0,0.55)',
                              borderColor: 'transparent',
                              cursor: img.is_primary ? 'default' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          />
                        </Tooltip>
                        <Button
                          size="small"
                          danger
                          type="primary"
                          shape="circle"
                          icon={<DeleteOutlined />}
                          onClick={() => deletePhoto(img.id)}
                          style={{
                            position: 'absolute', top: 4, right: 4,
                            width: 22, height: 22, minWidth: 22,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        />
                      </div>
                      {img.is_primary && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
                          color: 'var(--accent)', textTransform: 'uppercase',
                        }}>
                          {t('adminVehicles.mainPhoto')}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <Upload
                  multiple
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={() => false}
                  disabled={vehicleImages.length >= MAX_VEHICLE_IMAGES}
                  onChange={({ fileList }) => {
                    const files = fileList
                      .filter((f) => f.originFileObj)
                      .map((f) => f.originFileObj);
                    if (files.length) uploadPhotos(files);
                  }}
                >
                  <Button
                    icon={<PictureOutlined />}
                    loading={uploadingImages}
                    disabled={vehicleImages.length >= MAX_VEHICLE_IMAGES}
                    style={{ borderRadius: 10 }}
                  >
                    {t('adminVehicles.addPhotos')}
                  </Button>
                </Upload>
              </>
            )}
          </Form.Item>

          <div style={{ display: 'flex', gap: 14, alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
            <Form.Item
              name="status"
              label={<span style={{ fontWeight: 600 }}>{t('adminVehicles.status')}</span>}
              style={{ flex: 1 }}
            >
              <Select options={VEHICLE_STATUS_OPTIONS} />
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

          <Form.Item
            name="owner"
            label={<span style={{ fontWeight: 600 }}>{t('carOwners.owner')}</span>}
          >
            <Select
              allowClear
              showSearch
              placeholder={t('carOwners.noOwner')}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={carOwners.map((o) => ({ value: o.id, label: o.display_name }))}
              style={{ borderRadius: 10 }}
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
              {editingVehicle ? t('profile.saveChanges') : t('adminVehicles.addVehicle')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
