import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Form, Input, Button, Select, DatePicker, TimePicker, Upload, message, Spin, Grid, Switch, Dropdown } from 'antd';
import {
  ArrowLeftOutlined, EnvironmentOutlined,
  CalendarOutlined, UserOutlined, PhoneOutlined, CameraOutlined,
  CheckCircleOutlined, BulbOutlined, CloseOutlined, SearchOutlined,
  SwapRightOutlined, ClockCircleOutlined, InboxOutlined,
  PlusOutlined, DeleteOutlined, ExpandOutlined,
  FileTextOutlined, CarOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useBranding } from '../../contexts/BrandingContext';
import { useLang } from '../../contexts/LanguageContext';
import { CategoryImage } from '../../utils/categoryIcons';
import MapPicker from '../../components/map/MapPicker';
import FullscreenLocationPicker from '../../components/map/FullscreenLocationPicker';
import useTruckRoute from '../../hooks/useTruckRoute';
import LocationAutocomplete from '../../components/common/LocationAutocomplete';
import MapIcon from '../../components/common/MapIcon';
import ContactFab from '../../components/common/ContactFab';
import PhoneInput, { isValidGeorgiaPhone } from '../../components/common/PhoneInput';

const { TextArea } = Input;

// Cargo input fallback when a service has no cargo_field_config or when the
// customer picks the synthetic "Not sure / admin decide" service. Keep in
// lockstep with backend services/models.py DEFAULT_CARGO_FIELD_CONFIG.
// Dimensions visible by default; extras hidden until admin opts in.
// Form.Item `normalize` for free-text dimension/weight inputs: keep only
// digits and a single decimal point. Accepts EU comma → dot. Runs on
// every change (typing + paste), so the form state never sees letters.
const sanitizeNumericInput = (raw) => {
  if (raw == null || typeof raw !== 'string') return raw;
  let cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot >= 0) {
    cleaned = cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, '');
  }
  return cleaned;
};

const CARGO_FALLBACK_CONFIG = {
  length: 'optional', width: 'optional', height: 'optional',
  volume: 'optional', weight: 'optional',
  floor: 'off', days: 'off', fragile: 'off',
  insured: 'off', insurance: 'off',
};
const { useBreakpoint } = Grid;

// Build an AntD TimePicker `disabledTime` callback from the restricted
// windows that apply to the current order, plus a list of human-readable
// rules for the warning banner. A window applies if any pickup,
// destination, or route stop text contains its `location_keyword`
// (case-insensitive substring).
function computeRestrictions(windows, locationTexts) {
  const lowered = locationTexts
    .map((t) => (t || '').toLowerCase())
    .filter(Boolean);

  const applicable = (windows || []).filter((w) => {
    if (!w.is_active) return false;
    const kw = (w.location_keyword || '').toLowerCase().trim();
    if (!kw) return false;
    return lowered.some((txt) => txt.includes(kw));
  });

  if (applicable.length === 0) {
    return { applicable: [], disabledTime: undefined };
  }

  // For each window like 17:00–19:00, mark every minute in [start, end) as
  // blocked. Wrap-around windows (e.g. 22:00–06:00) are split into two
  // ranges. Each minute is one bit in a 1440-entry array.
  const blocked = new Array(24 * 60).fill(false);
  const minutesOf = (hms) => {
    if (!hms) return null;
    const [h, m] = hms.split(':').map(Number);
    return h * 60 + m;
  };
  applicable.forEach((w) => {
    const s = minutesOf(w.start_time);
    const e = minutesOf(w.end_time);
    if (s == null || e == null) return;
    if (s < e) {
      for (let i = s; i < e; i++) blocked[i] = true;
    } else if (s > e) {
      for (let i = s; i < 24 * 60; i++) blocked[i] = true;
      for (let i = 0; i < e; i++) blocked[i] = true;
    }
  });

  const disabledTime = () => ({
    disabledHours: () => {
      const hours = [];
      for (let h = 0; h < 24; h++) {
        let allBlocked = true;
        for (let m = 0; m < 60; m++) {
          if (!blocked[h * 60 + m]) { allBlocked = false; break; }
        }
        if (allBlocked) hours.push(h);
      }
      return hours;
    },
    disabledMinutes: (h) => {
      if (h == null || h < 0) return [];
      const mins = [];
      for (let m = 0; m < 60; m++) {
        if (blocked[h * 60 + m]) mins.push(m);
      }
      return mins;
    },
  });

  return { applicable, disabledTime };
}

export default function NewOrderFlow() {
  const [form] = Form.useForm();
  const { user } = useAuth();
  const { t, lang, changeLang, SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS } = useLang();

  // Language switcher menu — mirrors the AppLayout pattern so users get the
  // same options regardless of where they trigger it from. NewOrderFlow
  // routes outside AppLayout, so we render the switcher inline in the page
  // header instead of pulling it from the layout.
  const langMenuItems = SUPPORTED_LANGS.map((code) => ({
    key: `lang-${code}`,
    label: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 110 }}>
        <span>{LANG_FLAGS[code]}</span>
        <span>{LANG_LABELS[code]}</span>
        {lang === code && (
          <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>&#10003;</span>
        )}
      </span>
    ),
    onClick: () => changeLang(code),
  }));
  const { currency } = useBranding();
  const currencySymbol = currency?.symbol || '₾';
  const localized = (field) => {
    if (!field) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field['en'] || '';
  };
  const screens = useBreakpoint();
  const isDesktop = screens.md;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Two steps: 0=form, 1=confirm
  const [step, setStep] = useState(0);

  // Reset scroll position whenever we move between steps. Runs after React
  // commits the new step's DOM (effects fire post-paint), so smooth-scroll
  // targets the right document height. Without this the review screen
  // lands wherever the form was last scrolled to.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);
  const [categories, setCategories] = useState([]);
  // Full list of TransportCategory rows. Populates the first step (car
  // category picker) which the customer fills in BEFORE the service step —
  // the service grid below is filtered to services whose `car_categories`
  // M2M includes the selected vehicle type.
  const [carCategories, setCarCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  // Real TransportCategory chosen by the customer. With the new
  // category-first flow this is set in step 1 and drives the filtered
  // services list in step 2. May hold the helper-card DB row when the
  // customer defers (is_helper_card === true on the stored object).
  const [selectedTransportCategory, setSelectedTransportCategory] = useState(null);
  // Set when the user deep-links via ?service=X to a service that has
  // multiple allowed car_categories — we need them to pick the car category
  // first (filtered to the service's allowed list), then auto-lock the
  // service once they choose.
  const [pendingServiceId, setPendingServiceId] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [formValues, setFormValues] = useState({});
  const [catSearch, setCatSearch] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showCargo, setShowCargo] = useState(false);

  // Multi-stop route state
  const [pickupStops, setPickupStops] = useState([{ text: '', coords: null, contact_name: '', contact_phone: '' }]);
  const [destStops, setDestStops] = useState([{ text: '', coords: null, contact_name: '', contact_phone: '' }]);
  const [activeStop, setActiveStop] = useState({ type: 'pickup', index: 0 });
  // On mobile, tapping the small embedded MapPicker should open the
  // full-screen crosshair picker instead of pinning inside the 240px
  // thumbnail (the user can't aim accurately on a 240px-tall map).
  const [inlineMapFullscreenOpen, setInlineMapFullscreenOpen] = useState(false);
  const [totalDistance, setTotalDistance] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const distanceTimerRef = useRef(null);

  // One ref per pickup / destination row so the submit-time gate can
  // focus the offending input when a stop has text but no coords.
  const pickupInputRefs = useRef([]);
  const destInputRefs = useRef([]);

  // Customer-facing approximate-price preview shown on the review step.
  // null = not fetched yet / inputs incomplete, { price, computed } otherwise.
  const [pricePreview, setPricePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Auto-scroll refs ──
  // Anchors for forward auto-scroll after the customer commits a step.
  // Each ref attaches to a wrapper around the relevant SectionCard.
  const transportCategoryRef = useRef(null);
  const serviceRef = useRef(null);
  const routeRef = useRef(null);
  const dateRef = useRef(null);
  const descriptionRef = useRef(null);
  const scrollToRef = (ref) => {
    // Defer one tick so React renders newly-shown sections first
    // (e.g. the transport-category SectionCard, which only appears once
    // a service with 2+ vehicle types is selected).
    setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  const needsDest = selectedCategory?.requires_destination;

  // Pre-fill from landing page
  useEffect(() => {
    const state = location.state;
    if (state) {
      if (state.pickup) {
        const text = state.pickup.text || state.pickup.address || '';
        const coords = (state.pickup.lat && state.pickup.lng) ? { lat: state.pickup.lat, lng: state.pickup.lng } : null;
        setPickupStops([{ text, coords }]);
      }
      if (state.destination) {
        const text = state.destination.text || state.destination.address || '';
        const coords = (state.destination.lat && state.destination.lng) ? { lat: state.destination.lat, lng: state.destination.lng } : null;
        setDestStops([{ text, coords }]);
      }
    }
  }, [location.state]); // eslint-disable-line

  useEffect(() => {
    // Both lists are needed to wire up the deep-link smart-pick logic below
    // — the service's allowed car_categories drive the picker, and we look
    // services up by ID from the cached list.
    Promise.all([
      api.get('/services/'),
      api.get('/categories/'),
    ]).then(([svcRes, catRes]) => {
      const svcs = Array.isArray(svcRes.data) ? svcRes.data : svcRes.data.results || [];
      const ccats = Array.isArray(catRes.data) ? catRes.data : catRes.data.results || [];
      setCategories(svcs);
      setCarCategories(ccats);

      const catParam = searchParams.get('category');
      const svcParam = searchParams.get('service');

      // ?category=<id> — pre-select the car category and auto-scroll to
      // the service step so the customer continues where AppHome dropped
      // them off. Plain entry (no query params) intentionally lands at the
      // top so the customer picks a car category first.
      if (catParam) {
        const cc = ccats.find((c) => String(c.id) === catParam);
        if (cc) {
          setSelectedTransportCategory(cc);
          scrollToRef(serviceRef);
        }
      }

      // ?service=<id> — smart-pick based on the service's allowed car
      // categories:
      //   0 cats → fall back to plain flow (ignore deep link)
      //   1 cat  → auto-select both, customer skips both pickers and lands
      //            at the route step
      //   2+    → set pendingServiceId so the car-category picker filters
      //           to that service's allowed list; we lock the service once
      //           the customer picks one of those categories
      if (svcParam) {
        const svc = svcs.find((s) => String(s.id) === svcParam);
        if (svc) {
          const allowed = Array.isArray(svc.car_categories) ? svc.car_categories : [];
          if (allowed.length === 1) {
            setSelectedTransportCategory(allowed[0]);
            setSelectedCategory(svc);
            form.setFieldsValue({ selected_category: svc.id });
            scrollToRef(routeRef);
          } else if (allowed.length >= 2) {
            setPendingServiceId(svc.id);
          }
        }
      }
    });
  }, [searchParams]); // eslint-disable-line

  // Auto-fill pickup #1 contact info from the logged-in user. Each route
  // stop carries its own contact pair now; only pickup #1 mirrors the
  // top-level Order.contact_name/Order.contact_phone fields.
  useEffect(() => {
    if (!user) return;
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    setPickupStops((prev) => prev.map((s, i) => {
      if (i !== 0) return s;
      // Don't overwrite anything the customer has already typed.
      return {
        ...s,
        contact_name: s.contact_name || name,
        contact_phone: s.contact_phone || (user.phone_number || ''),
      };
    }));
  }, [user]); // eslint-disable-line

  // Step 1 of the form: picking the car category. Filters the service grid
  // below and triggers an auto-scroll to the service step. When the user
  // arrived via a ?service= deep link with multiple allowed car categories,
  // pendingServiceId is set — picking a car cat from the filtered list now
  // locks the service automatically and jumps straight to the route step.
  const handleTransportCategorySelect = (tc) => {
    setSelectedTransportCategory(tc);
    // If the previously-selected service doesn't belong to this car
    // category, drop it so the customer re-picks from the filtered list.
    if (
      selectedCategory
      && !selectedCategory.is_helper_card
      && Array.isArray(selectedCategory.car_categories)
      && !selectedCategory.car_categories.some((c) => c.id === tc.id)
    ) {
      setSelectedCategory(null);
      form.setFieldsValue({ selected_category: null });
    }
    if (pendingServiceId) {
      const svc = categories.find((s) => String(s.id) === String(pendingServiceId));
      if (svc) {
        setSelectedCategory(svc);
        form.setFieldsValue({ selected_category: svc.id });
        setPendingServiceId(null);
        scrollToRef(routeRef);
        return;
      }
      setPendingServiceId(null);
    }
    scrollToRef(serviceRef);
  };

  // Step 2: picking the actual Service (legacy state name: selectedCategory).
  // Car category is already chosen by this point, so just store the service
  // and jump to the route step.
  const handleCategorySelect = (cat) => {
    setSelectedCategory(cat);
    form.setFieldsValue({ selected_category: cat.id });
    scrollToRef(routeRef);
  };

  const handleDescriptionBlur = async () => {
    const desc = form.getFieldValue('description');
    if (desc && desc.length > 10) {
      try {
        const { data } = await api.post('/services/suggest/', { description: desc });
        if (data.id && data.id !== selectedCategory?.id) setSuggestion(data);
      } catch { /* ignore */ }
    }
  };

  const applySuggestion = () => {
    if (suggestion) {
      const cat = categories.find((c) => c.id === suggestion.id) || suggestion;
      setSelectedCategory(cat);
      form.setFieldsValue({ selected_category: cat.id });
      // Car-cat-first flow: keep the current car category if it's valid for
      // the suggested service; otherwise swap to the service's first
      // allowed car category so the user isn't left in an inconsistent
      // state.
      const tcats = Array.isArray(cat.car_categories) ? cat.car_categories : [];
      const currentTcOk = selectedTransportCategory
        && !selectedTransportCategory.is_helper_card
        && tcats.some((tc) => tc.id === selectedTransportCategory.id);
      if (!currentTcOk && tcats.length > 0) {
        setSelectedTransportCategory(tcats[0]);
      }
      scrollToRef(routeRef);
      setSuggestion(null);
    }
  };

  const goToConfirm = async () => {
    if (!selectedCategory) {
      message.warning(t('newOrder.pleaseSelectCategory'));
      return;
    }
    // Location inputs are managed outside the Form (pickupStops/destStops).
    if (!pickupStops[0]?.text?.trim()) {
      message.warning(needsDest ? t('newOrder.enterPickup') : t('newOrder.enterWork'));
      return;
    }
    if (needsDest && !destStops[0]?.text?.trim()) {
      message.warning(t('newOrder.enterDestination'));
      return;
    }
    // Pickup #1 contact is required (mirrors top-level Order.contact_*).
    if (!pickupStops[0]?.contact_name?.trim()) {
      message.warning(t('newOrder.enterContact'));
      return;
    }
    if ((pickupStops[0]?.contact_name?.trim() || '').length < 2) {
      message.warning(t('newOrder.contactNameShort'));
      return;
    }
    if (!pickupStops[0]?.contact_phone?.trim()) {
      message.warning(t('newOrder.enterPhone'));
      return;
    }
    // Validate every contact phone the customer filled in. Empty optional
    // stops are fine; partial numbers (fewer than 9 digits after +995) are
    // not — bail with a single warning instead of letting the order through
    // with an unreachable number.
    const allStops = [...pickupStops, ...destStops];
    const badPhoneStop = allStops.find(
      (s) => s.contact_phone && !isValidGeorgiaPhone(s.contact_phone)
    );
    if (badPhoneStop) {
      message.warning(t('auth.phoneInvalid'));
      return;
    }

    // Coord-commitment gate — see spec
    // docs/superpowers/specs/2026-05-28-location-confirm-indicator-design.md
    // Every stop the customer typed must also carry coords, otherwise
    // pricing / distance can't be calculated and the saved order would
    // undercut the real price. Empty optional stops are fine; the
    // earlier text-required check already caught required-but-blank
    // pickup #1 and destination #1.
    const unconfirmed = [];
    pickupStops.forEach((s, idx) => {
      if (s.text?.trim() && !s.coords) unconfirmed.push({ list: 'pickup', idx });
    });
    if (needsDest) {
      destStops.forEach((s, idx) => {
        if (s.text?.trim() && !s.coords) unconfirmed.push({ list: 'dest', idx });
      });
    }
    if (unconfirmed.length > 0) {
      const first = unconfirmed[0];
      message.warning(t('newOrder.locationNotConfirmed'));
      setActiveStop({ type: first.list, index: first.idx });
      scrollToRef(routeRef);
      // Focus runs after the smooth-scroll has visibly started so the
      // browser doesn't fight us by snap-scrolling to the newly-focused
      // input. Existing scrollToRef uses a 60ms inner setTimeout, so by
      // 450ms the scroll is well underway on a typical page.
      setTimeout(() => {
        const refs = first.list === 'pickup' ? pickupInputRefs : destInputRefs;
        refs.current[first.idx]?.focus?.();
      }, 450);
      return;
    }

    // Photos are optional — clear any stale error state from a prior
    // attempt where the requirement was still enforced.
    if (photoError) setPhotoError('');
    try {
      // Per-field cargo required rules now live on the Form.Items themselves
      // (driven by the service's cargo_field_config). validateFields below
      // catches anything missing — no extra cross-field XOR check is needed.
      const values = await form.validateFields();
      setFormValues(values);
      setStep(1);
      // scrollTo runs after React commits the new step's DOM — without the
      // rAF the smooth-scroll fires against the old, still-rendered form so
      // the user lands somewhere mid-page on the review screen.
    } catch (err) {
      if (err?.errorFields?.length) {
        message.warning(t('newOrder.fixFormErrors'));
        form.scrollToField(err.errorFields[0].name, { behavior: 'smooth', block: 'center' });
      }
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const values = formValues;
      const fd = new FormData();
      if (selectedCategory && !selectedCategory.is_helper_card) {
        fd.append('selected_service', selectedCategory.id);
      }
      // Transport category: send only when the customer has picked a real one.
      // null / helper card leaves the field empty so the admin can assign.
      if (selectedTransportCategory && !selectedTransportCategory.is_helper_card) {
        fd.append('selected_category', selectedTransportCategory.id);
      }
      fd.append('pickup_location', pickupStops[0]?.text || '');
      if (pickupStops[0]?.coords) {
        fd.append('pickup_lat', pickupStops[0].coords.lat);
        fd.append('pickup_lng', pickupStops[0].coords.lng);
      }
      fd.append('destination_location', destStops[0]?.text || '');
      if (destStops[0]?.coords) {
        fd.append('destination_lat', destStops[0].coords.lat);
        fd.append('destination_lng', destStops[0].coords.lng);
      }
      const routeStopsData = {
        pickups: pickupStops.filter(s => s.text).map(s => ({
          address: s.text,
          lat: s.coords?.lat || null,
          lng: s.coords?.lng || null,
          contact_name: (s.contact_name || '').trim(),
          contact_phone: (s.contact_phone || '').trim(),
        })),
        destinations: destStops.filter(s => s.text).map(s => ({
          address: s.text,
          lat: s.coords?.lat || null,
          lng: s.coords?.lng || null,
          contact_name: (s.contact_name || '').trim(),
          contact_phone: (s.contact_phone || '').trim(),
        })),
        distance: totalDistance?.distance || null,
        duration: totalDistance?.duration || null,
        ascent: totalDistance?.ascent ?? null,
      };
      fd.append('route_stops', JSON.stringify(routeStopsData));
      fd.append('requested_date', values.requested_date.format('YYYY-MM-DD'));
      if (values.requested_time) fd.append('requested_time', values.requested_time.format('HH:mm'));
      // Top-level Order.contact_* mirrors pickup #1; other stops' contacts
      // ride along inside route_stops JSON, captured a few lines up.
      fd.append('contact_name', (pickupStops[0]?.contact_name || '').trim());
      fd.append('contact_phone', (pickupStops[0]?.contact_phone || '').trim());
      fd.append('description', values.description);
      const cargoParts = [];
      if (values.cargo_length || values.cargo_width || values.cargo_height) {
        cargoParts.push(`${values.cargo_length || '-'} × ${values.cargo_width || '-'} × ${values.cargo_height || '-'} m`);
      }
      if (values.cargo_volume) cargoParts.push(`${values.cargo_volume} m³`);
      if (values.cargo_weight) cargoParts.push(`${values.cargo_weight} t`);
      if (values.cargo_floor) cargoParts.push(`${t('newOrder.floor')}: ${values.cargo_floor}`);
      if (values.cargo_days) cargoParts.push(`${t('newOrder.days')}: ${values.cargo_days}`);
      if (values.cargo_fragile) cargoParts.push(t('newOrder.fragile'));
      if (values.cargo_insured) cargoParts.push(t('newOrder.insured'));
      if (values.cargo_insurance) cargoParts.push(t('newOrder.insuranceNeeded'));
      fd.append('cargo_details', cargoParts.join(', '));
      // Structured copies — backend pricing engine reads these.
      // Customer enters tonnage; backend stores kg internally. Convert at
      // the send boundary so the pricing engine + all existing rates keep
      // working in kg without any DB/migration churn.
      if (values.cargo_weight) {
        const kg = Number(values.cargo_weight) * 1000;
        if (Number.isFinite(kg) && kg > 0) fd.append('cargo_weight_kg', kg);
      }
      if (values.cargo_days) fd.append('cargo_days', values.cargo_days);
      if (values.cargo_floor) fd.append('cargo_floor', values.cargo_floor);
      fd.append('cargo_fragile', values.cargo_fragile ? 'true' : 'false');
      fd.append('cargo_insured', values.cargo_insured ? 'true' : 'false');
      fd.append('cargo_insurance', values.cargo_insurance ? 'true' : 'false');
      fd.append('user_note', values.user_note || '');
      if (suggestion?.id) fd.append('suggested_service', suggestion.id);
      fileList.forEach((f) => fd.append('images', f.originFileObj));

      const { data } = await api.post('/orders/create/', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      message.success(t('orders.orderSubmitted'));
      navigate(`/app/orders/${data.public_id || data.id}`);
    } catch (err) {
      const detail = err.response?.data;
      if (detail && typeof detail === 'object') {
        const firstErr = Object.values(detail).flat()[0];
        message.error(typeof firstErr === 'string' ? firstErr : t('orders.failedCreate'));
      } else message.error(t('orders.failedCreate'));
    } finally { setLoading(false); }
  };

  // ── Multi-stop helpers ──
  const updateStop = (type, index, updates) => {
    const setter = type === 'pickup' ? setPickupStops : setDestStops;
    setter(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
    // Forward auto-scroll: when the customer commits coords for the first
    // pickup (and first destination if the service needs one), jump to the
    // date step. Typing without selecting from autocomplete doesn't trigger.
    if (index !== 0 || !updates.coords) return;
    const otherFirst = type === 'pickup' ? destStops[0] : pickupStops[0];
    const otherReady = !needsDest || !!otherFirst?.coords;
    if (otherReady) scrollToRef(dateRef);
  };

  const addStop = (type) => {
    const setter = type === 'pickup' ? setPickupStops : setDestStops;
    setter(prev => [...prev, { text: '', coords: null, contact_name: '', contact_phone: '' }]);
    const list = type === 'pickup' ? pickupStops : destStops;
    setActiveStop({ type, index: list.length });
  };

  const removeStop = (type, index) => {
    const setter = type === 'pickup' ? setPickupStops : setDestStops;
    setter(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next.length === 0 ? [{ text: '', coords: null, contact_name: '', contact_phone: '' }] : next;
    });
    const refs = type === 'pickup' ? pickupInputRefs : destInputRefs;
    refs.current.splice(index, 1);
    if (activeStop.type === type) {
      if (activeStop.index >= index && activeStop.index > 0) {
        setActiveStop({ type, index: activeStop.index - 1 });
      }
    }
  };

  // ── Distance calculation via the ORS HGV proxy ──
  // Backend caches identical coord sets for 30 min, so repeated re-renders
  // don't burn the daily ORS quota.
  const calculateDistance = useCallback(async () => {
    const allStops = [
      ...pickupStops.filter(s => s.coords),
      ...destStops.filter(s => s.coords),
    ];
    if (allStops.length < 2) {
      setTotalDistance(null);
      return;
    }
    setDistanceLoading(true);
    try {
      const coordinates = allStops.map(s => [s.coords.lng, s.coords.lat]);
      const { data } = await api.post('/orders/route-profile/', { coordinates });
      const props = data?.features?.[0]?.properties;
      const summary = props?.summary;
      if (summary && Number.isFinite(summary.distance) && Number.isFinite(summary.duration)) {
        setTotalDistance({
          distance: summary.distance,
          duration: summary.duration,
          // Total ascent (m). ORS puts this at properties.ascent — NOT
          // inside properties.summary — and reading the wrong field is what
          // caused every customer-created order to lose its elevation
          // multiplier (~7-10% under-quote on hilly routes).
          ascent: Number.isFinite(props.ascent) ? props.ascent : null,
        });
      } else {
        setTotalDistance(null);
      }
    } catch {
      // No route, network blip, rate-limited, etc. — leave the field empty.
      setTotalDistance(null);
    } finally {
      setDistanceLoading(false);
    }
  }, [pickupStops, destStops]);

  useEffect(() => {
    if (distanceTimerRef.current) clearTimeout(distanceTimerRef.current);
    distanceTimerRef.current = setTimeout(calculateDistance, 800);
    return () => clearTimeout(distanceTimerRef.current);
  }, [calculateDistance]);

  // ── Approximate-price preview ──
  // Runs on the review step (step === 1). Fires whenever inputs that
  // feed the pricing engine change: transport category, weight, days,
  // and the ORS route summary (distance + ascent). When the customer
  // hasn't picked a real transport category yet ("admin decide" or
  // none), we still ask the backend — it falls back to the service's
  // first linked category, exactly like the admin-side auto-assign does.
  const previewCategoryId = selectedTransportCategory
    && !selectedTransportCategory.is_helper_card
    ? selectedTransportCategory.id
    : null;
  const previewServiceId = selectedCategory && !selectedCategory.is_helper_card
    ? selectedCategory.id
    : null;
  const previewWeight = formValues.cargo_weight ?? null;
  const previewDays = formValues.cargo_days ?? null;
  const previewFloor = formValues.cargo_floor ?? null;
  const previewDistance = totalDistance?.distance ?? null;
  const previewAscent = totalDistance?.ascent ?? null;
  const previewDuration = totalDistance?.duration ?? null;
  const previewPickup = pickupStops[0]?.text || '';
  const previewDestination = destStops[0]?.text || '';
  // Address + coords per stop. Zone keyword-match runs against EVERY stop's
  // address, and coords let the backend re-fetch ORS for ascent if our local
  // calculateDistance() hadn't resolved yet — otherwise the elevation
  // multiplier silently drops and the preview undercuts what the saved
  // order ends up costing by ~7-10% on hilly routes.
  const previewStopsJson = JSON.stringify({
    pickups: pickupStops.filter(s => s.text).map(s => ({
      address: s.text,
      lat: s.coords?.lat ?? null,
      lng: s.coords?.lng ?? null,
    })),
    destinations: destStops.filter(s => s.text).map(s => ({
      address: s.text,
      lat: s.coords?.lat ?? null,
      lng: s.coords?.lng ?? null,
    })),
  });
  useEffect(() => {
    if (step !== 1) return undefined;
    // Wait for ORS to settle before firing. If we fire while distance is
    // still being computed, ascent comes through as null, the elevation
    // multiplier drops to 1.0, and the preview undercuts the saved price.
    if (distanceLoading) return undefined;
    // Nothing to price against — keep preview at null so the card hides.
    if (!previewCategoryId && !previewServiceId) {
      setPricePreview(null);
      return undefined;
    }
    let cancelled = false;
    setPreviewLoading(true);
    const { pickups, destinations } = JSON.parse(previewStopsJson);
    api.post('/orders/preview-price/', {
      service_id: previewServiceId,
      category_id: previewCategoryId,
      // Pricing-preview payload mirrors the order-submit boundary:
      // customer input is in tons, engine expects kg.
      cargo_weight_kg: previewWeight != null ? Number(previewWeight) * 1000 : null,
      cargo_days: previewDays,
      cargo_floor: previewFloor,
      pickup_location: previewPickup,
      destination_location: previewDestination,
      route_summary: {
        distance: previewDistance,
        duration: previewDuration,
        ascent: previewAscent,
        pickups,
        destinations,
      },
    }).then(({ data }) => {
      if (cancelled) return;
      setPricePreview(data || null);
    }).catch(() => {
      if (cancelled) return;
      setPricePreview(null);
    }).finally(() => {
      if (!cancelled) setPreviewLoading(false);
    });
    return () => { cancelled = true; };
  }, [step, previewCategoryId, previewServiceId, previewWeight, previewDays,
      previewFloor, previewDistance, previewAscent, previewDuration, previewPickup,
      previewDestination, previewStopsJson, distanceLoading]);

  // Truck-aware route preview — drives the polyline drawn on top of MapPicker.
  // Hits the same /orders/route-profile/ endpoint as calculateDistance; the
  // frontend + backend caches dedupe the overlapping calls.
  const routeWaypoints = [
    ...pickupStops.filter(s => s.coords).map(s => ({ lat: s.coords.lat, lng: s.coords.lng })),
    ...destStops.filter(s => s.coords).map(s => ({ lat: s.coords.lat, lng: s.coords.lng })),
  ];
  const truckRoute = useTruckRoute(routeWaypoints);

  const activeStopData = activeStop.type === 'pickup'
    ? pickupStops[activeStop.index]
    : destStops[activeStop.index];
  const activePosition = activeStopData?.coords
    ? [activeStopData.coords.lat, activeStopData.coords.lng]
    : null;

  const extraMarkers = [
    ...pickupStops.map((s, i) => ({ stop: s, color: 'green', type: 'pickup', index: i })),
    ...destStops.filter(() => needsDest).map((s, i) => ({ stop: s, color: 'red', type: 'dest', index: i })),
  ]
    .filter(m => m.stop.coords && !(m.type === activeStop.type && m.index === activeStop.index))
    .map(m => ({ position: [m.stop.coords.lat, m.stop.coords.lng], color: m.color }));

  const formatDistance = (meters) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} ${t('newOrder.km')}`;
    return `${Math.round(meters)} m`;
  };

  const formatDuration = (seconds) => {
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return `${hrs} ${t('newOrder.hr')} ${mins} ${t('newOrder.min')}`;
    }
    return `${Math.round(seconds / 60)} ${t('newOrder.min')}`;
  };

  // Services visible in step 2: filtered first by the chosen car category
  // (car-cat-first flow — only services that belong to the selected vehicle
  // type), then by the customer's free-text search. Rows render in their
  // backend-resolved position order; dashed styling is applied per-card.
  const filteredCategories = categories.filter((c) => {
    if (
      selectedTransportCategory
      && !selectedTransportCategory.is_helper_card
    ) {
      const allowed = Array.isArray(c.car_categories) ? c.car_categories : [];
      if (!allowed.some((cc) => cc.id === selectedTransportCategory.id)) {
        return false;
      }
    }
    if (!catSearch) return true;
    const q = catSearch.toLowerCase();
    return (
      localized(c.name).toLowerCase().includes(q)
      || localized(c.description).toLowerCase().includes(q)
    );
  });

  // Car categories visible in step 1. When a ?service= deep link landed on
  // a service with 2+ allowed car categories, scope the picker to those so
  // the customer ends up with a valid combination.
  const visibleCarCategories = (() => {
    if (pendingServiceId) {
      const svc = categories.find((s) => String(s.id) === String(pendingServiceId));
      if (svc && Array.isArray(svc.car_categories) && svc.car_categories.length > 0) {
        return svc.car_categories;
      }
    }
    return carCategories;
  })();

  const inputStyle = { height: 48, borderRadius: 12, fontSize: 15 };

  // ─── STEP 0: ORDER FORM ───
  if (step === 0) {
    return (
      <div style={{ minHeight: '100vh', paddingBottom: 90, maxWidth: 1200, margin: '0 auto' }} className="app-bg page-enter">
        {/* ── Header ── */}
        <div style={{
          background: 'var(--header-gradient)',
          padding: isDesktop ? '36px 40px 40px' : '28px 20px 32px',
          paddingTop: isDesktop ? 36 : 'calc(28px + env(safe-area-inset-top, 0px))',
          borderRadius: isDesktop ? '0 0 24px 24px' : '0 0 32px 32px',
          position: 'relative',
          overflow: 'hidden',
          color: '#fff',
        }}>
          {/* Decorative circles */}
          <div style={{
            position: 'absolute', top: -60, right: -40, width: 200, height: 200,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: -30, left: -30, width: 120, height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: '40%', left: '60%', width: 80, height: 80,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div onClick={() => navigate('/app')} style={{
                width: 44, height: 44, borderRadius: 14, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: 17, color: '#fff',
                background: 'rgba(255,255,255,0.18)',
                backdropFilter: 'blur(8px)',
                transition: 'all 0.2s ease',
              }}>
                <ArrowLeftOutlined />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1.2 }}>
                  {t('nav.newOrder')}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 500 }}>
                  {t('newOrder.whatService')}
                </div>
              </div>

              {/* Language switcher — NewOrderFlow renders outside AppLayout
                  so the customer wouldn't otherwise have a way to change
                  language mid-flow. Same options as the AppLayout user
                  menu (see langMenuItems above). */}
              <Dropdown
                menu={{ items: langMenuItems }}
                trigger={['click']}
                placement="bottomRight"
              >
                <div style={{
                  height: 36, padding: '0 12px', borderRadius: 12,
                  display: 'flex', alignItems: 'center', gap: 8,
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  color: '#fff',
                  background: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  letterSpacing: 0.3,
                }}>
                  <span style={{ fontSize: 16 }}>{LANG_FLAGS[lang]}</span>
                  <span>{(lang || 'en').toUpperCase()}</span>
                </div>
              </Dropdown>
            </div>

            {/* ── Progress bar ── */}
            <div style={{
              marginTop: 22,
              background: 'rgba(255,255,255,0.13)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 18,
              padding: '16px 18px',
              border: '1px solid rgba(255,255,255,0.16)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <ProgressStep number={1} active label={t('newOrder.stepDetails')} />
                <div style={{
                  flex: 1, height: 2,
                  background: 'rgba(255,255,255,0.2)', borderRadius: 1,
                }} />
                <ProgressStep number={2} label={t('newOrder.stepConfirm')} />
              </div>
            </div>
          </div>
        </div>

        <Form form={form} layout="vertical" requiredMark={false}
          initialValues={{ selected_category: selectedCategory?.id }}
          onValuesChange={(changed, all) => {
            if (!('cargo_length' in changed || 'cargo_width' in changed || 'cargo_height' in changed)) return;
            const L = parseFloat(all.cargo_length);
            const W = parseFloat(all.cargo_width);
            const H = parseFloat(all.cargo_height);
            if (Number.isFinite(L) && L > 0 && Number.isFinite(W) && W > 0 && Number.isFinite(H) && H > 0) {
              const volume = L * W * H;
              // 3 decimals covers small parcels (e.g. 0.3×0.2×0.1 m = 0.006 m³)
              // without making typical loads look noisy. Trim trailing zeros.
              const formatted = parseFloat(volume.toFixed(3)).toString();
              form.setFieldsValue({ cargo_volume: formatted });
            }
          }}
          style={{ margin: '0 auto', padding: isDesktop ? '0 40px' : '0 20px' }}
        >
          {/* ── SECTION: Transport Category ──
              First step in the form (car-cat-first flow). Drives the
              filtered service grid below. When the user deep-linked via
              ?service=X to a service with 2+ allowed car categories, this
              picker is scoped to those (see visibleCarCategories). */}
          <div ref={transportCategoryRef} style={{ scrollMarginTop: 16 }}>
          <SectionCard
            icon={<CarOutlined />}
            title={t('newOrder.transportCategory')}
            first
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
              gap: isDesktop ? 8 : 6,
            }}>
              {visibleCarCategories.map((tc) => {
                const isActive = selectedTransportCategory?.id === tc.id
                  || (tc.is_helper_card && selectedTransportCategory?.is_helper_card);
                return (
                  <CategoryCard
                    key={tc.id}
                    isActive={isActive}
                    color={tc.color || 'var(--accent)'}
                    imageUrl={tc.image_url}
                    icon={tc.icon}
                    name={localized(tc.name)}
                    dashed={tc.is_helper_card === true}
                    onClick={() => handleTransportCategorySelect(tc)}
                  />
                );
              })}
            </div>
          </SectionCard>
          </div>

          {/* ── SECTION: Service Type ──
              Filtered to services whose `car_categories` M2M includes the
              chosen vehicle type. Hidden until a car category is picked. */}
          {selectedTransportCategory && (
            <div ref={serviceRef} style={{ scrollMarginTop: 16 }}>
            <SectionCard
              icon={<InboxOutlined />}
              title={t('newOrder.selectService')}
            >
              {filteredCategories.length > 6 && (
                <Input
                  prefix={<SearchOutlined style={{ color: 'var(--text-placeholder)' }} />}
                  placeholder={t('newOrder.searchService')}
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  allowClear
                  style={{
                    marginBottom: 14, borderRadius: 12, height: 44,
                    background: 'var(--input-bg)', fontSize: 14,
                    border: '1px solid var(--border-light)',
                  }}
                />
              )}

              <div style={{
                display: 'grid',
                gridTemplateColumns: isDesktop ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
                gap: isDesktop ? 8 : 6,
              }}>
                {(showAllCategories ? filteredCategories : filteredCategories.slice(0, isDesktop ? 7 : 5)).map((cat) => {
                  const isActive = selectedCategory?.id === cat.id
                    || (cat.is_helper_card && selectedCategory?.is_helper_card);
                  const color = cat.color || 'var(--accent)';
                  return (
                    <CategoryCard
                      key={cat.id}
                      isActive={isActive}
                      color={color}
                      imageUrl={cat.image_url}
                      icon={cat.icon}
                      name={localized(cat.name)}
                      badge={cat.requires_destination ? t('newOrder.transportBadge') : null}
                      dashed={cat.is_helper_card === true}
                      onClick={() => handleCategorySelect(cat)}
                    />
                  );
                })}
              </div>
              {filteredCategories.length > (isDesktop ? 7 : 5) && (
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 12,
                    cursor: 'pointer', background: 'var(--bg-tertiary)',
                    fontSize: 13, fontWeight: 600, color: 'var(--accent)',
                    border: 'none', transition: 'all 0.2s',
                  }}
                >
                  {showAllCategories ? t('newOrder.showLess') : `${t('newOrder.showAll')} (${filteredCategories.length})`}
                </button>
              )}
            </SectionCard>
            </div>
          )}

          {/* ── SECTION: Route ── */}
          <div ref={routeRef} style={{ scrollMarginTop: 16 }}>
          <SectionCard
            icon={<MapIcon size={18} />}
            title={needsDest ? t('newOrder.fromTo') : t('newOrder.workLocation')}
          >
            <div style={{
              display: isDesktop ? 'flex' : 'block',
              gap: isDesktop ? 20 : 0,
              alignItems: 'stretch',
            }}>
              {/* Left: Route builder */}
              <div style={{ flex: isDesktop ? 1 : undefined, minWidth: 0 }}>
                <div style={{
                  background: 'var(--bg-primary)', borderRadius: 14,
                  padding: isDesktop ? 14 : 12,
                  border: '1px solid var(--border-light)',
                }}>
                  {/* Pickup stops */}
                  {pickupStops.map((stop, idx) => (
                    <div key={`pickup-${idx}`}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: activeStop.type === 'pickup' && activeStop.index === idx
                            ? 'var(--accent-bg)' : 'transparent',
                          borderRadius: 12, padding: '4px 8px 4px 4px',
                          transition: 'background 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => setActiveStop({ type: 'pickup', index: idx })}
                      >
                        {/* Timeline dot */}
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: 'var(--accent)',
                          flexShrink: 0,
                          boxShadow: '0 0 0 4px var(--accent-bg)',
                          transition: 'all 0.2s ease',
                        }} />
                        <LocationAutocomplete
                          value={stop.text}
                          confirmed={!!stop.coords}
                          ref={(r) => { pickupInputRefs.current[idx] = r; }}
                          onChange={(val) => updateStop('pickup', idx, { text: val, coords: null })}
                          onSelect={({ address, lat, lng }) => {
                            updateStop('pickup', idx, { text: address, coords: { lat, lng } });
                          }}
                          placeholder={idx === 0
                            ? (needsDest
                                ? (pickupStops.length > 1 ? `${t('newOrder.pickupFrom')} #${idx + 1}` : t('newOrder.pickupFrom'))
                                : t('newOrder.workSiteAddress'))
                            : `${t('newOrder.pickupFrom')} #${idx + 1}`}
                          prefix={null}
                          countryCode="ge"
                          style={{ flex: 1 }}
                          pickerMarkerColor="green"
                          pickerTitle={idx === 0
                            ? (needsDest
                                ? (pickupStops.length > 1 ? `${t('newOrder.pickupFrom')} #${idx + 1}` : t('newOrder.pickupFrom'))
                                : t('newOrder.workSiteAddress'))
                            : `${t('newOrder.pickupFrom')} #${idx + 1}`}
                          initialCoords={stop.coords || null}
                        />
                        {pickupStops.length > 1 && (
                          <div
                            onClick={(e) => { e.stopPropagation(); removeStop('pickup', idx); }}
                            style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--text-tertiary)',
                              background: 'var(--bg-tertiary)', transition: 'all 0.15s ease',
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: 12 }} />
                          </div>
                        )}
                      </div>
                      {/* Connector line */}
                      {(idx < pickupStops.length - 1 || needsDest) && (
                        <div style={{ paddingLeft: 5, margin: '1px 0' }}>
                          <div style={{
                            width: 2, height: idx < pickupStops.length - 1 ? 14 : 20,
                            background: 'var(--border-color)',
                            marginLeft: 0, borderRadius: 1,
                          }} />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add pickup button */}
                  <div
                    onClick={() => addStop('pickup')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', cursor: 'pointer', marginLeft: 20,
                      color: 'var(--accent)', fontSize: 12, fontWeight: 600,
                      borderRadius: 8, transition: 'background 0.15s',
                      background: 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <PlusOutlined style={{ fontSize: 10 }} />
                    {t('newOrder.addPickupStop')}
                  </div>

                  {/* Separator */}
                  {needsDest && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      margin: '8px 0', padding: '0 4px',
                    }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                      <SwapRightOutlined style={{ color: 'var(--text-placeholder)', fontSize: 14 }} />
                      <div style={{ flex: 1, height: 1, background: 'var(--border-light)' }} />
                    </div>
                  )}

                  {/* Destination stops */}
                  {needsDest && destStops.map((stop, idx) => (
                    <div key={`dest-${idx}`}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: activeStop.type === 'dest' && activeStop.index === idx
                            ? '#ef44440a' : 'transparent',
                          borderRadius: 12, padding: '4px 8px 4px 4px',
                          transition: 'background 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => setActiveStop({ type: 'dest', index: idx })}
                      >
                        <div style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: '#ef4444', flexShrink: 0,
                          boxShadow: '0 0 0 4px #ef444418',
                        }} />
                        <LocationAutocomplete
                          value={stop.text}
                          confirmed={!!stop.coords}
                          ref={(r) => { destInputRefs.current[idx] = r; }}
                          onChange={(val) => updateStop('dest', idx, { text: val, coords: null })}
                          onSelect={({ address, lat, lng }) => {
                            updateStop('dest', idx, { text: address, coords: { lat, lng } });
                          }}
                          placeholder={destStops.length > 1
                            ? `${t('newOrder.destinationTo')} #${idx + 1}`
                            : t('newOrder.destinationTo')}
                          prefix={null}
                          countryCode="ge"
                          style={{ flex: 1 }}
                          pickerMarkerColor="red"
                          pickerTitle={destStops.length > 1
                            ? `${t('newOrder.destinationTo')} #${idx + 1}`
                            : t('newOrder.destinationTo')}
                          initialCoords={stop.coords || null}
                        />
                        {destStops.length > 1 && (
                          <div
                            onClick={(e) => { e.stopPropagation(); removeStop('dest', idx); }}
                            style={{
                              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--text-tertiary)',
                              background: 'var(--bg-tertiary)', transition: 'all 0.15s ease',
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: 12 }} />
                          </div>
                        )}
                      </div>
                      {idx < destStops.length - 1 && (
                        <div style={{ paddingLeft: 5, margin: '1px 0' }}>
                          <div style={{
                            width: 2, height: 14,
                            background: '#ef444430',
                            marginLeft: 0, borderRadius: 1,
                          }} />
                        </div>
                      )}
                    </div>
                  ))}

                  {needsDest && (
                    <div
                      onClick={() => addStop('dest')}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', cursor: 'pointer', marginLeft: 20,
                        color: '#ef4444', fontSize: 12, fontWeight: 600,
                        borderRadius: 8, transition: 'background 0.15s',
                        background: 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#ef44440a'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <PlusOutlined style={{ fontSize: 10 }} />
                      {t('newOrder.addDestStop')}
                    </div>
                  )}
                </div>

                {/* Distance badge */}
                {totalDistance && (
                  <div style={{
                    background: 'var(--accent-bg)', borderRadius: 12, padding: '12px 16px',
                    marginTop: 10, display: 'flex', alignItems: 'center', gap: 12,
                    border: '1px solid var(--accent-bg-strong)',
                    animation: 'fadeInUp 0.3s ease-out both',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: 'var(--accent-bg-strong)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CarOutlined style={{ color: 'var(--accent)', fontSize: 16 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatDistance(totalDistance.distance)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                        ~ {formatDuration(totalDistance.duration)}
                      </div>
                    </div>
                    {distanceLoading && <Spin size="small" />}
                  </div>
                )}
                {distanceLoading && !totalDistance && (
                  <div style={{
                    textAlign: 'center', padding: '10px 0', fontSize: 12,
                    color: 'var(--text-tertiary)',
                  }}>
                    <Spin size="small" style={{ marginRight: 8 }} />
                    {t('newOrder.calculating')}
                  </div>
                )}
              </div>

              {/* Right: Map */}
              <div style={{
                flex: isDesktop ? 1 : undefined,
                minWidth: 0, marginTop: isDesktop ? 0 : 12,
                position: isDesktop ? 'sticky' : 'static',
                top: isDesktop ? 20 : undefined,
                alignSelf: isDesktop ? 'flex-start' : undefined,
              }}>
                {/* Map tab pills */}
                <div style={{
                  display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap',
                }}>
                  {pickupStops.map((_, idx) => (
                    <button
                      key={`pickup-tab-${idx}`}
                      onClick={() => setActiveStop({ type: 'pickup', index: idx })}
                      style={{
                        padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: activeStop.type === 'pickup' && activeStop.index === idx
                          ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: activeStop.type === 'pickup' && activeStop.index === idx
                          ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <MapIcon size={12} style={{ marginRight: 4 }} />
                      {needsDest
                        ? (pickupStops.length > 1 ? `${t('newOrder.pickupMap')} ${idx + 1}` : t('newOrder.pickupMap'))
                        : (pickupStops.length > 1 ? `${t('newOrder.locationMap')} ${idx + 1}` : t('newOrder.locationMap'))
                      }
                    </button>
                  ))}
                  {needsDest && destStops.map((_, idx) => (
                    <button
                      key={`dest-tab-${idx}`}
                      onClick={() => setActiveStop({ type: 'dest', index: idx })}
                      style={{
                        padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: activeStop.type === 'dest' && activeStop.index === idx
                          ? '#ef4444' : 'var(--bg-tertiary)',
                        color: activeStop.type === 'dest' && activeStop.index === idx
                          ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <MapIcon size={12} style={{ marginRight: 4 }} />
                      {destStops.length > 1 ? `${t('newOrder.destinationMap')} ${idx + 1}` : t('newOrder.destinationMap')}
                    </button>
                  ))}
                </div>

                <div style={{
                  position: 'relative',
                  borderRadius: 16, overflow: 'hidden',
                  border: '1px solid var(--border-light)',
                  boxShadow: 'var(--shadow-sm)',
                }}>
                  <MapPicker
                    position={activePosition}
                    onSelect={({ lat, lng, address }) => {
                      updateStop(activeStop.type === 'dest' ? 'dest' : 'pickup', activeStop.index, {
                        text: address,
                        coords: { lat, lng },
                      });
                    }}
                    height={isDesktop ? 360 : 240}
                    markerColor={activeStop.type === 'dest' ? 'red' : 'green'}
                    placeholder={
                      activeStop.type === 'dest'
                        ? t('newOrder.tapDestination')
                        : (needsDest ? t('newOrder.tapPickup') : t('newOrder.tapLocation'))
                    }
                    extraMarkers={extraMarkers}
                    routePoints={truckRoute.points}
                    steepnessSegments={truckRoute.steepnessSegments}
                  />
                  {/* Mobile-only: a small "Open fullscreen" button overlaid
                      on the top-right of the map. Tapping it opens the
                      crosshair picker. The inline tap-to-pin on the map
                      itself still works for desktop where the map is
                      large enough to aim accurately. */}
                  {!isDesktop && (
                    <button
                      type="button"
                      onClick={() => setInlineMapFullscreenOpen(true)}
                      aria-label={t('newOrder.openFullscreen')}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        zIndex: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        cursor: 'pointer',
                        color: activeStop.type === 'dest' ? '#ef4444' : 'var(--accent)',
                        fontSize: 12, fontWeight: 600,
                      }}
                    >
                      <ExpandOutlined style={{ fontSize: 13 }} />
                      {t('newOrder.openFullscreen')}
                    </button>
                  )}
                </div>

                {/* Fullscreen crosshair picker — opened by the "Open
                    fullscreen" button. Updates the current active stop on
                    confirm. */}
                <FullscreenLocationPicker
                  open={inlineMapFullscreenOpen}
                  title={activeStop.type === 'dest'
                    ? (destStops.length > 1
                        ? `${t('newOrder.destinationTo')} #${activeStop.index + 1}`
                        : t('newOrder.destinationTo'))
                    : (needsDest
                        ? (pickupStops.length > 1
                            ? `${t('newOrder.pickupFrom')} #${activeStop.index + 1}`
                            : t('newOrder.pickupFrom'))
                        : t('newOrder.workSiteAddress'))}
                  initialPosition={activePosition
                    ? { lat: activePosition[0], lng: activePosition[1] }
                    : null}
                  markerColor={activeStop.type === 'dest' ? 'red' : 'green'}
                  onCancel={() => setInlineMapFullscreenOpen(false)}
                  onConfirm={({ lat, lng, address }) => {
                    updateStop(activeStop.type === 'dest' ? 'dest' : 'pickup', activeStop.index, {
                      text: address,
                      coords: { lat, lng },
                    });
                    setInlineMapFullscreenOpen(false);
                  }}
                />
              </div>
            </div>
          </SectionCard>
          </div>

          {/* ── SECTION: Date & Time ── */}
          <div ref={dateRef} style={{ scrollMarginTop: 16 }}>
          <SectionCard icon={<CalendarOutlined />} title={t('newOrder.when')}>
            {(() => {
              const allLocations = [
                ...pickupStops.map((s) => s.text),
                ...destStops.map((s) => s.text),
              ];
              const windowsForCategory =
                selectedCategory && !selectedCategory.is_helper_card
                  ? (selectedCategory.restricted_time_windows || [])
                  : [];
              const { applicable, disabledTime } = computeRestrictions(
                windowsForCategory, allLocations,
              );
              return (
                <>
                  {applicable.length > 0 && (
                    <div style={{
                      background: '#fff7ed', borderRadius: 12, padding: '10px 14px',
                      marginBottom: 12, border: '1px solid #fed7aa',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <ClockCircleOutlined style={{ color: '#c2410c', fontSize: 16, marginTop: 2 }} />
                      <div style={{ flex: 1, fontSize: 13, color: '#7c2d12', lineHeight: 1.5 }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>
                          {t('newOrder.restrictedTimesTitle')}
                        </div>
                        {applicable.map((w) => (
                          <div key={w.id}>
                            • {w.location_keyword}: {w.start_time?.slice(0, 5)}–{w.end_time?.slice(0, 5)}
                            {w.description ? ` — ${w.description}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <Form.Item name="requested_date" style={{ flex: 1, marginBottom: 0 }}
                      rules={[{ required: true, message: t('newOrder.selectDate') }]}>
                      <DatePicker
                        style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 15 }}
                        placeholder={t('newOrder.selectDate')}
                        disabledDate={(d) => d && d < dayjs().startOf('day')}
                        inputReadOnly suffixIcon={<CalendarOutlined />}
                        onChange={(d) => {
                          if (d && form.getFieldValue('requested_time')) scrollToRef(descriptionRef);
                        }}
                      />
                    </Form.Item>
                    <Form.Item name="requested_time" style={{ flex: 1, marginBottom: 0 }}
                      rules={[{ required: true, message: t('newOrder.selectTime') }]}>
                      <TimePicker
                        format="HH:mm"
                        style={{ width: '100%', height: 48, borderRadius: 12, fontSize: 15 }}
                        placeholder={t('newOrder.preferredTime')}
                        inputReadOnly suffixIcon={<ClockCircleOutlined />}
                        disabledTime={disabledTime}
                        hideDisabledOptions
                        onChange={(v) => {
                          if (v && form.getFieldValue('requested_date')) scrollToRef(descriptionRef);
                        }}
                      />
                    </Form.Item>
                  </div>
                </>
              );
            })()}
          </SectionCard>
          </div>

          {/* ── SECTION: Description ── */}
          <div ref={descriptionRef} style={{ scrollMarginTop: 16 }}>
          <SectionCard icon={<FileTextOutlined />} title={t('newOrder.whatDone')}>
            <Form.Item name="description" rules={[{ required: true, message: t('newOrder.describeJob') }]}
              style={{ marginBottom: 0 }}
              extra={selectedCategory?.is_helper_card ? (
                <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                  {t('newOrder.describeNeedHelp')}
                </span>
              ) : null}>
              <TextArea rows={selectedCategory?.is_helper_card ? 5 : 3}
                placeholder={selectedCategory?.is_helper_card
                  ? t('newOrder.describeNeedDetailed')
                  : t('newOrder.describeNeed')}
                onBlur={handleDescriptionBlur}
                style={{ borderRadius: 12, fontSize: 15, padding: '12px 14px', resize: 'none' }} />
            </Form.Item>

            {suggestion && (
              <div style={{
                background: 'var(--accent-bg)', borderRadius: 12, padding: '12px 16px',
                marginTop: 12, display: 'flex', alignItems: 'center', gap: 10,
                border: '1px solid var(--accent-bg-strong)',
                animation: 'fadeInUp 0.3s ease-out both',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'var(--accent-bg-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <BulbOutlined style={{ color: 'var(--accent)', fontSize: 16 }} />
                </div>
                <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
                  {t('newOrder.suggested')} <strong>{localized(suggestion.name)}</strong>
                </div>
                <Button size="small" type="link" onClick={applySuggestion}
                  style={{ color: 'var(--accent)', fontWeight: 700, padding: '0 8px' }}>
                  {t('common.apply')}
                </Button>
                <CloseOutlined onClick={() => setSuggestion(null)}
                  style={{ color: 'var(--text-tertiary)', fontSize: 11, cursor: 'pointer', padding: 4 }} />
              </div>
            )}

            {/* Cargo details — driven by the chosen service's cargo_field_config.
                Each input is shown only when the service marks it 'optional'
                or 'required'. The whole sub-header disappears when every
                cargo field is 'off' (or the customer picked "Not sure"). */}
            {(() => {
              const cfg = (selectedCategory && !selectedCategory.is_helper_card)
                ? (selectedCategory.cargo_field_config || CARGO_FALLBACK_CONFIG)
                : CARGO_FALLBACK_CONFIG;
              const shown = (k) => cfg[k] && cfg[k] !== 'off';
              const required = (k) => cfg[k] === 'required';
              const anyShown = ['length','width','height','volume','weight','floor','days','fragile','insured','insurance'].some(shown);
              if (!anyShown) return null;
              const lwhShown = shown('length') || shown('width') || shown('height');
              const floorDaysShown = shown('floor') || shown('days');
              const dimInput = (name, key, placeholderKey) => (
                <Form.Item
                  name={name}
                  normalize={sanitizeNumericInput}
                  style={{ flex: 1, marginBottom: 0 }}
                  rules={[
                    ...(required(key) ? [{ required: true, message: t(`newOrder.enter${key.charAt(0).toUpperCase()}${key.slice(1)}`) }] : []),
                    { validator: (_, v) => {
                        if (v == null || v === '') return Promise.resolve();
                        const n = Number(v);
                        if (!Number.isFinite(n) || n <= 0 || n > 100) return Promise.reject(new Error(t('newOrder.dimensionRange')));
                        return Promise.resolve();
                      } },
                  ]}>
                  <Input placeholder={t(`newOrder.${placeholderKey}`)} suffix={t('newOrder.cm')}
                    inputMode="decimal" style={{ borderRadius: 12, fontSize: 14, height: 44 }} />
                </Form.Item>
              );
              return (
                <>
                  <div style={{
                    marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10,
                  }}>
                    <ExpandOutlined style={{ fontSize: 13, color: 'var(--text-tertiary)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {t('newOrder.cargoDetails')}
                    </span>
                  </div>
                  {lwhShown && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      {shown('length') && dimInput('cargo_length', 'Length', 'length')}
                      {shown('width') && dimInput('cargo_width', 'Width', 'width')}
                      {shown('height') && dimInput('cargo_height', 'Height', 'height')}
                    </div>
                  )}
                  {shown('volume') && (
                    <Form.Item
                      name="cargo_volume"
                      normalize={sanitizeNumericInput}
                      style={{ marginBottom: shown('weight') ? 8 : 0 }}
                      rules={required('volume') ? [{ required: true, message: t('newOrder.enterVolumeOrDimensions') }] : []}>
                      <Input placeholder={t('newOrder.cubicMeters')} suffix={t('newOrder.m3')}
                        inputMode="decimal" style={{ borderRadius: 12, fontSize: 14, height: 44 }} />
                    </Form.Item>
                  )}
                  {shown('weight') && (
                    <Form.Item
                      name="cargo_weight"
                      normalize={sanitizeNumericInput}
                      style={{ marginBottom: floorDaysShown || shown('fragile') ? 8 : 0 }}
                      rules={[
                        ...(required('weight') ? [{ required: true, message: t('newOrder.enterWeight') }] : []),
                        { validator: (_, v) => {
                            if (v == null || v === '') return Promise.resolve();
                            const n = Number(v);
                            if (!Number.isFinite(n) || n <= 0) return Promise.reject(new Error(t('newOrder.weightPositive')));
                            if (n > 1000) return Promise.reject(new Error(t('newOrder.weightTooLarge')));
                            return Promise.resolve();
                          } },
                      ]}>
                      <Input placeholder={t('newOrder.weight')} suffix={t('newOrder.kg')}
                        inputMode="decimal" style={{ borderRadius: 12, fontSize: 14, height: 44 }} />
                    </Form.Item>
                  )}
                  {floorDaysShown && (() => {
                    const floorMax = Math.max(1, parseInt(selectedCategory?.floor_max, 10) || 30);
                    const daysMax = Math.max(1, parseInt(selectedCategory?.days_max, 10) || 30);
                    const numberOptions = (max) =>
                      Array.from({ length: max }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
                    return (
                      <div style={{ display: 'flex', gap: 8, marginBottom: shown('fragile') ? 12 : 0 }}>
                        {shown('floor') && (
                          <Form.Item
                            name="cargo_floor"
                            style={{ flex: 1, marginBottom: 0 }}
                            rules={required('floor') ? [{ required: true, message: t('newOrder.enterFloor') }] : []}>
                            <Select
                              placeholder={t('newOrder.floor')}
                              options={numberOptions(floorMax)}
                              suffixIcon={<span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t('newOrder.floorUnit')}</span>}
                              style={{ width: '100%' }}
                              size="large"
                              allowClear
                            />
                          </Form.Item>
                        )}
                        {shown('days') && (
                          <Form.Item
                            name="cargo_days"
                            style={{ flex: 1, marginBottom: 0 }}
                            rules={required('days') ? [{ required: true, message: t('newOrder.enterDays') }] : []}>
                            <Select
                              placeholder={t('newOrder.days')}
                              options={numberOptions(daysMax)}
                              suffixIcon={<span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{t('newOrder.daysUnit')}</span>}
                              style={{ width: '100%' }}
                              size="large"
                              allowClear
                            />
                          </Form.Item>
                        )}
                      </div>
                    );
                  })()}
                  {shown('fragile') && (
                    <Form.Item
                      name="cargo_fragile"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}>
                      <FragileSwitchRow label={t('newOrder.fragile')} />
                    </Form.Item>
                  )}
                  {shown('insured') && (
                    <Form.Item
                      name="cargo_insured"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}>
                      <FragileSwitchRow label={t('newOrder.insured')} />
                    </Form.Item>
                  )}
                  {shown('insurance') && (
                    <Form.Item
                      name="cargo_insurance"
                      valuePropName="checked"
                      style={{ marginBottom: 0 }}>
                      <FragileSwitchRow label={t('newOrder.insuranceNeeded')} />
                    </Form.Item>
                  )}
                </>
              );
            })()}
          </SectionCard>
          </div>

          {/* ── SECTION: Contacts (one per route stop) ──
              Pickup #1 is required (mirrors Order.contact_name / contact_phone).
              Every other stop is optional; values live alongside the stop in
              pickupStops / destStops and ride along inside route_stops JSON. */}
          <SectionCard icon={<UserOutlined />} title={t('newOrder.contactPerson')}>
            {(() => {
              const pickupCount = pickupStops.length;
              const destCount = destStops.length;
              const blocks = [];
              pickupStops.forEach((stop, idx) => {
                const label = pickupCount === 1
                  ? t('newOrder.pickupContact')
                  : t('newOrder.pickupNContact', { n: idx + 1 });
                blocks.push({ key: `p-${idx}`, label, list: 'pickup', idx, stop, required: idx === 0 });
              });
              if (needsDest) {
                destStops.forEach((stop, idx) => {
                  const label = destCount === 1
                    ? t('newOrder.destContact')
                    : t('newOrder.destNContact', { n: idx + 1 });
                  blocks.push({ key: `d-${idx}`, label, list: 'dest', idx, stop, required: false });
                });
              }
              return blocks.map((b, i) => (
                <div key={b.key} style={{ marginBottom: i === blocks.length - 1 ? 0 : 16 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                    marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      background: b.list === 'pickup' ? 'var(--accent)' : 'var(--success-color)',
                    }} />
                    {b.label}
                    {!b.required && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)',
                        padding: '2px 6px', borderRadius: 6, background: 'var(--bg-tertiary)',
                        textTransform: 'lowercase', marginLeft: 2,
                      }}>
                        {t('newOrder.optionalLabel')}
                      </span>
                    )}
                  </div>
                  <Input
                    prefix={<UserOutlined style={{ color: 'var(--text-placeholder)' }} />}
                    placeholder={t('newOrder.fullName')}
                    autoComplete="name"
                    style={{ ...inputStyle, marginBottom: 8 }}
                    value={b.stop.contact_name || ''}
                    onChange={(e) => updateStop(b.list, b.idx, { contact_name: e.target.value })}
                  />
                  <PhoneInput
                    style={inputStyle}
                    value={b.stop.contact_phone || ''}
                    onChange={(v) => updateStop(b.list, b.idx, { contact_phone: v })}
                  />
                </div>
              ));
            })()}
          </SectionCard>

          {/* ── SECTION: Photos & Notes (both optional) ── */}
          <SectionCard icon={<CameraOutlined />} title={t('newOrder.additional')} last>
            <Form.Item name="user_note" style={{ marginBottom: 12 }}>
              <TextArea rows={2} placeholder={t('newOrder.notesForUs')}
                style={{ borderRadius: 12, fontSize: 15, padding: '12px 14px', resize: 'none' }} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}
              validateStatus={photoError ? 'error' : ''}
              help={photoError || undefined}>
              <Upload listType="picture" fileList={fileList}
                onChange={({ fileList: fl }) => {
                  setFileList(fl);
                  if (fl.length > 0) setPhotoError('');
                }}
                beforeUpload={() => false} multiple accept="image/*">
                <Button icon={<CameraOutlined />}
                  style={{
                    borderRadius: 12, height: 44,
                    border: '2px dashed var(--border-color)',
                    color: 'var(--text-secondary)', fontWeight: 600,
                    background: 'var(--bg-tertiary)',
                    width: '100%',
                  }}>
                  {t('newOrder.addPhotos')}
                </Button>
              </Upload>
            </Form.Item>
          </SectionCard>
        </Form>

        {/* ── Sticky CTA ── */}
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid var(--glass-border)',
        }}>
          <div style={{
            margin: '0 auto',
            maxWidth: 1200, padding: isDesktop ? '24px 40px' : '24px 20px', paddingBottom: isDesktop ? 'calc(24px + env(safe-area-inset-bottom, 0px))' : 'calc(24px + env(safe-area-inset-bottom, 0px))',
          }}>
            <Button type="primary" block onClick={goToConfirm}
              style={{
                height: 52, borderRadius: 14, fontSize: 16, fontWeight: 700,
                background: 'var(--fab-gradient)', border: 'none',
                boxShadow: 'var(--fab-shadow)', letterSpacing: -0.2,
              }}>
              {t('newOrder.reviewOrder')} <RightOutlined style={{ fontSize: 13, marginLeft: 4 }} />
            </Button>
          </div>
        </div>
        <ContactFab />
      </div>
    );
  }

  // ─── STEP 1: CONFIRMATION ───
  // Guard: if essential state is missing (e.g. hard refresh on step 1), show a fallback
  if (!selectedCategory || !formValues.description) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
      }} className="app-bg">
        <div style={{
          background: 'var(--card-bg)', borderRadius: 18,
          padding: '32px 28px', maxWidth: 420, width: '100%',
          border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'var(--accent-bg)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)', fontSize: 28,
          }}>
            <FileTextOutlined />
          </div>
          <div style={{
            fontSize: 18, fontWeight: 700, color: 'var(--text-primary)',
            marginBottom: 8, letterSpacing: -0.2,
          }}>
            {t('newOrder.orderDetails')}
          </div>
          <div style={{
            fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5,
          }}>
            {t('newOrder.fillDetailsFirst')}
          </div>
          <Button type="primary" block onClick={() => setStep(0)}
            style={{
              height: 48, borderRadius: 12, fontSize: 15, fontWeight: 700,
              background: 'var(--fab-gradient)', border: 'none',
              boxShadow: 'var(--fab-shadow)',
            }}>
            <ArrowLeftOutlined style={{ fontSize: 13, marginRight: 6 }} />
            {t('newOrder.backToForm')}
          </Button>
        </div>
        <ContactFab />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 140, maxWidth: 1200, margin: '0 auto' }} className="app-bg page-enter">
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--glass-border)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div onClick={() => setStep(0)} style={{
          width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, color: 'var(--text-primary)',
          background: 'var(--bg-tertiary)', transition: 'all 0.2s ease',
        }}>
          <ArrowLeftOutlined />
        </div>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
          {t('newOrder.confirmOrder')}
        </div>
        <Dropdown
          menu={{ items: langMenuItems }}
          trigger={['click']}
          placement="bottomRight"
        >
          <div style={{
            height: 36, padding: '0 12px', borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', fontSize: 13, fontWeight: 600,
            color: 'var(--text-primary)',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            letterSpacing: 0.3,
          }}>
            <span style={{ fontSize: 16 }}>{LANG_FLAGS[lang]}</span>
            <span>{(lang || 'en').toUpperCase()}</span>
          </div>
        </Dropdown>
      </div>

      {/* Progress indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px 8px',
      }}>
        <ProgressStep number={1} done label={t('newOrder.stepDetails')} />
        <div style={{
          flex: 1, height: 2,
          background: 'var(--accent)', borderRadius: 1,
        }} />
        <ProgressStep number={2} active label={t('newOrder.stepConfirm')} />
      </div>

      <div style={{ padding: isDesktop ? '32px 40px 48px' : '32px 20px 48px' }}>
        {/* Hero checkmark */}
        <div style={{
          textAlign: 'center', marginBottom: 24,
          animation: 'fadeInUp 0.4s ease-out both',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'var(--accent-bg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, color: 'var(--accent)', marginBottom: 12,
          }}>
            <CheckCircleOutlined />
          </div>
          <div style={{
            fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3,
          }}>
            {t('newOrder.reviewOrder')}
          </div>
        </div>

        {/* ── Approximate Price Card ──
            Shown only when the engine returns a price. When it can't
            compute (no zone matched, missing pricing data, customer
            still picking transport category), we hide the whole card
            rather than show "—" — a missing price reads as a problem
            to the customer, whereas no card just looks like "admin will
            price this". The card is decorative-only: nothing on the
            customer side is gated on this number. */}
        {previewLoading && !pricePreview && (
          <div style={{
            background: 'var(--card-bg)', borderRadius: 18,
            padding: isDesktop ? '24px 28px' : '20px 18px',
            marginBottom: isDesktop ? 20 : 14,
            border: '1px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 12,
            color: 'var(--text-tertiary)', fontSize: 13,
            animation: 'fadeInUp 0.4s ease-out 0.05s both',
          }}>
            <span style={{ fontSize: 16 }}>⏳</span>
            {t('newOrder.estimatingPrice')}
          </div>
        )}
        {pricePreview?.computed && pricePreview.price != null && (
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-bg) 0%, var(--accent-bg-strong) 100%)',
            borderRadius: 20,
            padding: isDesktop ? '24px 28px' : '20px 18px',
            marginBottom: isDesktop ? 20 : 14,
            border: '1px solid var(--accent-border, var(--accent))',
            boxShadow: '0 8px 24px rgba(0, 184, 86, 0.15)',
            animation: 'fadeInUp 0.4s ease-out 0.05s both',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--accent)',
              textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
            }}>
              {t('newOrder.approximatePrice')}
            </div>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{
                fontSize: isDesktop ? 36 : 30, fontWeight: 800,
                color: 'var(--text-primary)', letterSpacing: -1,
                lineHeight: 1,
              }}>
                {Number(pricePreview.price).toLocaleString('en-US')} {currencySymbol}
              </div>
            </div>
            <div style={{
              fontSize: 12, color: 'var(--text-secondary)',
              marginTop: 8, lineHeight: 1.5,
            }}>
              {t('newOrder.approximatePriceHint')}
            </div>
          </div>
        )}

        {/* ── Service Type Card ── */}
        <ConfirmSection delay={0.05} icon={<InboxOutlined />} title={t('newOrder.serviceType')}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 12,
            background: 'var(--accent-bg)',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--accent-bg-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'var(--accent)',
            }}>
              <CategoryImage imageUrl={selectedCategory?.image_url} icon={selectedCategory?.icon || 'inbox'} size={selectedCategory?.image_url ? 40 : 28} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {localized(selectedCategory?.name)}
            </div>
          </div>
          {selectedTransportCategory && !selectedTransportCategory.is_helper_card && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginTop: 8, padding: '8px 14px', borderRadius: 12,
              background: 'var(--bg-tertiary)',
            }}>
              <CarOutlined style={{ fontSize: 14, color: 'var(--text-tertiary)' }} />
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600 }}>
                {t('newOrder.transportCategory')}:
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {localized(selectedTransportCategory.name)}
              </div>
            </div>
          )}
        </ConfirmSection>

        {/* ── Description Card ── */}
        <ConfirmSection delay={0.1} icon={<FileTextOutlined />} title={t('orders.description')}>
          <div style={{
            fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6,
            padding: '8px 0',
          }}>
            {formValues.description}
          </div>
          {(formValues.cargo_length || formValues.cargo_width || formValues.cargo_height
            || formValues.cargo_volume || formValues.cargo_weight
            || formValues.cargo_floor || formValues.cargo_days || formValues.cargo_fragile
            || formValues.cargo_insured || formValues.cargo_insurance) && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8,
              paddingTop: 10, borderTop: '1px solid var(--border-light)',
            }}>
              {(formValues.cargo_length || formValues.cargo_width || formValues.cargo_height) && (
                <InfoChip label={t('newOrder.dimensions')} value={`${formValues.cargo_length || '-'} × ${formValues.cargo_width || '-'} × ${formValues.cargo_height || '-'} ${t('newOrder.cm')}`} />
              )}
              {formValues.cargo_volume && (
                <InfoChip label={t('newOrder.cubicMeters')} value={`${formValues.cargo_volume} ${t('newOrder.m3')}`} />
              )}
              {formValues.cargo_weight && (
                <InfoChip label={t('newOrder.weight')} value={`${formValues.cargo_weight} ${t('newOrder.kg')}`} />
              )}
              {formValues.cargo_floor && (
                <InfoChip label={t('newOrder.floor')} value={`${formValues.cargo_floor}`} />
              )}
              {formValues.cargo_days && (
                <InfoChip label={t('newOrder.days')} value={`${formValues.cargo_days} ${t('newOrder.daysUnit')}`} />
              )}
              {formValues.cargo_fragile && (
                <InfoChip label="" value={t('newOrder.fragile')} />
              )}
              {formValues.cargo_insured && (
                <InfoChip label="" value={t('newOrder.insured')} />
              )}
              {formValues.cargo_insurance && (
                <InfoChip label="" value={t('newOrder.insuranceNeeded')} />
              )}
            </div>
          )}
        </ConfirmSection>

        {/* ── Route Card ── */}
        <ConfirmSection delay={0.15} icon={<MapIcon size={18} />} title={needsDest ? t('newOrder.route') : t('newOrder.workLocation')}>
          {pickupStops.filter(s => s.text).map((stop, idx) => (
            <div key={`cp-${idx}`} style={{
              display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: needsDest ? '#10b98114' : 'var(--accent-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <MapIcon size={14} style={{
                  color: needsDest ? 'var(--success-color)' : 'var(--accent)',
                }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {needsDest
                    ? (pickupStops.filter(s => s.text).length > 1 ? `${t('orders.pickup')} ${idx + 1}` : t('orders.pickup'))
                    : t('orders.location')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                  {stop.text}
                </div>
              </div>
            </div>
          ))}

          {needsDest && destStops.filter(s => s.text).map((stop, idx) => (
            <div key={`cd-${idx}`} style={{
              display: 'flex', gap: 12, alignItems: 'center',
              marginBottom: idx < destStops.filter(s => s.text).length - 1 ? 10 : 0,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: '#ef444414',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <MapIcon size={14} style={{ color: '#ef4444' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {destStops.filter(s => s.text).length > 1 ? `${t('orders.destination')} ${idx + 1}` : t('orders.destination')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2 }}>
                  {stop.text}
                </div>
              </div>
            </div>
          ))}

          {totalDistance && (
            <div style={{
              marginTop: 12, paddingTop: 12,
              borderTop: '1px solid var(--border-light)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <CarOutlined style={{ color: 'var(--accent)', fontSize: 15 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatDistance(totalDistance.distance)}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                ~ {formatDuration(totalDistance.duration)}
              </span>
            </div>
          )}
        </ConfirmSection>

        {/* ── Schedule Card ── */}
        <ConfirmSection delay={0.2} icon={<CalendarOutlined />} title={t('newOrder.when')}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {t('orders.date')}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
                {formValues.requested_date?.format('DD MMM YYYY')}
              </div>
            </div>
            {formValues.requested_time && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {t('orders.time')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
                  {formValues.requested_time?.format('HH:mm')}
                </div>
              </div>
            )}
          </div>
        </ConfirmSection>

        {/* ── Contact Card (one row per stop with a filled contact) ── */}
        {(() => {
          const pickupCount = pickupStops.length;
          const destCount = destStops.length;
          const rows = [];
          pickupStops.forEach((s, i) => {
            if (!s.contact_name?.trim() && !s.contact_phone?.trim()) return;
            const label = pickupCount === 1
              ? t('newOrder.pickupContact')
              : t('newOrder.pickupNContact', { n: i + 1 });
            rows.push({ key: `cp-${i}`, label, list: 'pickup', name: s.contact_name, phone: s.contact_phone });
          });
          if (needsDest) {
            destStops.forEach((s, i) => {
              if (!s.contact_name?.trim() && !s.contact_phone?.trim()) return;
              const label = destCount === 1
                ? t('newOrder.destContact')
                : t('newOrder.destNContact', { n: i + 1 });
              rows.push({ key: `cd-${i}`, label, list: 'dest', name: s.contact_name, phone: s.contact_phone });
            });
          }
          if (rows.length === 0) return null;
          return (
            <ConfirmSection delay={0.25} icon={<UserOutlined />} title={t('newOrder.contactPerson')}>
              {rows.map((r, i) => (
                <div key={r.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  paddingTop: i === 0 ? 0 : 10,
                  marginTop: i === 0 ? 0 : 10,
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-light)',
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: r.list === 'pickup' ? 'var(--accent)' : 'var(--success-color)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                      {r.label}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 3,
                      display: 'flex', flexWrap: 'wrap', gap: 12,
                    }}>
                      {r.name && <span>{r.name}</span>}
                      {r.phone && <span style={{ color: 'var(--text-secondary)' }}>{r.phone}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </ConfirmSection>
          );
        })()}

        {/* ── Photos & Notes ── */}
        {(fileList.length > 0 || formValues.user_note) && (
          <ConfirmSection delay={0.3} icon={<CameraOutlined />} title={t('newOrder.additional')}>
            {fileList.length > 0 && (
              <div style={{ marginBottom: formValues.user_note ? 10 : 0 }}>
                <InfoChip label={t('orders.photos')} value={t('newOrder.imagesAttached', { count: fileList.length })} />
              </div>
            )}
            {formValues.user_note && (
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{formValues.user_note}"
              </div>
            )}
          </ConfirmSection>
        )}

      </div>

      {/* ── Sticky CTA ── matches step 0's bottom bar so the action is always
          in the same place; "Order Details" goes back, "Submit Order" submits. */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid var(--glass-border)',
      }}>
        <div style={{
          margin: '0 auto', maxWidth: 1200,
          padding: isDesktop ? '20px 40px' : '18px 20px',
          paddingBottom: isDesktop
            ? 'calc(20px + env(safe-area-inset-bottom, 0px))'
            : 'calc(18px + env(safe-area-inset-bottom, 0px))',
          display: 'flex', gap: 10, alignItems: 'stretch',
        }}>
          <Button onClick={() => setStep(0)} disabled={loading}
            style={{
              flex: '0 0 auto',
              height: 52, borderRadius: 14, fontSize: 14, fontWeight: 600,
              padding: '0 18px',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
            }}>
            <ArrowLeftOutlined style={{ fontSize: 12, marginRight: 6 }} />
            {t('newOrder.orderDetails')}
          </Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<CheckCircleOutlined />}
            style={{
              flex: 1,
              height: 52, borderRadius: 14, fontSize: 16, fontWeight: 700,
              background: 'var(--fab-gradient)', border: 'none',
              boxShadow: 'var(--fab-shadow)', letterSpacing: -0.2,
            }}>
            {t('newOrder.submitOrder')}
          </Button>
        </div>
      </div>
      <ContactFab />
    </div>
  );
}


// ─── Sub-components ───

function ProgressStep({ number, active, done, label }) {
  const bg = active
    ? 'rgba(255,255,255,0.22)'
    : done
    ? 'var(--accent-bg)'
    : 'rgba(255,255,255,0.08)';
  const color = active
    ? '#fff'
    : done
    ? 'var(--accent)'
    : 'rgba(255,255,255,0.45)';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px 6px 8px', borderRadius: 20,
      background: bg, transition: 'all 0.3s ease',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: active ? 'rgba(255,255,255,0.25)' : done ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
        color: (active || done) ? '#fff' : 'rgba(255,255,255,0.4)',
      }}>
        {done ? <CheckCircleOutlined style={{ fontSize: 12 }} /> : number}
      </div>
      <span style={{
        fontSize: 12, fontWeight: active ? 700 : 500,
        color, whiteSpace: 'nowrap',
        // Safety net: if a translator ever lands a label longer than the
        // pill can fit, ellipsize inside the pill instead of pushing the
        // entire stepper past its container's edge.
        maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis',
      }} title={typeof label === 'string' ? label : ''}>
        {label}
      </span>
    </div>
  );
}

// Wrapped Switch designed to live inside a Form.Item with
// valuePropName="checked" — Ant injects `checked`/`onChange` automatically.
function FragileSwitchRow({ checked, onChange, label }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 12,
      background: 'var(--bg-tertiary)',
      gap: 12,
    }}>
      <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500 }}>
        {label}
      </span>
      <Switch checked={!!checked} onChange={onChange} />
    </div>
  );
}

function SectionCard({ icon, title, children, first, last }) {
  return (
    <div style={{
      marginTop: first ? 36 : 24,
      marginBottom: last ? 24 : 0,
      background: 'var(--card-bg)',
      borderRadius: 18,
      padding: '36px 36px',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
      animation: 'fadeInUp 0.4s ease-out both',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 24,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'var(--accent-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, color: 'var(--accent)',
        }}>
          {icon}
        </div>
        <div style={{
          fontSize: 16, fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: -0.2,
        }}>
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

function CategoryCard({ isActive, color, icon, imageUrl, name, badge, dashed, onClick }) {
  return (
    <div
      onClick={onClick}
      className="card-interactive"
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 4, padding: '6px 4px 6px', borderRadius: 10, cursor: 'pointer',
        background: isActive ? `${color}10` : 'var(--bg-primary)',
        border: isActive
          ? `2px solid ${color}`
          : dashed
          ? '1.5px dashed var(--border-color)'
          : '1px solid var(--border-color)',
        boxShadow: isActive ? `0 0 0 3px ${color}0a` : 'var(--shadow-sm)',
        transition: 'all 0.2s ease',
        textAlign: 'center',
        minHeight: 60,
        justifyContent: 'center',
      }}
    >
      <div style={{
        width: '100%', aspectRatio: '1 / 1',
        borderRadius: 6,
        background: imageUrl
          ? 'var(--bg-secondary)'
          : (isActive ? `${color}18` : 'var(--bg-tertiary)'),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isActive ? color : 'var(--text-secondary)',
        transition: 'all 0.2s ease', overflow: 'hidden',
      }}>
        {imageUrl ? (
          <img src={imageUrl} alt="" style={{
            maxWidth: '100%', maxHeight: '100%',
            width: 'auto', height: 'auto',
            objectFit: 'contain', display: 'block',
          }} />
        ) : (
          <CategoryImage icon={icon} size={22} />
        )}
      </div>
      <div style={{ width: '100%' }}>
        <div style={{
          fontSize: 10.5, fontWeight: isActive ? 700 : 600,
          color: isActive ? color : 'var(--text-primary)',
          lineHeight: 1.2,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}>
          {name}
        </div>
        {badge && (
          <div style={{
            fontSize: 9, color: 'var(--text-tertiary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 2, marginTop: 1,
          }}>
            <SwapRightOutlined style={{ fontSize: 8 }} /> {badge}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmSection({ children, delay = 0, icon, title }) {
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 18, padding: '36px 36px',
      marginBottom: 24, boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-color)',
      animation: `fadeInUp 0.4s ease-out ${delay}s both`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12, paddingBottom: 10,
        borderBottom: '1px solid var(--border-light)',
      }}>
        <span style={{ fontSize: 14, color: 'var(--accent)' }}>{icon}</span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
          letterSpacing: -0.1, textTransform: 'uppercase',
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function InfoChip({ label, value }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 8,
      background: 'var(--bg-tertiary)',
      fontSize: 13,
    }}>
      {label && <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}:</span>}
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
