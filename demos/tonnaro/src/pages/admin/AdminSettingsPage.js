import React, { useEffect, useState } from 'react';
import {
  Button, Typography, Form, Input, Space, message, Grid, Upload,
  Select, Spin, Radio, Segmented, Tabs,
} from 'antd';
import {
  SaveOutlined, UploadOutlined, GlobalOutlined,
  BgColorsOutlined, CheckOutlined, EnvironmentOutlined,
  SettingOutlined, SearchOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons';
import SeoFormSection from './SeoFormSection';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import { COLOR_THEMES, DEFAULT_COLOR_THEME, applyColorTheme } from '../../utils/colorThemes';
import { I18nInput, LANG_TABS } from '../../components/common/I18nFormFields';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const COUNTRY_OPTIONS = [
  { code: 'ge', name: 'Georgia', flag: '🇬🇪' },
  { code: 'tr', name: 'Turkey', flag: '🇹🇷' },
  { code: 'az', name: 'Azerbaijan', flag: '🇦🇿' },
  { code: 'am', name: 'Armenia', flag: '🇦🇲' },
  { code: 'ru', name: 'Russia', flag: '🇷🇺' },
  { code: 'ua', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'fr', name: 'France', flag: '🇫🇷' },
  { code: 'it', name: 'Italy', flag: '🇮🇹' },
  { code: 'es', name: 'Spain', flag: '🇪🇸' },
  { code: 'gb', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'pl', name: 'Poland', flag: '🇵🇱' },
  { code: 'bg', name: 'Bulgaria', flag: '🇧🇬' },
  { code: 'ro', name: 'Romania', flag: '🇷🇴' },
  { code: 'gr', name: 'Greece', flag: '🇬🇷' },
  { code: 'kz', name: 'Kazakhstan', flag: '🇰🇿' },
  { code: 'il', name: 'Israel', flag: '🇮🇱' },
  { code: 'ae', name: 'UAE', flag: '🇦🇪' },
  { code: 'cn', name: 'China', flag: '🇨🇳' },
];

export default function AdminSettingsPage() {
  const screens = useBreakpoint();
  const { t } = useLang();
  const { setColorTheme, refresh: refreshBranding } = useBranding();
  const isMobile = !screens.md;

  const [contactForm] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoDarkFile, setLogoDarkFile] = useState(null);
  const [logoDarkPreview, setLogoDarkPreview] = useState(null);
  const [faviconFile, setFaviconFile] = useState(null);
  const [faviconPreview, setFaviconPreview] = useState(null);
  const [termsDraft, setTermsDraft] = useState({ en: '', ka: '', ru: '' });
  const [termsLang, setTermsLang] = useState('en');
  const [savingTerms, setSavingTerms] = useState(false);

  const load = () => {
    setLoading(true);
    return api.get('/site-settings/admin/').then(({ data }) => {
      setData(data);
      setLogoPreview(data.site_logo_url || null);
      setLogoDarkPreview(data.site_logo_dark_url || null);
      setFaviconPreview(data.favicon_url || null);
      contactForm.setFieldsValue({
        contact_phone: data.contact_phone || '',
        whatsapp_number: data.whatsapp_number || '',
        contact_email: data.contact_email || '',
      });
    }).catch(() => message.error(t('adminSettings.loadFailed')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line

  useEffect(() => {
    api.get('/site-settings/admin/terms/')
      .then(({ data }) => setTermsDraft({
        en: data.en || '', ka: data.ka || '', ru: data.ru || '',
      }))
      .catch(() => { /* leave empty draft on failure */ });
  }, []);

  const updateField = (field, value) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await contactForm.validateFields(['contact_phone', 'whatsapp_number', 'contact_email']);
    } catch {
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('site_name', data.site_name || '');
      fd.append('site_title', data.site_title || '');
      fd.append('header_display', ['both', 'logo_only', 'name_only'].includes(data.header_display) ? data.header_display : 'both');
      fd.append('color_theme', data.color_theme || DEFAULT_COLOR_THEME);
      fd.append('contact_phone', (data.contact_phone || '').trim());
      fd.append('whatsapp_number', (data.whatsapp_number || '').trim());
      fd.append('contact_email', (data.contact_email || '').trim());
      fd.append('default_search_scope', data.default_search_scope || 'georgia');
      fd.append('default_search_countries', JSON.stringify(data.default_search_countries || []));
      fd.append('footer_text', JSON.stringify(data.footer_text || {}));
      if (logoFile) fd.append('site_logo', logoFile);
      if (logoDarkFile) fd.append('site_logo_dark', logoDarkFile);
      if (faviconFile) fd.append('favicon', faviconFile);

      await api.put('/site-settings/admin/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setColorTheme(data.color_theme || DEFAULT_COLOR_THEME);
      await refreshBranding();
      setLogoFile(null);
      setLogoDarkFile(null);
      setFaviconFile(null);
      message.success(t('adminSettings.saved'));
    } catch (err) {
      message.error(t('adminSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTerms = async () => {
    setSavingTerms(true);
    // react-quill emits "<p><br></p>" / "<p></p>" for an empty editor; persist
    // those as "" so the backend/registration treat the language as "not set"
    // rather than gating registration behind a blank terms box.
    const QUILL_EMPTY = /^(<p>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/i;
    const normalize = (html) => (QUILL_EMPTY.test((html || '').trim()) ? '' : (html || ''));
    const payload = {
      en: normalize(termsDraft.en),
      ka: normalize(termsDraft.ka),
      ru: normalize(termsDraft.ru),
    };
    try {
      await api.put('/site-settings/admin/terms/', { terms_text: payload });
      setTermsDraft(payload);
      message.success(t('adminSettings.termsSaved'));
    } catch {
      message.error(t('adminSettings.termsSaveFailed'));
    } finally {
      setSavingTerms(false);
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <Title level={3} style={{
            margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            {t('adminSettings.title')}
          </Title>
          <Text style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            {t('adminSettings.subtitle')}
          </Text>
        </div>
        <Button
          type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}
          style={{
            background: 'var(--accent)', borderColor: 'var(--accent)',
            borderRadius: 10, height: 40, fontWeight: 600,
          }}
        >
          {t('adminSettings.save')}
        </Button>
      </div>

      {/* ── Branding ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <GlobalOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.brandingSection')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.siteName')}</span>}>
            <Input
              value={data.site_name}
              onChange={(e) => updateField('site_name', e.target.value)}
              style={inputStyle}
              placeholder="Tonnaro"
            />
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('adminSettings.siteNameHint')}
            </div>
          </Form.Item>

          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.siteTitle')}</span>}>
            <Input
              value={data.site_title}
              onChange={(e) => updateField('site_title', e.target.value)}
              style={inputStyle}
              placeholder={data.site_name || 'Tonnaro'}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('adminSettings.siteTitleHint')}
            </div>
          </Form.Item>

          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.headerDisplay')}</span>}>
            <Segmented
              value={data.header_display || 'both'}
              onChange={(v) => updateField('header_display', v)}
              options={[
                { label: t('adminSettings.headerBoth'), value: 'both' },
                { label: t('adminSettings.headerLogoOnly'), value: 'logo_only' },
                { label: t('adminSettings.headerNameOnly'), value: 'name_only' },
              ]}
              block
            />
            <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('adminSettings.headerDisplayHint')}
            </div>
          </Form.Item>

          <div style={{ display: 'flex', gap: isMobile ? 12 : 24, flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
              <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.siteLogo')}</span>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {logoPreview && (
                    <img
                      src={logoPreview} alt="Logo"
                      style={{
                        height: 48, width: 'auto', maxWidth: 200,
                        objectFit: 'contain',
                        borderRadius: 6, border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        padding: 4,
                      }}
                    />
                  )}
                  <Upload
                    beforeUpload={(file) => {
                      setLogoFile(file);
                      setLogoPreview(URL.createObjectURL(file));
                      return false;
                    }}
                    showUploadList={false}
                    accept="image/*"
                  >
                    <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                      {t('adminSettings.uploadLogo')}
                    </Button>
                  </Upload>
                  {logoPreview && (
                    <Button danger type="text" onClick={() => {
                      setLogoFile(null); setLogoPreview(null); updateField('site_logo', null);
                    }}>
                      {t('adminSettings.removeImage')}
                    </Button>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {t('adminSettings.siteLogoHint')}
                </div>
              </Form.Item>
            </div>

            <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
              <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.siteLogoDark')}</span>}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  // Render the dark-logo preview against a dark surface so admin
                  // can sanity-check contrast without having to flip the whole UI.
                }}>
                  {logoDarkPreview && (
                    <img
                      src={logoDarkPreview} alt="Logo (dark)"
                      style={{
                        height: 48, width: 'auto', maxWidth: 200,
                        objectFit: 'contain',
                        borderRadius: 6, border: '1px solid var(--border-color)',
                        background: '#1f2937',
                        padding: 4,
                      }}
                    />
                  )}
                  <Upload
                    beforeUpload={(file) => {
                      setLogoDarkFile(file);
                      setLogoDarkPreview(URL.createObjectURL(file));
                      return false;
                    }}
                    showUploadList={false}
                    accept="image/*"
                  >
                    <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                      {t('adminSettings.uploadLogoDark')}
                    </Button>
                  </Upload>
                  {logoDarkPreview && (
                    <Button danger type="text" onClick={() => {
                      setLogoDarkFile(null); setLogoDarkPreview(null); updateField('site_logo_dark', null);
                    }}>
                      {t('adminSettings.removeImage')}
                    </Button>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {t('adminSettings.siteLogoDarkHint')}
                </div>
              </Form.Item>
            </div>

            <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
              <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.favicon')}</span>}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  {faviconPreview && (
                    <img
                      src={faviconPreview} alt="Favicon"
                      style={{
                        width: 32, height: 32, objectFit: 'contain',
                        borderRadius: 6, border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                      }}
                    />
                  )}
                  <Upload
                    beforeUpload={(file) => {
                      setFaviconFile(file);
                      setFaviconPreview(URL.createObjectURL(file));
                      return false;
                    }}
                    showUploadList={false}
                    accept="image/png,image/x-icon,image/svg+xml"
                  >
                    <Button icon={<UploadOutlined />} style={{ borderRadius: 10 }}>
                      {t('adminSettings.uploadFavicon')}
                    </Button>
                  </Upload>
                  {faviconPreview && (
                    <Button danger type="text" onClick={() => {
                      setFaviconFile(null); setFaviconPreview(null); updateField('favicon', null);
                    }}>
                      {t('adminSettings.removeImage')}
                    </Button>
                  )}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {t('adminSettings.faviconHint')}
                </div>
              </Form.Item>
            </div>
          </div>
        </Form>
      </div>

      {/* ── SEO & Social Preview ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <SearchOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.seoSection') || 'SEO & Social Preview'}
        </div>
        <SeoFormSection />
      </div>

      {/* ── Contact Widget (Call + WhatsApp floating bubble) ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <SettingOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.contactWidgetSection')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          {t('adminSettings.contactWidgetHint')}
        </div>
        <Form
          layout="vertical"
          form={contactForm}
          onValuesChange={(changed) => {
            Object.entries(changed).forEach(([k, v]) => updateField(k, v));
          }}
        >
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Form.Item
              name="contact_phone"
              label={<span style={{ fontWeight: 600 }}>{t('adminSettings.contactPhone')}</span>}
              style={{ flex: 1, minWidth: isMobile ? '100%' : 240, marginBottom: 8 }}
              rules={[{
                validator: (_, value) => {
                  if (!value || value.trim() === '') return Promise.resolve();
                  return /^\+?\d[\d\s\-()]{5,30}\d$/.test(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('common.invalidPhone')));
                },
              }]}
            >
              <Input
                placeholder="+995 555 123 456"
                style={{ borderRadius: 10 }}
                allowClear
              />
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('adminSettings.contactPhoneHint')}
              </div>
            </Form.Item>
            <Form.Item
              name="whatsapp_number"
              label={<span style={{ fontWeight: 600 }}>{t('adminSettings.whatsappNumber')}</span>}
              style={{ flex: 1, minWidth: isMobile ? '100%' : 240, marginBottom: 8 }}
              rules={[{
                validator: (_, value) => {
                  if (!value || value.trim() === '') return Promise.resolve();
                  return /^\+?\d[\d\s\-()]{5,30}\d$/.test(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('common.invalidPhone')));
                },
              }]}
            >
              <Input
                placeholder="995555123456"
                style={{ borderRadius: 10 }}
                allowClear
              />
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('adminSettings.whatsappNumberHint')}
              </div>
            </Form.Item>
            <Form.Item
              name="contact_email"
              label={<span style={{ fontWeight: 600 }}>{t('adminSettings.contactEmail')}</span>}
              style={{ flex: 1, minWidth: isMobile ? '100%' : 240, marginBottom: 8 }}
              rules={[{
                validator: (_, value) => {
                  if (!value || value.trim() === '') return Promise.resolve();
                  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('adminSettings.invalidEmail')));
                },
              }]}
            >
              <Input
                placeholder="contact@example.com"
                style={{ borderRadius: 10 }}
                allowClear
              />
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('adminSettings.contactEmailHint')}
              </div>
            </Form.Item>
          </div>
        </Form>
      </div>

      {/* ── Footer text (multilingual line shown on public pages) ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <GlobalOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.footerSection')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          {t('adminSettings.footerHint')}
        </div>
        <Form layout="vertical">
          <Form.Item
            label={<span style={{ fontWeight: 600 }}>{t('adminSettings.footerText')}</span>}
            style={{ marginBottom: 8 }}
          >
            <I18nInput
              value={data.footer_text || {}}
              onChange={(obj) => updateField('footer_text', obj)}
              placeholder="Tonnaro © 2026"
            />
          </Form.Item>
        </Form>
      </div>

      {/* ── Color Theme ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <BgColorsOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.colorThemeSection')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          {t('adminSettings.colorThemeHint')}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 110 : 130}px, 1fr))`,
          gap: 12,
        }}>
          {Object.entries(COLOR_THEMES).map(([key, theme]) => {
            const selected = (data.color_theme || DEFAULT_COLOR_THEME) === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  updateField('color_theme', key);
                  applyColorTheme(key);
                }}
                style={{
                  cursor: 'pointer',
                  background: selected ? 'var(--accent-bg)' : 'var(--bg-secondary)',
                  border: `2px solid ${selected ? theme.swatch : 'var(--border-color)'}`,
                  borderRadius: 14, padding: '14px 12px',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease', position: 'relative',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: theme.swatch,
                  boxShadow: `0 4px 12px ${theme.swatch}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <CheckOutlined style={{ color: '#fff', fontSize: 18 }} />}
                </div>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}>
                  {theme.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Location Scope ── */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          <EnvironmentOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.locationSection')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          {t('adminSettings.locationHint')}
        </div>

        <Form layout="vertical" requiredMark={false}>
          <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.searchScope')}</span>}>
            <Radio.Group
              value={data.default_search_scope || 'georgia'}
              onChange={(e) => {
                updateField('default_search_scope', e.target.value);
                if (e.target.value !== 'custom') updateField('default_search_countries', []);
              }}
            >
              <Space direction="vertical" style={{ gap: 10 }}>
                <Radio value="georgia" style={{ fontWeight: 500 }}>🇬🇪 {t('adminSettings.scopeGeorgia')}</Radio>
                <Radio value="worldwide" style={{ fontWeight: 500 }}>🌍 {t('adminSettings.scopeWorldwide')}</Radio>
                <Radio value="custom" style={{ fontWeight: 500 }}>🗺️ {t('adminSettings.scopeCustom')}</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {data.default_search_scope === 'custom' && (
            <Form.Item label={<span style={{ fontWeight: 600 }}>{t('adminSettings.searchCountries')}</span>}>
              <Select
                mode="multiple"
                value={data.default_search_countries || []}
                onChange={(val) => updateField('default_search_countries', val)}
                placeholder={t('adminSettings.selectCountries')}
                style={{ borderRadius: 10 }}
                optionFilterProp="label"
                options={COUNTRY_OPTIONS.map((c) => ({
                  value: c.code,
                  label: `${c.flag} ${c.name}`,
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </div>

      {/* ── Terms & Conditions ── */}
      <div style={{
        background: 'var(--card-bg)', border: '1px solid var(--border-color)',
        borderRadius: 16, padding: 20, marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
          <SafetyCertificateOutlined style={{ color: 'var(--accent)' }} />
          {t('adminSettings.termsSection')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 14 }}>
          {t('adminSettings.termsHint')}
        </div>

        <Tabs
          size="small"
          activeKey={termsLang}
          onChange={setTermsLang}
          items={LANG_TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            children: (
              <ReactQuill
                theme="snow"
                value={termsDraft[tab.key] || ''}
                onChange={(html) => setTermsDraft((prev) => ({ ...prev, [tab.key]: html }))}
                style={{ background: 'var(--input-bg)', borderRadius: 8 }}
              />
            ),
          }))}
        />

        <div style={{ textAlign: 'right', marginTop: 12 }}>
          <Button
            type="primary" icon={<SaveOutlined />} onClick={handleSaveTerms}
            loading={savingTerms}
            style={{ background: 'var(--accent)', borderColor: 'var(--accent)', borderRadius: 10, fontWeight: 600 }}
          >
            {t('adminSettings.saveTerms')}
          </Button>
        </div>
      </div>

      {/* Bottom save button */}
      <div style={{ textAlign: 'right', paddingBottom: 40 }}>
        <Button
          type="primary" icon={<SaveOutlined />} onClick={handleSave}
          loading={saving} size="large"
          style={{
            background: 'var(--accent)', borderColor: 'var(--accent)',
            borderRadius: 12, height: 46, fontWeight: 700, fontSize: 15,
            paddingInline: 32,
          }}
        >
          {t('adminSettings.save')}
        </Button>
      </div>

    </div>
  );
}
