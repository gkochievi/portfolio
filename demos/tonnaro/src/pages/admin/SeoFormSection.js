import React, { useEffect, useState, useCallback } from 'react';
import {
  Button, Form, Input, InputNumber, Segmented, Switch, Upload,
  TimePicker, Space, message, Spin, Divider,
} from 'antd';
import {
  SaveOutlined, UploadOutlined, PlusOutlined, DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import dayjs from 'dayjs';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { I18nInput, I18nTextArea } from '../../components/common/I18nFormFields';

// ── Constants ──────────────────────────────────────────────────────────────

const ROBOTS_OPTIONS = [
  { label: 'Index, follow', value: 'index,follow' },
  { label: 'No-index, follow', value: 'noindex,follow' },
  { label: 'No-index, no-follow', value: 'noindex,nofollow' },
];

const SCHEMA_OPTIONS = [
  { label: 'MovingCompany', value: 'MovingCompany' },
  { label: 'LocalBusiness', value: 'LocalBusiness' },
  { label: 'AutomotiveBusiness', value: 'AutomotiveBusiness' },
];

const DAYS = [
  { code: 'Mo', label: 'Mon' },
  { code: 'Tu', label: 'Tue' },
  { code: 'We', label: 'Wed' },
  { code: 'Th', label: 'Thu' },
  { code: 'Fr', label: 'Fri' },
  { code: 'Sa', label: 'Sat' },
  { code: 'Su', label: 'Sun' },
];

// Build an initial per-day state from the opening_hours array coming from the API.
// Returns: { Mo: { enabled, opens, closes }, Tu: {...}, ... }
function hoursArrayToState(arr = []) {
  const state = {};
  DAYS.forEach(({ code }) => {
    state[code] = { enabled: false, opens: '09:00', closes: '18:00' };
  });
  (arr || []).forEach((entry) => {
    (entry.dayOfWeek || []).forEach((code) => {
      if (state[code] !== undefined) {
        state[code] = {
          enabled: true,
          opens: entry.opens || '09:00',
          closes: entry.closes || '18:00',
        };
      }
    });
  });
  return state;
}

// Collapse per-day state back to the API array shape.
// Groups consecutive days with identical open/close times.
function hoursStateToArray(state) {
  // We emit one entry per enabled day (no grouping — simpler, Google accepts it)
  return DAYS
    .filter(({ code }) => state[code]?.enabled)
    .map(({ code }) => ({
      dayOfWeek: [code],
      opens: state[code].opens,
      closes: state[code].closes,
    }));
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

// ── SeoFormSection ──────────────────────────────────────────────────────────

export default function SeoFormSection() {
  const { t } = useLang();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Core SEO
  const [seoTitle, setSeoTitle] = useState({ en: '', ka: '', ru: '' });
  const [seoDescription, setSeoDescription] = useState({ en: '', ka: '', ru: '' });
  const [seoKeywords, setSeoKeywords] = useState({ en: '', ka: '', ru: '' });
  const [seoOgImageUrl, setSeoOgImageUrl] = useState(null);  // current saved URL
  const [seoOgImageFile, setSeoOgImageFile] = useState(null); // new File to upload
  const [seoOgImagePreview, setSeoOgImagePreview] = useState(null); // object URL for new file
  const [seoOgImageAlt, setSeoOgImageAlt] = useState('');
  const [seoCanonicalUrl, setSeoCanonicalUrl] = useState('');
  const [seoRobots, setSeoRobots] = useState('index,follow');
  const [seoThemeColor, setSeoThemeColor] = useState('');
  const [seoThemeColorError, setSeoThemeColorError] = useState(false);
  const [schemaType, setSchemaType] = useState('MovingCompany');

  // Structured data
  const [legalName, setLegalName] = useState('');
  const [addressStreet, setAddressStreet] = useState('');
  const [addressLocality, setAddressLocality] = useState('');
  const [addressRegion, setAddressRegion] = useState('');
  const [addressPostalCode, setAddressPostalCode] = useState('');
  const [addressCountry, setAddressCountry] = useState('GE');
  const [geoLat, setGeoLat] = useState(null);
  const [geoLng, setGeoLng] = useState(null);
  const [openingHours, setOpeningHours] = useState(() => hoursArrayToState([]));
  const [sameAs, setSameAs] = useState([]);
  const [sameAsErrors, setSameAsErrors] = useState({}); // index → bool

  // ── Load ────────────────────────────────────────────────────────────────

  const loadSeo = useCallback(() => {
    setLoading(true);
    return api.get('/seo/admin/')
      .then(({ data }) => {
        setSeoTitle(data.seo_title || { en: '', ka: '', ru: '' });
        setSeoDescription(data.seo_description || { en: '', ka: '', ru: '' });
        setSeoKeywords(data.seo_keywords || { en: '', ka: '', ru: '' });
        setSeoOgImageUrl(data.seo_og_image_url || null);
        setSeoOgImageFile(null);
        setSeoOgImagePreview(null);
        setSeoOgImageAlt(data.seo_og_image_alt || '');
        setSeoCanonicalUrl(data.seo_canonical_url || '');
        setSeoRobots(data.seo_robots || 'index,follow');
        setSeoThemeColor(data.seo_theme_color || '');
        setSchemaType(data.schema_type || 'MovingCompany');
        setLegalName(data.legal_name || '');
        setAddressStreet(data.address_street || '');
        setAddressLocality(data.address_locality || '');
        setAddressRegion(data.address_region || '');
        setAddressPostalCode(data.address_postal_code || '');
        setAddressCountry(data.address_country || 'GE');
        setGeoLat(data.geo_latitude != null ? parseFloat(data.geo_latitude) : null);
        setGeoLng(data.geo_longitude != null ? parseFloat(data.geo_longitude) : null);
        setOpeningHours(hoursArrayToState(data.opening_hours || []));
        setSameAs(data.same_as || []);
      })
      .catch(() => {
        // TODO i18n: adminSettings.seoLoadFailed
        message.error(t('adminSettings.seoLoadFailed') || 'Failed to load SEO settings');
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { loadSeo(); }, [loadSeo]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('seo_title', JSON.stringify(seoTitle));
      fd.append('seo_description', JSON.stringify(seoDescription));
      fd.append('seo_keywords', JSON.stringify(seoKeywords));
      fd.append('seo_og_image_alt', seoOgImageAlt);
      fd.append('seo_canonical_url', seoCanonicalUrl);
      fd.append('seo_robots', seoRobots);
      fd.append('seo_theme_color', seoThemeColor);
      fd.append('schema_type', schemaType);
      fd.append('legal_name', legalName);
      fd.append('address_street', addressStreet);
      fd.append('address_locality', addressLocality);
      fd.append('address_region', addressRegion);
      fd.append('address_postal_code', addressPostalCode);
      fd.append('address_country', addressCountry.toUpperCase());
      if (geoLat != null) fd.append('geo_latitude', geoLat);
      if (geoLng != null) fd.append('geo_longitude', geoLng);
      fd.append('opening_hours', JSON.stringify(hoursStateToArray(openingHours)));
      fd.append('same_as', JSON.stringify(sameAs.filter((u) => u.trim())));

      if (seoOgImageFile) {
        fd.append('seo_og_image', seoOgImageFile);
      }
      // If the admin removed the image (url cleared, no new file), send empty string.
      if (!seoOgImageFile && !seoOgImageUrl) {
        fd.append('seo_og_image', '');
      }

      await api.patch('/seo/admin/', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // TODO i18n: adminSettings.seoSaved
      message.success(t('adminSettings.seoSaved') || 'SEO settings saved!');
      // Refetch to pick up canonical state (especially new seo_og_image_url)
      await loadSeo();
    } catch (err) {
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const firstMsg = Object.values(detail).flat()[0];
        message.error(typeof firstMsg === 'string' ? firstMsg : (t('adminSettings.seoSaveFailed') || 'Failed to save SEO settings'));
      } else {
        // TODO i18n: adminSettings.seoSaveFailed
        message.error(t('adminSettings.seoSaveFailed') || 'Failed to save SEO settings');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── same_as helpers ───────────────────────────────────────────────────────

  const addSameAs = () => setSameAs((prev) => [...prev, '']);
  const removeSameAs = (idx) => {
    setSameAs((prev) => prev.filter((_, i) => i !== idx));
    setSameAsErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };
  const updateSameAs = (idx, val) => {
    setSameAs((prev) => prev.map((u, i) => (i === idx ? val : u)));
  };
  const validateSameAs = (idx, val) => {
    const isUrl = val.trim() === '' || val.startsWith('http://') || val.startsWith('https://');
    setSameAsErrors((prev) => ({ ...prev, [idx]: !isUrl }));
  };

  // ── opening_hours helpers ─────────────────────────────────────────────────

  const toggleDay = (code, enabled) => {
    setOpeningHours((prev) => ({
      ...prev,
      [code]: { ...prev[code], enabled },
    }));
  };
  const setDayTime = (code, field, timeStr) => {
    setOpeningHours((prev) => ({
      ...prev,
      [code]: { ...prev[code], [field]: timeStr },
    }));
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const labelStyle = { fontWeight: 600 };
  const hintStyle = { marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' };
  const subCardStyle = {
    background: 'var(--bg-secondary)',
    borderRadius: 12,
    padding: '16px 20px',
    marginBottom: 20,
  };
  const inputStyle = { borderRadius: 10 };

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin />
      </div>
    );
  }

  // Display URL: new file preview takes priority, then saved URL
  const ogImageDisplay = seoOgImagePreview || seoOgImageUrl;

  return (
    <Form layout="vertical" requiredMark={false}>

      {/* ── Core SEO ── */}
      <div style={subCardStyle}>
        {/* TODO i18n: adminSettings.seoSection */}
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)' }}>
          {t('adminSettings.seoSection') || 'Page SEO'}
        </div>
        <div style={{ ...hintStyle, marginBottom: 16 }}>
          {/* TODO i18n: adminSettings.seoSectionHint */}
          {t('adminSettings.seoSectionHint') || 'How the site appears in Google results and when shared on Facebook, Twitter, WhatsApp.'}
        </div>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoTitle') || 'Page title'}</span>}>
          <I18nInput value={seoTitle} onChange={setSeoTitle} placeholder="Tonnaro" />
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoTitleHint */}
            {t('adminSettings.seoTitleHint') || 'Shown in the browser tab and Google results. 50-60 characters. Per language.'}
          </div>
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoDescription') || 'Meta description'}</span>}>
          <I18nTextArea value={seoDescription} onChange={setSeoDescription} rows={3} placeholder="Order tow trucks, cranes, lowboys..." />
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoDescriptionHint */}
            {t('adminSettings.seoDescriptionHint') || 'Shown under the title in Google results. 150-160 characters. Per language.'}
          </div>
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoKeywords') || 'Keywords'}</span>}>
          <I18nInput value={seoKeywords} onChange={setSeoKeywords} placeholder="tow truck, crane, heavy transport" />
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoKeywordsHint */}
            {t('adminSettings.seoKeywordsHint') || 'Comma-separated. Low SEO value today but included for completeness.'}
          </div>
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoCanonical') || 'Canonical URL'}</span>}>
          <Input
            value={seoCanonicalUrl}
            onChange={(e) => setSeoCanonicalUrl(e.target.value)}
            placeholder="https://tonnaro.ge/"
            style={inputStyle}
            allowClear
          />
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoCanonicalHint */}
            {t('adminSettings.seoCanonicalHint') || 'Absolute URL. Leave blank to use the current request URL.'}
          </div>
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoRobots') || 'Robots directive'}</span>}>
          <Segmented
            value={seoRobots}
            onChange={setSeoRobots}
            options={ROBOTS_OPTIONS}
            block
          />
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoRobotsHint */}
            {t('adminSettings.seoRobotsHint') || 'Tells search engines whether to index and follow links.'}
          </div>
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoThemeColor') || 'Theme color (hex)'}</span>}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: HEX_RE.test(seoThemeColor) ? seoThemeColor : 'var(--accent)',
              border: '1px solid var(--border-color)',
              transition: 'background 0.2s',
            }} />
            <Input
              value={seoThemeColor}
              onChange={(e) => {
                setSeoThemeColor(e.target.value);
                setSeoThemeColorError(false);
              }}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== '' && !HEX_RE.test(v)) setSeoThemeColorError(true);
              }}
              placeholder="#F97316"
              maxLength={7}
              style={{
                ...inputStyle,
                borderColor: seoThemeColorError ? '#ff4d4f' : undefined,
                width: 140,
              }}
              allowClear
            />
          </div>
          {seoThemeColorError && (
            <div style={{ ...hintStyle, color: '#ff4d4f' }}>
              Must be a 6-digit hex code, e.g. #F97316
            </div>
          )}
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoThemeColorHint */}
            {t('adminSettings.seoThemeColorHint') || 'Browser chrome color on mobile. Blank derives from the site palette.'}
          </div>
        </Form.Item>
      </div>

      {/* ── Social Preview Image ── */}
      <div style={subCardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)' }}>
          {/* TODO i18n: adminSettings.seoOgImage */}
          {t('adminSettings.seoOgImage') || 'Social preview image'}
        </div>

        <Form.Item>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            {ogImageDisplay && (
              <img
                src={ogImageDisplay}
                alt="OG preview"
                style={{
                  width: 240,
                  height: 126,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <ImgCrop aspect={1200 / 630} aspectSlider showReset showGrid>
                <Upload
                  beforeUpload={(file) => {
                    setSeoOgImageFile(file);
                    setSeoOgImagePreview(URL.createObjectURL(file));
                    return false;
                  }}
                  showUploadList={false}
                  accept="image/png,image/jpeg,image/webp"
                >
                  <Button icon={<UploadOutlined />} style={inputStyle}>
                    {/* TODO i18n: adminSettings.uploadOgImage */}
                    {t('adminSettings.uploadOgImage') || 'Upload Social Image'}
                  </Button>
                </Upload>
              </ImgCrop>
              {ogImageDisplay && (
                <Button
                  danger type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    setSeoOgImageFile(null);
                    setSeoOgImagePreview(null);
                    setSeoOgImageUrl(null);
                  }}
                >
                  {/* TODO i18n: adminSettings.removeImage */}
                  {t('adminSettings.removeImage') || 'Remove image'}
                </Button>
              )}
            </div>
          </div>
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoOgImageHint */}
            {t('adminSettings.seoOgImageHint') || 'Shown on Facebook, LinkedIn, WhatsApp, Twitter previews. 1200×630 PNG/JPG.'}
          </div>
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.seoOgImageAlt') || 'Image alt text'}</span>}>
          <Input
            value={seoOgImageAlt}
            onChange={(e) => setSeoOgImageAlt(e.target.value)}
            placeholder="Heavy transport vehicles in Tbilisi"
            style={inputStyle}
            maxLength={255}
            allowClear
          />
          <div style={hintStyle}>
            {/* TODO i18n: adminSettings.seoOgImageAltHint */}
            {t('adminSettings.seoOgImageAltHint') || 'Descriptive alt text for accessibility and Twitter.'}
          </div>
        </Form.Item>
      </div>

      {/* ── Structured Data ── */}
      <div style={subCardStyle}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>
          {/* TODO i18n: adminSettings.structuredDataSection */}
          {t('adminSettings.structuredDataSection') || 'Business Info (Structured Data)'}
        </div>
        <div style={{ ...hintStyle, marginBottom: 16 }}>
          {/* TODO i18n: adminSettings.structuredDataHint */}
          {t('adminSettings.structuredDataHint') || 'Helps Google show rich results — address, hours, social links.'}
        </div>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.schemaType') || 'Business type'}</span>}>
          <Segmented value={schemaType} onChange={setSchemaType} options={SCHEMA_OPTIONS} block />
        </Form.Item>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.legalName') || 'Legal name'}</span>}>
          <Input
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Tonnaro LLC"
            style={inputStyle}
            allowClear
          />
        </Form.Item>

        <Divider style={{ margin: '16px 0 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {/* TODO i18n: adminSettings.addressStreet (section label) */}
            Address
          </span>
        </Divider>

        <Form.Item label={<span style={labelStyle}>{t('adminSettings.addressStreet') || 'Street address'}</span>}>
          <Input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="123 Rustaveli Ave" style={inputStyle} allowClear />
        </Form.Item>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Form.Item
            label={<span style={labelStyle}>{t('adminSettings.addressLocality') || 'City'}</span>}
            style={{ flex: 2, minWidth: 160 }}
          >
            <Input value={addressLocality} onChange={(e) => setAddressLocality(e.target.value)} placeholder="Tbilisi" style={inputStyle} allowClear />
          </Form.Item>
          <Form.Item
            label={<span style={labelStyle}>{t('adminSettings.addressRegion') || 'Region / state'}</span>}
            style={{ flex: 2, minWidth: 160 }}
          >
            <Input value={addressRegion} onChange={(e) => setAddressRegion(e.target.value)} placeholder="Tbilisi" style={inputStyle} allowClear />
          </Form.Item>
          <Form.Item
            label={<span style={labelStyle}>{t('adminSettings.addressPostalCode') || 'Postal code'}</span>}
            style={{ flex: 1, minWidth: 100 }}
          >
            <Input value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="0105" style={inputStyle} allowClear />
          </Form.Item>
          <Form.Item
            label={<span style={labelStyle}>{t('adminSettings.addressCountry') || 'Country code (ISO)'}</span>}
            style={{ flex: 1, minWidth: 80 }}
          >
            <Input
              value={addressCountry}
              onChange={(e) => setAddressCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="GE"
              maxLength={2}
              style={{ ...inputStyle, width: 72, textTransform: 'uppercase' }}
            />
          </Form.Item>
        </div>

        <Divider style={{ margin: '4px 0 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Geo coordinates
          </span>
        </Divider>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Form.Item
            label={<span style={labelStyle}>{t('adminSettings.geoLatitude') || 'Latitude'}</span>}
            style={{ flex: 1, minWidth: 180 }}
          >
            <InputNumber
              value={geoLat}
              onChange={setGeoLat}
              step={0.000001}
              precision={6}
              placeholder="41.693411"
              style={{ width: '100%', borderRadius: 10 }}
            />
          </Form.Item>
          <Form.Item
            label={<span style={labelStyle}>{t('adminSettings.geoLongitude') || 'Longitude'}</span>}
            style={{ flex: 1, minWidth: 180 }}
          >
            <InputNumber
              value={geoLng}
              onChange={setGeoLng}
              step={0.000001}
              precision={6}
              placeholder="44.801565"
              style={{ width: '100%', borderRadius: 10 }}
            />
          </Form.Item>
        </div>

        {/* ── Opening Hours ── */}
        <Divider style={{ margin: '4px 0 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {/* TODO i18n: adminSettings.openingHours */}
            {t('adminSettings.openingHours') || 'Opening hours'}
          </span>
        </Divider>
        <div style={{ ...hintStyle, marginBottom: 12 }}>
          {/* TODO i18n: adminSettings.openingHoursHint */}
          {t('adminSettings.openingHoursHint') || 'Toggle a day to mark it open, then set open and close times.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DAYS.map(({ code, label }) => {
            const day = openingHours[code];
            return (
              <div
                key={code}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px',
                  background: day.enabled ? 'var(--accent-bg)' : 'var(--bg-primary)',
                  borderRadius: 8,
                  border: `1px solid ${day.enabled ? 'var(--accent)' : 'var(--border-color)'}`,
                  opacity: day.enabled ? 1 : 0.6,
                  transition: 'all 0.15s',
                }}
              >
                <Switch
                  checked={day.enabled}
                  onChange={(v) => toggleDay(code, v)}
                  size="small"
                />
                <span style={{ width: 36, fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                  {label}
                </span>
                <TimePicker
                  value={day.enabled ? dayjs(day.opens, 'HH:mm') : null}
                  onChange={(_, str) => setDayTime(code, 'opens', str || '09:00')}
                  format="HH:mm"
                  minuteStep={15}
                  disabled={!day.enabled}
                  size="small"
                  style={{ width: 90, borderRadius: 8 }}
                  allowClear={false}
                />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>–</span>
                <TimePicker
                  value={day.enabled ? dayjs(day.closes, 'HH:mm') : null}
                  onChange={(_, str) => setDayTime(code, 'closes', str || '18:00')}
                  format="HH:mm"
                  minuteStep={15}
                  disabled={!day.enabled}
                  size="small"
                  style={{ width: 90, borderRadius: 8 }}
                  allowClear={false}
                />
              </div>
            );
          })}
        </div>

        {/* ── Social Links (same_as) ── */}
        <Divider style={{ margin: '20px 0 12px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            {/* TODO i18n: adminSettings.sameAs */}
            {t('adminSettings.sameAs') || 'Social links'}
          </span>
        </Divider>
        <div style={{ ...hintStyle, marginBottom: 12 }}>
          {/* TODO i18n: adminSettings.sameAsHint */}
          {t('adminSettings.sameAsHint') || 'Full URLs to your profiles on Facebook, Instagram, LinkedIn, etc.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sameAs.map((url, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={url}
                  onChange={(e) => updateSameAs(idx, e.target.value)}
                  onBlur={(e) => validateSameAs(idx, e.target.value)}
                  placeholder="https://facebook.com/tonnaro"
                  style={{
                    ...inputStyle,
                    borderColor: sameAsErrors[idx] ? '#ff4d4f' : undefined,
                  }}
                  allowClear
                />
                {sameAsErrors[idx] && (
                  <div style={{ ...hintStyle, color: '#ff4d4f' }}>
                    Must be a full URL starting with http:// or https://
                  </div>
                )}
              </div>
              <Button
                type="text" danger
                icon={<DeleteOutlined />}
                onClick={() => removeSameAs(idx)}
                style={{ borderRadius: 8, marginTop: 1 }}
                title={t('adminSettings.removeSocialLink') || 'Remove'}
              />
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addSameAs}
            style={{ borderRadius: 10, alignSelf: 'flex-start' }}
          >
            {/* TODO i18n: adminSettings.addSocialLink */}
            {t('adminSettings.addSocialLink') || 'Add social link'}
          </Button>
        </div>
      </div>

      {/* ── Save button ── */}
      <div style={{ textAlign: 'right', paddingBottom: 8 }}>
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
          {/* TODO i18n: adminSettings.seoSaveBtn */}
          {t('adminSettings.seoSaveBtn') || 'Save SEO settings'}
        </Button>
      </div>
    </Form>
  );
}
