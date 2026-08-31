import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Typography, Tag, Modal, Form, Input, InputNumber, Select, Switch, Space,
  ColorPicker, message, Grid, Empty, Upload, Segmented, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined,
  DeleteOutlined, CheckOutlined, SearchOutlined, FilterOutlined,
  SettingOutlined, HolderOutlined,
} from '@ant-design/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove,
  verticalListSortingStrategy, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ImgCrop from 'antd-img-crop';
import api from '../../api/client';
import {
  CategoryImage, getCategoryIcon, searchIcons, getIconMeta, AVAILABLE_ICONS,
} from '../../utils/categoryIcons';
import { useLang } from '../../contexts/LanguageContext';
import { I18nInput, I18nTextArea } from '../../components/common/I18nFormFields';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

// Keep this list in lockstep with backend services/models.py CARGO_FIELD_KEYS.
// Cargo dimensions default to 'optional' (today's behaviour); extras
// (floor/days/fragile) default to 'off' so admins opt-in per service.
const CARGO_FIELD_KEYS = [
  'length', 'width', 'height', 'volume', 'weight',
  'floor', 'days', 'fragile', 'insured', 'insurance',
];
const DEFAULT_CARGO_FIELD_CONFIG = {
  length: 'optional', width: 'optional', height: 'optional',
  volume: 'optional', weight: 'optional',
  floor: 'off', days: 'off', fragile: 'off',
  insured: 'off', insurance: 'off',
};
const normalizeCargoFieldConfig = (raw) => {
  const out = { ...DEFAULT_CARGO_FIELD_CONFIG };
  if (raw && typeof raw === 'object') {
    CARGO_FIELD_KEYS.forEach((k) => {
      if (['off', 'optional', 'required'].includes(raw[k])) out[k] = raw[k];
    });
  }
  return out;
};
const PRICING_MODES = ['fixed', 'calculator'];

function DragHandle({ attributes, listeners }) {
  const { t } = useLang();
  return (
    <span
      {...attributes}
      {...listeners}
      aria-label={t('admin.dragToReorder')}
      style={{
        cursor: 'grab', color: 'var(--text-tertiary)',
        touchAction: 'none', display: 'inline-flex',
        padding: 4, fontSize: 18,
      }}
    >
      <HolderOutlined />
    </span>
  );
}

function DesktopDragHandle({ id }) {
  // Table cells render outside the SortableServiceRowTr scope, so the
  // handle needs its own useSortable hook to grab activator listeners.
  const { attributes, listeners } = useSortable({ id });
  return <DragHandle attributes={attributes} listeners={listeners} />;
}

function SortableServiceRow({ service, children }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: service.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners }) : children}
    </div>
  );
}

function SortableServiceRowTr({ svc, restRowProps, children }) {
  const {
    setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: svc.id });
  const style = {
    ...restRowProps.style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : undefined,
  };
  return (
    <tr {...restRowProps} ref={setNodeRef} style={style}>
      {children}
    </tr>
  );
}

export default function AdminServicesPage() {
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const [services, setServices] = useState([]);
  const [carCategories, setCarCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [carCategoryFilter, setCarCategoryFilter] = useState('');

  // i18n fields
  const [svcName, setSvcName] = useState({ en: '', ka: '', ru: '' });
  const [svcDesc, setSvcDesc] = useState({ en: '', ka: '', ru: '' });
  // Non-i18n fields
  const [svcIcon, setSvcIcon] = useState('tool');
  const [svcColor, setSvcColor] = useState('#F97316');
  const [svcKeywords, setSvcKeywords] = useState('');
  const [svcCarCategoryIds, setSvcCarCategoryIds] = useState([]);

  // Settings modal — cargo-field config + routing toggle live in their own
  // dialog reachable via a gear icon on each row, kept out of the main edit
  // flow so branding/category concerns and order-form concerns stay separate.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsService, setSettingsService] = useState(null);
  const [settingsCargoConfig, setSettingsCargoConfig] = useState(DEFAULT_CARGO_FIELD_CONFIG);
  const [settingsRequiresDest, setSettingsRequiresDest] = useState(false);
  const [settingsFloorMax, setSettingsFloorMax] = useState(30);
  const [settingsDaysMax, setSettingsDaysMax] = useState(30);
  const [settingsFloorPrice, setSettingsFloorPrice] = useState(0);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [svcIsActive, setSvcIsActive] = useState(true);

  const localized = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  const fetchServices = () => {
    setLoading(true);
    api.get('/services/admin/').then(({ data }) => {
      const results = data.results || data;
      setServices(Array.isArray(results) ? results : []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchCarCategories = () => {
    api.get('/categories/admin/').then(({ data }) => {
      const results = data.results || data;
      setCarCategories(Array.isArray(results) ? results : []);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchServices();
    fetchCarCategories();
  }, []);

  const filteredIcons = useMemo(() => searchIcons(iconSearch), [iconSearch]);
  const visibleServices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (showArchived ? s.is_active !== false : s.is_active === false) return false;
      if (carCategoryFilter && !(s.car_categories || []).includes(carCategoryFilter)) return false;
      if (q) {
        const name = typeof s.name === 'object' ? Object.values(s.name).join(' ') : (s.name || '');
        const desc = typeof s.description === 'object' ? Object.values(s.description).join(' ') : (s.description || '');
        const hay = `${name} ${desc} ${s.suggestion_keywords || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [services, showArchived, search, carCategoryFilter]);

  const openModal = (service = null) => {
    setEditingService(service);
    setImageFile(null);
    setImagePreview(service?.image_url || null);
    setImageRemoved(false);
    setIconSearch('');
    if (service) {
      setSvcName(typeof service.name === 'object' ? { en: '', ka: '', ru: '', ...service.name } : { en: service.name || '', ka: '', ru: '' });
      setSvcDesc(typeof service.description === 'object' ? { en: '', ka: '', ru: '', ...service.description } : { en: service.description || '', ka: '', ru: '' });
      setSvcIcon(service.icon || 'tool');
      setSvcColor(service.color || '#F97316');
      setSvcKeywords(service.suggestion_keywords || '');
      setSvcCarCategoryIds(Array.isArray(service.car_categories) ? service.car_categories : []);
      setSvcIsActive(service.is_active !== false);
    } else {
      setSvcName({ en: '', ka: '', ru: '' });
      setSvcDesc({ en: '', ka: '', ru: '' });
      setSvcIcon('tool');
      setSvcColor('#F97316');
      setSvcKeywords('');
      setSvcCarCategoryIds([]);
      setSvcIsActive(true);
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!svcName.en && !svcName.ka && !svcName.ru) {
      message.error(t('common.required'));
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', JSON.stringify(svcName));
      formData.append('description', JSON.stringify(svcDesc));
      formData.append('icon', svcIcon || 'tool');
      formData.append('color', typeof svcColor === 'string' ? svcColor : svcColor?.toHexString?.() || '#F97316');
      formData.append('suggestion_keywords', svcKeywords);
      formData.append('is_active', svcIsActive ? 'true' : 'false');
      formData.append('car_categories', JSON.stringify(svcCarCategoryIds));
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageRemoved) {
        formData.append('image', '');
      }

      if (editingService) {
        await api.patch(`/services/admin/${editingService.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        message.success(t('adminServices.serviceUpdated'));
      } else {
        await api.post('/services/admin/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        message.success(t('adminServices.serviceCreated'));
      }
      setModalOpen(false);
      fetchServices();
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('adminServices.failedUpdateSvc');
      message.error(typeof firstErr === 'string' ? firstErr : t('adminServices.failedUpdateSvc'));
    } finally {
      setSaving(false);
    }
  };

  const openSettings = (service) => {
    setSettingsService(service);
    setSettingsCargoConfig(normalizeCargoFieldConfig(service?.cargo_field_config));
    setSettingsRequiresDest(!!service?.requires_destination);
    setSettingsFloorMax(Number.isFinite(service?.floor_max) && service.floor_max > 0 ? service.floor_max : 30);
    setSettingsDaysMax(Number.isFinite(service?.days_max) && service.days_max > 0 ? service.days_max : 30);
    setSettingsFloorPrice(Number(service?.floor_price) >= 0 ? Number(service.floor_price) : 0);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async () => {
    if (!settingsService) return;
    setSettingsSaving(true);
    try {
      // JSON request — no multipart needed. Patch payload is scoped to the
      // order-form concerns this modal owns, keeping the edit-modal flow's
      // multipart save isolated from this one.
      await api.patch(`/services/admin/${settingsService.id}/`, {
        cargo_field_config: normalizeCargoFieldConfig(settingsCargoConfig),
        requires_destination: settingsRequiresDest,
        floor_max: Math.max(1, Math.min(999, parseInt(settingsFloorMax, 10) || 30)),
        days_max: Math.max(1, Math.min(999, parseInt(settingsDaysMax, 10) || 30)),
        floor_price: Math.max(0, Number(settingsFloorPrice) || 0),
      });
      message.success(t('adminServices.serviceUpdated'));
      setSettingsOpen(false);
      fetchServices();
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('adminServices.failedUpdateSvc');
      message.error(typeof firstErr === 'string' ? firstErr : t('adminServices.failedUpdateSvc'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const toggleActive = async (svc) => {
    try {
      await api.patch(`/services/admin/${svc.id}/`, { is_active: !svc.is_active });
      message.success(svc.is_active ? t('adminServices.serviceDeactivated') : t('adminServices.serviceActivated'));
      fetchServices();
    } catch {
      message.error(t('adminServices.failedUpdateSvc'));
    }
  };

  const handleImageSelect = (info) => {
    const file = info.file;
    setImageFile(file);
    setImageRemoved(false);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
    return false;
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
  };

  const isMobile = !screens.md;

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeList = visibleServices.filter((s) => s.is_active !== false);
    const oldIdx = activeList.findIndex((s) => s.id === active.id);
    const newIdx = activeList.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(activeList, oldIdx, newIdx);

    const idToNewIndex = new Map(reordered.map((s, i) => [s.id, i]));
    const previousServices = services;
    const newServices = [...services].sort((a, b) => {
      const aIdx = idToNewIndex.has(a.id) ? idToNewIndex.get(a.id) : -1;
      const bIdx = idToNewIndex.has(b.id) ? idToNewIndex.get(b.id) : -1;
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    setServices(newServices);
    try {
      await api.post('/services/admin/reorder/', {
        order: reordered.map((s) => s.id),
      });
      message.success(t('admin.orderSaved'));
    } catch (err) {
      setServices(previousServices);
      message.error(t('admin.orderSaveFailed'));
    }
  };

  // Dropdown only offers active car categories, but if a service is already
  // linked to a now-inactive one, keep it in the option list so the tag renders
  // with its name (and flag it "(inactive)" + disabled so it can't be re-added
  // after removal).
  const carCategoryOptions = carCategories
    .filter((c) => c.is_active !== false || svcCarCategoryIds.includes(c.id))
    .map((c) => {
      const inactive = c.is_active === false;
      const baseLabel = localized(c.name) || `#${c.id}`;
      return {
        value: c.id,
        label: inactive ? `${baseLabel} (${t('common.inactive')})` : baseLabel,
        disabled: inactive,
      };
    });

  const renderCarCategoryTags = (ids) => {
    if (!Array.isArray(ids) || ids.length === 0) {
      return <Text style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</Text>;
    }
    return (
      <Space size={4} wrap>
        {ids.slice(0, 3).map((id) => {
          const cat = carCategories.find((c) => c.id === id);
          return (
            <Tag key={id} color={cat?.color || 'default'} style={{ margin: 0 }}>
              {cat ? localized(cat.name) : `#${id}`}
            </Tag>
          );
        })}
        {ids.length > 3 && (
          <Tag style={{ margin: 0 }}>+{ids.length - 3}</Tag>
        )}
      </Space>
    );
  };

  const columns = [
    {
      title: '',
      key: 'dnd',
      width: 40,
      render: (_, record) => {
        if (record.is_active === false || showArchived) return null;
        return <DesktopDragHandle id={record.id} />;
      },
    },
    {
      title: '', width: 84,
      render: (_, record) => (
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: `color-mix(in srgb, ${record.color || 'var(--accent)'} 12%, transparent)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, color: record.color || 'var(--accent)',
          overflow: 'hidden',
        }}>
          {record.image_url ? (
            <img src={record.image_url} alt="" style={{
              maxWidth: '100%', maxHeight: '100%',
              width: 'auto', height: 'auto',
              objectFit: 'contain', display: 'block',
            }} />
          ) : (
            <CategoryImage icon={record.icon} size={28} />
          )}
        </div>
      ),
    },
    {
      title: t('adminUsers.name'), dataIndex: 'name', ellipsis: true,
      render: (name, record) => (
        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          {localized(name)}
          {record.is_helper_card && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '2px 8px',
              fontSize: 10, fontWeight: 700,
              color: 'var(--accent)',
              background: 'var(--accent-bg, rgba(0,184,86,0.08))',
              border: '1px solid var(--accent-bg-strong, rgba(0,184,86,0.18))',
              borderRadius: 999,
              letterSpacing: 0.4, textTransform: 'uppercase',
            }}>
              {t('admin.helperCard')}
            </span>
          )}
        </span>
      ),
    },
    {
      title: t('adminServices.carCategories'), dataIndex: 'car_categories', width: 260,
      render: renderCarCategoryTags,
    },
    {
      title: t('adminCats.color'), dataIndex: 'color', width: 110,
      render: (c) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 18, height: 18, borderRadius: 5,
            background: c || 'var(--accent)',
            border: '1px solid var(--border-color)',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>{c}</span>
        </div>
      ),
    },
    {
      title: t('adminOrders.status'), dataIndex: 'is_active', width: 120,
      render: (active) => {
        const label = active ? t('common.active') : t('common.inactive');
        return (
          <Tag color={active ? 'green' : 'red'} title={label}>
            {label}
          </Tag>
        );
      },
    },
    {
      title: '', width: 150,
      render: (_, record) => (
        <Space size={4}>
          <Button
            size="small" type="text"
            icon={<EditOutlined />}
            onClick={(e) => { e.stopPropagation(); openModal(record); }}
            style={{ color: 'var(--accent)' }}
          />
          {!record.is_helper_card && (
            <Button
              size="small" type="text"
              icon={<SettingOutlined />}
              onClick={(e) => { e.stopPropagation(); openSettings(record); }}
              style={{ color: 'var(--text-secondary)' }}
              title={t('adminServices.cargoFieldsSection')}
            />
          )}
          <Popconfirm
            title={record.is_active
              ? t('common.confirmDisable')
              : t('common.confirmEnable')}
            onConfirm={(e) => { e.stopPropagation?.(); toggleActive(record); }}
            onCancel={(e) => e.stopPropagation?.()}
            okText={t('common.yes')}
            cancelText={t('common.no')}
            okButtonProps={{ danger: record.is_active }}
          >
            <Button
              size="small" type="text"
              danger={record.is_active}
              icon={record.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={(e) => e.stopPropagation()}
              title={record.is_active ? t('common.disable') : t('common.enable')}
            />
          </Popconfirm>
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
          {t('adminServices.title')}
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
          {t('adminServices.newService')}
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
            style={{ width: 220, borderRadius: 10 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            placeholder={t('adminServices.carCategories')}
            allowClear
            showSearch
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            style={{ width: 200, borderRadius: 10 }}
            value={carCategoryFilter || undefined}
            onChange={(v) => setCarCategoryFilter(v || '')}
            options={carCategories
              .filter((c) => c.is_active !== false)
              .map((c) => ({ value: c.id, label: localized(c.name) }))}
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
        loading && visibleServices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            {t('common.loading')}
          </div>
        ) : visibleServices.length === 0 ? (
          <Empty description={t('adminServices.noServices')} />
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={visibleServices.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleServices.map((svc) => {
                const archived = svc.is_active === false || showArchived;

                const renderCardInner = (dragHandle) => (
                  <div
                    style={{
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 14,
                      padding: '16px',
                      marginBottom: 10,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      {dragHandle}
                      <div style={{
                        width: 64, height: 64, borderRadius: 12,
                        background: `color-mix(in srgb, ${svc.color || 'var(--accent)'} 12%, transparent)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, color: svc.color || 'var(--accent)', flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {svc.image_url ? (
                          <img src={svc.image_url} alt="" style={{
                            maxWidth: '100%', maxHeight: '100%',
                            width: 'auto', height: 'auto',
                            objectFit: 'contain', display: 'block',
                          }} />
                        ) : (
                          <CategoryImage icon={svc.icon} size={32} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', display: 'block' }}
                          ellipsis={{ tooltip: localized(svc.name) }}
                        >
                          {localized(svc.name)}
                        </Text>
                        {svc.is_helper_card && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            marginTop: 4, padding: '2px 8px',
                            fontSize: 10, fontWeight: 700,
                            color: 'var(--accent)',
                            background: 'var(--accent-bg, rgba(0,184,86,0.08))',
                            border: '1px solid var(--accent-bg-strong, rgba(0,184,86,0.18))',
                            borderRadius: 999,
                            letterSpacing: 0.4, textTransform: 'uppercase',
                          }}>
                            {t('admin.helperCard')}
                          </span>
                        )}
                      </div>
                      <Tag color={svc.is_active ? 'green' : 'red'} style={{ margin: 0, flexShrink: 0 }}>
                        {svc.is_active ? t('common.active') : t('common.inactive')}
                      </Tag>
                    </div>
                    {localized(svc.description) && (
                      <Text
                        style={{
                          fontSize: 13, color: 'var(--text-tertiary)', display: 'block', marginBottom: 8,
                        }}
                        ellipsis={{ tooltip: localized(svc.description), rows: 2 }}
                      >
                        {localized(svc.description)}
                      </Text>
                    )}
                    <div style={{ marginBottom: 8 }}>
                      {renderCarCategoryTags(svc.car_categories)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button
                        size="small" type="text"
                        icon={<EditOutlined />}
                        onClick={() => openModal(svc)}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        Edit
                      </Button>
                      {!svc.is_helper_card && (
                        <Button
                          size="small" type="text"
                          icon={<SettingOutlined />}
                          onClick={() => openSettings(svc)}
                          style={{ color: 'var(--text-secondary)' }}
                          title={t('adminServices.cargoFieldsSection')}
                        />
                      )}
                      <Popconfirm
                        title={svc.is_active
                          ? t('common.confirmDisable')
                          : t('common.confirmEnable')}
                        onConfirm={() => toggleActive(svc)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                        okButtonProps={{ danger: svc.is_active }}
                      >
                        <Button
                          size="small" type="text"
                          danger={svc.is_active}
                          icon={svc.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                        />
                      </Popconfirm>
                    </div>
                  </div>
                );

                if (archived) {
                  return <div key={svc.id}>{renderCardInner(null)}</div>;
                }
                return (
                  <SortableServiceRow key={svc.id} service={svc}>
                    {({ attributes, listeners }) =>
                      renderCardInner(
                        <DragHandle attributes={attributes} listeners={listeners} />
                      )
                    }
                  </SortableServiceRow>
                );
              })}
            </SortableContext>
          </DndContext>
        )
      ) : (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visibleServices.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xs)',
            }}>
              <Table
                columns={columns}
                dataSource={visibleServices}
                rowKey="id"
                loading={loading}
                size="middle"
                pagination={false}
                scroll={{ x: 'max-content' }}
                components={{
                  body: {
                    row: ({ children, ...restRowProps }) => {
                      const rowId = restRowProps['data-row-key'];
                      const svc = visibleServices.find((s) => String(s.id) === String(rowId));
                      if (!svc) return <tr {...restRowProps}>{children}</tr>;
                      if (svc.is_active === false || showArchived) {
                        return <tr {...restRowProps}>{children}</tr>;
                      }
                      return (
                        <SortableServiceRowTr svc={svc} restRowProps={restRowProps}>
                          {children}
                        </SortableServiceRowTr>
                      );
                    },
                  },
                }}
              />
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>
            {editingService ? t('adminServices.editService') : t('adminServices.newService')}
          </span>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        destroyOnClose
        width={isMobile ? '94vw' : 600}
        styles={{
          content: { borderRadius: 16, padding: 0 },
          header: { padding: isMobile ? '16px 18px 0' : '20px 24px 0', borderBottom: 'none' },
          body: { padding: isMobile ? '12px 18px 18px' : '16px 24px 24px' },
        }}
      >
        <Form layout="vertical" requiredMark={false}>
          {/* Name (i18n) */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('adminUsers.name')}</span>}
            required
          >
            <I18nInput
              value={svcName}
              onChange={setSvcName}
              placeholder={t('adminServices.serviceName')}
            />
          </Form.Item>

          {/* Description (i18n) */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('orders.description')}</span>}
          >
            <I18nTextArea
              value={svcDesc}
              onChange={setSvcDesc}
              placeholder={t('adminCats.briefDesc')}
            />
          </Form.Item>

          {/* Car categories (M2M) — hidden for helper-card rows */}
          {!editingService?.is_helper_card && (
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>{t('adminServices.carCategories')}</span>}
              extra={
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {t('adminServices.carCategoriesHelp')}
                </span>
              }
            >
              <Select
                mode="multiple"
                allowClear
                value={svcCarCategoryIds}
                onChange={setSvcCarCategoryIds}
                options={carCategoryOptions}
                placeholder={t('adminServices.selectCarCategories')}
                style={{ width: '100%', borderRadius: 10 }}
                optionFilterProp="label"
              />
            </Form.Item>
          )}

          {/* Image Upload */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('adminCats.image')}</span>}
            extra={
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                {t('adminCats.imageIconHint')}
              </span>
            }
          >
            <ImgCrop
              aspect={1}
              aspectSlider
              rotationSlider
              showReset
              showGrid
              modalTitle={t('adminCats.cropImage')}
              modalOk={t('common.save')}
              modalCancel={t('common.cancel')}
              resetText={t('common.reset')}
            >
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={(file) => {
                handleImageSelect({ file });
                return false;
              }}
            >
              <div style={{
                width: '100%',
                border: '2px dashed var(--border-color)',
                borderRadius: 12,
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                background: 'var(--bg-secondary)',
              }}>
                {imagePreview ? (
                  <div style={{
                    width: 72, height: 72, borderRadius: 12,
                    overflow: 'hidden', flexShrink: 0,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <img
                      src={imagePreview}
                      alt=""
                      style={{
                        maxWidth: '100%', maxHeight: '100%',
                        width: 'auto', height: 'auto',
                        objectFit: 'contain', display: 'block',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    width: 72, height: 72, borderRadius: 12,
                    background: `color-mix(in srgb, ${svcColor} 12%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: svcColor, flexShrink: 0,
                  }}>
                    {React.cloneElement(getCategoryIcon(svcIcon), { style: { fontSize: 28 } })}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {imagePreview
                      ? t('adminCats.changeImage')
                      : t('adminCats.uploadImage')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {imagePreview
                      ? 'PNG, JPG, SVG'
                      : t('adminCats.iconFallbackHint')}
                  </div>
                </div>
                {imagePreview && (
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={handleRemoveImage}
                    style={{ flexShrink: 0 }}
                  >
                    {t('adminCats.removeImage')}
                  </Button>
                )}
              </div>
            </Upload>
            </ImgCrop>
          </Form.Item>

          {/* Icon picker */}
          <Form.Item
            label={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontWeight: 600 }}>{t('adminCats.icon')}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {filteredIcons.length}/{AVAILABLE_ICONS.length}
                  {getIconMeta(svcIcon)?.label && ` · ${getIconMeta(svcIcon).label}`}
                </span>
              </div>
            }
            extra={
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                {t('adminCats.iconHelp')}
              </span>
            }
          >
            <Input
              allowClear
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              placeholder={t('adminCats.searchIcons')}
              prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
              style={{ borderRadius: 10, marginBottom: 10 }}
            />
            <div style={{
              maxHeight: 260,
              overflowY: 'auto',
              padding: 12,
              background: 'var(--bg-secondary)',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
            }}>
              {filteredIcons.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '24px 8px',
                  color: 'var(--text-tertiary)', fontSize: 13,
                }}>
                  {t('adminCats.noIconsMatch')}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 42 : 48}px, 1fr))`,
                  gap: isMobile ? 6 : 8,
                }}>
                  {filteredIcons.map((iconKey) => {
                    const selected = svcIcon === iconKey;
                    const meta = getIconMeta(iconKey);
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setSvcIcon(iconKey)}
                        aria-pressed={selected}
                        aria-label={meta?.label || iconKey}
                        title={meta?.label || iconKey}
                        style={{
                          width: '100%', height: 48,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: selected
                            ? `2px solid ${svcColor}`
                            : '1px solid var(--border-color)',
                          borderRadius: 10,
                          background: selected
                            ? `color-mix(in srgb, ${svcColor} 14%, transparent)`
                            : 'var(--card-bg)',
                          color: selected ? svcColor : 'var(--text-secondary)',
                          fontSize: 20,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        {getCategoryIcon(iconKey)}
                        {selected && (
                          <CheckOutlined
                            style={{
                              position: 'absolute',
                              top: -6, right: -6,
                              background: svcColor,
                              color: '#fff',
                              borderRadius: '50%',
                              fontSize: 10,
                              padding: 3,
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('adminCats.color')}</span>}
          >
            <ColorPicker
              format="hex"
              value={svcColor}
              onChange={(c) => setSvcColor(c.toHexString())}
            />
          </Form.Item>

          {/* Suggestion keywords — hidden for helper-card rows */}
          {!editingService?.is_helper_card && (
            <Form.Item
              label={<span style={{ fontWeight: 600 }}>{t('adminCats.suggestionKeywords')}</span>}
              extra={<span style={{ color: 'var(--text-tertiary)' }}>{t('adminCats.keywordsHelp')}</span>}
            >
              <TextArea
                rows={2}
                value={svcKeywords}
                onChange={(e) => setSvcKeywords(e.target.value)}
                placeholder="keyword1, keyword2, keyword3"
                style={{ borderRadius: 10 }}
              />
            </Form.Item>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: 'var(--bg-secondary)',
            borderRadius: 12, marginBottom: 20,
          }}>
            <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('common.active')}
            </Text>
            <Switch checked={svcIsActive} onChange={setSvcIsActive} />
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              block
              loading={saving}
              size="large"
              onClick={handleSave}
              style={{
                background: 'var(--accent)', borderColor: 'var(--accent)',
                borderRadius: 12, height: 46, fontWeight: 700, fontSize: 15,
              }}
            >
              {editingService ? t('profile.saveChanges') : t('adminServices.newService')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Settings modal — cargo-field config per service. Reachable via the
          gear icon in each row; kept separate from the main edit modal so
          the two concerns can be edited (and saved) independently. */}
      <Modal
        title={(
          <span style={{ fontWeight: 700 }}>
            {t('adminServices.cargoFieldsSection')}
            {settingsService && (
              <span style={{
                fontWeight: 500, color: 'var(--text-tertiary)', marginLeft: 8,
              }}>
                — {localized(settingsService.name)}
              </span>
            )}
          </span>
        )}
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={handleSaveSettings}
        confirmLoading={settingsSaving}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
        width={560}
      >
        {/* Pricing controls have moved to the Car Categories settings —
            see AdminCategoriesPage. The vehicle (category) drives the rate,
            not the service taxonomy. */}

        {/* ── Routing section ── */}
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12,
          padding: '14px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
              {t('adminServices.requiresDest')}
            </Text>
            <Text style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('adminServices.requiresDestHelp')}
            </Text>
          </div>
          <Switch checked={settingsRequiresDest} onChange={setSettingsRequiresDest} />
        </div>

        {/* ── Cargo fields section ── */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '-0.01em', marginBottom: 4,
        }}>
          {t('adminServices.cargoFieldsSection')}
        </div>
        <div style={{ color: 'var(--text-tertiary)', fontSize: 12, marginBottom: 10 }}>
          {t('adminServices.cargoFieldsHelp')}
        </div>
        <div style={{
          background: 'var(--bg-secondary)', borderRadius: 12,
          padding: '4px 16px',
        }}>
          {CARGO_FIELD_KEYS.map((key, i) => {
            const labelKey = `cargoField${key.charAt(0).toUpperCase()}${key.slice(1)}`;
            const mode = settingsCargoConfig[key] || 'optional';
            const enabled = mode !== 'off';
            const required = mode === 'required';
            const setMode = (m) => setSettingsCargoConfig((prev) => ({ ...prev, [key]: m }));
            const hasMax = key === 'floor' || key === 'days';
            const maxValue = key === 'floor' ? settingsFloorMax : settingsDaysMax;
            const setMaxValue = key === 'floor' ? setSettingsFloorMax : setSettingsDaysMax;
            return (
              <div
                key={key}
                style={{
                  padding: '12px 0',
                  borderBottom: i < CARGO_FIELD_KEYS.length - 1 ? '1px solid var(--border-light)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600,
                    color: enabled ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    transition: 'color 0.2s',
                  }}>
                    {t(`adminServices.${labelKey}`)}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    opacity: enabled ? 1 : 0.45, transition: 'opacity 0.2s',
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {t('adminServices.modeRequired')}
                    </span>
                    <Switch
                      size="small"
                      checked={required}
                      disabled={!enabled}
                      onChange={(checked) => setMode(checked ? 'required' : 'optional')}
                    />
                  </div>
                  <div style={{
                    width: 1, height: 22, background: 'var(--border-light)', margin: '0 4px',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {t('adminServices.modeShow')}
                    </span>
                    <Switch
                      checked={enabled}
                      onChange={(checked) => setMode(checked ? 'optional' : 'off')}
                    />
                  </div>
                </div>
                {hasMax && enabled && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginTop: 8, paddingLeft: 0,
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {t('adminServices.maxValue')}
                    </span>
                    <InputNumber
                      min={1}
                      max={999}
                      value={maxValue}
                      onChange={(v) => setMaxValue(v == null ? 1 : v)}
                      size="small"
                      style={{ width: 90 }}
                    />
                  </div>
                )}
                {key === 'floor' && enabled && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    marginTop: 8, paddingLeft: 0,
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                      {t('adminServices.floorPrice')}
                    </span>
                    <InputNumber
                      min={0}
                      max={1000000}
                      step={1}
                      precision={0}
                      parser={(v) => Number(String(v || '').replace(/[^\d]/g, '')) || 0}
                      value={settingsFloorPrice}
                      onChange={(v) => setSettingsFloorPrice(v == null ? 0 : Math.trunc(Number(v)) || 0)}
                      size="small"
                      style={{ width: 110 }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
