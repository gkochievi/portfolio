import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Typography, Spin, Button, Timeline, Image, Space,
  Select, Input, InputNumber, message, Empty, Grid, Divider, DatePicker, TimePicker, Tag, Alert, Modal, Tooltip,
} from 'antd';
import dayjs from 'dayjs';
import { useRealtimeRefresh, useNotifications } from '../../contexts/NotificationContext';
import {
  ArrowLeftOutlined, TagOutlined, CarOutlined, SyncOutlined,
  CommentOutlined, EnvironmentOutlined, PictureOutlined, HistoryOutlined,
  ThunderboltOutlined, UserOutlined, ClockCircleOutlined, WalletOutlined,
  PhoneOutlined, SendOutlined, CheckCircleOutlined,
  EditOutlined, PlusOutlined, DeleteOutlined,
  InfoCircleOutlined, SettingOutlined,
  CopyOutlined, MailOutlined, DownloadOutlined, TeamOutlined,
  ExclamationCircleFilled, RightOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { StatusBadge, UrgencyBadge } from '../../components/common/StatusBadge';
import { STATUS_CONFIG, buildStatusOptions } from '../../utils/status';
import MapPicker, { MapView } from '../../components/map/MapPicker';
import LocationAutocomplete from '../../components/common/LocationAutocomplete';
import StatusStepper, { STATUS_STEPS } from '../../components/common/StatusStepper';
import ElevationProfile from '../../components/map/ElevationProfile';
import useTruckRoute from '../../hooks/useTruckRoute';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import { DEFAULT_CURRENCY } from '../../utils/currency';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

export default function AdminOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const { t, lang } = useLang();
  const { currency = DEFAULT_CURRENCY } = useBranding();
  const localized = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v[lang] || v['en'] || '';
  };
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  // Pricing zones — fetched once so the breakdown panel can render the
  // localized zone name instead of the bare slug stored on the order.
  const [zones, setZones] = useState([]);
  const [newStatus, setNewStatus] = useState('');
  // Use `null` as the "user hasn't touched the textarea" sentinel — mirrors
  // the priceDraft pattern. `''` is a real user state (a deliberate clear),
  // so silent refreshes must not overwrite it back to admin_comment.
  const [comment, setComment] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [priceDraft, setPriceDraft] = useState(null);
  const [recalculatingPrice, setRecalculatingPrice] = useState(false);

  // Optimistic toggle for the per-field admin verification checkmarks. The
  // PATCH endpoint stamps admin_verified_<field> on the order; we flip the
  // local view immediately so the click feels instant.
  const handleToggleVerify = async (fieldKey) => {
    const flagName = `admin_verified_${fieldKey}`;
    const current = !!order?.[flagName];
    setOrder((prev) => (prev ? { ...prev, [flagName]: !current } : prev));
    try {
      await api.patch(`/orders/admin/${id}/`, { [flagName]: !current });
    } catch {
      // Roll back on failure
      setOrder((prev) => (prev ? { ...prev, [flagName]: current } : prev));
      message.error(t('adminOrderDetail.saveFailed') || 'Save failed');
    }
  };

  // Each verify icon is gated on the underlying field actually having a
  // value — verifying an empty selection isn't meaningful.
  const VERIFY_VALUE_GETTERS = {
    service: (o) => !!o?.final_service,
    vehicle: (o) => !!o?.assigned_vehicle,
    driver:  (o) => !!o?.assigned_driver,
    price:   (o) => o?.price !== null && o?.price !== undefined && Number(o?.price) > 0,
  };

  const verifyToggle = (fieldKey, baseDisabled = false, opts = {}) => {
    const flagName = `admin_verified_${fieldKey}`;
    const verified = !!order?.[flagName];
    const hasValue = (VERIFY_VALUE_GETTERS[fieldKey] || (() => true))(order);
    const disabled = baseDisabled || !hasValue;
    const tooltip = !hasValue
      ? t('adminOrderDetail.verifyDisabledEmpty')
      : (verified ? t('adminOrderDetail.fieldVerified') : t('adminOrderDetail.verifyRequiredTooltip'));
    // Show the "Required" chip only while the field has a value and the
    // admin hasn't ticked it off yet — verified or empty-field states are
    // self-explanatory from the icon's color/opacity. Callers can suppress
    // the chip via opts.hideRequired when the surrounding row already
    // shows its own "Required" tag (e.g. the price section).
    const showRequiredTag = hasValue && !verified && !baseDisabled && !opts.hideRequired;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
        {showRequiredTag && (
          <Tag
            color="warning"
            style={{
              margin: 0, fontSize: 11, lineHeight: '18px',
              padding: '0 6px', borderRadius: 6, fontWeight: 600,
            }}
          >
            {t('adminOrderDetail.required')}
          </Tag>
        )}
        <Tooltip title={tooltip}>
          <Button
            type="text" size="small"
            disabled={disabled}
            onClick={() => handleToggleVerify(fieldKey)}
            icon={
              <CheckCircleOutlined
                style={{
                  color: verified && hasValue ? '#10b981' : 'var(--text-tertiary)',
                  fontSize: 16,
                  opacity: !hasValue ? 0.25 : (verified ? 1 : 0.45),
                }}
              />
            }
            style={{ padding: 4, height: 24 }}
          />
        </Tooltip>
      </div>
    );
  };
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPickupStops, setEditPickupStops] = useState([]);
  const [editDestStops, setEditDestStops] = useState([]);
  // Which stop the in-modal map is currently pinning. Mirrors the customer's
  // NewOrderFlow active-stop pattern so admins can switch between stops and
  // tap the map to drop a marker.
  const [editActiveStop, setEditActiveStop] = useState({ type: 'pickup', index: 0 });
  // Defer mounting Leaflet until the modal's open animation has finished.
  // If we render MapContainer while the modal slot is still animating from
  // 0×0 to its final size, Leaflet's internal pixel math computes against
  // bogus dimensions and getCenter()/getZoom() come back NaN — every later
  // flyTo() then floods the console with "Invalid LatLng (NaN, NaN)".
  const [editMapReady, setEditMapReady] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [editTime, setEditTime] = useState(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCargoDetails, setEditCargoDetails] = useState('');
  const [editUrgency, setEditUrgency] = useState('normal');
  const [editSaving, setEditSaving] = useState(false);
  // B6: track the auto-promotion banner. `undoCountdown` doubles as both
  // visibility flag (null = hidden) and remaining seconds. `dismissed`
  // stores the OrderStatusHistory id we've already cleared so silent
  // refreshes don't re-mount the banner once the user dealt with it.
  const [undoCountdown, setUndoCountdown] = useState(null);
  const [dismissedPromotionId, setDismissedPromotionId] = useState(null);
  const { refresh: refreshNotifications } = useNotifications();

  useEffect(() => {
    api.get('/services/').then(({ data }) => {
      setCategories(Array.isArray(data) ? data : data.results || []);
    });
    api.get('/vehicles/admin/').then(({ data }) => {
      const results = data.results || data;
      setVehicles(Array.isArray(results) ? results : []);
    });
    api.get('/drivers/admin/').then(({ data }) => {
      const results = data.results || data;
      setDrivers(Array.isArray(results) ? results : []);
    });
    // Admin endpoint (returns all zones, active + inactive) so historical
    // pricing_breakdown rows that reference deactivated legacy zone slugs
    // (e.g. region_le30/region_gt30) can still resolve a display name.
    api.get('/pricing/admin/zones/').then(({ data }) => {
      setZones(Array.isArray(data) ? data : []);
    }).catch(() => { /* breakdown falls back to slug if this fails */ });
  }, []);

  // Drivers licensed to operate the currently-assigned vehicle AND linked to it.
  const eligibleDrivers = useMemo(() => {
    if (!order?.assigned_vehicle) return [];
    return drivers.filter((d) => {
      const linked = (d.vehicles || []).some((v) => v.id === order.assigned_vehicle);
      return linked && d.is_active && d.status === 'active';
    });
  }, [drivers, order?.assigned_vehicle]);

  // Vehicles — show all but flag busy ones with active-order counts.
  const assignedVehicleId = order?.assigned_vehicle;
  // Pick the most-specific category the admin wants this order routed to —
  // final_category overrides selected_category overrides the suggestion.
  // We use it to mark vehicles whose category list covers this order so
  // they sort to the top of the dropdown.
  const orderCategoryId = order?.final_category
    || order?.selected_category
    || order?.suggested_category;
  const vehicleOptions = useMemo(() => {
    const list = vehicles.map((v) => {
      const isCurrent = v.id === assignedVehicleId;
      const busy = (v.active_orders_count || 0) > 0 && !isCurrent;
      const matchesService = orderCategoryId
        ? (v.categories_detail || []).some((c) => c.id === orderCategoryId)
        : false;
      const categoriesText = (v.categories_detail || [])
        .map((c) => (typeof c.name === 'string' ? c.name : (c.name?.[lang] || c.name?.en || '')))
        .filter(Boolean)
        .join(', ');
      const statusText = v.status !== 'available' && !isCurrent
        ? (v.status_display || v.status)
        : null;
      const disabled = !isCurrent && (v.status === 'maintenance' || v.status === 'retired' || !v.is_active);
      return {
        value: v.id,
        // Plain string used by the closed Select header AND by filterOption.
        // The dropdown rows render via optionRender below.
        label: `${v.name} (${v.plate_number})`,
        vehicle: v,
        isCurrent,
        busy,
        matchesService,
        categoriesText,
        statusText,
        disabled,
      };
    });
    // Sort: currently-assigned first, then service-matching available,
    // then other available, then busy/disabled (still selectable so admins
    // can see the full fleet, but pushed to the bottom).
    list.sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      if (a.matchesService !== b.matchesService) return a.matchesService ? -1 : 1;
      const aPenalty = a.disabled || a.busy ? 1 : 0;
      const bPenalty = b.disabled || b.busy ? 1 : 0;
      if (aPenalty !== bPenalty) return aPenalty - bPenalty;
      return 0;
    });
    return list;
  }, [vehicles, assignedVehicleId, lang, orderCategoryId]);

  const fetchOrder = useCallback(({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    return api.get(`/orders/admin/${id}/`).then(({ data }) => {
      setOrder(data);
      setNewStatus((prev) => prev || data.status);
      // Don't fill comment from server — `comment === null` means
      // "untouched" and the textarea falls back to data.admin_comment via
      // its render expression. Setting the string here would clobber a
      // user-cleared textarea on every silent refresh.
      setPriceDraft((prev) => (prev !== null ? prev : (data.price !== null && data.price !== undefined ? Math.round(Number(data.price)) : null)));
      // backend auto-marks this order as read; refresh the bell badge quickly
      refreshNotifications();
    }).catch(() => { if (!silent) message.error(t('adminOrderDetail.orderNotFound')); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [id, t, refreshNotifications]);

  useRealtimeRefresh(useCallback(() => {
    fetchOrder({ silent: true });
  }, [fetchOrder]));

  useEffect(() => { fetchOrder(); }, [id]); // eslint-disable-line

  // B6: detect a fresh auto-promotion and arm the undo countdown. We
  // check the most-recent status_history entry against a 60s window so
  // a stale auto-flip from yesterday never re-arms the banner.
  const latestHistory = order?.status_history?.[0];
  useEffect(() => {
    if (!latestHistory?.is_auto_promotion) return;
    if (latestHistory.id === dismissedPromotionId) return;
    if (order?.status !== 'under_review') return;
    const ageSeconds = (Date.now() - new Date(latestHistory.created_at).getTime()) / 1000;
    const remaining = Math.floor(60 - ageSeconds);
    if (remaining <= 0) return;
    // Cap at 30s for the visible countdown — the backend tolerates 60s
    // but we want the admin to act quickly. They can still trigger the
    // backend undo within those extra 30s if they refresh and re-arm.
    setUndoCountdown(Math.min(remaining, 30));
  }, [latestHistory?.id, dismissedPromotionId, order?.status]);

  // Tick the countdown down every second; clears itself at 0.
  useEffect(() => {
    if (undoCountdown === null) return undefined;
    if (undoCountdown <= 0) {
      setUndoCountdown(null);
      return undefined;
    }
    const handle = setTimeout(() => {
      setUndoCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => clearTimeout(handle);
  }, [undoCountdown]);

  const handleUndoAutoPromotion = async () => {
    setUpdating(true);
    try {
      await api.post(`/orders/admin/${id}/undo-auto-promotion/`);
      // Mark this promotion event "handled" so the detection effect
      // doesn't re-arm the banner on the next silent refresh.
      if (latestHistory?.id) setDismissedPromotionId(latestHistory.id);
      setUndoCountdown(null);
      message.success(t('adminOrderDetail.undoAutoPromotionSuccess'));
      fetchOrder();
    } catch (err) {
      message.error(extractApiError(err, t('adminOrderDetail.undoAutoPromotionFailed')));
    } finally {
      setUpdating(false);
    }
  };
  const dismissAutoPromotionBanner = () => {
    if (latestHistory?.id) setDismissedPromotionId(latestHistory.id);
    setUndoCountdown(null);
  };

  const applyStatusChange = async (effectiveComment) => {
    setUpdating(true);
    try {
      await api.post(`/orders/admin/${id}/status/`, {
        status: newStatus,
        comment: effectiveComment,
      });
      message.success(t('adminOrderDetail.statusUpdated'));
      // Reset to "untouched" so the next fetch's admin_comment shows through.
      setComment(null);
      fetchOrder();
    } catch (err) {
      message.error(extractApiError(err, t('adminOrderDetail.statusUpdateFailed')));
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = () => {
    if (!newStatus || newStatus === order.status) {
      message.warning(t('adminOrderDetail.selectDifferent'));
      return;
    }
    // Falsy-||-fallback would re-inherit admin_comment when the user has
    // intentionally cleared the textarea; check explicitly against null.
    const effectiveComment = (comment !== null ? comment : (order.admin_comment || '')).trim();
    if (newStatus === 'rejected' && !effectiveComment) {
      message.error(t('adminOrderDetail.rejectCommentRequired'));
      return;
    }
    if (newStatus === 'rejected') {
      Modal.confirm({
        title: t('adminOrderDetail.rejectConfirmTitle'),
        content: t('adminOrderDetail.rejectConfirmContent'),
        okText: t('adminOrderDetail.rejectConfirmOk'),
        okType: 'danger',
        cancelText: t('common.cancel'),
        onOk: () => applyStatusChange(effectiveComment),
      });
      return;
    }
    applyStatusChange(effectiveComment);
  };

  const handleCategoryChange = async (serviceId) => {
    // Snapshot the price BEFORE the service change so we can show admins
    // the old → new delta after the recalc completes.
    const oldPriceRaw = order?.price;
    const oldPrice = oldPriceRaw !== null && oldPriceRaw !== undefined && Number(oldPriceRaw) > 0
      ? Math.round(Number(oldPriceRaw)) : null;
    try {
      await api.patch(`/orders/admin/${id}/`, { final_service: serviceId });
      message.success(t('adminOrderDetail.serviceUpdated'));
    } catch {
      message.error(t('adminOrderDetail.serviceUpdateFailed'));
      return;
    }
    // Service drives the engine's category lookup (final_service →
    // final_category resolution lives on the backend). Re-run the pricing
    // engine immediately so the admin doesn't see a stale price.
    try {
      const { data } = await api.post(`/orders/admin/${id}/recalculate-price/`);
      const newPriceRaw = data?.price;
      const newPrice = newPriceRaw !== null && newPriceRaw !== undefined && Number(newPriceRaw) > 0
        ? Math.round(Number(newPriceRaw)) : null;
      // Always overwrite the local draft with the freshly-computed value —
      // user chose "overwrite always" in the recalc design.
      if (newPrice !== null) {
        setPriceDraft(newPrice);
      }
      const sym = currency?.symbol || '₾';
      const fmt = (v) => `${sym}${Number(v).toLocaleString()}`;
      if (!data?.computed || newPrice === null) {
        message.warning(t('adminOrderDetail.recalculateNoResult'));
      } else if (oldPrice === null) {
        message.success(t('adminOrderDetail.priceSetByRecalc', { price: fmt(newPrice) }));
      } else if (oldPrice === newPrice) {
        message.info(t('adminOrderDetail.priceUnchanged', { price: fmt(newPrice) }));
      } else {
        message.success(t('adminOrderDetail.priceRecalculatedToast', {
          old: fmt(oldPrice), new: fmt(newPrice),
        }));
      }
    } catch {
      // Don't fail the whole flow — the service change already succeeded.
      // Admin can hit "Recalculate price" manually if they want to retry.
    } finally {
      fetchOrder();
    }
  };

  const patchOrder = async (payload, successMsg, failMsg) => {
    try {
      await api.patch(`/orders/admin/${id}/`, payload);
      message.success(successMsg);
      fetchOrder();
      return true;
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail && typeof detail === 'object'
        ? Object.values(detail).flat()[0]
        : null;
      message.error(typeof firstErr === 'string' ? firstErr : failMsg);
      return false;
    }
  };

  const handleVehicleAssign = async (vehicleId) => {
    // Snapshot the price BEFORE the change so we can show the old → new delta
    // after the recalc completes.
    const oldPriceRaw = order?.price;
    const oldPrice = oldPriceRaw !== null && oldPriceRaw !== undefined && Number(oldPriceRaw) > 0
      ? Math.round(Number(oldPriceRaw)) : null;

    // Changing vehicle invalidates the driver link; clear driver in the same patch.
    const willClearDriver = Boolean(order.assigned_driver) && vehicleId !== order.assigned_vehicle;
    const payload = { assigned_vehicle: vehicleId || null };
    if (willClearDriver) payload.assigned_driver = null;

    try {
      await api.patch(`/orders/admin/${id}/`, payload);
      message.success(t('adminOrderDetail.vehicleAssigned'));
    } catch (err) {
      const detail = err.response?.data;
      const firstErr = detail && typeof detail === 'object'
        ? Object.values(detail).flat()[0] : null;
      message.error(typeof firstErr === 'string' ? firstErr : t('adminOrderDetail.vehicleAssignFailed'));
      return;
    }
    if (willClearDriver) {
      message.info(t('adminOrderDetail.driverClearedByVehicleChange'));
    }

    // Assigning a vehicle re-bases the order's pricing category on the backend
    // (the calculator follows the assigned vehicle). Re-run the engine so the
    // admin sees the price for the new category immediately. Skip when the
    // vehicle was cleared — there's no category to price against.
    if (vehicleId) {
      try {
        const { data } = await api.post(`/orders/admin/${id}/recalculate-price/`);
        const newPriceRaw = data?.price;
        const newPrice = newPriceRaw !== null && newPriceRaw !== undefined && Number(newPriceRaw) > 0
          ? Math.round(Number(newPriceRaw)) : null;
        if (newPrice !== null) {
          setPriceDraft(newPrice);
        }
        const sym = currency?.symbol || '₾';
        const fmt = (v) => `${sym}${Number(v).toLocaleString()}`;
        if (!data?.computed || newPrice === null) {
          message.warning(t('adminOrderDetail.recalculateNoResult'));
        } else if (oldPrice === null) {
          message.success(t('adminOrderDetail.priceSetByRecalc', { price: fmt(newPrice) }));
        } else if (oldPrice === newPrice) {
          message.info(t('adminOrderDetail.priceUnchanged', { price: fmt(newPrice) }));
        } else {
          message.success(t('adminOrderDetail.priceRecalculatedToast', {
            old: fmt(oldPrice), new: fmt(newPrice),
          }));
        }
      } catch {
        // Vehicle assignment already succeeded — admin can hit "Recalculate
        // price" manually if the recalc request itself failed.
      }
    }
    fetchOrder();
  };

  const handleDriverAssign = async (driverId) => {
    await patchOrder(
      { assigned_driver: driverId || null },
      t('adminOrderDetail.driverAssigned'),
      t('adminOrderDetail.driverAssignFailed'),
    );
  };

  const handleScheduleChange = async (range) => {
    const [from, to] = range || [null, null];
    await patchOrder(
      {
        scheduled_from: from ? from.toISOString() : null,
        scheduled_to: to ? to.toISOString() : null,
      },
      t('adminOrderDetail.scheduleUpdated'),
      t('adminOrderDetail.scheduleUpdateFailed'),
    );
  };

  const handleRecalculatePrice = async () => {
    setRecalculatingPrice(true);
    try {
      const { data } = await api.post(`/orders/admin/${id}/recalculate-price/`);
      if (data?.computed) {
        message.success(t('adminOrderDetail.recalculateDone'));
      } else {
        // Engine couldn't compute (missing pricing_type, no rate row, etc.) —
        // breakdown still carries the error reason so admin can see it.
        message.warning(t('adminOrderDetail.recalculateNoResult'));
      }
      // priceDraft is sticky once set, so fetchOrder() alone won't refresh
      // the "Set Price" input. Push the freshly-computed value in directly.
      if (data?.price !== null && data?.price !== undefined) {
        setPriceDraft(Math.round(Number(data.price)));
      }
      await fetchOrder();
    } catch (e) {
      message.error(t('adminOrderDetail.recalculateFailed'));
    } finally {
      setRecalculatingPrice(false);
    }
  };

  const handlePriceSave = async () => {
    if (priceDraft === null || priceDraft === undefined || priceDraft === '' || Number(priceDraft) <= 0) {
      message.error(t('adminOrderDetail.priceInvalid'));
      return;
    }
    await patchOrder(
      { price: Number(priceDraft) },
      t('adminOrderDetail.priceSaved'),
      t('adminOrderDetail.priceSaveFailed'),
    );
  };

  const handleUrgencyChange = async (urgency) => {
    try {
      await api.patch(`/orders/admin/${id}/`, { urgency });
      message.success(t('adminOrderDetail.urgencyUpdated'));
      fetchOrder();
    } catch {
      message.error(t('adminOrderDetail.urgencyUpdateFailed'));
    }
  };

  // Surface a usable message from a DRF error payload regardless of whether
  // the backend returned `{detail: ...}`, `{field: "..."}`, `{field: [...]}`,
  // or a plain string. Without this, field-level validation errors (e.g. an
  // overlapping driver booking) collapse to the generic "Status update
  // failed" toast and the admin has no way to see the real reason.
  const extractApiError = (err, fallback) => {
    const data = err?.response?.data;
    if (!data) return fallback;
    if (typeof data === 'string') return data;
    if (data.detail) return data.detail;
    if (typeof data === 'object') {
      for (const v of Object.values(data)) {
        if (Array.isArray(v) && v.length) return String(v[0]);
        if (typeof v === 'string' && v) return v;
      }
    }
    return fallback;
  };

  const handleSendOffer = () => {
    const priceNum = priceDraft === null || priceDraft === undefined || priceDraft === ''
      ? null : Number(priceDraft);
    if (priceNum === null || !Number.isFinite(priceNum) || priceNum <= 0) {
      message.error(t('adminOrderDetail.priceInvalid'));
      return;
    }
    if (!order.assigned_vehicle || !order.assigned_driver) {
      message.error(t('adminOrderDetail.missingForOffer'));
      return;
    }
    if (
      !order.admin_verified_service
      || !order.admin_verified_vehicle
      || !order.admin_verified_driver
      || !order.admin_verified_price
    ) {
      message.error(t('adminOrderDetail.missingVerifications'));
      return;
    }
    Modal.confirm({
      title: t('adminOrderDetail.sendForApprovalConfirm'),
      content: t('adminOrderDetail.sendForApprovalContent'),
      okText: t('adminOrderDetail.sendForApprovalOk'),
      okType: 'primary',
      cancelText: t('common.cancel'),
      onOk: async () => {
        setUpdating(true);
        try {
          // Persist the latest typed price so admin doesn't need a separate Save step.
          if (priceNum !== Number(order.price)) {
            await api.patch(`/orders/admin/${id}/`, { price: priceNum });
          }
          await api.post(`/orders/admin/${id}/status/`, {
            status: 'offer_sent',
            comment: (comment !== null ? comment : (order.admin_comment || '')).trim(),
          });
          message.success(t('adminOrderDetail.offerSentSuccess'));
          fetchOrder();
        } catch (err) {
          message.error(extractApiError(err, t('adminOrderDetail.statusUpdateFailed')));
        } finally {
          setUpdating(false);
        }
      },
    });
  };

  const handleCommentSave = async () => {
    try {
      const value = comment !== null ? comment : (order.admin_comment || '');
      await api.patch(`/orders/admin/${id}/`, { admin_comment: value });
      message.success(t('adminOrderDetail.commentSaved'));
      fetchOrder();
    } catch {
      message.error(t('adminOrderDetail.commentSaveFailed'));
    }
  };

  const openEditModal = () => {
    const rsPickups = order.route_stops?.pickups?.length ? order.route_stops.pickups : null;
    const rsDests = order.route_stops?.destinations?.length ? order.route_stops.destinations : null;
    const initialPickups = rsPickups
      ? rsPickups.map(p => ({
          text: p.address || '',
          coords: p.lat && p.lng ? { lat: p.lat, lng: p.lng } : null,
          contact_name: p.contact_name || '',
          contact_phone: p.contact_phone || '',
        }))
      : [{
          text: order.pickup_location || '',
          coords: order.pickup_lat && order.pickup_lng ? { lat: order.pickup_lat, lng: order.pickup_lng } : null,
          contact_name: order.contact_name || '',
          contact_phone: order.contact_phone || '',
        }];
    const initialDests = rsDests
      ? rsDests.map(d => ({
          text: d.address || '',
          coords: d.lat && d.lng ? { lat: d.lat, lng: d.lng } : null,
          contact_name: d.contact_name || '',
          contact_phone: d.contact_phone || '',
        }))
      : (order.destination_location
        ? [{
            text: order.destination_location,
            coords: order.destination_lat && order.destination_lng ? { lat: order.destination_lat, lng: order.destination_lng } : null,
            contact_name: '',
            contact_phone: '',
          }]
        : []);
    setEditPickupStops(initialPickups);
    setEditDestStops(initialDests);
    setEditDate(order.requested_date ? dayjs(order.requested_date) : null);
    setEditTime(order.requested_time ? dayjs(order.requested_time, 'HH:mm:ss') : null);
    setEditContactName(order.contact_name || '');
    setEditContactPhone(order.contact_phone || '');
    setEditDescription(order.description || '');
    setEditCargoDetails(order.cargo_details || '');
    setEditUrgency(order.urgency || 'normal');
    setEditActiveStop({ type: 'pickup', index: 0 });
    setEditModalOpen(true);
  };

  const updateEditStop = (kind, idx, patch) => {
    const setter = kind === 'pickup' ? setEditPickupStops : setEditDestStops;
    setter((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };
  const addEditStop = (kind) => {
    const setter = kind === 'pickup' ? setEditPickupStops : setEditDestStops;
    setter((prev) => [...prev, { text: '', coords: null }]);
  };
  const removeEditStop = (kind, idx) => {
    const setter = kind === 'pickup' ? setEditPickupStops : setEditDestStops;
    setter((prev) => prev.filter((_, i) => i !== idx));
    // If the active map-target was the removed stop (or comes after it),
    // fall back to pickup #0 so the map keeps a sensible focus.
    if (editActiveStop.type === kind && editActiveStop.index >= idx) {
      setEditActiveStop({ type: 'pickup', index: 0 });
    }
  };

  const handleEditSave = async () => {
    const pickupsCleaned = editPickupStops.filter(s => (s.text || '').trim());
    const destsCleaned = editDestStops.filter(s => (s.text || '').trim());
    if (!pickupsCleaned.length) {
      message.error(t('adminOrderDetail.editPickupRequired'));
      return;
    }

    // Did the actual route geometry change? If admin only edited non-location
    // fields (date, contact, etc.), keep the existing distance/duration so a
    // transient routing outage doesn't wipe valid data. Otherwise recalculate
    // via the ORS HGV proxy (truck-aware, server-side key, cached for 30 min).
    const stopKey = (stops) => stops
      .map((s) => `${s.lat ?? s.coords?.lat ?? ''},${s.lng ?? s.coords?.lng ?? ''}`)
      .join('|');
    const oldStops = [
      ...(order.route_stops?.pickups || []),
      ...(order.route_stops?.destinations || []),
    ];
    const newStops = [...pickupsCleaned, ...destsCleaned];
    const coordsChanged = stopKey(oldStops) !== stopKey(newStops);

    let distance = order.route_stops?.distance ?? null;
    let duration = order.route_stops?.duration ?? null;

    if (coordsChanged) {
      // Default to null on a real geometry change so we don't ship stale data
      // if routing fails or any stop is missing coordinates.
      distance = null;
      duration = null;
      const allHaveCoords = newStops.length >= 2 && newStops.every(
        (s) => Number.isFinite(s.coords?.lat) && Number.isFinite(s.coords?.lng),
      );
      if (allHaveCoords) {
        try {
          const coordinates = newStops.map((s) => [s.coords.lng, s.coords.lat]);
          const { data } = await api.post('/orders/route-profile/', { coordinates });
          const summary = data?.features?.[0]?.properties?.summary;
          if (summary && Number.isFinite(summary.distance) && Number.isFinite(summary.duration)) {
            distance = summary.distance;
            duration = summary.duration;
          }
        } catch {
          // Routing failure — leave distance null. Admin can re-save later.
        }
      }
    }

    const routeStops = {
      pickups: pickupsCleaned.map(s => ({
        address: s.text,
        lat: s.coords?.lat ?? null,
        lng: s.coords?.lng ?? null,
        contact_name: (s.contact_name || '').trim(),
        contact_phone: (s.contact_phone || '').trim(),
      })),
      destinations: destsCleaned.map(s => ({
        address: s.text,
        lat: s.coords?.lat ?? null,
        lng: s.coords?.lng ?? null,
        contact_name: (s.contact_name || '').trim(),
        contact_phone: (s.contact_phone || '').trim(),
      })),
      distance,
      duration,
    };
    const firstPickup = pickupsCleaned[0];
    const firstDest = destsCleaned[0];
    const payload = {
      pickup_location: firstPickup.text,
      pickup_lat: firstPickup.coords?.lat ?? null,
      pickup_lng: firstPickup.coords?.lng ?? null,
      destination_location: firstDest?.text || '',
      destination_lat: firstDest?.coords?.lat ?? null,
      destination_lng: firstDest?.coords?.lng ?? null,
      requested_date: editDate ? editDate.format('YYYY-MM-DD') : null,
      requested_time: editTime ? editTime.format('HH:mm:ss') : null,
      contact_name: editContactName,
      contact_phone: editContactPhone,
      description: editDescription,
      cargo_details: editCargoDetails,
      urgency: editUrgency,
      route_stops: JSON.stringify(routeStops),
    };
    try {
      setEditSaving(true);
      await api.patch(`/orders/admin/${id}/`, payload);
      message.success(t('adminOrderDetail.editSaved'));
      setEditModalOpen(false);
      await fetchOrder();
    } catch (err) {
      const detail = err.response?.data?.detail
        || (err.response?.data ? Object.values(err.response.data).flat().join(' ') : null)
        || t('adminOrderDetail.editFailed');
      message.error(detail);
    } finally {
      setEditSaving(false);
    }
  };

  // Truck-aware route waypoints — derived above the early returns so the
  // useTruckRoute hook is called unconditionally (Rules of Hooks).
  // Memoized so MapView/useTruckRoute see the same array reference across
  // renders when the underlying coords haven't actually changed — prevents
  // Leaflet from remounting mid-zoom-animation (the _leaflet_pos crash).
  const routeWaypoints = useMemo(() => {
    if (!order) return [];
    const pk = order.route_stops?.pickups?.length
      ? order.route_stops.pickups
      : (order.pickup_lat && order.pickup_lng ? [{ lat: order.pickup_lat, lng: order.pickup_lng }] : []);
    const ds = order.route_stops?.destinations?.length
      ? order.route_stops.destinations
      : (order.destination_lat && order.destination_lng ? [{ lat: order.destination_lat, lng: order.destination_lng }] : []);
    return [
      ...pk.filter(s => s.lat && s.lng).map(s => ({ lat: s.lat, lng: s.lng })),
      ...ds.filter(s => s.lat && s.lng).map(s => ({ lat: s.lat, lng: s.lng })),
    ];
  }, [
    order?.route_stops?.pickups,
    order?.route_stops?.destinations,
    order?.pickup_lat,
    order?.pickup_lng,
    order?.destination_lat,
    order?.destination_lng,
  ]);
  const truckRoute = useTruckRoute(routeWaypoints);

  // Stable map-marker list — same memoization rationale as routeWaypoints.
  // Multi-stop orders keep their full route in `route_stops`; the flat
  // pickup_/destination_ fields only hold the first stop for legacy/list use.
  const mapMarkers = useMemo(() => {
    if (!order) return [];
    const pickupStops = order.route_stops?.pickups?.length
      ? order.route_stops.pickups
      : (order.pickup_location ? [{ lat: order.pickup_lat, lng: order.pickup_lng }] : []);
    const destStops = order.route_stops?.destinations?.length
      ? order.route_stops.destinations
      : (order.destination_location ? [{ lat: order.destination_lat, lng: order.destination_lng }] : []);
    return [
      ...pickupStops.filter(s => s.lat && s.lng).map(s => ({ position: [s.lat, s.lng], color: 'green' })),
      ...destStops.filter(s => s.lat && s.lng).map(s => ({ position: [s.lat, s.lng], color: 'red' })),
    ];
  }, [
    order?.route_stops?.pickups,
    order?.route_stops?.destinations,
    order?.pickup_location,
    order?.pickup_lat,
    order?.pickup_lng,
    order?.destination_location,
    order?.destination_lat,
    order?.destination_lng,
  ]);

  // Stable [from, to] dayjs pair derived from the saved order. Memoized
  // so the RangePicker doesn't receive a fresh array reference on every
  // re-render (AntD treats that as a value change and resets the
  // mid-selection state, which would clear the half-typed start).
  // When scheduled_from is empty we fall back to the customer's requested
  // pickup date+time so the admin only has to pick the end of the window
  // (picking the end commits both via the onChange path below).
  const scheduleSavedValue = useMemo(() => {
    const savedFrom = order?.scheduled_from ? dayjs(order.scheduled_from) : null;
    const savedTo = order?.scheduled_to ? dayjs(order.scheduled_to) : null;
    if (!savedFrom && order?.requested_date) {
      // requested_time is a TimeField → 'HH:MM:SS' or null on legacy orders.
      const time = (order.requested_time || '00:00').slice(0, 5);
      const suggested = dayjs(`${order.requested_date}T${time}`);
      if (suggested.isValid()) return [suggested, savedTo];
    }
    return [savedFrom, savedTo];
  }, [
    order?.scheduled_from,
    order?.scheduled_to,
    order?.requested_date,
    order?.requested_time,
  ]);

  // Local draft for the RangePicker. Lets the user pick start without us
  // PATCHing the backend with scheduled_to=null (which both wipes the
  // visible end AND can fail conflict validation in
  // orders/assignment.windows_overlap when the order already has a
  // vehicle/driver assigned). Null = "no draft, show the saved value".
  const [scheduleDraft, setScheduleDraft] = useState(null);
  useEffect(() => {
    // Drop the draft whenever the server-side window changes (a successful
    // save, a manual refresh, etc.) so the picker re-syncs with truth.
    setScheduleDraft(null);
  }, [order?.scheduled_from, order?.scheduled_to]);

  // Backfill stale/missing route summary on legacy orders. The customer
  // flow now stores `ascent` into route_stops, but orders created before
  // that landed have ascent=null → pricing engine reads 0 → calculator
  // breakdown shows Elevation 0m even though the live route profile has
  // a real number. When the freshly-fetched ORS summary disagrees with
  // what's stored, post it through the recalc endpoint so the saved
  // breakdown matches what admins see in the elevation chart.
  const syncedRouteKeyRef = useRef(null);
  useEffect(() => {
    if (!order || !truckRoute?.summary) return;
    const summary = truckRoute.summary;
    const stored = order.route_stops || {};
    const storedDistance = Number(stored.distance) || 0;
    const storedAscent = Number(stored.ascent) || 0;
    const freshDistance = Math.round((summary.distanceKm || 0) * 1000);
    const freshAscent = Math.round(summary.ascentM || 0);
    // ORS distance is in meters; tolerate ±50m drift before re-posting.
    const distanceDrift = Math.abs(freshDistance - storedDistance) > 50;
    // Ascent: anything more than 5m off matters because tiny diffs come
    // from ORS DEM updates, not from a real data gap.
    const ascentDrift = Math.abs(freshAscent - storedAscent) > 5;
    // Critical case: stored ascent is 0 but the route actually climbs.
    const ascentBackfill = storedAscent === 0 && freshAscent > 10;
    if (!distanceDrift && !ascentDrift && !ascentBackfill) return;

    const key = `${order.id}:${freshDistance}:${freshAscent}`;
    if (syncedRouteKeyRef.current === key) return;
    syncedRouteKeyRef.current = key;

    (async () => {
      try {
        const { data } = await api.post(`/orders/admin/${id}/recalculate-price/`, {
          route_summary: {
            distance: freshDistance,
            duration: Math.round(summary.durationSec || 0),
            ascent: freshAscent,
          },
        });
        // priceDraft is sticky once set (so admin-typed values aren't
        // clobbered by background refetches), so we explicitly overwrite
        // it with the freshly-computed value here. Without this, the
        // breakdown updates to the new total but the "Set Price" input
        // keeps showing the old number.
        if (data?.price !== null && data?.price !== undefined) {
          setPriceDraft(Math.round(Number(data.price)));
        }
        fetchOrder();
      } catch (e) {
        // Best-effort: a transient failure shouldn't block the admin
        // from using the page. Manual "Recalculate price" still works.
      }
    })();
    // We deliberately exclude `fetchOrder` and `id` from deps to avoid
    // re-runs from referential changes; the guard ref handles idempotency.
    // eslint-disable-next-line
  }, [order?.id, truckRoute?.summary?.distanceKm, truckRoute?.summary?.ascentM]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );
  if (!order) return <Empty description={t('adminOrderDetail.orderNotFound')} />;

  const isMobile = !screens.md;
  // Two-column layout kicks in once we have ≥ 1200 px window width
  // (AntD's `xl` breakpoint, the closest to the requested ~1100 px).
  const isWide = screens.xl;
  const TERMINAL_STATUSES = ['completed', 'rejected', 'cancelled'];
  const isTerminal = TERMINAL_STATUSES.includes(order.status);
  // With the new flow, `approved` means the customer has already accepted.
  const customerAccepted = ['approved', 'in_progress', 'completed'].includes(order.status);
  const awaitingAcceptance = order.status === 'offer_sent';
  const priceIsSet = order.price !== null && order.price !== undefined && Number(order.price) > 0;
  const priceDraftValid = priceDraft !== null && priceDraft !== undefined && priceDraft !== ''
    && Number.isFinite(Number(priceDraft)) && Number(priceDraft) > 0;
  // Admin hasn't sent the offer yet — "Send for Customer Approval" persists the
  // typed price itself, so a separate Save Price button would be redundant.
  const preOfferStatuses = ['new', 'under_review'];
  const showSavePriceButton = !preOfferStatuses.includes(order.status);
  // All four per-field verifications must be checked off before the admin
  // can send the offer. Mirrors the backend gate in AdminOrderUpdateSerializer.
  const allVerificationsChecked = (
    Boolean(order.admin_verified_service)
    && Boolean(order.admin_verified_vehicle)
    && Boolean(order.admin_verified_driver)
    && Boolean(order.admin_verified_price)
  );
  const readyToSendOffer = (
    order.status === 'under_review'
    && (priceIsSet || priceDraftValid)
    && Boolean(order.assigned_vehicle)
    && Boolean(order.assigned_driver)
    && allVerificationsChecked
  );
  // Forward-only lifecycle — mirrors Order.STATUS_PROGRESSION on the backend.
  // Reuses the same source-of-truth as the shared StatusStepper.
  const STATUS_PROGRESSION = STATUS_STEPS;
  const currentProgressionIdx = STATUS_PROGRESSION.indexOf(order.status);

  // Multi-stop orders keep their full route in `route_stops`; the flat
  // pickup_/destination_ fields only hold the first stop for legacy/list use.
  // (mapMarkers is memoized above the early returns — these copies keep the
  // `address` field that downstream UI needs.)
  const pickupStops = order.route_stops?.pickups?.length
    ? order.route_stops.pickups
    : (order.pickup_location ? [{ address: order.pickup_location, lat: order.pickup_lat, lng: order.pickup_lng }] : []);
  const destStops = order.route_stops?.destinations?.length
    ? order.route_stops.destinations
    : (order.destination_location ? [{ address: order.destination_location, lat: order.destination_lat, lng: order.destination_lng }] : []);

  // ─── Quick-actions helpers ────────────────────────────────────────────
  const customerEmail = order.user_detail?.email || '';
  const customerPhone = order.contact_phone || order.user_detail?.phone_number || '';
  const pickupAddress = pickupStops[0]?.address || '';
  const formatStopForMaps = (s) => {
    if (!s) return null;
    if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) return `${s.lat},${s.lng}`;
    return s.address ? encodeURIComponent(s.address) : null;
  };
  const mapsUrl = (() => {
    const origin = formatStopForMaps(pickupStops[0]);
    if (!origin) return null;
    const dest = formatStopForMaps(destStops[0]);
    if (!dest) return `https://www.google.com/maps/search/?api=1&query=${origin}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
  })();
  const handleCopyPickup = async () => {
    if (!pickupAddress) return;
    try {
      await navigator.clipboard.writeText(pickupAddress);
      message.success(t('adminOrderDetail.pickupCopied'));
    } catch {
      message.error(t('adminOrderDetail.copyFailed'));
    }
  };
  const handleDownloadCsv = async () => {
    try {
      const resp = await api.get(`/orders/admin/${id}/export/`, { responseType: 'blob' });
      const disposition = resp.headers?.['content-disposition'] || '';
      const match = /filename="?([^";]+)"?/.exec(disposition);
      const filename = match ? match[1] : `order_${id}.csv`;
      const url = window.URL.createObjectURL(resp.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error(t('adminOrders.exportFailed'));
    }
  };
  const goToCustomerOrders = () => {
    if (!order.user) return;
    const params = new URLSearchParams({ user_id: String(order.user) });
    const userName = order.user_detail?.full_name || order.contact_name || '';
    if (userName) params.set('user_name', userName);
    navigate(`/admin/orders?${params.toString()}`);
  };

  // ─── Next-step checklist ──────────────────────────────────────────────
  // Smooth-scroll a panel anchor into view; matches the IDs we set on the
  // assignment fields below so each unmet item is one click away.
  const scrollToAnchor = (anchorId) => {
    const el = document.getElementById(anchorId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const finalServiceAssigned = Boolean(order.final_service);
  const checklistItems = [
    {
      key: 'service',
      done: finalServiceAssigned,
      label: t(finalServiceAssigned ? 'adminOrderDetail.checklistServiceDone' : 'adminOrderDetail.checklistServiceTodo'),
      anchor: 'admin-final-service',
    },
    {
      key: 'vehicle',
      done: Boolean(order.assigned_vehicle),
      label: t(order.assigned_vehicle ? 'adminOrderDetail.checklistVehicleDone' : 'adminOrderDetail.checklistVehicleTodo'),
      anchor: 'admin-assign-vehicle',
    },
    {
      key: 'driver',
      done: Boolean(order.assigned_driver),
      label: t(order.assigned_driver ? 'adminOrderDetail.checklistDriverDone' : 'adminOrderDetail.checklistDriverTodo'),
      anchor: 'admin-assign-driver',
    },
    {
      key: 'price',
      done: priceIsSet,
      label: t(priceIsSet ? 'adminOrderDetail.checklistPriceDone' : 'adminOrderDetail.checklistPriceTodo'),
      anchor: 'admin-set-price',
    },
  ];
  const NEXT_STEP_BY_STATUS = {
    new: 'adminOrderDetail.nextStepNew',
    under_review: 'adminOrderDetail.nextStepUnderReview',
    offer_sent: 'adminOrderDetail.nextStepOfferSent',
    approved: 'adminOrderDetail.nextStepApproved',
    in_progress: 'adminOrderDetail.nextStepInProgress',
    completed: 'adminOrderDetail.nextStepCompleted',
  };
  const nextStepLabel = NEXT_STEP_BY_STATUS[order.status]
    ? t(NEXT_STEP_BY_STATUS[order.status])
    : null;
  // Show checklist only while preparing the offer; once the offer is sent
  // (or the order is terminal), the right-column alerts already convey
  // the next admin action.
  const showChecklist = !isTerminal && (order.status === 'new' || order.status === 'under_review');

  // ─── In-modal map state derived from the live edit form ───
  const editActiveList = editActiveStop.type === 'pickup' ? editPickupStops : editDestStops;
  const editActiveStopData = editActiveList[editActiveStop.index];
  const editActiveLat = editActiveStopData?.coords?.lat;
  const editActiveLng = editActiveStopData?.coords?.lng;
  const editActivePosition = (Number.isFinite(editActiveLat) && Number.isFinite(editActiveLng))
    ? [editActiveLat, editActiveLng]
    : null;
  const editExtraMarkers = [
    ...editPickupStops.map((s, i) => ({ stop: s, type: 'pickup', index: i })),
    ...editDestStops.map((s, i) => ({ stop: s, type: 'dest', index: i })),
  ]
    .filter((m) => Number.isFinite(m.stop.coords?.lat) && Number.isFinite(m.stop.coords?.lng)
      && !(m.type === editActiveStop.type && m.index === editActiveStop.index))
    .map((m) => ({
      position: [m.stop.coords.lat, m.stop.coords.lng],
      color: m.type === 'dest' ? 'red' : 'green',
    }));
  const handleMapPickEdit = ({ lat, lng, address }) => {
    updateEditStop(editActiveStop.type, editActiveStop.index, {
      text: address,
      coords: { lat, lng },
    });
  };

  // Route distance / duration computed by OSRM at order-creation time and
  // stored alongside the stops in `route_stops`. We mirror the customer-side
  // formatting from NewOrderFlow (km / m, h+m / m).
  const routeDistanceMeters = order.route_stops?.distance ?? null;
  const routeDurationSeconds = order.route_stops?.duration ?? null;
  const formatDistance = (meters) => (
    meters >= 1000
      ? `${(meters / 1000).toFixed(1)} ${t('newOrder.km')}`
      : `${Math.round(meters)} m`
  );
  const formatDuration = (seconds) => {
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.round((seconds % 3600) / 60);
      return `${hrs} ${t('newOrder.hr')} ${mins} ${t('newOrder.min')}`;
    }
    return `${Math.round(seconds / 60)} ${t('newOrder.min')}`;
  };

  const statusOptionsForOrder = buildStatusOptions(t)
    // Cancellation is customer-only.
    .filter((opt) => opt.value !== 'cancelled' || order.status === 'cancelled')
    // "New" is the entry state.
    .filter((opt) => opt.value !== 'new' || order.status === 'new')
    // "Accepted" is customer-only — admin uses "Send for Approval" to send the offer.
    .filter((opt) => opt.value !== 'approved' || order.status === 'approved')
    .map((opt) => {
      // Backward moves along the progression are blocked server-side.
      const targetIdx = STATUS_PROGRESSION.indexOf(opt.value);
      if (
        currentProgressionIdx >= 0
        && targetIdx >= 0
        && targetIdx < currentProgressionIdx
      ) {
        return { ...opt, disabled: true };
      }
      if (opt.value === 'in_progress' && !customerAccepted && order.status !== 'in_progress') {
        return { ...opt, disabled: true };
      }
      if (opt.value === 'offer_sent' && !priceIsSet && order.status !== 'offer_sent') {
        return { ...opt, disabled: true };
      }
      // Completion requires the job to be in progress first.
      if (opt.value === 'completed' && order.status !== 'in_progress' && order.status !== 'completed') {
        return { ...opt, disabled: true };
      }
      return opt;
    });

  const sectionStyle = {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  };

  const sectionHeaderStyle = {
    padding: isMobile ? '14px 16px' : '16px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  };

  const sectionTitleStyle = {
    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
    letterSpacing: '-0.02em', margin: 0,
  };

  // Fixed-bottom CTA only shown while the offer hasn't been sent yet — see
  // bar implementation just before the page closes. Reserve room for it so
  // the last section doesn't hide behind the bar.
  const showSendOfferBar = !isTerminal && (order.status === 'new' || order.status === 'under_review');

  // Extracted so the same JSX can render in either column of the flex layout
  // (between Order Info and Map on narrow viewports, or in the right column
  // on wide viewports) without duplicating ~470 lines of markup.
  const adminActionsSection = (
    <div style={{ ...sectionStyle, marginBottom: 0 }}>
      <div style={sectionHeaderStyle}>
        <SettingOutlined style={{ color: '#8b5cf6', fontSize: 15 }} />
        <Text style={sectionTitleStyle}>{t('adminOrderDetail.adminActions')}</Text>
      </div>
      <div style={{ padding: isMobile ? 16 : 24 }}>
        {isTerminal && (
          <Alert
            type="info"
            showIcon
            message={t('adminOrderDetail.lockedTitle')}
            description={t('adminOrderDetail.lockedDescription', {
              status: t(`status.${order.status}`),
            })}
            style={{ borderRadius: 10, marginBottom: 20 }}
          />
        )}
        {awaitingAcceptance && (
          <Alert
            type="warning"
            showIcon
            message={t('adminOrderDetail.offerSentTitle')}
            description={t('adminOrderDetail.offerSentDescription')}
            style={{ borderRadius: 10, marginBottom: 20 }}
          />
        )}

        {/* When customer has accepted, highlight the next logical step */}
        {order.status === 'approved' && (
          <div style={{
            background: 'linear-gradient(135deg, #10b98114 0%, #10b98120 100%)',
            borderRadius: 14, padding: isMobile ? '14px 16px' : '16px 20px',
            border: '1px solid #10b98140',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <CheckCircleOutlined style={{ color: '#10b981', fontSize: 22, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                letterSpacing: -0.1,
              }}>
                {t('adminOrderDetail.customerAccepted')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                {order.customer_accepted_at && t('adminOrderDetail.customerAcceptedAt', {
                  date: new Date(order.customer_accepted_at).toLocaleString(),
                })}
              </div>
            </div>
          </div>
        )}

        {/* Assign Service */}
        <div id="admin-final-service" style={{ marginBottom: 24, scrollMarginTop: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <TagOutlined style={{ color: 'var(--accent)', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.assignService')}
            </Text>
            {verifyToggle('service', isTerminal)}
          </div>
          <Select
            style={{ width: '100%', maxWidth: isMobile ? '100%' : 340 }}
            size={isMobile ? 'large' : 'middle'}
            value={order.final_service || undefined}
            placeholder={t('adminOrderDetail.selectFinalService')}
            onChange={handleCategoryChange}
            disabled={isTerminal}
            options={categories.map((c) => ({ value: c.id, label: localized(c.name) }))}
          />
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Assign Vehicle */}
        <div id="admin-assign-vehicle" style={{ marginBottom: 24, scrollMarginTop: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CarOutlined style={{ color: 'var(--accent)', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.assignVehicle')}
            </Text>
            {verifyToggle('vehicle', isTerminal)}
          </div>
          <Select
            style={{ width: '100%', maxWidth: isMobile ? '100%' : 340 }}
            size={isMobile ? 'large' : 'middle'}
            value={order.assigned_vehicle || undefined}
            placeholder={t('adminOrderDetail.selectVehicle')}
            allowClear
            showSearch
            // Search across name + plate + categories so admins can type
            // either "tow" or "AB-123-CD" and find what they expect.
            filterOption={(input, option) => {
              const needle = input.toLowerCase();
              return [option?.label, option?.categoriesText]
                .filter(Boolean)
                .some((s) => String(s).toLowerCase().includes(needle));
            }}
            onChange={handleVehicleAssign}
            disabled={isTerminal}
            options={vehicleOptions}
            optionRender={(option) => {
              const o = option.data || option;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: 600, color: 'var(--text-primary)',
                  }}>
                    <span>{o.vehicle?.name}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12, fontFamily: 'monospace' }}>
                      ({o.vehicle?.plate_number})
                    </span>
                    {o.matchesService && (
                      <CheckCircleOutlined style={{ color: '#10b981', fontSize: 12 }} />
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                    fontSize: 11,
                  }}>
                    {o.categoriesText && (
                      <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>
                        {o.categoriesText}
                      </Tag>
                    )}
                    {o.statusText && (
                      <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>
                        {o.statusText}
                      </Tag>
                    )}
                    {o.busy && (
                      <Tag color="red" style={{ margin: 0, fontSize: 10, lineHeight: '16px' }}>
                        {t('adminOrderDetail.vehicleBusy')}
                      </Tag>
                    )}
                  </div>
                </div>
              );
            }}
          />
          {order.assigned_vehicle_detail && (
            <div style={{
              marginTop: 10, padding: '12px 14px',
              background: 'var(--accent-bg)', borderRadius: 12,
              border: '1px solid var(--accent-bg-strong)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: 'var(--accent-bg-strong)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)', fontSize: 18, flexShrink: 0,
                }}>
                  <CarOutlined />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {order.assigned_vehicle_detail.name}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2,
                    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  }}>
                    {order.assigned_vehicle_detail.plate_number && (
                      <span>
                        {t('orders.plate')}:{' '}
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          color: 'var(--text-secondary)', letterSpacing: 0.5,
                        }}>
                          {order.assigned_vehicle_detail.plate_number}
                        </span>
                      </span>
                    )}
                    {order.assigned_vehicle_detail.status_display && (
                      <Tag style={{ margin: 0 }}>{order.assigned_vehicle_detail.status_display}</Tag>
                    )}
                  </div>
                </div>
              </div>

              {(() => {
                const seen = new Set();
                const imgs = [];
                if (order.assigned_vehicle_detail.image) {
                  imgs.push(order.assigned_vehicle_detail.image);
                  seen.add(order.assigned_vehicle_detail.image);
                }
                if (Array.isArray(order.assigned_vehicle_detail.images)) {
                  order.assigned_vehicle_detail.images.forEach((img) => {
                    if (img?.image && !seen.has(img.image)) {
                      imgs.push(img.image);
                      seen.add(img.image);
                    }
                  });
                }
                if (!imgs.length) return null;
                return (
                  <div style={{ marginTop: 10 }}>
                    <Image.PreviewGroup>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {imgs.map((src, i) => (
                          <Image
                            key={i} width={72} height={72} src={src}
                            style={{ objectFit: 'cover', borderRadius: 10 }}
                          />
                        ))}
                      </div>
                    </Image.PreviewGroup>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Assign Driver */}
        <div id="admin-assign-driver" style={{ marginBottom: 24, scrollMarginTop: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <UserOutlined style={{ color: 'var(--accent)', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.assignDriver')}
            </Text>
            {verifyToggle('driver', isTerminal)}
          </div>
          {!order.assigned_vehicle ? (
            <Alert
              type="info"
              showIcon
              message={t('adminOrderDetail.assignVehicleFirst')}
              style={{ borderRadius: 10 }}
            />
          ) : (
            <>
              <Select
                style={{ width: '100%', maxWidth: isMobile ? '100%' : 340 }}
                size={isMobile ? 'large' : 'middle'}
                value={order.assigned_driver || undefined}
                placeholder={t('adminOrderDetail.selectDriver')}
                allowClear
                showSearch
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                onChange={handleDriverAssign}
                disabled={isTerminal}
                options={eligibleDrivers.map((d) => ({
                  value: d.id,
                  label: `${d.full_name} — ${d.license_number}${d.is_busy ? ` · ${t('adminOrderDetail.driverBusy')}` : ''}`,
                  // Disable busy drivers (except the one already assigned)
                  // so admins can't pick a doomed assignment and only learn
                  // about the conflict at submit time.
                  disabled: d.is_busy && d.id !== order.assigned_driver,
                }))}
                notFoundContent={t('adminOrderDetail.noEligibleDrivers')}
              />
              {order.assigned_driver_detail && (
                <div style={{
                  marginTop: 10, padding: '12px 14px',
                  background: 'var(--accent-bg)', borderRadius: 12,
                  border: '1px solid var(--accent-bg-strong)',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  {order.assigned_driver_detail.photo ? (
                    <img
                      src={order.assigned_driver_detail.photo}
                      alt={order.assigned_driver_detail.full_name}
                      style={{
                        width: 52, height: 52, borderRadius: '50%',
                        objectFit: 'cover', flexShrink: 0,
                        border: '2px solid var(--card-bg)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
                    />
                  ) : (
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'var(--accent-bg-strong)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--accent)', fontSize: 20, flexShrink: 0,
                    }}>
                      <UserOutlined />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {order.assigned_driver_detail.full_name}
                    </div>
                    <div style={{
                      fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4,
                      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    }}>
                      {order.assigned_driver_detail.phone && (
                        <a
                          href={`tel:${order.assigned_driver_detail.phone}`}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            color: 'var(--accent)', fontWeight: 600, textDecoration: 'none',
                          }}
                        >
                          <PhoneOutlined style={{ fontSize: 11 }} />
                          {order.assigned_driver_detail.phone}
                        </a>
                      )}
                      {order.assigned_driver_detail.license_number && (
                        <span>· {order.assigned_driver_detail.license_number}</span>
                      )}
                      {order.assigned_driver_detail.license_categories && (
                        <Tag style={{ margin: 0 }}>{order.assigned_driver_detail.license_categories}</Tag>
                      )}
                      {order.assigned_driver_detail.status_display && (
                        <Tag style={{ margin: 0 }}>{order.assigned_driver_detail.status_display}</Tag>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Scheduled Window */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ClockCircleOutlined style={{ color: 'var(--accent)', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.scheduledWindow')}
            </Text>
          </div>
          <DatePicker.RangePicker
            style={{ width: '100%', maxWidth: isMobile ? '100%' : 420, borderRadius: 10 }}
            size={isMobile ? 'large' : 'middle'}
            showTime={{ format: 'HH:mm' }}
            format="YYYY-MM-DD HH:mm"
            value={scheduleDraft ?? scheduleSavedValue}
            // Keep the draft alive while the user is mid-pick so AntD's
            // controlled value matches the partial selection on screen.
            onCalendarChange={(dates) => setScheduleDraft(dates ?? [null, null])}
            onChange={(dates) => {
              // Clear icon → wipe both ends. Full range → persist. Partial
              // (one side filled) → keep the draft and wait for the user
              // to pick the other side.
              if (dates === null) {
                setScheduleDraft(null);
                handleScheduleChange(null);
                return;
              }
              const [from, to] = dates;
              if (from && to) {
                setScheduleDraft(null);
                handleScheduleChange(dates);
              }
            }}
            disabled={isTerminal}
          />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {t('adminOrderDetail.scheduleHint')}
          </div>
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Set Price */}
        <div id="admin-set-price" style={{ marginBottom: 24, scrollMarginTop: 80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <WalletOutlined style={{ color: '#10b981', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.setPrice')}
            </Text>
            {verifyToggle('price', isTerminal, { hideRequired: true })}
            {order.status === 'new' || order.status === 'under_review' ? (
              <Tag color="orange" style={{ margin: 0, borderRadius: 6 }}>
                {t('adminOrderDetail.priceRequiredTag')}
              </Tag>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <InputNumber
              style={{ width: isMobile ? '100%' : 200 }}
              size={isMobile ? 'large' : 'middle'}
              value={priceDraft ?? undefined}
              onChange={(val) => setPriceDraft(val === null || val === undefined ? null : Math.round(Number(val)))}
              min={0}
              step={10}
              precision={0}
              disabled={isTerminal}
              placeholder={t('adminOrderDetail.priceInputPlaceholder')}
              prefix={<span style={{ color: 'var(--text-tertiary)' }}>{currency.symbol}</span>}
            />
            {showSavePriceButton && (
              <Button
                onClick={handlePriceSave}
                disabled={isTerminal}
                size={isMobile ? 'large' : 'middle'}
                style={{
                  borderRadius: 10, fontWeight: 600,
                  border: '1px solid var(--border-color)',
                  ...(isMobile ? { width: '100%', height: 44 } : {}),
                }}
              >
                {t('adminOrderDetail.savePrice')}
              </Button>
            )}
            <Button
              icon={<ThunderboltOutlined />}
              loading={recalculatingPrice}
              disabled={isTerminal}
              onClick={handleRecalculatePrice}
              size={isMobile ? 'large' : 'middle'}
              style={{
                borderRadius: 10, fontWeight: 600,
                border: '1px solid var(--border-color)',
                color: 'var(--accent)',
                ...(isMobile ? { width: '100%', height: 44 } : {}),
              }}
            >
              {t('adminOrderDetail.recalculatePrice')}
            </Button>
          </div>
          {order.pricing_breakdown && (
            <PriceBreakdownPanel
              breakdown={order.pricing_breakdown}
              t={t}
              currency={currency}
              zones={zones}
              lang={lang}
            />
          )}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
            {showSavePriceButton ? t('adminOrderDetail.priceHint') : t('adminOrderDetail.priceHintPreOffer')}
          </div>
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Set Priority */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ThunderboltOutlined style={{ color: '#f59e0b', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.setPriority')}
            </Text>
          </div>
          <Select
            style={{ width: '100%', maxWidth: isMobile ? '100%' : 340 }}
            size={isMobile ? 'large' : 'middle'}
            value={order.urgency}
            onChange={handleUrgencyChange}
            disabled={isTerminal}
            options={[
              { value: 'low', label: t('urgency.low') },
              { value: 'normal', label: t('urgency.normal') },
              { value: 'high', label: t('urgency.high') },
              { value: 'urgent', label: t('urgency.urgent') },
            ]}
          />
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Change Status */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <SyncOutlined style={{ color: '#06b6d4', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.changeStatus')}
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Select
              style={{ width: isMobile ? '100%' : 200 }}
              size={isMobile ? 'large' : 'middle'}
              value={newStatus}
              onChange={setNewStatus}
              disabled={isTerminal}
              options={statusOptionsForOrder}
            />
            <Button
              type="primary"
              loading={updating}
              onClick={handleStatusChange}
              disabled={isTerminal}
              size={isMobile ? 'large' : 'middle'}
              style={{
                background: 'var(--accent)',
                borderColor: 'var(--accent)',
                borderRadius: 10,
                fontWeight: 600,
                ...(isMobile ? { width: '100%', height: 44 } : {}),
              }}
            >
              {t('adminOrderDetail.updateStatus')}
            </Button>
          </div>
          {awaitingAcceptance && (
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
              {t('adminOrderDetail.inProgressLockedHint')}
            </div>
          )}
        </div>

        <Divider style={{ borderColor: 'var(--border-color)' }} />

        {/* Admin Comment */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CommentOutlined style={{ color: '#f59e0b', fontSize: 14 }} />
            <Text style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {t('adminOrderDetail.adminCommentLabel')}
            </Text>
            {newStatus === 'rejected' && (
              <Tag color="red" style={{ margin: 0, borderRadius: 6 }}>
                {t('adminOrderDetail.required')}
              </Tag>
            )}
          </div>
          {newStatus === 'rejected' && (
            <Alert
              type="warning"
              showIcon
              message={t('adminOrderDetail.rejectCommentRequired')}
              style={{ borderRadius: 10, marginBottom: 10 }}
            />
          )}
          <TextArea
            rows={3}
            value={comment !== null ? comment : (order.admin_comment || '')}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('adminOrderDetail.addComment')}
            status={newStatus === 'rejected' && !(comment !== null ? comment : (order.admin_comment || '')).trim() ? 'error' : undefined}
            disabled={isTerminal}
            style={{ borderRadius: 10 }}
          />
          <Button
            onClick={handleCommentSave}
            disabled={isTerminal}
            style={{
              marginTop: 10, borderRadius: 10,
              fontWeight: 600, border: '1px solid var(--border-color)',
            }}
          >
            {t('adminOrderDetail.saveComment')}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        maxWidth: isWide ? 1280 : 920,
        margin: '0 auto',
        paddingBottom: showSendOfferBar ? (isMobile ? 160 : 120) : 0,
      }}
      className="page-enter"
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
        marginBottom: isMobile ? 16 : 24, flexWrap: 'wrap',
      }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/orders')}
          size={isMobile ? 'large' : 'middle'}
          style={{ borderRadius: 10, border: '1px solid var(--border-color)' }}
        >
          {isMobile ? '' : t('common.back')}
        </Button>
        <Title level={isMobile ? 4 : 3} style={{
          margin: 0, fontWeight: 800, letterSpacing: '-0.02em',
          color: 'var(--text-primary)', flex: isMobile ? 1 : 'initial', minWidth: 0,
        }}>
          {t('orders.orderDetail', { id: order.id })}
        </Title>
        <StatusBadge status={order.status} />
      </div>

      {/* Auto-promotion banner — fires for ~30s right after the admin's
          first GET silently flipped this order from new → under_review.
          The customer was notified by realtime push; clicking Undo
          reverts the status (deletes the auto history entry on the
          backend) so an accidental row-click doesn't permanently mark
          the order as in-review. */}
      {undoCountdown !== null && undoCountdown > 0 && (
        <div style={{
          marginBottom: isMobile ? 16 : 24,
          padding: isMobile ? '12px 14px' : '14px 18px',
          background: '#fffbeb',
          border: '1px solid #fcd34d',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <ExclamationCircleFilled style={{ color: '#f59e0b', fontSize: 18, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{
              fontWeight: 700, fontSize: 13, color: '#78350f',
            }}>
              {t('adminOrderDetail.autoPromotionTitle')}
            </div>
            <div style={{ fontSize: 12, color: '#92400e', marginTop: 2 }}>
              {t('adminOrderDetail.autoPromotionDescription')}
            </div>
          </div>
          <Button
            type="primary"
            size="small"
            danger
            loading={updating}
            onClick={handleUndoAutoPromotion}
            style={{ borderRadius: 8, fontWeight: 700 }}
          >
            {t('adminOrderDetail.undoAutoPromotion', { seconds: undoCountdown })}
          </Button>
          <Button
            type="text"
            size="small"
            onClick={dismissAutoPromotionBanner}
            style={{ color: '#92400e', borderRadius: 8 }}
          >
            {t('common.close')}
          </Button>
        </div>
      )}

      {/* Progression stepper — shows the same shape the customer sees,
          so admins can match the customer's mental model at a glance.
          Hidden on terminal states; rejected/cancelled don't fit the
          forward-only progression. */}
      {!isTerminal && STATUS_STEPS.includes(order.status) && (
        <div style={{
          marginBottom: isMobile ? 16 : 24,
          padding: isMobile ? '14px 16px' : '14px 20px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
        }}>
          <StatusStepper status={order.status} compact />
        </div>
      )}

      {/* Summary strip — surfaces the most-glanced facts (left) and the
          quick-action shortcuts (right). Wraps to two rows on narrow
          viewports so the actions stay tappable. */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: isMobile ? 8 : 12,
        marginBottom: isMobile ? 16 : 24,
        padding: isMobile ? '10px 14px' : '12px 18px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        fontSize: 13,
      }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          gap: isMobile ? 8 : 12, minWidth: 0,
        }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <UserOutlined style={{ color: 'var(--text-tertiary)' }} />
            <span style={{
              fontWeight: 600, color: 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {order.user_detail?.full_name || order.contact_name || '—'}
            </span>
          </div>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ClockCircleOutlined style={{ color: 'var(--text-tertiary)' }} />
            <span style={{ color: 'var(--text-primary)' }}>
              {order.requested_date || '—'}
              {order.requested_time && (
                <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>
                  {String(order.requested_time).slice(0, 5)}
                </span>
              )}
            </span>
          </div>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <WalletOutlined style={{ color: 'var(--text-tertiary)' }} />
            <span style={{
              fontWeight: 600,
              color: priceIsSet ? 'var(--accent)' : 'var(--text-tertiary)',
            }}>
              {priceIsSet
                ? `${currency.symbol}${Number(order.price).toLocaleString()}`
                : '—'}
            </span>
          </div>
        </div>
        <Space size={2} wrap>
          {customerPhone && (
            <Tooltip title={t('adminOrderDetail.callCustomer')}>
              <Button
                type="text"
                size="small"
                icon={<PhoneOutlined />}
                href={`tel:${customerPhone}`}
                style={{ color: 'var(--text-secondary)' }}
              />
            </Tooltip>
          )}
          {pickupAddress && (
            <Tooltip title={t('adminOrderDetail.copyPickup')}>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopyPickup}
                style={{ color: 'var(--text-secondary)' }}
              />
            </Tooltip>
          )}
          {mapsUrl && (
            <Tooltip title={t('adminOrderDetail.openInMaps')}>
              <Button
                type="text"
                size="small"
                icon={<EnvironmentOutlined />}
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-secondary)' }}
              />
            </Tooltip>
          )}
          {customerEmail && (
            <Tooltip title={t('adminOrderDetail.emailCustomer')}>
              <Button
                type="text"
                size="small"
                icon={<MailOutlined />}
                href={`mailto:${customerEmail}`}
                style={{ color: 'var(--text-secondary)' }}
              />
            </Tooltip>
          )}
          {order.user && (
            <Tooltip title={t('adminOrderDetail.viewCustomerOrders')}>
              <Button
                type="text"
                size="small"
                icon={<TeamOutlined />}
                onClick={goToCustomerOrders}
                style={{ color: 'var(--text-secondary)' }}
              />
            </Tooltip>
          )}
          <Tooltip title={t('adminOrderDetail.downloadCsv')}>
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownloadCsv}
              style={{ color: 'var(--text-secondary)' }}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Next-step checklist — replaces "scroll-and-hunt" with a single
          glance: what's the next action, and which fields still block it.
          Each missing item is clickable and scrolls to the matching input
          in the admin actions panel. Hidden once the offer is sent (the
          right-column alerts take over from there) and on terminal states. */}
      {showChecklist && nextStepLabel && (
        <div style={{
          marginBottom: isMobile ? 16 : 24,
          padding: isMobile ? '14px 16px' : '16px 20px',
          background: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderLeft: `4px solid ${readyToSendOffer ? 'var(--accent)' : '#f59e0b'}`,
          borderRadius: 12,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {t('adminOrderDetail.nextStep')}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>·</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              {nextStepLabel}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {checklistItems.map((item) => {
              const Wrapper = item.done ? 'div' : 'button';
              const wrapperProps = item.done
                ? {}
                : {
                  type: 'button',
                  onClick: () => scrollToAnchor(item.anchor),
                };
              return (
                <Wrapper
                  key={item.key}
                  {...wrapperProps}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: 'transparent',
                    border: 'none',
                    cursor: item.done ? 'default' : 'pointer',
                    textAlign: 'left',
                    color: 'inherit',
                    fontSize: 13,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={item.done ? undefined : (e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={item.done ? undefined : (e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {item.done
                    ? <CheckCircleOutlined style={{ color: '#10b981', fontSize: 15 }} />
                    : <ExclamationCircleFilled style={{ color: '#f59e0b', fontSize: 15 }} />}
                  <span style={{
                    flex: 1,
                    color: item.done ? 'var(--text-tertiary)' : 'var(--text-primary)',
                    textDecoration: item.done ? 'line-through' : 'none',
                    fontWeight: item.done ? 400 : 600,
                  }}>
                    {item.label}
                  </span>
                  {!item.done && <RightOutlined style={{ color: 'var(--text-tertiary)', fontSize: 11 }} />}
                </Wrapper>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-column section layout on wide screens. Outer flex stacks the
          left column (Order Info + Map + Images + History) next to the right
          column (Admin Actions). Each column sizes to its own content so the
          page scroll matches `max(left, right)` — no extra empty scroll past
          content. On narrow viewports the layout collapses to a single
          column and Admin Actions renders in JSX order via the `!isWide`
          guard inside the left column. */}
      <div style={{
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        alignItems: 'flex-start',
        gap: 20,
      }}>
      {/* Left column */}
      <div style={{
        flex: 1,
        minWidth: 0,
        width: isWide ? undefined : '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>

      {/* Order Info */}
      <div style={{
        ...sectionStyle,
        marginBottom: 0,
        ...(isWide ? { gridColumn: 1 } : {}),
      }}>
        <div style={{ ...sectionHeaderStyle, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <InfoCircleOutlined style={{ color: '#3b82f6', fontSize: 15 }} />
            <Text style={sectionTitleStyle}>{t('adminOrderDetail.orderInfo')}</Text>
            {order.admin_edited_at && (
              <Tag
                color="gold"
                onClick={() => scrollToAnchor('order-edit-history')}
                style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}
              >
                {t('adminOrderDetail.editedByAdminTag')}
                {order.edit_history?.length > 0 && (
                  <span style={{ marginLeft: 4 }}>· {order.edit_history.length}</span>
                )}
              </Tag>
            )}
          </div>
          {!isTerminal && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={openEditModal}
              style={{ borderRadius: 8 }}
            >
              {t('adminOrderDetail.editDetails')}
            </Button>
          )}
        </div>
        <div style={{ padding: isMobile ? 16 : 24 }}>

          {/* Customer */}
          <div style={{ paddingBottom: 18, borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
            }}>
              <UserOutlined style={{ color: '#3b82f6', fontSize: 13 }} />
              {t('adminOrderDetail.customer')}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0,
              }}>
                {(order.user_detail?.full_name || '?').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                  {order.user_detail?.full_name || '—'}
                </div>
                {order.user_detail?.email && (
                  <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {order.user_detail.email}
                  </div>
                )}
                {((order.contact_name && order.contact_name !== order.user_detail?.full_name) || order.contact_phone) && (
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: '1px dashed var(--border-color)',
                    display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13,
                  }}>
                    {order.contact_name && order.contact_name !== order.user_detail?.full_name && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <UserOutlined style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
                        <span style={{ color: 'var(--text-tertiary)' }}>{t('orders.contact')}:</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{order.contact_name}</span>
                      </div>
                    )}
                    {order.contact_phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PhoneOutlined style={{ color: 'var(--text-tertiary)', fontSize: 12 }} />
                        <a href={`tel:${order.contact_phone}`} style={{ color: 'var(--accent)', fontWeight: 500 }}>
                          {order.contact_phone}
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service */}
          <div style={{ padding: '18px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
            }}>
              <TagOutlined style={{ color: 'var(--accent)', fontSize: 13 }} />
              {t('adminOrders.service')}
            </div>
            <div style={{ fontSize: 15 }}>
              {(() => {
                const finalName = localized(order.final_service_detail?.name || order.final_category_detail?.name);
                const selectedName = localized(order.selected_service_detail?.name || order.selected_category_detail?.name);
                const suggestedName = localized(order.suggested_service_detail?.name || order.suggested_category_detail?.name);
                const primary = finalName || selectedName;
                if (!primary) return '—';
                const showOverride = finalName && selectedName && finalName !== selectedName;
                const showSuggested = suggestedName
                  && suggestedName !== finalName
                  && suggestedName !== selectedName;
                return (
                  <>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{primary}</span>
                    {showOverride && (
                      <span style={{ color: 'var(--text-tertiary)' }}>{' → '}{selectedName}</span>
                    )}
                    {showSuggested && (
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                        {t('newOrder.suggested')} {suggestedName}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Route */}
          <div style={{ padding: '18px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14,
            }}>
              <EnvironmentOutlined style={{ color: '#10b981', fontSize: 13 }} />
              {t('newOrder.route')}
            </div>

            <div style={{
              position: 'relative', paddingLeft: 22,
              marginBottom: destStops.length ? 16 : 0,
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 5, width: 12, height: 12,
                borderRadius: '50%', background: '#10b981',
                boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.18)',
              }} />
              {destStops.length > 0 && (
                <div style={{
                  position: 'absolute', left: 5, top: 19, bottom: -16,
                  width: 2, background: 'var(--border-color)',
                }} />
              )}
              <div style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {t('orders.pickup')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                {pickupStops.map((s, i) => (
                  <div key={i} style={{ marginTop: i === 0 ? 0 : 8 }}>
                    <div>
                      {pickupStops.length > 1 && (
                        <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>{i + 1}.</span>
                      )}
                      {s.address || '—'}
                    </div>
                    {(s.contact_name || s.contact_phone) && (
                      <div style={{
                        marginTop: 3, display: 'flex', flexWrap: 'wrap',
                        alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)',
                      }}>
                        <UserOutlined style={{ fontSize: 11, color: 'var(--text-tertiary)' }} />
                        {s.contact_name && <span>{s.contact_name}</span>}
                        {s.contact_phone && (
                          <a href={`tel:${s.contact_phone}`} style={{ color: 'var(--accent)' }}>
                            {s.contact_phone}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {destStops.length > 0 && (
              <div style={{ position: 'relative', paddingLeft: 22 }}>
                <div style={{
                  position: 'absolute', left: 0, top: 5, width: 12, height: 12,
                  borderRadius: '50%', background: '#ef4444',
                  boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.18)',
                }} />
                <div style={{
                  fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>
                  {t('orders.destination')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>
                  {destStops.map((s, i) => (
                    <div key={i} style={{ marginTop: i === 0 ? 0 : 8 }}>
                      <div>
                        {destStops.length > 1 && (
                          <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>{i + 1}.</span>
                        )}
                        {s.address || '—'}
                      </div>
                      {(s.contact_name || s.contact_phone) && (
                        <div style={{
                          marginTop: 3, display: 'flex', flexWrap: 'wrap',
                          alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)',
                        }}>
                          <UserOutlined style={{ fontSize: 11, color: 'var(--text-tertiary)' }} />
                          {s.contact_name && <span>{s.contact_name}</span>}
                          {s.contact_phone && (
                            <a href={`tel:${s.contact_phone}`} style={{ color: 'var(--accent)' }}>
                              {s.contact_phone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {routeDistanceMeters != null && (
              <div style={{
                marginTop: 14, padding: '10px 14px',
                background: 'var(--bg-secondary)', borderRadius: 10,
                display: 'inline-flex', alignItems: 'center', gap: 10,
                fontSize: 13,
              }}>
                <span style={{
                  color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {t('newOrder.routeDistance')}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatDistance(routeDistanceMeters)}
                </span>
                {routeDurationSeconds != null && (
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    · ~ {formatDuration(routeDurationSeconds)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Schedule */}
          <div style={{ padding: '18px 0', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
            }}>
              <ClockCircleOutlined style={{ color: '#f59e0b', fontSize: 13 }} />
              {t('adminOrderDetail.schedule')}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
            }}>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                }}>
                  {t('orders.date')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {order.requested_date || '—'}
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                }}>
                  {t('orders.time')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {order.requested_time ? String(order.requested_time).slice(0, 5) : '—'}
                </div>
              </div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
                }}>
                  {t('adminOrders.urgencyLabel')}
                </div>
                <UrgencyBadge urgency={order.urgency} />
              </div>
            </div>
          </div>

          {/* Details (description / cargo / user note) */}
          {(order.description || order.cargo_details || order.user_note
            || order.cargo_insured || order.cargo_insurance) && (
            <div style={{ padding: '18px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
              }}>
                <CommentOutlined style={{ color: '#8b5cf6', fontSize: 13 }} />
                {t('adminOrderDetail.details')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {order.description && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      {t('orders.description')}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {order.description}
                    </div>
                  </div>
                )}
                {order.cargo_details && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      {t('newOrder.cargoDetails')}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {order.cargo_details}
                    </div>
                  </div>
                )}
                {order.cargo_insured && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      {t('newOrder.cargoInsured')}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {t('common.yes')}
                    </div>
                  </div>
                )}
                {order.cargo_insurance && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      {t('newOrder.insuranceRequested')}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {t('common.yes')}
                    </div>
                  </div>
                )}
                {order.user_note && (
                  <div>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      {t('newOrder.notes')}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {order.user_note}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps footer */}
          <div style={{
            paddingTop: 16, fontSize: 11, color: 'var(--text-tertiary)',
            display: 'flex', flexWrap: 'wrap', gap: 14,
          }}>
            <span>{t('adminOrderDetail.created')}: {new Date(order.created_at).toLocaleString()}</span>
            <span>·</span>
            <span>{t('adminOrderDetail.updated')}: {new Date(order.updated_at).toLocaleString()}</span>
          </div>

        </div>
      </div>

      {!isWide && adminActionsSection}

      {/* Map */}
      {mapMarkers.length > 0 && (
        <div style={{
          ...sectionStyle,
          marginBottom: 0,
          ...(isWide ? { gridColumn: 1 } : {}),
        }}>
          <div style={sectionHeaderStyle}>
            <EnvironmentOutlined style={{ color: '#10b981', fontSize: 15 }} />
            <Text style={sectionTitleStyle}>{t('adminOrderDetail.locationMap')}</Text>
          </div>
          <div style={{ padding: 0 }}>
            <MapView
              height={260}
              markers={mapMarkers}
              routePoints={truckRoute.points}
              steepnessSegments={truckRoute.steepnessSegments}
            />
          </div>
          {routeWaypoints.length >= 2 && (truckRoute.summary || truckRoute.loading || truckRoute.error) && (
            <div style={{ padding: isMobile ? 16 : 24, paddingTop: 12 }}>
              <ElevationProfile {...truckRoute} />
            </div>
          )}
        </div>
      )}

      {/* Images */}
      {order.images?.length > 0 && (
        <div style={{
          ...sectionStyle,
          marginBottom: 0,
          ...(isWide ? { gridColumn: 1 } : {}),
        }}>
          <div style={sectionHeaderStyle}>
            <PictureOutlined style={{ color: 'var(--accent)', fontSize: 15 }} />
            <Text style={sectionTitleStyle}>{t('adminOrderDetail.uploadedImages')}</Text>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <Image.PreviewGroup>
              <Space wrap size={12}>
                {order.images.map((img) => (
                  <Image
                    key={img.id}
                    width={120}
                    height={120}
                    src={img.image}
                    style={{ objectFit: 'cover', borderRadius: 12 }}
                  />
                ))}
              </Space>
            </Image.PreviewGroup>
          </div>
        </div>
      )}

      {/* Edit History — per-field log of admin edits to customer-supplied
          fields. Scrolled-to from the "Edited by admin" tag in the Order
          Info header so admins can audit what changed without diffing the
          status history. Hidden when nothing has been edited yet. */}
      {order.edit_history?.length > 0 && (
        <div
          id="order-edit-history"
          style={{
            ...sectionStyle,
            marginBottom: 0,
            scrollMarginTop: 80,
            ...(isWide ? { gridColumn: 1 } : {}),
          }}
        >
          <div style={sectionHeaderStyle}>
            <EditOutlined style={{ color: '#f59e0b', fontSize: 15 }} />
            <Text style={sectionTitleStyle}>{t('adminOrderDetail.editHistory')}</Text>
            <Tag style={{ margin: 0, fontSize: 11 }}>{order.edit_history.length}</Tag>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {order.edit_history.map((h) => {
                const fieldLabel = t(`adminOrderDetail.editField.${h.field_name}`);
                // t() returns the dotted key when missing — fall back to
                // the raw field name in that case so we don't display
                // "adminOrderDetail.editField.foo" verbatim.
                const niceField = (fieldLabel && !fieldLabel.startsWith('adminOrderDetail.editField'))
                  ? fieldLabel
                  : h.field_name;
                return (
                  <div
                    key={h.id}
                    style={{
                      padding: '10px 12px',
                      background: 'var(--bg-secondary)',
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', flexWrap: 'wrap', gap: 8,
                      marginBottom: 6,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                        {niceField}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {h.changed_by_name && <>{h.changed_by_name} · </>}
                        {new Date(h.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      flexWrap: 'wrap', fontSize: 12,
                    }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 6,
                        background: '#ef444414', color: '#dc2626',
                        textDecoration: 'line-through',
                        maxWidth: '100%', overflowWrap: 'anywhere',
                      }}>
                        {h.old_value || <em style={{ opacity: 0.6 }}>{t('common.empty')}</em>}
                      </span>
                      <RightOutlined style={{ color: 'var(--text-tertiary)', fontSize: 10 }} />
                      <span style={{
                        padding: '2px 8px', borderRadius: 6,
                        background: '#10b98114', color: '#059669',
                        fontWeight: 600,
                        maxWidth: '100%', overflowWrap: 'anywhere',
                      }}>
                        {h.new_value || <em style={{ opacity: 0.6 }}>{t('common.empty')}</em>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Status History */}
      {order.status_history?.length > 0 && (
        <div style={{
          ...sectionStyle,
          marginBottom: 0,
          ...(isWide ? { gridColumn: 1 } : {}),
        }}>
          <div style={sectionHeaderStyle}>
            <HistoryOutlined style={{ color: '#06b6d4', fontSize: 15 }} />
            <Text style={sectionTitleStyle}>{t('orders.statusHistory')}</Text>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <Timeline
              items={order.status_history.map((h) => ({
                color: STATUS_CONFIG[h.new_status]?.color || 'gray',
                children: (
                  <div>
                    <div style={{ marginBottom: 4 }}>
                      <StatusBadge status={h.new_status} />
                      {h.old_status && (
                        <Text style={{
                          color: 'var(--text-tertiary)', fontSize: 12, marginLeft: 6,
                        }}>
                          {t('status.' + h.old_status)}
                        </Text>
                      )}
                    </div>
                    {h.changed_by_name && (
                      <Text style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block' }}>
                        {h.changed_by_name}
                      </Text>
                    )}
                    {h.comment && (
                      <div style={{
                        padding: '6px 10px', background: 'var(--bg-secondary)',
                        borderRadius: 8, marginTop: 4, fontSize: 12,
                        color: 'var(--text-secondary)',
                      }}>
                        {h.comment}
                      </div>
                    )}
                    <Text style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4, display: 'block' }}>
                      {new Date(h.created_at).toLocaleString()}
                    </Text>
                  </div>
                ),
              }))}
            />
          </div>
        </div>
      )}

      </div>{/* /left column */}

      {isWide && (
        <div style={{ width: 380, flexShrink: 0 }}>
          {adminActionsSection}
        </div>
      )}

      </div>{/* /outer flex */}

      {/* Edit Details Modal */}
      <Modal
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleEditSave}
        // Defer the map mount until the open animation finishes; tear it
        // down again on close so it remounts fresh next time.
        afterOpenChange={(open) => setEditMapReady(open)}
        title={t('adminOrderDetail.editDetails')}
        okText={t('adminOrderDetail.saveEdits')}
        cancelText={t('common.cancel')}
        confirmLoading={editSaving}
        width={isMobile ? '100%' : 680}
        // Cap body height so the embedded map doesn't push the OK/Cancel
        // footer below the fold. Title + footer stay anchored.
        styles={{ body: { maxHeight: 'calc(85vh - 110px)', overflowY: 'auto', paddingRight: 8 } }}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Pickups */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              {t('newOrder.pickupFrom')}
            </Text>
            {editPickupStops.map((stop, idx) => {
              const isActive = editActiveStop.type === 'pickup' && editActiveStop.index === idx;
              return (
                <div
                  key={`edit-pickup-${idx}`}
                  onClick={() => setEditActiveStop({ type: 'pickup', index: idx })}
                  style={{
                    display: 'flex', gap: 8, marginBottom: 8,
                    padding: 4, borderRadius: 10,
                    background: isActive ? 'var(--accent-bg)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <LocationAutocomplete
                    value={stop.text}
                    confirmed={!!stop.coords}
                    onChange={(val) => updateEditStop('pickup', idx, { text: val, coords: null })}
                    onSelect={({ address, lat, lng }) => updateEditStop('pickup', idx, { text: address, coords: { lat, lng } })}
                    placeholder={editPickupStops.length > 1 ? `${t('newOrder.pickupFrom')} #${idx + 1}` : t('newOrder.pickupFrom')}
                    countryCode="ge"
                    style={{ flex: 1 }}
                  />
                  {editPickupStops.length > 1 && (
                    <Button
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); removeEditStop('pickup', idx); }}
                      danger
                    />
                  )}
                </div>
              );
            })}
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => addEditStop('pickup')}
              type="dashed"
              block
            >
              {t('newOrder.addPickupStop')}
            </Button>
          </div>

          {/* Destinations */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>
              {t('orders.destination')}
            </Text>
            {editDestStops.map((stop, idx) => {
              const isActive = editActiveStop.type === 'dest' && editActiveStop.index === idx;
              return (
                <div
                  key={`edit-dest-${idx}`}
                  onClick={() => setEditActiveStop({ type: 'dest', index: idx })}
                  style={{
                    display: 'flex', gap: 8, marginBottom: 8,
                    padding: 4, borderRadius: 10,
                    background: isActive ? '#ef44441a' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <LocationAutocomplete
                    value={stop.text}
                    confirmed={!!stop.coords}
                    onChange={(val) => updateEditStop('dest', idx, { text: val, coords: null })}
                    onSelect={({ address, lat, lng }) => updateEditStop('dest', idx, { text: address, coords: { lat, lng } })}
                    placeholder={editDestStops.length > 1 ? `${t('orders.destination')} #${idx + 1}` : t('orders.destination')}
                    countryCode="ge"
                    style={{ flex: 1 }}
                  />
                  <Button
                    icon={<DeleteOutlined />}
                    onClick={(e) => { e.stopPropagation(); removeEditStop('dest', idx); }}
                    danger
                  />
                </div>
              );
            })}
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => addEditStop('dest')}
              type="dashed"
              block
            >
              {t('newOrder.addDestStop')}
            </Button>
          </div>

          {/* Map picker — admins can drop a pin on the map for the active stop.
              Tabs above the map switch which stop the next click updates. */}
          {(editPickupStops.length > 0 || editDestStops.length > 0) && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                {t('adminOrderDetail.locationMap')}
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {editPickupStops.map((_, idx) => {
                  const isActive = editActiveStop.type === 'pickup' && editActiveStop.index === idx;
                  return (
                    <button
                      key={`edit-pickup-tab-${idx}`}
                      type="button"
                      onClick={() => setEditActiveStop({ type: 'pickup', index: idx })}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <EnvironmentOutlined style={{ marginRight: 4, fontSize: 11 }} />
                      {editPickupStops.length > 1
                        ? `${t('newOrder.pickupMap')} ${idx + 1}`
                        : t('newOrder.pickupMap')}
                    </button>
                  );
                })}
                {editDestStops.map((_, idx) => {
                  const isActive = editActiveStop.type === 'dest' && editActiveStop.index === idx;
                  return (
                    <button
                      key={`edit-dest-tab-${idx}`}
                      type="button"
                      onClick={() => setEditActiveStop({ type: 'dest', index: idx })}
                      style={{
                        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: isActive ? '#ef4444' : 'var(--bg-tertiary)',
                        color: isActive ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <EnvironmentOutlined style={{ marginRight: 4, fontSize: 11 }} />
                      {editDestStops.length > 1
                        ? `${t('newOrder.destinationMap')} ${idx + 1}`
                        : t('newOrder.destinationMap')}
                    </button>
                  );
                })}
              </div>
              {editMapReady ? (
                <MapPicker
                  position={editActivePosition}
                  onSelect={handleMapPickEdit}
                  height={isMobile ? 240 : 320}
                  markerColor={editActiveStop.type === 'dest' ? 'red' : 'green'}
                  placeholder={editActiveStop.type === 'dest'
                    ? t('newOrder.tapDestination')
                    : t('newOrder.tapPickup')}
                  extraMarkers={editExtraMarkers}
                />
              ) : (
                // Map placeholder during the modal's open animation.
                <div style={{
                  height: isMobile ? 240 : 320,
                  borderRadius: 12,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                }} />
              )}
            </div>
          )}

          {/* Date + Time */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('adminOrderDetail.requestedDate')}
              </Text>
              <DatePicker
                value={editDate}
                onChange={setEditDate}
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('orders.time')}
              </Text>
              <TimePicker
                value={editTime}
                onChange={setEditTime}
                style={{ width: '100%' }}
                format="HH:mm"
              />
            </div>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('orders.contact')}
              </Text>
              <Input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
                {t('auth.phone')}
              </Text>
              <Input value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} />
            </div>
          </div>

          {/* Urgency */}
          <div>
            <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('adminOrders.urgencyLabel')}
            </Text>
            <Select
              value={editUrgency}
              onChange={setEditUrgency}
              style={{ width: '100%' }}
              options={[
                { value: 'low', label: t('urgency.low') },
                { value: 'normal', label: t('urgency.normal') },
                { value: 'high', label: t('urgency.high') },
                { value: 'urgent', label: t('urgency.urgent') },
              ]}
            />
          </div>

          {/* Description */}
          <div>
            <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('orders.description')}
            </Text>
            <TextArea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
          </div>

          {/* Cargo details */}
          <div>
            <Text style={{ display: 'block', marginBottom: 4, fontSize: 12, color: 'var(--text-tertiary)' }}>
              {t('newOrder.cargoDetails')}
            </Text>
            <TextArea value={editCargoDetails} onChange={(e) => setEditCargoDetails(e.target.value)} rows={2} />
          </div>
        </div>
      </Modal>

      {/* ── Sticky Send-for-Customer-Approval CTA ── */}
      {showSendOfferBar && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: isMobile ? 0 : 'var(--admin-sidebar-width, 0px)',
          right: 0,
          zIndex: 99,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid var(--glass-border)',
          paddingBottom: isMobile ? 62 : 0,
        }}>
          <div style={{
            margin: '0 auto',
            maxWidth: 1200,
            padding: isMobile ? '14px 16px' : '20px 40px',
            paddingBottom: isMobile
              ? 'calc(14px + env(safe-area-inset-bottom, 0px))'
              : 'calc(20px + env(safe-area-inset-bottom, 0px))',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
                letterSpacing: -0.1,
              }}>
                {t('adminOrderDetail.sendForApproval')}
              </div>
              <div style={{
                fontSize: 12,
                color: readyToSendOffer ? 'var(--text-tertiary)' : '#d97706',
                marginTop: 2,
              }}>
                {readyToSendOffer
                  ? t('adminOrderDetail.sendForApprovalContent')
                  : (priceIsSet || priceDraftValid) && order.assigned_vehicle && order.assigned_driver
                    ? (() => {
                        const missing = [
                          !order.admin_verified_service && t('adminOrderDetail.fieldService'),
                          !order.admin_verified_vehicle && t('adminOrderDetail.fieldVehicle'),
                          !order.admin_verified_driver && t('adminOrderDetail.fieldDriver'),
                          !order.admin_verified_price && t('adminOrderDetail.fieldPrice'),
                        ].filter(Boolean);
                        return t('adminOrderDetail.missingVerificationsList', {
                          fields: missing.join(', '),
                        });
                      })()
                    : t('adminOrderDetail.missingForOffer')}
              </div>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<SendOutlined />}
              loading={updating}
              disabled={!readyToSendOffer}
              onClick={handleSendOffer}
              style={{
                height: 52, borderRadius: 14, fontWeight: 700, fontSize: 15,
                background: readyToSendOffer ? 'var(--accent)' : undefined,
                borderColor: readyToSendOffer ? 'var(--accent)' : undefined,
                minWidth: 220,
                boxShadow: readyToSendOffer ? '0 4px 14px rgba(0, 184, 86, 0.28)' : 'none',
                ...(isMobile ? { width: '100%' } : {}),
              }}
            >
              {t('adminOrderDetail.sendForApproval')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Price breakdown panel ────────────────────────────────────────────────
// Reads the audit log stored on Order.pricing_breakdown and renders a
// compact summary so admins can see exactly how the auto-computed price
// was derived. Tolerates the error shape ({mode, error}) emitted when the
// engine couldn't produce a price.
function PriceBreakdownPanel({ breakdown, t, currency, zones = [], lang = 'en' }) {
  if (!breakdown) return null;
  const symbol = currency?.symbol || '₾';
  // Resolve a zone slug to its localized display name. Falls back to the
  // slug if zones haven't loaded or the slug no longer matches any zone
  // (e.g. the admin deleted/renamed it after the order was priced).
  const zoneLabel = (slug) => {
    if (!slug) return '—';
    const z = zones.find((zz) => zz.slug === slug);
    if (!z) return slug;
    const name = z.name;
    if (!name) return slug;
    if (typeof name === 'string') return name;
    return name[lang] || name.en || name.ka || name.ru || slug;
  };
  const fmt = (v) => {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
  };
  const card = {
    marginTop: 12, padding: '12px 14px', borderRadius: 10,
    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
    fontSize: 12, color: 'var(--text-secondary)',
  };
  if (breakdown.error) {
    return (
      <div style={{ ...card, borderColor: '#fcd34d', background: '#fffbeb' }}>
        <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
          {t('adminOrderDetail.pricingBreakdown')}
        </div>
        <div>{t(`adminOrderDetail.pricingError_${breakdown.error}`) || breakdown.error}</div>
      </div>
    );
  }
  // Tints mirror the Calculator's ResultRow so admins can find the same
  // five numbers (Total, VAT, Company Fee, Driver Gross, Driver VAT) at
  // a glance regardless of which page they're on.
  const HIGHLIGHT_BG = {
    yellow: 'rgba(234, 179, 8, 0.12)',
    green:  'rgba(16, 185, 129, 0.12)',
    red:    'rgba(239, 68, 68, 0.12)',
    orange: 'rgba(249, 115, 22, 0.12)',
  };
  const Row = ({ label, value, highlight }) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: highlight ? '6px 8px' : '4px 0',
      borderRadius: highlight ? 6 : 0,
      background: highlight ? HIGHLIGHT_BG[highlight] : 'transparent',
      borderBottom: highlight ? 'none' : '1px solid var(--border-light)',
    }}>
      <span>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  );
  return (
    <div style={card}>
      <div style={{
        fontWeight: 700, color: 'var(--text-primary)', fontSize: 13,
        marginBottom: 8, display: 'flex', justifyContent: 'space-between',
      }}>
        <span>{t('adminOrderDetail.pricingBreakdown')}</span>
        <span style={{ fontWeight: 500, color: 'var(--text-tertiary)' }}>
          {t(`adminOrderDetail.pricingMode_${breakdown.mode}`) || breakdown.mode}
        </span>
      </div>
      {breakdown.mode === 'fixed' && (
        <>
          <Row label={t('adminOrderDetail.pricingBase')} value={fmt(breakdown.base)} />
          <Row label={t('adminOrderDetail.daysMultiplier')} value={`× ${breakdown.days_multiplier}`} />
          {Number(breakdown.floor_surcharge) > 0 && (
            <Row label={t('adminOrderDetail.floorSurcharge')} value={fmt(breakdown.floor_surcharge)} />
          )}
          <Row label={t('adminOrderDetail.pricingTotal')} value={fmt(breakdown.total)} />
        </>
      )}
      {breakdown.mode === 'calculator' && (
        <>
          <Row label={t('adminPricing.type')} value={breakdown.type} />
          <Row label={t('adminPricing.zone')} value={zoneLabel(breakdown.zone)} />
          <Row label={t('adminPricing.weightKg')}
            value={
              (breakdown.effective_weight_kg != null
                && Number(breakdown.effective_weight_kg) !== Number(breakdown.weight_kg))
                ? `${(Number(breakdown.effective_weight_kg) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} T `
                  + `(${t('adminPricing.minWeightApplied')}; `
                  + `${(Number(breakdown.weight_kg) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} T)`
                : `${(Number(breakdown.weight_kg) / 1000).toLocaleString(undefined, { maximumFractionDigits: 3 })} T`
            } />
          <Row label={t('adminPricing.distanceKm')}
            value={`${Number(breakdown.distance_km).toFixed(2)} km`} />
          <Row label={t('adminPricing.elevationM')}
            value={`${Math.round(Number(breakdown.elevation_m) || 0)} m`} />
          {breakdown.breakdown?.total_revenue && (
            <Row label={t('adminPricing.totalRevenue')}
              value={fmt(breakdown.breakdown.total_revenue)} highlight="yellow" />
          )}
          {/* VAT — informational only, computed as total × rate from
              PricingConfig.vat. Doesn't feed Company Fee or Driver Gross. */}
          {breakdown.breakdown?.vat !== undefined && (
            <Row label={t('adminPricing.vat')}
              value={fmt(breakdown.breakdown.vat)} highlight="red" />
          )}
          {breakdown.breakdown?.company_fee !== undefined && (
            <Row label={t('adminPricing.companyFee')}
              value={fmt(breakdown.breakdown.company_fee)} highlight="orange" />
          )}
          {breakdown.breakdown?.driver_gross !== undefined && (
            <Row label={t('adminPricing.driverGross')}
              value={fmt(breakdown.breakdown.driver_gross)} highlight="green" />
          )}
          {/* Driver VAT — informational. Rate comes from the assigned
              driver (18% default, 1% if vat_18_percent=false on the
              driver). Legacy breakdowns won't have this field; hide. */}
          {breakdown.breakdown?.driver_vat !== undefined && (
            <Row label={t('adminPricing.driverVat')}
              value={fmt(breakdown.breakdown.driver_vat)} highlight="red" />
          )}
          <Row label={t('adminOrderDetail.daysMultiplier')} value={`× ${breakdown.days_multiplier}`} />
          {Number(breakdown.floor_surcharge) > 0 && (
            <Row label={t('adminOrderDetail.floorSurcharge')} value={fmt(breakdown.floor_surcharge)} />
          )}
          <Row label={t('adminOrderDetail.pricingTotal')} value={fmt(breakdown.total)} />
        </>
      )}
    </div>
  );
}
