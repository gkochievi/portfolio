import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tabs, Table, Button, Form, Input, InputNumber, Modal, Select, Tag,
  Typography, Space, message, Grid, Empty, Alert, Segmented, Switch,
} from 'antd';
import {
  EditOutlined, PlusOutlined, DeleteOutlined, CalculatorOutlined,
  ThunderboltOutlined, RiseOutlined, ToolOutlined, GlobalOutlined,
} from '@ant-design/icons';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { I18nInput } from '../../components/common/I18nFormFields';

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

// Keep in lockstep with backend pricing/models.py choices.
const TYPE_OPTIONS = [
  { value: 'hiab', i18n: 'typeHiab' },
  { value: 'trailer', i18n: 'typeTrailer' },
  { value: 'cart', i18n: 'typeCart' },
];
const PUMP_KIND_OPTIONS = [
  { value: 'pump', i18n: 'pumpKindPump' },
  { value: 'pump_mixer', i18n: 'pumpKindMixer' },
];

const fmtCurrency = (raw) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₾`;
};
const fmtPercent = (raw, digits = 1) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
};
const fmtNumber = (raw, digits = 2) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(digits);
};

const localizedText = (val, lang) => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  return val[lang] || val.en || val.ka || val.ru || '';
};

export default function AdminPricingPage() {
  const { t, lang } = useLang();
  const screens = useBreakpoint();
  const isDesktop = screens.md;

  // Zones are admin-managed (new in this round). Load once at the top and
  // pass them down — the Calculator and Rates tabs both use this list for
  // their zone dropdowns.
  const [zones, setZones] = useState([]);
  const loadZones = useCallback(async () => {
    try {
      const { data } = await api.get('/pricing/zones/');
      setZones(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { loadZones(); }, [loadZones]);

  return (
    <div className="page-enter">
      <div style={{ marginBottom: 18 }}>
        <Title level={3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
        }}>
          {t('adminPricing.title')}
        </Title>
        <Text style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
          {t('adminPricing.subtitle')}
        </Text>
      </div>

      <Tabs
        defaultActiveKey="calculator"
        items={[
          {
            key: 'calculator',
            label: (<span><CalculatorOutlined /> {t('adminPricing.tabCalculator')}</span>),
            children: <CalculatorTab isDesktop={isDesktop} lang={lang} t={t} zones={zones} />,
          },
          {
            key: 'rates',
            label: (<span><ThunderboltOutlined /> {t('adminPricing.tabRates')}</span>),
            children: <RatesTab t={t} lang={lang} zones={zones} />,
          },
          {
            key: 'zones',
            label: (<span><GlobalOutlined /> {t('adminPricing.tabZones')}</span>),
            children: <ZonesTab t={t} lang={lang} onChanged={loadZones} />,
          },
          {
            key: 'elevation',
            label: (<span><RiseOutlined /> {t('adminPricing.tabElevationGlobals')}</span>),
            children: <ElevationGlobalsTab t={t} />,
          },
          {
            key: 'equipment',
            label: (<span><ToolOutlined /> {t('adminPricing.tabEquipmentPump')}</span>),
            children: <EquipmentPumpTab t={t} lang={lang} />,
          },
        ]}
      />
    </div>
  );
}

// ── Tab 1: Calculator ──────────────────────────────────────────────────────

function CalculatorTab({ isDesktop, lang, t, zones }) {
  const [type, setType] = useState('hiab');
  // Defer initial zone selection until /pricing/zones/ resolves so we never
  // fire a quote with a stale hardcoded slug (the seeded 'region_gt30' was
  // retired by migration 0006). Also re-selects when the current slug
  // disappears, e.g. an admin deletes a zone.
  const [zone, setZone] = useState(null);
  useEffect(() => {
    if (!zones.length) return;
    setZone((curr) => (curr && zones.some((z) => z.slug === curr) ? curr : zones[0].slug));
  }, [zones]);
  // Calculator state holds the admin's tonnage input. The backend pricing
  // engine still works in kg internally, so we × 1000 on the way out (see
  // the /pricing/quote/ POST below). Default 10 T mirrors the old default
  // of 10000 kg.
  const [weightKg, setWeightKg] = useState(10);
  const [distanceKm, setDistanceKm] = useState(50);
  const [elevationM, setElevationM] = useState(0);
  // Driver VAT tier toggle. true = 18% (standard VAT-registered driver);
  // false = 1% (small-business income-tax tier). Mirrors the Driver
  // model's `vat_18_percent` so the calculator preview matches what an
  // order quote will compute once a driver is assigned.
  const [driverVatHigh, setDriverVatHigh] = useState(true);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  // VAT rate is configured in the Globals tab (PricingConfig.vat) — single
  // source of truth. We bump this nonce after the Globals tab saves so the
  // calculator re-quotes with the new rate without a manual refresh.
  // Globals broadcasts via a CustomEvent on window so we don't have to
  // hoist the rate into a context just for this.
  const [vatNonce, setVatNonce] = useState(0);
  useEffect(() => {
    const onChange = () => setVatNonce((n) => n + 1);
    window.addEventListener('pricing-config-updated', onChange);
    return () => window.removeEventListener('pricing-config-updated', onChange);
  }, []);

  // Pump panel
  const [pumpKind, setPumpKind] = useState('pump');
  const [pumpVolume, setPumpVolume] = useState(50);
  const [pumpQuoteResult, setPumpQuoteResult] = useState(null);
  const pumpDebounceRef = useRef(null);

  // Equipment list (static read)
  const [equipment, setEquipment] = useState([]);
  useEffect(() => {
    api.get('/pricing/equipment/').then(({ data }) => setEquipment(data || [])).catch(() => {});
  }, []);

  // Debounced live quote
  useEffect(() => {
    if (!zone) return undefined; // wait for the zones list to resolve
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.post('/pricing/quote/', {
          type, zone,
          // Convert admin's tons → kg for the engine.
          weight_kg: (weightKg || 0) * 1000,
          distance_km: distanceKm || 0,
          elevation_m: elevationM || 0,
          driver_vat_rate: driverVatHigh ? 0.18 : 0.01,
        });
        setQuote(data);
      } catch (e) {
        setQuote(null);
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [type, zone, weightKg, distanceKm, elevationM, driverVatHigh, vatNonce]);

  useEffect(() => {
    if (pumpDebounceRef.current) clearTimeout(pumpDebounceRef.current);
    pumpDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.post('/pricing/pump-quote/', {
          kind: pumpKind, volume_m3: pumpVolume || 0,
        });
        setPumpQuoteResult(data);
      } catch {
        setPumpQuoteResult(null);
      }
    }, 150);
    return () => clearTimeout(pumpDebounceRef.current);
  }, [pumpKind, pumpVolume]);

  const inputCardStyle = {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-xs)',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1fr' : '1fr', gap: 16 }}>
      {/* ── Inputs ── */}
      <div style={inputCardStyle}>
        <Title level={5} style={{ marginTop: 0 }}>{t('adminPricing.inputs')}</Title>
        <Form layout="vertical">
          <Form.Item label={t('adminPricing.type')} style={{ marginBottom: 12 }}>
            <Select value={type} onChange={setType}
              options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(`adminPricing.${o.i18n}`) }))} />
          </Form.Item>
          <Form.Item label={t('adminPricing.zone')} style={{ marginBottom: 12 }}>
            <Select value={zone} onChange={setZone}
              options={zones.map((z) => ({ value: z.slug, label: localizedText(z.name, lang) || z.slug }))} />
          </Form.Item>
          <Form.Item label={t('adminPricing.weightKg')} style={{ marginBottom: 12 }}
            validateStatus={(quote?.warnings?.includes('weight_exceeds_max') || quote?.weight_min_applied) ? 'warning' : ''}
            help={quote?.warnings?.includes('weight_exceeds_max')
              ? t('adminPricing.warningWeightOverMax')
              : (quote?.weight_min_applied
                  ? `${t('adminPricing.minWeightApplied')} — ${Number(quote.min_kg) / 1000} T`
                  : null)}>
            <InputNumber value={weightKg} onChange={(v) => setWeightKg(v ?? 0)} min={0} max={1000} step={0.1}
              style={{ width: '100%' }} addonAfter="T" />
          </Form.Item>
          <Form.Item label={t('adminPricing.distanceKm')} style={{ marginBottom: 12 }}
            validateStatus={quote?.warnings?.includes('distance_exceeds_fixed_radius') ? 'warning' : ''}
            help={quote?.warnings?.includes('distance_exceeds_fixed_radius') ? t('adminPricing.warningDistanceOverRadius') : null}>
            <InputNumber value={distanceKm} onChange={(v) => setDistanceKm(v ?? 0)} min={0} max={10000}
              style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('adminPricing.elevationM')} style={{ marginBottom: 12 }}>
            <InputNumber value={elevationM} onChange={(v) => setElevationM(v ?? 0)} min={0} max={20000}
              style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('adminPricing.driverVatRate')} style={{ marginBottom: 0 }}>
            <Segmented
              value={driverVatHigh ? '18' : '1'}
              onChange={(v) => setDriverVatHigh(v === '18')}
              options={[
                { value: '18', label: '18%' },
                { value: '1',  label: '1%'  },
              ]}
              block
            />
          </Form.Item>
        </Form>
      </div>

      {/* ── Results ── */}
      <div style={inputCardStyle}>
        <Title level={5} style={{ marginTop: 0 }}>
          {t('adminPricing.results')} {loading && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>…</span>}
        </Title>
        {quote ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <ResultRow label={t('adminPricing.weightRevenue')} value={fmtCurrency(quote.weight_revenue)} />
            <ResultRow label={t('adminPricing.distanceRevenue')} value={fmtCurrency(quote.distance_revenue)}
              hint={`× ${fmtNumber(quote.elevation_multiplier, 2)}`} />
            <ResultRow label={t('adminPricing.fixedRevenue')} value={fmtCurrency(quote.fixed_revenue)} />
            <ResultRow label={t('adminPricing.totalRevenue')} value={fmtCurrency(quote.total_revenue)} highlight="yellow" />
            {/* VAT — informational only, computed as total × rate from
                the PricingConfig.vat set in the Globals tab. Doesn't flow
                into Company Fee, Driver Gross, or Driver Net. */}
            <ResultRow label={t('adminPricing.vat')} value={fmtCurrency(quote.vat)}
              hint={fmtPercent(quote.vat_rate)} highlight="red" />
            <ResultRow label={t('adminPricing.companyFee')} value={fmtCurrency(quote.company_fee)}
              hint={fmtPercent(quote.rate?.fee_pct)} highlight="orange" />
            <ResultRow label={t('adminPricing.driverGross')} value={fmtCurrency(quote.driver_gross)} highlight="green" />
            {/* Driver VAT — informational, computed off driver_gross
                using the assigned driver's per-driver rate (or the
                Calculator's toggle when there's no driver yet). */}
            <ResultRow label={t('adminPricing.driverVat')} value={fmtCurrency(quote.driver_vat)}
              hint={fmtPercent(quote.driver_vat_rate)} highlight="red" />
            <ResultRow label={t('adminPricing.fuelCost')} value={fmtCurrency(quote.fuel_cost)}
              hint={`${fmtNumber(quote.fuel_per_km, 2)} ₾/km`} />
            <ResultRow label={t('adminPricing.driverNet')} value={fmtCurrency(quote.driver_net)} bold />
          </div>
        ) : (
          <Empty description={t('adminPricing.fillInputs')} />
        )}
      </div>

      {/* ── Pump-mixer panel ── */}
      <div style={{ ...inputCardStyle, gridColumn: isDesktop ? 'span 1' : 'span 1' }}>
        <Title level={5} style={{ marginTop: 0 }}>{t('adminPricing.pumpMixer')}</Title>
        <Form layout="vertical">
          <Form.Item label={t('adminPricing.pumpKind')} style={{ marginBottom: 12 }}>
            <Select value={pumpKind} onChange={setPumpKind}
              options={PUMP_KIND_OPTIONS.map((o) => ({ value: o.value, label: t(`adminPricing.${o.i18n}`) }))} />
          </Form.Item>
          <Form.Item label={t('adminPricing.volumeM3')} style={{ marginBottom: 0 }}
            validateStatus={pumpQuoteResult?.warnings?.includes('volume_exceeds_max') ? 'warning' : ''}
            help={pumpQuoteResult?.warnings?.includes('volume_exceeds_max') ? t('adminPricing.warningVolumeOverMax') : null}>
            <InputNumber value={pumpVolume} onChange={(v) => setPumpVolume(v ?? 0)} min={0} max={10000}
              style={{ width: '100%' }} />
          </Form.Item>
        </Form>
        {pumpQuoteResult && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ResultRow label={`${pumpQuoteResult.volume_m3} × ${fmtCurrency(pumpQuoteResult.per_m3)}/m³`}
              value={fmtCurrency(Number(pumpQuoteResult.per_m3) * Number(pumpQuoteResult.volume_m3))} />
            {Number(pumpQuoteResult.fixed) > 0 && (
              <ResultRow label={t('adminPricing.fixedSurcharge')} value={fmtCurrency(pumpQuoteResult.fixed)} />
            )}
            <ResultRow label={t('adminPricing.total')} value={fmtCurrency(pumpQuoteResult.total)} highlight="yellow" bold />
          </div>
        )}
      </div>

      {/* ── Equipment list ── */}
      <div style={inputCardStyle}>
        <Title level={5} style={{ marginTop: 0 }}>{t('adminPricing.equipment')}</Title>
        {equipment.length === 0 ? <Empty /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {equipment.map((eq) => (
              <ResultRow key={eq.id}
                label={localizedText(eq.name, lang)}
                value={`${fmtCurrency(eq.price)} / ${localizedText(eq.unit, lang)}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value, hint, bold, highlight }) {
  // Tinted backgrounds for the rows the admin scans most often:
  // - yellow: customer-facing total
  // - green:  driver's gross take
  // - red:    tax obligations (VAT, Driver VAT)
  // - orange: platform cut (Company Fee)
  const bg = highlight === 'yellow' ? 'rgba(234, 179, 8, 0.12)'
    : highlight === 'green'  ? 'rgba(16, 185, 129, 0.12)'
    : highlight === 'red'    ? 'rgba(239, 68, 68, 0.12)'
    : highlight === 'orange' ? 'rgba(249, 115, 22, 0.12)'
    : 'transparent';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      padding: '8px 12px', borderRadius: 8, background: bg,
      borderBottom: highlight ? 'none' : '1px solid var(--border-light)',
    }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{
        fontSize: bold ? 16 : 14, fontWeight: bold ? 800 : 600,
        color: 'var(--text-primary)',
      }}>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>{hint}</span>}
        {value}
      </div>
    </div>
  );
}

// ── Tab 2: Rates ───────────────────────────────────────────────────────────

function RatesTab({ t, lang, zones }) {
  const zoneLabel = (slug) => {
    const z = zones.find((zz) => zz.slug === slug);
    return z ? (localizedText(z.name, lang) || z.slug) : slug;
  };
  const [rates, setRates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    const { data } = await api.get('/pricing/admin/rates/');
    setRates(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ── Tonnage boundary helpers ──
  // Backend stores per_kg (₾/kg) and max_kg (kg). The admin form is
  // labelled in tons, so we convert at the modal boundary: scale on load
  // for display, scale on save before the API call.
  const toFormUnits = (row) => {
    if (!row) return null;
    return {
      ...row,
      per_kg: row.per_kg != null ? Number(row.per_kg) * 1000 : row.per_kg,
      max_kg: row.max_kg != null ? Number(row.max_kg) / 1000 : row.max_kg,
      min_kg: row.min_kg != null ? Number(row.min_kg) / 1000 : 0,
    };
  };
  const fromFormUnits = (values) => ({
    ...values,
    per_kg: values.per_kg != null ? Number(values.per_kg) / 1000 : values.per_kg,
    max_kg: values.max_kg != null ? Number(values.max_kg) * 1000 : values.max_kg,
    min_kg: values.min_kg != null ? Number(values.min_kg) * 1000 : 0,
  });

  const openModal = (row) => {
    setEditing(row);
    form.setFieldsValue(toFormUnits(row) || {
      type: 'hiab', zone: 'tbilisi',
      min_fix: 0, per_kg: 0, max_kg: 0, min_kg: 0, per_km: 0,
      fixed_price: 0, fixed_radius: 0, fee_pct: 0.15, km_fix: 0,
      fuel_per_km: 1.26,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = fromFormUnits(values);
      if (editing?.id) {
        await api.patch(`/pricing/admin/rates/${editing.id}/`, payload);
      } else {
        await api.post('/pricing/admin/rates/', payload);
      }
      message.success(t('common.saved'));
      setModalOpen(false);
      load();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(t('adminPricing.saveFailed'));
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      okType: 'danger',
      onOk: async () => {
        await api.delete(`/pricing/admin/rates/${id}/`);
        load();
      },
    });
  };

  const columns = [
    { title: t('adminPricing.type'), dataIndex: 'type',
      render: (v) => t(`adminPricing.${TYPE_OPTIONS.find((o) => o.value === v)?.i18n || v}`) },
    { title: t('adminPricing.zone'), dataIndex: 'zone',
      render: (v) => zoneLabel(v) },
    { title: t('adminPricing.minFix'), dataIndex: 'min_fix', render: fmtNumber },
    // DB stores per_kg (₾/kg) — show per ton (₾/T) so the admin reads in the
    // same unit they enter into the edit modal.
    { title: t('adminPricing.perKg'), dataIndex: 'per_kg',
      render: (v) => fmtNumber(v != null ? Number(v) * 1000 : v, 2) },
    // DB stores min_kg — display as tons. 0 = no minimum.
    { title: t('adminPricing.minKg'), dataIndex: 'min_kg',
      render: (v) => v != null ? fmtNumber(Number(v) / 1000, 2) : v },
    // DB stores max_kg — display as tons.
    { title: t('adminPricing.maxKg'), dataIndex: 'max_kg',
      render: (v) => v != null ? fmtNumber(Number(v) / 1000, 2) : v },
    { title: t('adminPricing.perKm'), dataIndex: 'per_km', render: fmtNumber },
    { title: t('adminPricing.kmFix'), dataIndex: 'km_fix', render: fmtNumber },
    { title: t('adminPricing.fuelPerKm'), dataIndex: 'fuel_per_km', render: fmtNumber },
    { title: t('adminPricing.feePct'), dataIndex: 'fee_pct', render: (v) => fmtPercent(v) },
    { title: t('adminPricing.fixedRadius'), dataIndex: 'fixed_radius' },
    {
      title: '', width: 80,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          {t('adminPricing.newRate')}
        </Button>
      </div>
      <Table
        rowKey="id"
        dataSource={rates}
        columns={columns}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editing?.id ? t('adminPricing.editRate') : t('adminPricing.newRate')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label={t('adminPricing.type')} rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: t(`adminPricing.${o.i18n}`) }))} />
          </Form.Item>
          <Form.Item name="zone" label={t('adminPricing.zone')} rules={[{ required: true }]}>
            <Select
              options={zones.map((z) => ({ value: z.slug, label: localizedText(z.name, lang) || z.slug }))}
              placeholder={t('adminPricing.zone')}
            />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Form.Item name="min_fix" label={t('adminPricing.minFix')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="per_kg" label={t('adminPricing.perKg')} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.001} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_kg" label={t('adminPricing.minKg')}>
              <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="max_kg" label={t('adminPricing.maxKg')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="per_km" label={t('adminPricing.perKm')} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="km_fix" label={t('adminPricing.kmFix')} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fuel_per_km" label={t('adminPricing.fuelPerKm')} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fee_pct" label={t('adminPricing.feePctDecimal')} rules={[{ required: true }]}>
              <InputNumber min={0} max={1} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fixed_price" label={t('adminPricing.fixedPrice')}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="fixed_radius" label={t('adminPricing.fixedRadius')}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </>
  );
}

// ── Tab 3: Zones ───────────────────────────────────────────────────────────

function ZonesTab({ t, lang, onChanged }) {
  const [zones, setZones] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [form] = Form.useForm();
  const kind = Form.useWatch('kind', form);

  const load = useCallback(async () => {
    const { data } = await api.get('/pricing/admin/zones/');
    setZones(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openModal = (row) => {
    setEditing(row);
    form.setFieldsValue(row || {
      name: { en: '', ka: '', ru: '' },
      kind: 'distance', keywords: '', keyword_scope: 'within',
      max_distance_km: null,
      is_active: true,
    });
    setModalOpen(true);
  };

  const persistOrder = async (nextZones) => {
    setZones(nextZones);
    try {
      await api.post('/pricing/admin/zones/reorder/', { ids: nextZones.map((z) => z.id) });
      if (onChanged) onChanged();
    } catch {
      message.error(t('adminPricing.saveFailed'));
      load();
    }
  };

  const handleRowDragStart = (idx) => () => setDragIndex(idx);
  const handleRowDragOver = (e) => { e.preventDefault(); };
  const handleRowDrop = (idx) => (e) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === idx) { setDragIndex(null); return; }
    const next = [...zones];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setDragIndex(null);
    persistOrder(next);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing?.id) {
        await api.patch(`/pricing/admin/zones/${editing.id}/`, values);
      } else {
        await api.post('/pricing/admin/zones/', values);
      }
      message.success(t('common.saved'));
      setModalOpen(false);
      load();
      if (onChanged) onChanged();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(t('adminPricing.saveFailed'));
    }
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      okType: 'danger',
      onOk: async () => {
        await api.delete(`/pricing/admin/zones/${id}/`);
        load();
        if (onChanged) onChanged();
      },
    });
  };

  const columns = [
    {
      title: '', width: 40,
      render: () => (
        <span title={t('adminPricing.dragToReorder')}
          style={{ cursor: 'grab', color: 'var(--text-tertiary)', userSelect: 'none', fontSize: 16 }}>
          ⋮⋮
        </span>
      ),
    },
    {
      title: t('adminPricing.zoneName'),
      render: (_, r) => (
        <div>
          <div>{localizedText(r.name, lang) || r.slug}</div>
          <code style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.slug}</code>
        </div>
      ),
    },
    { title: t('adminPricing.zoneKind'), dataIndex: 'kind',
      render: (v) => t(v === 'keyword' ? 'adminPricing.zoneKindKeyword' : 'adminPricing.zoneKindDistance') },
    { title: t('adminPricing.zoneRule'), render: (_, r) => {
      if (r.kind === 'keyword') return r.keywords || '—';
      return r.max_distance_km != null ? `≤ ${r.max_distance_km} km` : '∞ (catch-all)';
    }},
    { title: t('common.active'), dataIndex: 'is_active',
      render: (v) => v ? <Tag color="green">{t('common.active')}</Tag> : <Tag>—</Tag> },
    {
      title: '', width: 90,
      render: (_, record) => (
        <Space size={4}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openModal(record)} />
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ];

  // Custom row component — wires native HTML5 DnD so admins can drag a row
  // up or down to reorder. The order field still lives in the DB (used by
  // the engine for evaluation priority) but the admin never types into it.
  const DraggableRow = (props) => {
    const idx = zones.findIndex((z) => z.id === props['data-row-key']);
    const isOver = dragIndex !== null && idx === dragIndex;
    return (
      <tr
        {...props}
        draggable
        onDragStart={handleRowDragStart(idx)}
        onDragOver={handleRowDragOver}
        onDrop={handleRowDrop(idx)}
        onDragEnd={() => setDragIndex(null)}
        style={{
          ...(props.style || {}),
          cursor: 'grab',
          opacity: isOver ? 0.5 : 1,
        }}
      />
    );
  };

  return (
    <>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          {t('adminPricing.zonesHelp')}
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
          {t('adminPricing.newZone')}
        </Button>
      </div>
      <Table
        rowKey="id"
        dataSource={zones}
        columns={columns}
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        components={{ body: { row: DraggableRow } }}
      />

      <Modal
        title={editing?.id ? t('adminPricing.editZone') : t('adminPricing.newZone')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('adminPricing.zoneName')} rules={[{ required: true }]}>
            <I18nInput />
          </Form.Item>
          <Form.Item name="kind" label={t('adminPricing.zoneKind')} rules={[{ required: true }]}>
            <Segmented
              options={[
                { label: t('adminPricing.zoneKindKeyword'), value: 'keyword' },
                { label: t('adminPricing.zoneKindDistance'), value: 'distance' },
              ]}
              block
            />
          </Form.Item>
          {kind === 'keyword' && (
            <>
              <Form.Item name="keywords" label={t('adminPricing.zoneKeywords')}
                extra={t('adminPricing.zoneKeywordsHelp')}>
                <Input placeholder="tbilisi, თბილისი, тбилиси" />
              </Form.Item>
              <Form.Item name="keyword_scope" label={t('adminPricing.zoneKeywordScope')}
                extra={t('adminPricing.zoneKeywordScopeHelp')}>
                <Segmented
                  options={[
                    { label: t('adminPricing.zoneKeywordScopeWithin'), value: 'within' },
                    { label: t('adminPricing.zoneKeywordScopeCrossing'), value: 'crossing' },
                  ]}
                  block
                />
              </Form.Item>
            </>
          )}
          {kind === 'distance' && (
            <Form.Item name="max_distance_km" label={t('adminPricing.zoneMaxDistance')}
              extra={t('adminPricing.zoneMaxDistanceHelp')}>
              <InputNumber min={0} style={{ width: '100%' }} placeholder="30" />
            </Form.Item>
          )}
          <Form.Item name="is_active" valuePropName="checked" label={t('common.active')}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}


// ── Tab 4: Elevation buckets + globals ─────────────────────────────────────

function ElevationGlobalsTab({ t }) {
  const [config, setConfig] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [editingBucket, setEditingBucket] = useState(null);
  const [bucketModalOpen, setBucketModalOpen] = useState(false);
  const [bucketForm] = Form.useForm();
  const [configForm] = Form.useForm();

  const loadConfig = useCallback(async () => {
    const { data } = await api.get('/pricing/admin/config/');
    setConfig(data);
    // VAT is stored as a decimal (0.18) but admins think in percent.
    // Show the field as 18.00 — convert back on save.
    configForm.setFieldsValue({
      ...data,
      vat: data?.vat != null ? Number(data.vat) * 100 : null,
    });
  }, [configForm]);
  const loadBuckets = useCallback(async () => {
    const { data } = await api.get('/pricing/admin/elevation/');
    setBuckets(data || []);
  }, []);
  useEffect(() => { loadConfig(); loadBuckets(); }, [loadConfig, loadBuckets]);

  const handleConfigSave = async () => {
    try {
      const values = await configForm.validateFields();
      // Convert VAT % (admin-facing) back to decimal (storage / engine).
      const payload = {
        ...values,
        vat: values?.vat != null ? Number(values.vat) / 100 : null,
      };
      await api.patch('/pricing/admin/config/', payload);
      message.success(t('common.saved'));
      loadConfig();
      // Tell the Calculator tab to re-fire its quote with the new rate.
      window.dispatchEvent(new CustomEvent('pricing-config-updated'));
    } catch (e) {
      if (e?.errorFields) return;
      message.error(t('adminPricing.saveFailed'));
    }
  };

  const openBucket = (row) => {
    setEditingBucket(row);
    bucketForm.setFieldsValue(row || { max_gradient: null, multiplier: 1, order: buckets.length });
    setBucketModalOpen(true);
  };

  const handleBucketSave = async () => {
    try {
      const values = await bucketForm.validateFields();
      if (editingBucket?.id) {
        await api.patch(`/pricing/admin/elevation/${editingBucket.id}/`, values);
      } else {
        await api.post('/pricing/admin/elevation/', values);
      }
      message.success(t('common.saved'));
      setBucketModalOpen(false);
      loadBuckets();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(t('adminPricing.saveFailed'));
    }
  };

  const handleBucketDelete = async (id) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      okType: 'danger',
      onOk: async () => {
        await api.delete(`/pricing/admin/elevation/${id}/`);
        loadBuckets();
      },
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
      {/* Globals */}
      <section>
        <Title level={5}>{t('adminPricing.globals')}</Title>
        <Form form={configForm} layout="vertical">
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message={t('adminPricing.fuelOnRatesNotice')} />
          <Form.Item name="vat" label={t('adminPricing.vatRate')} rules={[{ required: true }]}
            style={{ maxWidth: 280 }}>
            <InputNumber min={0} max={100} step={0.5} precision={2}
              style={{ width: '100%' }} addonAfter="%" />
          </Form.Item>
          <Button type="primary" onClick={handleConfigSave}>{t('common.save')}</Button>
        </Form>
      </section>

      {/* Buckets */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>{t('adminPricing.elevationBuckets')}</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openBucket(null)}>
            {t('adminPricing.newBucket')}
          </Button>
        </div>
        <Alert type="info" showIcon style={{ marginBottom: 12 }}
          message={t('adminPricing.bucketsHelp')} />
        <Table
          rowKey="id"
          dataSource={buckets}
          size="small"
          pagination={false}
          columns={[
            { title: t('adminPricing.order'), dataIndex: 'order', width: 80 },
            { title: t('adminPricing.maxGradient'), dataIndex: 'max_gradient',
              render: (v) => v == null ? '∞' : fmtNumber(v, 2) },
            { title: t('adminPricing.multiplier'), dataIndex: 'multiplier',
              render: (v) => `× ${fmtNumber(v, 2)}` },
            {
              title: '', width: 80,
              render: (_, record) => (
                <Space size={4}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openBucket(record)} />
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleBucketDelete(record.id)} />
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Modal
        title={editingBucket?.id ? t('adminPricing.editBucket') : t('adminPricing.newBucket')}
        open={bucketModalOpen}
        onCancel={() => setBucketModalOpen(false)}
        onOk={handleBucketSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={bucketForm} layout="vertical">
          <Form.Item name="order" label={t('adminPricing.order')} rules={[{ required: true }]}>
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_gradient" label={t('adminPricing.maxGradient')}
            extra={t('adminPricing.maxGradientHelp')}>
            <InputNumber min={0} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="multiplier" label={t('adminPricing.multiplier')} rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Tab 4: Equipment + Pump-Mixer ──────────────────────────────────────────

function EquipmentPumpTab({ t, lang }) {
  const [pumpRows, setPumpRows] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [editingPump, setEditingPump] = useState(null);
  const [pumpModalOpen, setPumpModalOpen] = useState(false);
  const [pumpForm] = Form.useForm();
  const [editingEq, setEditingEq] = useState(null);
  const [eqModalOpen, setEqModalOpen] = useState(false);
  const [eqForm] = Form.useForm();

  const loadPump = useCallback(async () => {
    const { data } = await api.get('/pricing/admin/pump-mixer/');
    setPumpRows(data || []);
  }, []);
  const loadEquipment = useCallback(async () => {
    const { data } = await api.get('/pricing/admin/equipment/');
    setEquipment(data || []);
  }, []);
  useEffect(() => { loadPump(); loadEquipment(); }, [loadPump, loadEquipment]);

  const openPump = (row) => {
    setEditingPump(row);
    pumpForm.setFieldsValue(row || { kind: 'pump', per_m3: 0, fixed: 0, max_m3: 100 });
    setPumpModalOpen(true);
  };
  const handlePumpSave = async () => {
    try {
      const values = await pumpForm.validateFields();
      if (editingPump?.id) {
        await api.patch(`/pricing/admin/pump-mixer/${editingPump.id}/`, values);
      } else {
        await api.post('/pricing/admin/pump-mixer/', values);
      }
      message.success(t('common.saved'));
      setPumpModalOpen(false);
      loadPump();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(t('adminPricing.saveFailed'));
    }
  };

  const openEq = (row) => {
    setEditingEq(row);
    eqForm.setFieldsValue(row || {
      name: { en: '', ka: '', ru: '' },
      unit: { en: '1 day', ka: '1 დღე', ru: '1 день' },
      price: 0, order: equipment.length, is_active: true,
    });
    setEqModalOpen(true);
  };
  const handleEqSave = async () => {
    try {
      const values = await eqForm.validateFields();
      if (editingEq?.id) {
        await api.patch(`/pricing/admin/equipment/${editingEq.id}/`, values);
      } else {
        await api.post('/pricing/admin/equipment/', values);
      }
      message.success(t('common.saved'));
      setEqModalOpen(false);
      loadEquipment();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(t('adminPricing.saveFailed'));
    }
  };
  const handleEqDelete = async (id) => {
    Modal.confirm({
      title: t('common.confirmDelete'),
      okType: 'danger',
      onOk: async () => {
        await api.delete(`/pricing/admin/equipment/${id}/`);
        loadEquipment();
      },
    });
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
      {/* Pump-mixer */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>{t('adminPricing.pumpMixerRates')}</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openPump(null)}>
            {t('adminPricing.newPumpRate')}
          </Button>
        </div>
        <Table
          rowKey="id"
          dataSource={pumpRows}
          size="small"
          pagination={false}
          columns={[
            { title: t('adminPricing.pumpKind'), dataIndex: 'kind',
              render: (v) => t(`adminPricing.${PUMP_KIND_OPTIONS.find((o) => o.value === v)?.i18n || v}`) },
            { title: t('adminPricing.perM3'), dataIndex: 'per_m3', render: fmtNumber },
            { title: t('adminPricing.fixedSurcharge'), dataIndex: 'fixed', render: fmtNumber },
            { title: t('adminPricing.maxM3'), dataIndex: 'max_m3' },
            {
              title: '', width: 60,
              render: (_, record) => (
                <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openPump(record)} />
              ),
            },
          ]}
        />
      </section>

      {/* Equipment */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>{t('adminPricing.equipment')}</Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openEq(null)}>
            {t('adminPricing.newEquipment')}
          </Button>
        </div>
        <Table
          rowKey="id"
          dataSource={equipment}
          size="small"
          pagination={false}
          columns={[
            { title: t('adminPricing.order'), dataIndex: 'order', width: 80 },
            { title: t('adminPricing.equipmentName'),
              render: (_, r) => localizedText(r.name, lang) },
            { title: t('adminPricing.equipmentUnit'),
              render: (_, r) => localizedText(r.unit, lang) },
            { title: t('adminPricing.price'), dataIndex: 'price', render: fmtCurrency },
            { title: t('common.active'), dataIndex: 'is_active',
              render: (v) => v ? <Tag color="green">{t('common.active')}</Tag> : <Tag>—</Tag> },
            {
              title: '', width: 90,
              render: (_, record) => (
                <Space size={4}>
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEq(record)} />
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleEqDelete(record.id)} />
                </Space>
              ),
            },
          ]}
        />
      </section>

      <Modal
        title={editingPump?.id ? t('adminPricing.editPumpRate') : t('adminPricing.newPumpRate')}
        open={pumpModalOpen}
        onCancel={() => setPumpModalOpen(false)}
        onOk={handlePumpSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={pumpForm} layout="vertical">
          <Form.Item name="kind" label={t('adminPricing.pumpKind')} rules={[{ required: true }]}>
            <Select options={PUMP_KIND_OPTIONS.map((o) => ({ value: o.value, label: t(`adminPricing.${o.i18n}`) }))} />
          </Form.Item>
          <Form.Item name="per_m3" label={t('adminPricing.perM3')} rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="fixed" label={t('adminPricing.fixedSurcharge')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="max_m3" label={t('adminPricing.maxM3')}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingEq?.id ? t('adminPricing.editEquipment') : t('adminPricing.newEquipment')}
        open={eqModalOpen}
        onCancel={() => setEqModalOpen(false)}
        onOk={handleEqSave}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        destroyOnClose
      >
        <Form form={eqForm} layout="vertical">
          <Form.Item name="name" label={t('adminPricing.equipmentName')} rules={[{ required: true }]}>
            <I18nInput />
          </Form.Item>
          <Form.Item name="unit" label={t('adminPricing.equipmentUnit')}>
            <I18nInput />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Form.Item name="price" label={t('adminPricing.price')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="order" label={t('adminPricing.order')}>
              <InputNumber min={0} max={9999} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
