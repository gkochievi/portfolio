import React, { useCallback, useEffect, useState } from 'react';
import { Spin, Image, Button, Modal, message, Grid, Input } from 'antd';
import {
  ArrowLeftOutlined, EnvironmentOutlined, CalendarOutlined,
  ClockCircleOutlined, UserOutlined, PhoneOutlined,
  CloseCircleOutlined, CarOutlined, CheckCircleOutlined,
  FileTextOutlined, CameraOutlined, InboxOutlined, HistoryOutlined,
  WalletOutlined, EditOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import { useLang } from '../../contexts/LanguageContext';
import { useBranding } from '../../contexts/BrandingContext';
import { DEFAULT_CURRENCY } from '../../utils/currency';
import { useRealtimeRefresh, useNotifications } from '../../contexts/NotificationContext';
import { MapView } from '../../components/map/MapPicker';
import { CategoryImage } from '../../utils/categoryIcons';
import { getStatusLabel } from '../../utils/status';
import StatusStepper, { STATUS_BADGE_COLORS } from '../../components/common/StatusStepper';
import useTruckRoute from '../../hooks/useTruckRoute';

const { useBreakpoint } = Grid;

// Statuses where a price has been offered and should be visible to the customer.
const PRICE_VISIBLE_STATUSES = ['offer_sent', 'approved', 'in_progress', 'completed'];

export default function AppOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();
  const { currency = DEFAULT_CURRENCY } = useBranding();
  const localized = (v) => {
    if (!v) return '';
    if (typeof v === 'string') return v;
    return v[lang] || v['en'] || '';
  };
  const screens = useBreakpoint();
  const isDesktop = screens.md;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const { refresh: refreshNotifications } = useNotifications();

  const fetchOrder = useCallback(({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    return api.get(`/orders/${id}/`).then(({ data }) => {
      setOrder(data);
      refreshNotifications();
    })
      .catch(() => { if (!silent) message.error(t('orders.orderDetail', { id })); })
      .finally(() => { if (!silent) setLoading(false); });
  }, [id, t, refreshNotifications]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  useRealtimeRefresh(useCallback(() => {
    fetchOrder({ silent: true });
  }, [fetchOrder]));

  // Truck-aware route waypoints. Computed before any early-return so the
  // useTruckRoute hook is called unconditionally (Rules of Hooks).
  const routeWaypoints = (() => {
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
  })();
  const truckRoute = useTruckRoute(routeWaypoints);

  const handleCancel = () => {
    setCancelReason('');
    setCancelOpen(true);
  };

  const submitCancel = async () => {
    // Mirror the backend rule so the customer gets immediate feedback
    // instead of a round-trip 400. Backend still enforces the same minimum.
    const trimmed = cancelReason.trim();
    if (trimmed.length < 10) {
      message.warning(t('orders.cancelReasonTooShort'));
      return;
    }
    setCancelling(true);
    try {
      await api.post(`/orders/${id}/cancel/`, { reason: trimmed });
      message.success(t('orders.orderCancelledMsg'));
      setCancelOpen(false);
      fetchOrder();
    } catch (err) {
      message.error(err.response?.data?.detail || t('orders.failedCancel'));
    } finally {
      setCancelling(false);
    }
  };

  const handleAcceptOffer = async () => {
    // Single tap — no confirm dialog. The button itself acts as confirmation;
    // double-checking on every accept added friction without preventing
    // mistakes (the customer already saw the price + admin's offer card).
    try {
      await api.post(`/orders/${id}/accept/`);
      message.success(t('orders.offerAcceptedMsg'));
      fetchOrder();
    } catch (err) {
      message.error(err.response?.data?.detail || t('orders.failedAccept'));
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) return null;

  const isCancelled = order.status === 'cancelled';
  const isRejected = order.status === 'rejected';
  const isTerminal = isCancelled || isRejected;
  const statusColor = STATUS_BADGE_COLORS[order.status] || '#8e93ab';
  const priceValue = order.price !== null && order.price !== undefined && Number(order.price) > 0
    ? Number(order.price)
    : null;
  const showPrice = priceValue !== null && PRICE_VISIBLE_STATUSES.includes(order.status);
  const awaitingPrice = !showPrice && ['new', 'under_review'].includes(order.status);
  // `approved` now means the customer has already accepted the offer.
  const accepted = order.status === 'approved' || order.status === 'in_progress'
    || order.status === 'completed' || Boolean(order.customer_accepted_at);
  const canAcceptOffer = order.status === 'offer_sent' && priceValue !== null;

  const pickupStops = order.route_stops?.pickups?.length
    ? order.route_stops.pickups
    : (order.pickup_location ? [{ address: order.pickup_location, lat: order.pickup_lat, lng: order.pickup_lng }] : []);
  const destStops = order.route_stops?.destinations?.length
    ? order.route_stops.destinations
    : (order.destination_location ? [{ address: order.destination_location, lat: order.destination_lat, lng: order.destination_lng }] : []);
  const hasDest = destStops.length > 0;

  const mapMarkers = [
    ...pickupStops.filter(s => s.lat && s.lng).map(s => ({ position: [s.lat, s.lng], color: 'green' })),
    ...destStops.filter(s => s.lat && s.lng).map(s => ({ position: [s.lat, s.lng], color: 'red' })),
  ];

  return (
    <div style={{ minHeight: '100vh', paddingBottom: order.is_cancellable ? 100 : 40, maxWidth: 1200, margin: '0 auto' }} className="app-bg page-enter">
      {/* ── Hero Header ── */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div onClick={() => navigate('/app/orders')} style={{
              width: 44, height: 44, borderRadius: 14, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 17, color: '#fff',
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(8px)',
              transition: 'all 0.2s ease',
            }}>
              <ArrowLeftOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1.2 }}>
                {t('orders.detailsTitle')}
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: 500 }}>
                {new Date(order.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Status chip */}
          <div style={{
            marginTop: 22,
            background: 'rgba(255,255,255,0.13)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 18,
            padding: '14px 18px',
            border: '1px solid rgba(255,255,255,0.16)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: statusColor,
              boxShadow: `0 0 0 4px ${statusColor}40`,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {t('orders.status') || 'Status'}
              </div>
              <div style={{ fontSize: 15, color: '#fff', fontWeight: 700, marginTop: 2, letterSpacing: -0.1 }}>
                {getStatusLabel(t, order.status, { isCustomer: true }) || order.status}
              </div>
            </div>
            {localized((order.selected_service_detail || order.selected_category_detail)?.name) && (
              <div style={{
                padding: '6px 12px', borderRadius: 10,
                background: 'rgba(255,255,255,0.18)',
                fontSize: 12, fontWeight: 600, color: '#fff',
                whiteSpace: 'nowrap',
              }}>
                {localized((order.selected_service_detail || order.selected_category_detail)?.name)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: isDesktop ? '32px 40px 48px' : '24px 20px 48px' }}>
        {/* ── Admin edited banner ── */}
        {order.admin_edited_at && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12, marginBottom: 16,
            background: 'rgba(217, 119, 6, 0.1)',
            border: '1px solid rgba(217, 119, 6, 0.35)',
            color: '#b45309', fontSize: 13, fontWeight: 500,
          }}>
            <EditOutlined style={{ fontSize: 14 }} />
            <span>
              {t('orders.editedByAdmin', {
                date: new Date(order.admin_edited_at).toLocaleString(),
              })}
            </span>
          </div>
        )}

        {/* ── Status Progress Tracker ── */}
        {!isTerminal && (
          <ConfirmSection delay={0.05} icon={<HistoryOutlined />} title={t('orders.orderProgress')}>
            <StatusStepper status={order.status} isCustomer />
          </ConfirmSection>
        )}

        {/* ── Price offer ── */}
        {showPrice && (
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-bg) 0%, var(--accent-bg-strong) 100%)',
            borderRadius: 18, padding: isDesktop ? '24px 28px' : '20px',
            marginBottom: isDesktop ? 24 : 16,
            border: '1px solid var(--accent-bg-strong)',
            display: 'flex', alignItems: 'center', gap: 16,
            animation: 'fadeInUp 0.4s ease-out 0.08s both',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 22, flexShrink: 0,
              boxShadow: '0 6px 18px rgba(0, 184, 86, 0.25)',
            }}>
              <WalletOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                {t('orders.priceOffered')}
              </div>
              <div style={{
                fontSize: isDesktop ? 28 : 24, fontWeight: 800,
                color: 'var(--text-primary)', marginTop: 4, letterSpacing: -0.5,
              }}>
                {currency.symbol}{Math.round(priceValue).toLocaleString()}
              </div>
              {order.status === 'offer_sent' && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                  {t('orders.priceAcceptHint')}
                </div>
              )}
              {accepted && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  marginTop: 6, padding: '4px 10px', borderRadius: 999,
                  background: 'var(--accent-bg-strong)', color: 'var(--accent)',
                  fontSize: 12, fontWeight: 700,
                }}>
                  <CheckCircleOutlined style={{ fontSize: 12 }} />
                  {t('orders.offerAccepted')}
                  {order.customer_accepted_at && (
                    <span style={{ fontWeight: 500, opacity: 0.8 }}>
                      · {new Date(order.customer_accepted_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {awaitingPrice && (
          <div style={{
            background: 'var(--bg-tertiary)',
            borderRadius: 18, padding: '16px 20px',
            marginBottom: isDesktop ? 24 : 16,
            border: '1px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <WalletOutlined style={{ fontSize: 18, color: 'var(--text-tertiary)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                {t('orders.awaitingPrice')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {t('orders.awaitingPriceHint')}
              </div>
            </div>
          </div>
        )}

        {/* ── Terminal state banner ── */}
        {isTerminal && (
          <div style={{
            background: isRejected ? 'var(--danger-bg)' : 'var(--bg-tertiary)',
            borderRadius: 18, padding: '28px 24px', marginBottom: 24,
            border: isRejected ? '1px solid var(--danger-border)' : '1px solid var(--border-color)',
            textAlign: 'center',
            animation: 'fadeInUp 0.4s ease-out both',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
              background: isRejected ? '#ef444414' : 'var(--badge-muted-bg)',
            }}>
              <CloseCircleOutlined style={{
                fontSize: 32,
                color: isRejected ? '#ef4444' : 'var(--text-tertiary)',
              }} />
            </div>
            <div style={{
              fontSize: 18, fontWeight: 800,
              color: isRejected ? '#ef4444' : 'var(--text-secondary)',
              letterSpacing: -0.3,
            }}>
              {isRejected ? t('orders.orderRejected') : t('orders.orderCancelled')}
            </div>
            {order.admin_comment && (
              <div style={{
                fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10,
                lineHeight: 1.5, maxWidth: 360, margin: '10px auto 0',
              }}>
                {order.admin_comment}
              </div>
            )}
          </div>
        )}

        {/* ── Service Type ── */}
        <ConfirmSection delay={0.1} icon={<InboxOutlined />} title={t('newOrder.serviceType')}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 12,
            background: 'var(--accent-bg)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--accent-bg-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, color: 'var(--accent)',
            }}>
              <CategoryImage
                imageUrl={(order.selected_service_detail || order.selected_category_detail)?.image_url}
                icon={(order.selected_service_detail || order.selected_category_detail)?.icon || 'inbox'}
                size={(order.selected_service_detail || order.selected_category_detail)?.image_url ? 44 : 28}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {localized((order.selected_service_detail || order.selected_category_detail)?.name) || '—'}
              </div>
              {(order.final_service_detail || order.final_category_detail)?.name && (
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  <CheckCircleOutlined style={{ marginRight: 4, fontSize: 11 }} />
                  {t('orders.assigned')}: {localized((order.final_service_detail || order.final_category_detail).name)}
                </div>
              )}
            </div>
          </div>
        </ConfirmSection>

        {/* ── Description ── */}
        {order.description && (
          <ConfirmSection delay={0.15} icon={<FileTextOutlined />} title={t('orders.description')}>
            <div style={{
              fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6,
              padding: '4px 0',
            }}>
              {order.description}
            </div>
            {order.cargo_details && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10,
                paddingTop: 10, borderTop: '1px solid var(--border-light)',
              }}>
                <InfoChip label={t('newOrder.cargoDetails')} value={order.cargo_details} />
              </div>
            )}
            {(order.cargo_insured || order.cargo_insurance) && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10,
                paddingTop: 10, borderTop: '1px solid var(--border-light)',
              }}>
                {order.cargo_insured && (
                  <InfoChip label={t('newOrder.cargoInsured')} value={t('common.yes')} />
                )}
                {order.cargo_insurance && (
                  <InfoChip label={t('newOrder.insuranceRequested')} value={t('common.yes')} />
                )}
              </div>
            )}
          </ConfirmSection>
        )}

        {/* ── Route ── */}
        {(pickupStops.length > 0 || destStops.length > 0) && (
          <ConfirmSection delay={0.2} icon={<EnvironmentOutlined />} title={hasDest ? t('newOrder.route') : t('newOrder.workLocation')}>
            {pickupStops.map((stop, idx) => (
              <div key={`p-${idx}`} style={{
                display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: hasDest ? '#10b98114' : 'var(--accent-bg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <EnvironmentOutlined style={{
                    color: hasDest ? 'var(--success-color)' : 'var(--accent)', fontSize: 14,
                  }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {hasDest
                      ? (pickupStops.length > 1 ? `${t('orders.pickup')} ${idx + 1}` : t('orders.pickup'))
                      : t('orders.location')}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2, wordBreak: 'break-word' }}>
                    {stop.address || stop.text || '—'}
                  </div>
                </div>
              </div>
            ))}

            {destStops.map((stop, idx) => (
              <div key={`d-${idx}`} style={{
                display: 'flex', gap: 12, alignItems: 'center',
                marginBottom: idx < destStops.length - 1 ? 10 : 0,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: '#ef444414',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <EnvironmentOutlined style={{ color: '#ef4444', fontSize: 14 }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {destStops.length > 1 ? `${t('orders.destination')} ${idx + 1}` : t('orders.destination')}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 500, marginTop: 2, wordBreak: 'break-word' }}>
                    {stop.address || stop.text || '—'}
                  </div>
                </div>
              </div>
            ))}

            {order.route_stops?.distance && (
              <div style={{
                marginTop: 12, paddingTop: 12,
                borderTop: '1px solid var(--border-light)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <CarOutlined style={{ color: 'var(--accent)', fontSize: 15 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {order.route_stops.distance >= 1000
                    ? `${(order.route_stops.distance / 1000).toFixed(1)} ${t('newOrder.km')}`
                    : `${Math.round(order.route_stops.distance)} m`}
                </span>
                {order.route_stops.duration && (
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    ~ {order.route_stops.duration >= 3600
                      ? `${Math.floor(order.route_stops.duration / 3600)} ${t('newOrder.hr')} ${Math.round((order.route_stops.duration % 3600) / 60)} ${t('newOrder.min')}`
                      : `${Math.round(order.route_stops.duration / 60)} ${t('newOrder.min')}`}
                  </span>
                )}
              </div>
            )}

            {/* Map */}
            {mapMarkers.length > 0 && (
              <div style={{
                marginTop: 14,
                borderRadius: 12, overflow: 'hidden',
                border: '1px solid var(--border-light)',
              }}>
                <MapView
                  height={isDesktop ? 280 : 200}
                  markers={mapMarkers}
                  routePoints={truckRoute.points}
                  steepnessSegments={truckRoute.steepnessSegments}
                />
              </div>
            )}
          </ConfirmSection>
        )}

        {/* ── Schedule ── */}
        <ConfirmSection delay={0.25} icon={<CalendarOutlined />} title={t('newOrder.when')}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {t('orders.date')}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
                {order.requested_date || '—'}
              </div>
            </div>
            {order.requested_time && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                  {t('orders.time')}
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 3 }}>
                  <ClockCircleOutlined style={{ marginRight: 6, fontSize: 13, color: 'var(--text-tertiary)' }} />
                  {order.requested_time}
                </div>
              </div>
            )}
          </div>
        </ConfirmSection>

        {/* ── Contact ── */}
        <ConfirmSection delay={0.3} icon={<UserOutlined />} title={t('newOrder.contactPerson')}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {t('orders.contact')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 3 }}>
                {order.contact_name || '—'}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {t('auth.phone')}
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginTop: 3 }}>
                <PhoneOutlined style={{ marginRight: 6, fontSize: 12, color: 'var(--text-tertiary)' }} />
                {order.contact_phone || '—'}
              </div>
            </div>
          </div>
        </ConfirmSection>

        {/* ── Your transport team (approved onward, once admin has assigned) ── */}
        {PRICE_VISIBLE_STATUSES.includes(order.status)
          && (order.assigned_vehicle_detail || order.assigned_driver_detail) && (
          <ConfirmSection delay={0.35} icon={<CarOutlined />} title={t('orders.yourTeam')}>
            {order.assigned_driver_detail && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px', borderRadius: 14,
                background: 'var(--accent-bg)',
                marginBottom: order.assigned_vehicle_detail ? 12 : 0,
              }}>
                {order.assigned_driver_detail.photo ? (
                  <img
                    src={order.assigned_driver_detail.photo}
                    alt={order.assigned_driver_detail.full_name}
                    style={{
                      width: 56, height: 56, borderRadius: '50%', objectFit: 'cover',
                      flexShrink: 0, border: '2px solid var(--card-bg)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    }}
                  />
                ) : (
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'var(--accent-bg-strong)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)', fontSize: 22, flexShrink: 0,
                  }}>
                    <UserOutlined />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: 0.3,
                  }}>
                    {t('orders.driver')}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
                    marginTop: 2, letterSpacing: -0.1,
                  }}>
                    {order.assigned_driver_detail.full_name}
                  </div>
                  {order.assigned_driver_detail.phone && (
                    <a
                      href={`tel:${order.assigned_driver_detail.phone}`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        marginTop: 6, padding: '5px 12px', borderRadius: 999,
                        background: 'var(--accent)', color: '#fff',
                        fontSize: 12, fontWeight: 600, textDecoration: 'none',
                      }}
                    >
                      <PhoneOutlined style={{ fontSize: 11 }} />
                      {order.assigned_driver_detail.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {order.assigned_vehicle_detail && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 12,
                  background: 'var(--bg-tertiary)',
                }}>
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
                    {order.assigned_vehicle_detail.plate_number && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {t('orders.plate')}:{' '}
                        <span style={{
                          fontFamily: 'monospace', fontWeight: 700,
                          color: 'var(--text-secondary)', letterSpacing: 0.5,
                        }}>
                          {order.assigned_vehicle_detail.plate_number}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {(() => {
                  const seen = new Set();
                  const vehicleImages = [];
                  if (order.assigned_vehicle_detail.image) {
                    vehicleImages.push(order.assigned_vehicle_detail.image);
                    seen.add(order.assigned_vehicle_detail.image);
                  }
                  if (Array.isArray(order.assigned_vehicle_detail.images)) {
                    order.assigned_vehicle_detail.images.forEach((img) => {
                      if (img?.image && !seen.has(img.image)) {
                        vehicleImages.push(img.image);
                        seen.add(img.image);
                      }
                    });
                  }
                  if (!vehicleImages.length) return null;
                  return (
                    <div style={{ marginTop: 12 }}>
                      <div style={{
                        fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8,
                      }}>
                        {t('orders.vehiclePhotos')}
                      </div>
                      <Image.PreviewGroup>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {vehicleImages.map((src, i) => (
                            <Image
                              key={i} width={84} height={84} src={src}
                              style={{ objectFit: 'cover', borderRadius: 12 }}
                            />
                          ))}
                        </div>
                      </Image.PreviewGroup>
                    </div>
                  );
                })()}
              </div>
            )}
          </ConfirmSection>
        )}

        {/* ── Admin comment (non-terminal) ── */}
        {order.admin_comment && !isTerminal && (
          <ConfirmSection delay={0.4} icon={<FileTextOutlined />} title={t('orders.adminComment')}>
            <div style={{
              fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6,
              background: '#f59e0b10', borderRadius: 12, padding: '12px 14px',
              border: '1px solid #f59e0b25',
            }}>
              {order.admin_comment}
            </div>
          </ConfirmSection>
        )}

        {/* ── Photos ── */}
        {order.images?.length > 0 && (
          <ConfirmSection delay={0.45} icon={<CameraOutlined />} title={t('orders.photos')}>
            <Image.PreviewGroup>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {order.images.map((img) => (
                  <Image key={img.id} width={84} height={84} src={img.image}
                    style={{ objectFit: 'cover', borderRadius: 12 }} />
                ))}
              </div>
            </Image.PreviewGroup>
          </ConfirmSection>
        )}

        {/* ── Status history ── */}
        {order.status_history?.length > 0 && (
          <ConfirmSection delay={0.5} icon={<HistoryOutlined />} title={t('orders.statusHistory')}>
            <div style={{ position: 'relative' }}>
              {order.status_history.map((h, i) => {
                const dotColor = STATUS_BADGE_COLORS[h.new_status] || 'var(--text-placeholder)';
                const isLast = i === order.status_history.length - 1;
                return (
                  <div key={i} style={{
                    display: 'flex', gap: 14,
                    paddingBottom: isLast ? 0 : 20,
                    // Stretch columns so the dot column spans the full row
                    // height — otherwise the line stops at minHeight and
                    // leaves a visible gap before the next entry.
                    alignItems: 'stretch',
                    position: 'relative',
                  }}>
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      flexShrink: 0, width: 20,
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: dotColor,
                        border: '2px solid var(--card-bg)',
                        boxShadow: `0 0 0 2px ${dotColor}30`,
                        flexShrink: 0, zIndex: 1,
                      }} />
                      {!isLast && (
                        <div style={{
                          width: 2, flex: 1, minHeight: 24,
                          background: 'var(--border-color)',
                          marginTop: 4,
                          // Extend the line through the row's bottom padding
                          // so it meets the top of the next dot with no gap.
                          marginBottom: -20,
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, paddingBottom: isLast ? 0 : 4 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                        lineHeight: 1.2, letterSpacing: -0.1,
                      }}>
                        {getStatusLabel(t, h.new_status, { isCustomer: true }) || h.new_status}
                      </div>
                      {h.comment && (
                        <div style={{
                          fontSize: 12, color: 'var(--text-secondary)', marginTop: 6,
                          lineHeight: 1.5,
                        }}>
                          {h.comment}
                        </div>
                      )}
                      <div style={{
                        fontSize: 11, color: 'var(--text-placeholder)', marginTop: 6,
                      }}>
                        {new Date(h.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ConfirmSection>
        )}
      </div>

      {/* ── Cancel/Reject Modal — reason is required (min 10 chars) ── */}
      <Modal
        title={order.status === 'offer_sent' ? t('orders.rejectOfferConfirm') : t('orders.cancelConfirm')}
        open={cancelOpen}
        onOk={submitCancel}
        onCancel={() => setCancelOpen(false)}
        okText={order.status === 'offer_sent' ? t('orders.yesReject') : t('orders.yesCancel')}
        cancelText={t('common.back')}
        okButtonProps={{
          danger: true,
          loading: cancelling,
          disabled: cancelReason.trim().length < 10,
        }}
        confirmLoading={cancelling}
        destroyOnClose
      >
        <p style={{ marginTop: 0 }}>
          {order.status === 'offer_sent' ? t('orders.rejectOfferWarning') : t('orders.cancelWarning')}
        </p>
        <div style={{ marginTop: 12, marginBottom: 28 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 6,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {t('orders.cancelReasonLabel')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {cancelReason.length} / 500
            </span>
          </div>
          <Input.TextArea
            rows={3}
            maxLength={500}
            placeholder={t('orders.cancelReasonPlaceholder')}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div style={{
            marginTop: 6, fontSize: 12,
            color: cancelReason.trim().length < 10
              ? 'var(--danger-color, #ef4444)'
              : 'var(--text-tertiary)',
          }}>
            {t('orders.cancelReasonMinHint')}
          </div>
        </div>
      </Modal>

      {/* ── Sticky Cancel CTA ── */}
      {order.is_cancellable && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid var(--glass-border)',
        }}>
          <div style={{
            margin: '0 auto', maxWidth: 1200,
            padding: isDesktop ? '20px 40px' : '16px 20px',
            paddingBottom: isDesktop
              ? 'calc(20px + env(safe-area-inset-bottom, 0px))'
              : 'calc(16px + env(safe-area-inset-bottom, 0px))',
          }}>
            {canAcceptOffer ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <Button
                  danger onClick={handleCancel}
                  icon={<CloseCircleOutlined />}
                  style={{
                    flex: 1, height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700,
                    boxShadow: 'none',
                  }}
                >
                  {t('orders.rejectOffer')}
                </Button>
                <Button
                  type="primary" onClick={handleAcceptOffer}
                  icon={<CheckCircleOutlined />}
                  style={{
                    flex: 1, height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700,
                    background: 'var(--accent)', borderColor: 'var(--accent)',
                    boxShadow: '0 4px 14px rgba(0, 184, 86, 0.28)',
                  }}
                >
                  {t('orders.acceptOffer')}
                </Button>
              </div>
            ) : (
              <Button
                danger block onClick={handleCancel}
                icon={<CloseCircleOutlined />}
                style={{
                  height: 52, borderRadius: 14, fontSize: 15, fontWeight: 700,
                  boxShadow: 'none',
                }}
              >
                {t('orders.cancelOrder')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


function ConfirmSection({ children, delay = 0, icon, title }) {
  const screens = Grid.useBreakpoint();
  const isDesktop = screens.md;
  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: 18,
      padding: isDesktop ? '32px 32px' : '22px 20px',
      marginBottom: isDesktop ? 24 : 16, boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--border-color)',
      animation: `fadeInUp 0.4s ease-out ${delay}s both`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 16, paddingBottom: 12,
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'var(--accent-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'var(--accent)',
        }}>
          {icon}
        </div>
        <span style={{
          fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
          letterSpacing: 0.2, textTransform: 'uppercase',
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
      <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}:</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}
