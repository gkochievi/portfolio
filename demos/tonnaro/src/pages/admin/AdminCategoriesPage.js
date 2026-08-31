import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Typography, Tag, Modal, Form, Input, InputNumber, Switch, Space,
  ColorPicker, message, Grid, Empty, Upload, Segmented, Popconfirm, TimePicker,
} from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, CameraOutlined, DeleteOutlined, CheckOutlined, SearchOutlined, FilterOutlined, ClockCircleOutlined, EnvironmentOutlined, HolderOutlined } from '@ant-design/icons';
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
import dayjs from 'dayjs';
import api from '../../api/client';
import { CategoryImage, getCategoryIcon, searchIcons, getIconMeta, AVAILABLE_ICONS } from '../../utils/categoryIcons';
import { useLang } from '../../contexts/LanguageContext';
import { I18nInput, I18nTextArea } from '../../components/common/I18nFormFields';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

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
  // Table cells render outside the SortableCategoryRowTr scope, so the
  // handle needs its own useSortable hook to grab activator listeners.
  // The row's setNodeRef + transform live separately in SortableCategoryRowTr;
  // calling useSortable here for listeners/attributes is the documented
  // dnd-kit pattern for cell-level drag handles.
  const { attributes, listeners } = useSortable({ id });
  return <DragHandle attributes={attributes} listeners={listeners} />;
}

function SortableCategoryRow({ category, children }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: category.id });
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

function SortableCategoryRowTr({ cat, restRowProps, children }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: cat.id });
  const style = {
    ...restRowProps.style,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.18)' : undefined,
  };
  return (
    <tr {...restRowProps} ref={setNodeRef} style={style}>
      {typeof children === 'function' ? children({ attributes, listeners }) : children}
    </tr>
  );
}

export default function AdminCategoriesPage() {
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');

  // i18n fields managed as state (not via Form)
  const [catName, setCatName] = useState({ en: '', ka: '', ru: '' });
  const [catDesc, setCatDesc] = useState({ en: '', ka: '', ru: '' });
  // Non-i18n fields
  const [catIcon, setCatIcon] = useState('car');
  const [catColor, setCatColor] = useState('#F97316');
  const [catKeywords, setCatKeywords] = useState('');
  const [catIsActive, setCatIsActive] = useState(true);
  // Pricing controls live here (not on Service) because the vehicle drives
  // the rate model. Engine type is only meaningful when pricing_mode is
  // 'calculator'; fixed_price only meaningful when 'fixed'.
  const [catPricingMode, setCatPricingMode] = useState('fixed');
  const [catFixedPrice, setCatFixedPrice] = useState(0);
  const [catPricingType, setCatPricingType] = useState('');

  // Restricted time windows for the currently-edited category.
  // Each entry: { id?, location_keyword, start_time, end_time, description, is_active, _draftId? }
  // id is set on rows fetched from the server; _draftId is a client-only
  // marker used to track unsaved rows in the React list (since they have no id).
  const [catWindows, setCatWindows] = useState([]);
  const [windowEditor, setWindowEditor] = useState({ open: false, index: -1 });
  const [windowDraft, setWindowDraft] = useState({
    location_keyword: '', start_time: null, end_time: null,
    description: '', is_active: true,
  });

  // Helper: resolve i18n field to current language
  const localized = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };

  const fetchCategories = () => {
    setLoading(true);
    api.get('/categories/admin/').then(({ data }) => {
      const results = data.results || data;
      setCategories(Array.isArray(results) ? results : []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCategories(); }, []);

  const filteredIcons = useMemo(() => searchIcons(iconSearch), [iconSearch]);
  const visibleCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((c) => {
      if (showArchived ? c.is_active !== false : c.is_active === false) return false;
      if (q) {
        const name = typeof c.name === 'object' ? Object.values(c.name).join(' ') : (c.name || '');
        const desc = typeof c.description === 'object' ? Object.values(c.description).join(' ') : (c.description || '');
        const hay = `${name} ${desc} ${c.suggestion_keywords || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [categories, showArchived, search]);

  const openModal = (category = null) => {
    setEditingCategory(category);
    setImageFile(null);
    setImagePreview(category?.image_url || null);
    setImageRemoved(false);
    setIconSearch('');
    if (category) {
      setCatName(typeof category.name === 'object' ? { en: '', ka: '', ru: '', ...category.name } : { en: category.name || '', ka: '', ru: '' });
      setCatDesc(typeof category.description === 'object' ? { en: '', ka: '', ru: '', ...category.description } : { en: category.description || '', ka: '', ru: '' });
      setCatIcon(category.icon || 'car');
      setCatColor(category.color || '#F97316');
      setCatKeywords(category.suggestion_keywords || '');
      setCatIsActive(category.is_active !== false);
      setCatPricingMode(['fixed', 'calculator'].includes(category.pricing_mode) ? category.pricing_mode : 'fixed');
      setCatFixedPrice(Number(category.fixed_price) || 0);
      setCatPricingType(category.pricing_type || '');
      setCatWindows(
        Array.isArray(category.restricted_time_windows)
          ? category.restricted_time_windows.map((w) => ({ ...w }))
          : []
      );
    } else {
      setCatName({ en: '', ka: '', ru: '' });
      setCatDesc({ en: '', ka: '', ru: '' });
      setCatIcon('car');
      setCatColor('#F97316');
      setCatKeywords('');
      setCatIsActive(true);
      setCatPricingMode('fixed');
      setCatFixedPrice(0);
      setCatPricingType('');
      setCatWindows([]);
    }
    setModalOpen(true);
    setWindowEditor({ open: false, index: -1 });
    setWindowDraft({
      location_keyword: '', start_time: null, end_time: null,
      description: '', is_active: true,
    });
  };

  const handleSave = async () => {
    if (!catName.en && !catName.ka && !catName.ru) {
      message.error(t('common.required'));
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', JSON.stringify(catName));
      formData.append('description', JSON.stringify(catDesc));
      formData.append('icon', catIcon || 'car');
      formData.append('color', typeof catColor === 'string' ? catColor : catColor?.toHexString?.() || '#F97316');
      formData.append('suggestion_keywords', catKeywords);
      formData.append('is_active', catIsActive ? 'true' : 'false');
      formData.append('pricing_mode', ['fixed', 'calculator'].includes(catPricingMode) ? catPricingMode : 'fixed');
      formData.append('fixed_price', String(Math.max(0, Number(catFixedPrice) || 0)));
      formData.append('pricing_type', ['hiab', 'trailer', 'cart'].includes(catPricingType) ? catPricingType : '');
      // Strip client-only fields (_draftId) and serialize for multipart.
      const windowsPayload = catWindows.map(({ _draftId, ...rest }) => rest);
      formData.append('restricted_time_windows', JSON.stringify(windowsPayload));
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (imageRemoved) {
        formData.append('image', '');
      }

      if (editingCategory) {
        await api.patch(`/categories/admin/${editingCategory.id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        message.success(t('adminCats.categoryUpdated'));
      } else {
        await api.post('/categories/admin/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        message.success(t('adminCats.categoryCreated'));
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail ? Object.values(detail).flat()[0] : t('adminCats.failedUpdateCat');
      message.error(typeof firstErr === 'string' ? firstErr : t('adminCats.failedUpdateCat'));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (cat) => {
    try {
      await api.patch(`/categories/admin/${cat.id}/`, { is_active: !cat.is_active });
      message.success(cat.is_active ? t('adminCats.categoryDeactivated') : t('adminCats.categoryActivated'));
      fetchCategories();
    } catch {
      message.error(t('adminCats.failedUpdateCat'));
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

    const activeList = visibleCategories.filter((c) => c.is_active !== false);
    const oldIdx = activeList.findIndex((c) => c.id === active.id);
    const newIdx = activeList.findIndex((c) => c.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(activeList, oldIdx, newIdx);

    const idToNewIndex = new Map(reordered.map((c, i) => [c.id, i]));
    const previousCategories = categories;
    const newCategories = [...categories].sort((a, b) => {
      const aIdx = idToNewIndex.has(a.id) ? idToNewIndex.get(a.id) : -1;
      const bIdx = idToNewIndex.has(b.id) ? idToNewIndex.get(b.id) : -1;
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
    setCategories(newCategories);
    try {
      await api.post('/categories/admin/reorder/', {
        order: reordered.map((c) => c.id),
      });
      message.success(t('admin.orderSaved'));
    } catch (err) {
      setCategories(previousCategories);
      message.error(t('admin.orderSaveFailed'));
    }
  };

  const openWindowEditor = (index) => {
    if (index >= 0 && catWindows[index]) {
      const w = catWindows[index];
      setWindowDraft({
        location_keyword: w.location_keyword || '',
        start_time: w.start_time ? dayjs(w.start_time, 'HH:mm:ss') : null,
        end_time: w.end_time ? dayjs(w.end_time, 'HH:mm:ss') : null,
        description: w.description || '',
        is_active: w.is_active !== false,
      });
    } else {
      setWindowDraft({
        location_keyword: '', start_time: null, end_time: null,
        description: '', is_active: true,
      });
    }
    setWindowEditor({ open: true, index });
  };

  const cancelWindowEditor = () => setWindowEditor({ open: false, index: -1 });

  const commitWindowEditor = () => {
    if (!windowDraft.location_keyword.trim()) {
      message.error(t('adminCats.keywordRequired'));
      return;
    }
    if (!windowDraft.start_time || !windowDraft.end_time) {
      message.error(t('common.required'));
      return;
    }
    const fmt = (d) => d.format('HH:mm:ss');
    const row = {
      location_keyword: windowDraft.location_keyword.trim(),
      start_time: fmt(windowDraft.start_time),
      end_time: fmt(windowDraft.end_time),
      description: windowDraft.description || '',
      is_active: !!windowDraft.is_active,
    };
    setCatWindows((prev) => {
      const next = [...prev];
      if (windowEditor.index >= 0 && next[windowEditor.index]) {
        // preserve id if editing existing
        next[windowEditor.index] = { ...next[windowEditor.index], ...row };
      } else {
        next.push({ ...row, _draftId: `draft-${Date.now()}` });
      }
      return next;
    });
    cancelWindowEditor();
  };

  const removeWindow = (index) => {
    setCatWindows((prev) => prev.filter((_, i) => i !== index));
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
      title: '', width: 120,
      render: (_, record) => (
        <Space size={4}>
          <Button
            size="small" type="text"
            icon={<EditOutlined />}
            onClick={(e) => { e.stopPropagation(); openModal(record); }}
            style={{ color: 'var(--accent)' }}
          />
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
          {t('adminCats.title')}
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
          {t('adminCats.newCategory')}
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
        loading && visibleCategories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            {t('common.loading')}
          </div>
        ) : visibleCategories.length === 0 ? (
          <Empty description={t('adminCats.noCategories')} />
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={visibleCategories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleCategories.map((cat) => {
                const archived = cat.is_active === false || showArchived;

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
                        background: `color-mix(in srgb, ${cat.color || 'var(--accent)'} 12%, transparent)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, color: cat.color || 'var(--accent)', flexShrink: 0,
                        overflow: 'hidden',
                      }}>
                        {cat.image_url ? (
                          <img src={cat.image_url} alt="" style={{
                            maxWidth: '100%', maxHeight: '100%',
                            width: 'auto', height: 'auto',
                            objectFit: 'contain', display: 'block',
                          }} />
                        ) : (
                          <CategoryImage icon={cat.icon} size={32} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', display: 'block' }}
                          ellipsis={{ tooltip: localized(cat.name) }}
                        >
                          {localized(cat.name)}
                        </Text>
                        {cat.is_helper_card && (
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
                      <Tag color={cat.is_active ? 'green' : 'red'} style={{ margin: 0, flexShrink: 0 }}>
                        {cat.is_active ? t('common.active') : t('common.inactive')}
                      </Tag>
                    </div>
                    {localized(cat.description) && (
                      <Text
                        style={{
                          fontSize: 13, color: 'var(--text-tertiary)', display: 'block', marginBottom: 8,
                        }}
                        ellipsis={{ tooltip: localized(cat.description), rows: 2 }}
                      >
                        {localized(cat.description)}
                      </Text>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Button
                        size="small" type="text"
                        icon={<EditOutlined />}
                        onClick={() => openModal(cat)}
                        style={{ color: 'var(--accent)', fontWeight: 600 }}
                      >
                        Edit
                      </Button>
                      <Popconfirm
                        title={cat.is_active
                          ? t('common.confirmDisable')
                          : t('common.confirmEnable')}
                        onConfirm={() => toggleActive(cat)}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                        okButtonProps={{ danger: cat.is_active }}
                      >
                        <Button
                          size="small" type="text"
                          danger={cat.is_active}
                          icon={cat.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
                        />
                      </Popconfirm>
                    </div>
                  </div>
                );

                if (archived) {
                  return <div key={cat.id}>{renderCardInner(null)}</div>;
                }
                return (
                  <SortableCategoryRow key={cat.id} category={cat}>
                    {({ attributes, listeners }) =>
                      renderCardInner(
                        <DragHandle attributes={attributes} listeners={listeners} />
                      )
                    }
                  </SortableCategoryRow>
                );
              })}
            </SortableContext>
          </DndContext>
        )
      ) : (
        <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={visibleCategories.map((c) => c.id)}
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
                dataSource={visibleCategories}
                rowKey="id"
                loading={loading}
                size="middle"
                pagination={false}
                scroll={{ x: 'max-content' }}
                components={{
                  body: {
                    row: ({ children, ...restRowProps }) => {
                      const rowId = restRowProps['data-row-key'];
                      const cat = visibleCategories.find((c) => String(c.id) === String(rowId));
                      if (!cat) return <tr {...restRowProps}>{children}</tr>;
                      if (cat.is_active === false || showArchived) {
                        return <tr {...restRowProps}>{children}</tr>;
                      }
                      return (
                        <SortableCategoryRowTr cat={cat} restRowProps={restRowProps}>
                          {children}
                        </SortableCategoryRowTr>
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
            {editingCategory ? t('adminCats.editCategory') : t('adminCats.newCategory')}
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
              value={catName}
              onChange={setCatName}
              placeholder={t('adminCats.categoryName')}
            />
          </Form.Item>

          {/* Description (i18n) */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('orders.description')}</span>}
          >
            <I18nTextArea
              value={catDesc}
              onChange={setCatDesc}
              placeholder={t('adminCats.briefDesc')}
            />
          </Form.Item>

          {/* Image Upload */}
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('adminCats.image') || 'Image'}</span>}
            extra={
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                {t('adminCats.imageIconHint') || 'When an image is uploaded, it replaces the icon.'}
              </span>
            }
          >
            <ImgCrop
              aspect={1}
              aspectSlider
              rotationSlider
              showReset
              showGrid
              modalTitle={t('adminCats.cropImage') || 'Adjust image'}
              modalOk={t('common.save') || 'Save'}
              modalCancel={t('common.cancel') || 'Cancel'}
              resetText={t('common.reset') || 'Reset'}
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
                    background: `color-mix(in srgb, ${catColor} 12%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, color: catColor, flexShrink: 0,
                  }}>
                    {React.cloneElement(getCategoryIcon(catIcon), { style: { fontSize: 28 } })}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {imagePreview
                      ? (t('adminCats.changeImage') || 'Change image')
                      : (t('adminCats.uploadImage') || 'Upload image')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {imagePreview
                      ? 'PNG, JPG, SVG'
                      : (t('adminCats.iconFallbackHint') || 'No image — the icon below will be used.')}
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
                    {t('adminCats.removeImage') || 'Remove'}
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
                <span style={{ fontWeight: 600 }}>{t('adminCats.icon') || 'Icon'}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>
                  {filteredIcons.length}/{AVAILABLE_ICONS.length}
                  {getIconMeta(catIcon)?.label && ` · ${getIconMeta(catIcon).label}`}
                </span>
              </div>
            }
            extra={
              <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                {t('adminCats.iconHelp') || 'Shown when no image is uploaded.'}
              </span>
            }
          >
            <Input
              allowClear
              value={iconSearch}
              onChange={(e) => setIconSearch(e.target.value)}
              placeholder={t('adminCats.searchIcons') || 'Search icons (e.g. car, crane, box, clock)'}
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
                  {t('adminCats.noIconsMatch') || 'No icons match your search'}
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 42 : 48}px, 1fr))`,
                  gap: isMobile ? 6 : 8,
                }}>
                  {filteredIcons.map((iconKey) => {
                    const selected = catIcon === iconKey;
                    const meta = getIconMeta(iconKey);
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setCatIcon(iconKey)}
                        aria-pressed={selected}
                        aria-label={meta?.label || iconKey}
                        title={meta?.label || iconKey}
                        style={{
                          width: '100%', height: 48,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: selected
                            ? `2px solid ${catColor}`
                            : '1px solid var(--border-color)',
                          borderRadius: 10,
                          background: selected
                            ? `color-mix(in srgb, ${catColor} 14%, transparent)`
                            : 'var(--card-bg)',
                          color: selected ? catColor : 'var(--text-secondary)',
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
                              background: catColor,
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
              value={catColor}
              onChange={(c) => setCatColor(c.toHexString())}
            />
          </Form.Item>

          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('adminCats.suggestionKeywords')}</span>}
            extra={<span style={{ color: 'var(--text-tertiary)' }}>{t('adminCats.keywordsHelp')}</span>}
          >
            <TextArea
              rows={2}
              value={catKeywords}
              onChange={(e) => setCatKeywords(e.target.value)}
              placeholder="keyword1, keyword2, keyword3"
              style={{ borderRadius: 10 }}
            />
          </Form.Item>

          {/* ── Pricing controls (hidden for helper-card rows) ── */}
          {!editingCategory?.is_helper_card && (
            <div style={{
              background: 'var(--bg-secondary)', borderRadius: 12,
              padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4,
              }}>
                {t('adminCats.pricingSection')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
                {t('adminCats.pricingHelp')}
              </div>
              <Segmented
                value={catPricingMode}
                onChange={setCatPricingMode}
                options={[
                  { label: t('adminCats.pricingFixed'), value: 'fixed' },
                  { label: t('adminCats.pricingCalculator'), value: 'calculator' },
                ]}
                block
                style={{ width: '100%', marginBottom: 12 }}
              />
              {catPricingMode === 'fixed' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {t('adminCats.fixedPriceLabel')}
                  </div>
                  <InputNumber
                    min={0} max={10000000} step={10}
                    value={catFixedPrice}
                    onChange={(v) => setCatFixedPrice(v == null ? 0 : v)}
                    addonAfter="₾"
                    style={{ width: '100%', maxWidth: 240 }}
                  />
                </div>
              )}
              {catPricingMode === 'calculator' && (
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    {t('adminCats.pricingTypeLabel')}
                  </div>
                  <Segmented
                    value={catPricingType || 'hiab'}
                    onChange={setCatPricingType}
                    options={[
                      { label: t('adminPricing.typeHiab'), value: 'hiab' },
                      { label: t('adminPricing.typeTrailer'), value: 'trailer' },
                      { label: t('adminPricing.typeCart'), value: 'cart' },
                    ]}
                    block
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Restricted Time Windows (hidden for helper-card rows) ── */}
          {!editingCategory?.is_helper_card && (
          <div style={{
            marginTop: 24, padding: 16,
            border: '1px solid var(--border-color)', borderRadius: 12,
            background: 'var(--bg-secondary)',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontWeight: 700, color: 'var(--text-primary)',
              }}>
                <ClockCircleOutlined style={{ color: 'var(--accent)' }} />
                {t('adminCats.restrictedTimesSection')}
              </div>
              <Button
                icon={<PlusOutlined />}
                onClick={() => openWindowEditor(-1)}
                disabled={windowEditor.open}
                style={{ borderRadius: 8 }}
              >
                {t('adminCats.addWindow')}
              </Button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
              {t('adminCats.restrictedTimesHint')}
            </div>

            {catWindows.length === 0 && !windowEditor.open && (
              <div style={{
                padding: '20px 12px', textAlign: 'center',
                color: 'var(--text-tertiary)', fontSize: 13,
              }}>
                {t('adminCats.noWindows')}
              </div>
            )}

            {catWindows.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {catWindows.map((w, idx) => (
                  <div
                    key={w.id ?? w._draftId ?? idx}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: 10, background: 'var(--card-bg)',
                      border: '1px solid var(--border-color)', borderRadius: 10,
                      flexWrap: 'wrap',
                      opacity: w.is_active === false ? 0.55 : 1,
                    }}
                  >
                    <EnvironmentOutlined style={{ color: 'var(--accent)' }} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {w.location_keyword}
                        {w.is_active === false && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                            ({t('adminCats.windowDisabled')})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {String(w.start_time).slice(0, 5)} – {String(w.end_time).slice(0, 5)}
                      </div>
                      {w.description && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          {w.description}
                        </div>
                      )}
                    </div>
                    <Space size={4}>
                      <Button
                        size="small" icon={<EditOutlined />}
                        onClick={() => openWindowEditor(idx)}
                        disabled={windowEditor.open}
                      />
                      <Popconfirm
                        title={t('adminCats.deleteWindowConfirm')}
                        okText={t('common.yes')}
                        cancelText={t('common.no')}
                        onConfirm={() => removeWindow(idx)}
                      >
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  </div>
                ))}
              </div>
            )}

            {windowEditor.open && (
              <div style={{
                marginTop: 12, padding: 12,
                border: '1px solid var(--accent)', borderRadius: 10,
                background: 'var(--card-bg)',
              }}>
                <div style={{ fontWeight: 700, marginBottom: 10 }}>
                  {windowEditor.index >= 0
                    ? t('adminCats.editWindow')
                    : t('adminCats.newWindow')}
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('adminCats.locationKeyword')}
                  </div>
                  <Input
                    value={windowDraft.location_keyword}
                    onChange={(e) => setWindowDraft((p) => ({ ...p, location_keyword: e.target.value }))}
                    placeholder="Tbilisi"
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {t('adminCats.locationKeywordHint')}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {t('adminCats.startTime')}
                    </div>
                    <TimePicker
                      value={windowDraft.start_time}
                      onChange={(v) => setWindowDraft((p) => ({ ...p, start_time: v }))}
                      format="HH:mm"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      {t('adminCats.endTime')}
                    </div>
                    <TimePicker
                      value={windowDraft.end_time}
                      onChange={(v) => setWindowDraft((p) => ({ ...p, end_time: v }))}
                      format="HH:mm"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    {t('adminCats.windowDescription')}
                  </div>
                  <Input
                    value={windowDraft.description}
                    onChange={(e) => setWindowDraft((p) => ({ ...p, description: e.target.value }))}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    {t('adminCats.windowDescriptionHint')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <Switch
                    checked={windowDraft.is_active}
                    onChange={(v) => setWindowDraft((p) => ({ ...p, is_active: v }))}
                  />
                  <span style={{ fontSize: 13 }}>
                    {windowDraft.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </div>

                <Space>
                  <Button onClick={cancelWindowEditor}>{t('common.cancel')}</Button>
                  <Button type="primary" onClick={commitWindowEditor}
                    style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}>
                    {t('common.save')}
                  </Button>
                </Space>
              </div>
            )}
          </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: 'var(--bg-secondary)',
            borderRadius: 12, marginBottom: 20,
          }}>
            <Text style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {t('common.active')}
            </Text>
            <Switch checked={catIsActive} onChange={setCatIsActive} />
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
              {editingCategory ? t('profile.saveChanges') : t('adminCats.newCategory')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
