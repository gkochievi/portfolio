import React, { useEffect, useState } from 'react';
import {
  Button, Typography, Form, Input, message, Grid, Upload,
  ColorPicker, Select, Spin, Switch,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined,
  RocketOutlined, FileTextOutlined, TrophyOutlined,
  ThunderboltOutlined, StarOutlined, UploadOutlined,
  InfoCircleOutlined, HolderOutlined, AppstoreOutlined,
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
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { getCategoryIcon, AVAILABLE_ICONS } from '../../utils/categoryIcons';
import { I18nInput, I18nTextArea } from '../../components/common/I18nFormFields';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Must stay in lockstep with DEFAULT_SECTION_ORDER in LandingPage.js — keys
// here drive both the drag list and the translation labels for each row.
const SECTION_KEYS = [
  'hero', 'vehicle_types', 'services', 'about',
  'steps', 'benefits', 'cta',
];

// Resolve the saved order from the API into a stable array used by the
// drag list. Same algorithm as the public page: any keys missing from the
// saved order are appended at the end with enabled=true so a section added
// later still shows up in the admin UI without manual intervention.
function resolveAdminOrder(apiOrder) {
  const fromApi = Array.isArray(apiOrder) && apiOrder.length > 0 ? apiOrder : null;
  const base = fromApi || SECTION_KEYS.map((key) => ({ key, enabled: true }));
  const seen = new Set(base.map((s) => s.key));
  const missing = SECTION_KEYS
    .filter((key) => !seen.has(key))
    .map((key) => ({ key, enabled: true }));
  // Drop any unknown keys so a stale row from an older deploy doesn't leak
  // through.
  const known = base.filter((s) => SECTION_KEYS.includes(s.key));
  return [...known, ...missing];
}

function SectionLabel({ sectionKey }) {
  const { t } = useLang();
  const map = {
    hero: 'adminLanding.sectionHero',
    vehicle_types: 'adminLanding.sectionVehicleTypes',
    services: 'adminLanding.sectionServices',
    about: 'adminLanding.sectionAbout',
    steps: 'adminLanding.sectionSteps',
    benefits: 'adminLanding.sectionBenefits',
    cta: 'adminLanding.sectionCta',
  };
  return <span>{t(map[sectionKey] || sectionKey)}</span>;
}

function SortableSectionRow({ item, onToggle }) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: item.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 12px',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 12,
    marginBottom: 8,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{
          cursor: 'grab', color: 'var(--text-tertiary)',
          touchAction: 'none', display: 'inline-flex',
          padding: 4,
        }}
        aria-label="Drag to reorder"
      >
        <HolderOutlined style={{ fontSize: 18 }} />
      </span>
      <span style={{
        fontWeight: 600, color: 'var(--text-primary)',
        flex: 1, letterSpacing: '-0.01em',
      }}>
        <SectionLabel sectionKey={item.key} />
      </span>
      <Switch
        checked={item.enabled}
        onChange={(checked) => onToggle(item.key, checked)}
      />
    </div>
  );
}

export default function AdminLandingPage() {
  const screens = useBreakpoint();
  const { t } = useLang();
  const isMobile = !screens.md;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [aboutFile, setAboutFile] = useState(null);
  const [aboutPreview, setAboutPreview] = useState(null);
  const [aboutCleared, setAboutCleared] = useState(false);
  const [sectionOrder, setSectionOrder] = useState(
    () => resolveAdminOrder(null)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    api.get('/landing/admin/').then(({ data }) => {
      setData(data);
      setAboutPreview(data.about_image_url || null);
      setSectionOrder(resolveAdminOrder(data.section_order));
    }).catch(() => message.error('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrder((prev) => {
      const oldIndex = prev.findIndex((s) => s.key === active.id);
      const newIndex = prev.findIndex((s) => s.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggleSectionEnabled = (key, enabled) => {
    setSectionOrder((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled } : s))
    );
  };

  const updateField = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const updateArrayItem = (field, index, key, value) => {
    setData((prev) => {
      const arr = [...(prev[field] || [])];
      arr[index] = { ...arr[index], [key]: value };
      return { ...prev, [field]: arr };
    });
  };

  const addArrayItem = (field, template) => {
    setData((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), template],
    }));
  };

  const removeArrayItem = (field, index) => {
    setData((prev) => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();

      const jsonFields = [
        'hero_title', 'hero_description', 'stats',
        'about_eyebrow', 'about_title', 'about_description',
        'steps_title', 'steps', 'benefits_title', 'benefits',
        'cta_title', 'cta_description', 'cta_button_text',
      ];

      jsonFields.forEach((field) => {
        formData.append(field, JSON.stringify(data[field] || {}));
      });

      formData.append('section_order', JSON.stringify(sectionOrder));

      if (aboutFile) {
        formData.append('about_image', aboutFile);
      } else if (aboutCleared) {
        // Empty string asks the serializer to clear the stored image.
        formData.append('about_image', '');
      }

      const { data: updated } = await api.put('/landing/admin/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setData(updated);
      setAboutPreview(updated.about_image_url || null);
      setSectionOrder(resolveAdminOrder(updated.section_order));
      setAboutFile(null);
      setAboutCleared(false);
      message.success(t('adminLanding.saved'));
    } catch (err) {
      message.error(t('adminLanding.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  const cardStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    padding: isMobile ? 16 : 24,
    marginBottom: 20,
  };

  const sectionTitleStyle = {
    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
    marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
  };

  const inputStyle = { borderRadius: 10 };

  return (
    <div className="page-enter">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Title level={3} style={{
            margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            {t('adminLanding.title')}
          </Title>
          <Text style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            {t('adminLanding.subtitle')}
          </Text>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          style={{
            background: 'var(--accent)', borderColor: 'var(--accent)',
            borderRadius: 10, height: 40, fontWeight: 600,
          }}
        >
          {t('adminLanding.save')}
        </Button>
      </div>

      {/* ── Page Layout (drag-reorder + visibility) ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <AppstoreOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.sectionLayout')}
        </div>
        <Text style={{
          display: 'block', color: 'var(--text-tertiary)',
          fontSize: 13, marginBottom: 14,
        }}>
          {t('adminLanding.dragToReorder')}
        </Text>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sectionOrder.map((s) => s.key)}
            strategy={verticalListSortingStrategy}
          >
            {sectionOrder.map((item) => (
              <SortableSectionRow
                key={item.key}
                item={item}
                onToggle={toggleSectionEnabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* ── Hero Section ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <StarOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.heroSection')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.heroTitle')}</span>}>
            <I18nInput
              value={data.hero_title}
              onChange={(obj) => updateField('hero_title', obj)}
            />
          </Form.Item>

          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.heroDescription')}</span>}>
            <I18nTextArea
              value={data.hero_description}
              onChange={(obj) => updateField('hero_description', obj)}
            />
          </Form.Item>

        </Form>
      </div>

      {/* ── About Us Section ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <InfoCircleOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.aboutSection')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.aboutEyebrow')}</span>}>
            <I18nInput
              value={data.about_eyebrow}
              onChange={(obj) => updateField('about_eyebrow', obj)}
            />
          </Form.Item>

          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.aboutTitle')}</span>}>
            <I18nInput
              value={data.about_title}
              onChange={(obj) => updateField('about_title', obj)}
            />
          </Form.Item>

          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.aboutDescription')}</span>}>
            <I18nTextArea
              value={data.about_description}
              onChange={(obj) => updateField('about_description', obj)}
              rows={5}
            />
          </Form.Item>

          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.aboutImage')}</span>}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {aboutPreview && (
                <img
                  src={aboutPreview}
                  alt="About preview"
                  style={{
                    width: 160, height: 120, objectFit: 'cover',
                    borderRadius: 10, border: '1px solid var(--border-color)',
                  }}
                />
              )}
              <Upload
                beforeUpload={(file) => {
                  setAboutFile(file);
                  setAboutCleared(false);
                  setAboutPreview(URL.createObjectURL(file));
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
                maxCount={1}
              >
                <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                  {t('adminLanding.aboutImage')}
                </Button>
              </Upload>
              {aboutPreview && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setAboutFile(null);
                    setAboutPreview(null);
                    setAboutCleared(true);
                  }}
                  style={{ borderRadius: 10 }}
                >
                  {t('adminLanding.removeImage')}
                </Button>
              )}
            </div>
          </Form.Item>
        </Form>
      </div>

      {/* ── Stats Section ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <TrophyOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.statsSection')}
        </div>
        {(data.stats || []).map((stat, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start',
            padding: 12, background: 'var(--bg-secondary)', borderRadius: 12,
          }}>
            <div style={{ flex: '0 0 100px' }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                {t('adminLanding.statNumber')}
              </Text>
              <Input
                value={stat.number}
                onChange={(e) => updateArrayItem('stats', i, 'number', e.target.value)}
                style={inputStyle}
                placeholder="500+"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                {t('adminLanding.statLabel')}
              </Text>
              <I18nInput
                value={stat.label}
                onChange={(obj) => updateArrayItem('stats', i, 'label', obj)}
              />
            </div>
            <Button
              type="text" danger
              icon={<DeleteOutlined />}
              onClick={() => removeArrayItem('stats', i)}
              style={{ marginTop: 18 }}
            />
          </div>
        ))}
        <Button
          type="dashed" block
          icon={<PlusOutlined />}
          onClick={() => addArrayItem('stats', { number: '', label: {} })}
          style={{ borderRadius: 10 }}
        >
          {t('adminLanding.addStat')}
        </Button>
      </div>

      {/* ── Steps Section ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <FileTextOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.stepsSection')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.stepsTitle')}</span>}>
            <I18nInput
              value={data.steps_title}
              onChange={(obj) => updateField('steps_title', obj)}
            />
          </Form.Item>
        </Form>

        {(data.steps || []).map((step, i) => (
          <div key={i} style={{
            padding: 16, background: 'var(--bg-secondary)', borderRadius: 12,
            marginBottom: 12,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10,
            }}>
              <Text style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                Step {i + 1}
              </Text>
              <Button
                type="text" danger size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeArrayItem('steps', i)}
              >
                {t('adminLanding.remove')}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <div style={{ flex: isMobile ? '1 1 100%' : '0 0 150px' }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {t('adminLanding.stepIcon')}
                </Text>
                <Select
                  value={step.icon}
                  onChange={(val) => updateArrayItem('steps', i, 'icon', val)}
                  style={{ width: '100%' }}
                  options={AVAILABLE_ICONS.map((name) => ({
                    value: name,
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {getCategoryIcon(name)} {name}
                      </span>
                    ),
                  }))}
                />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                {t('adminLanding.stepTitle')}
              </Text>
              <I18nInput
                value={step.title}
                onChange={(obj) => updateArrayItem('steps', i, 'title', obj)}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                {t('adminLanding.stepDescription')}
              </Text>
              <I18nTextArea
                value={step.description}
                onChange={(obj) => updateArrayItem('steps', i, 'description', obj)}
                rows={2}
              />
            </div>
          </div>
        ))}
        <Button
          type="dashed" block
          icon={<PlusOutlined />}
          onClick={() => addArrayItem('steps', { icon: 'car', title: {}, description: {} })}
          style={{ borderRadius: 10 }}
        >
          {t('adminLanding.addStep')}
        </Button>
      </div>

      {/* ── Benefits Section ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <RocketOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.benefitsSection')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.benefitsTitle')}</span>}>
            <I18nInput
              value={data.benefits_title}
              onChange={(obj) => updateField('benefits_title', obj)}
            />
          </Form.Item>
        </Form>

        {(data.benefits || []).map((b, i) => (
          <div key={i} style={{
            padding: 16, background: 'var(--bg-secondary)', borderRadius: 12,
            marginBottom: 12,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginBottom: 10,
            }}>
              <Text style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                Benefit {i + 1}
              </Text>
              <Button
                type="text" danger size="small"
                icon={<DeleteOutlined />}
                onClick={() => removeArrayItem('benefits', i)}
              >
                {t('adminLanding.remove')}
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: isMobile ? '1 1 100%' : '0 0 150px' }}>
                <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {t('adminLanding.benefitIcon')}
                </Text>
                <Select
                  value={b.icon}
                  onChange={(val) => updateArrayItem('benefits', i, 'icon', val)}
                  style={{ width: '100%' }}
                  options={AVAILABLE_ICONS.map((name) => ({
                    value: name,
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {getCategoryIcon(name)} {name}
                      </span>
                    ),
                  }))}
                />
              </div>
              <div>
                <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  {t('adminLanding.benefitColor')}
                </Text>
                <div>
                  <ColorPicker
                    value={b.color || '#F97316'}
                    onChange={(c) => updateArrayItem('benefits', i, 'color', c.toHexString())}
                    format="hex"
                  />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                {t('adminLanding.benefitTitle')}
              </Text>
              <I18nInput
                value={b.title}
                onChange={(obj) => updateArrayItem('benefits', i, 'title', obj)}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)' }}>
                {t('adminLanding.benefitDescription')}
              </Text>
              <I18nTextArea
                value={b.description}
                onChange={(obj) => updateArrayItem('benefits', i, 'description', obj)}
                rows={2}
              />
            </div>
          </div>
        ))}
        <Button
          type="dashed" block
          icon={<PlusOutlined />}
          onClick={() => addArrayItem('benefits', { icon: 'rocket', title: {}, description: {}, color: '#F97316' })}
          style={{ borderRadius: 10 }}
        >
          {t('adminLanding.addBenefit')}
        </Button>
      </div>

      {/* ── CTA Section ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <ThunderboltOutlined style={{ color: 'var(--accent)' }} />
          {t('adminLanding.ctaSection')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.ctaTitle')}</span>}>
            <I18nInput
              value={data.cta_title}
              onChange={(obj) => updateField('cta_title', obj)}
            />
          </Form.Item>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.ctaDescription')}</span>}>
            <I18nTextArea
              value={data.cta_description}
              onChange={(obj) => updateField('cta_description', obj)}
            />
          </Form.Item>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminLanding.ctaButton')}</span>}>
            <I18nInput
              value={data.cta_button_text}
              onChange={(obj) => updateField('cta_button_text', obj)}
            />
          </Form.Item>
        </Form>
      </div>

      {/* Bottom save button */}
      <div style={{ textAlign: 'right', paddingBottom: 40 }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          size="large"
          style={{
            background: 'var(--accent)', borderColor: 'var(--accent)',
            borderRadius: 12, height: 46, fontWeight: 700, fontSize: 15,
            paddingInline: 32,
          }}
        >
          {t('adminLanding.save')}
        </Button>
      </div>
    </div>
  );
}
