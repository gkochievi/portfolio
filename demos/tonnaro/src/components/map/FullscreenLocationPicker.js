import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LeftOutlined, CompassOutlined, LoadingOutlined, AimOutlined } from '@ant-design/icons';
import { useLang } from '../../contexts/LanguageContext';
// DEMO: pin images come from the bundle rather than cdnjs. See src/demo/markers.js.
import { DEFAULT_ICON } from '../../demo/markers';

// Fix default marker icon issue with webpack — only needed if we ever add
// real Markers, but harmless to keep in sync with the rest of the codebase.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions(DEFAULT_ICON);

const GEORGIA_CENTER = [41.7151, 44.8271]; // Tbilisi — better default than country centroid
const DEFAULT_ZOOM = 13;
const PIN_DROP_ZOOM = 16;

const isValidLatLng = (p) =>
  Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);

// ── helpers ─────────────────────────────────────────────────────────────
async function reverseGeocode(lat, lng, language) {
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lng),
    zoom: '18',
    addressdetails: '1',
  });
  if (language) params.set('accept-language', language);
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!res.ok) throw new Error('reverse geocode failed');
  return res.json();
}

function shortAddressFrom(data) {
  const addr = data?.address || {};
  const parts = [];
  const road = addr.road || addr.pedestrian || addr.path || '';
  const houseNumber = addr.house_number || '';
  const city = addr.city || addr.town || addr.village || addr.municipality || '';
  if (road) parts.push(houseNumber ? `${road} ${houseNumber}` : road);
  if (city) parts.push(city);
  return parts.length > 0 ? parts.join(', ') : data?.display_name || '';
}

// ── inner: tracks the map view, reports the visible center back to the parent
function CenterTracker({ onCenterChange }) {
  const map = useMap();

  // Initial sync — the parent may have started us at a pinned position; surface
  // the center after the container has its real dimensions.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        map.invalidateSize();
        const c = map.getCenter();
        if (c) onCenterChange({ lat: c.lat, lng: c.lng });
      } catch { /* container gone */ }
    }, 220);
    return () => clearTimeout(id);
  }, [map]); // eslint-disable-line

  useMapEvents({
    moveend(e) {
      const c = e.target.getCenter();
      if (c) onCenterChange({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

function MapFlyTo({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (
      flyTo &&
      Number.isFinite(flyTo.lat) &&
      Number.isFinite(flyTo.lng) &&
      Number.isFinite(flyTo.zoom)
    ) {
      try {
        map.flyTo([flyTo.lat, flyTo.lng], flyTo.zoom, { duration: 1.0 });
      } catch { /* not ready */ }
    }
  }, [flyTo, map]);
  return null;
}

/**
 * Full-screen, Bolt/Yandex-style location picker.
 *
 * The crosshair pin is a CSS overlay anchored at the exact map center —
 * the user pans the map under it instead of dragging a marker. On every
 * `moveend` the new center is reverse-geocoded (debounced ~400 ms) and
 * the result is shown in the sticky bottom sheet. Confirm hands the
 * `{lat, lng, address}` back to the caller.
 *
 * Why not a draggable marker?
 *  - On mobile, a fixed crosshair with a pannable map is much easier to
 *    aim with one thumb; you don't have to "grab" anything.
 *  - The visual reference stays stable while the world moves under it,
 *    matching the mental model users already have from Bolt/Yandex Go/Uber.
 */
export default function FullscreenLocationPicker({
  open,
  title,
  initialPosition,      // { lat, lng } | null
  markerColor = 'green', // 'green' | 'red' — affects the pin tint
  onCancel,
  onConfirm,
}) {
  const { lang, t } = useLang();
  const [center, setCenter] = useState(() => {
    if (initialPosition && Number.isFinite(initialPosition.lat) && Number.isFinite(initialPosition.lng)) {
      return { lat: initialPosition.lat, lng: initialPosition.lng };
    }
    return { lat: GEORGIA_CENTER[0], lng: GEORGIA_CENTER[1] };
  });
  const [address, setAddress] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef(null);
  const lastResolvedRef = useRef({ lat: null, lng: null });

  // Reset state whenever the picker opens — otherwise stale address from a
  // previous session would briefly flash before the first geocode resolves.
  useEffect(() => {
    if (!open) return;
    setAddress('');
    setGeoLoading(false);
    if (initialPosition && Number.isFinite(initialPosition.lat) && Number.isFinite(initialPosition.lng)) {
      setCenter({ lat: initialPosition.lat, lng: initialPosition.lng });
      setFlyTo({ lat: initialPosition.lat, lng: initialPosition.lng, zoom: PIN_DROP_ZOOM });
    } else {
      setCenter({ lat: GEORGIA_CENTER[0], lng: GEORGIA_CENTER[1] });
      // try to recenter on the user's location if they allowed geolocation
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              setFlyTo({ lat, lng, zoom: PIN_DROP_ZOOM });
            }
          },
          () => { /* denied — fine */ },
          { timeout: 4000, enableHighAccuracy: false }
        );
      }
    }
  }, [open]); // eslint-disable-line

  const updateAddressForCenter = useCallback((next) => {
    // Skip redundant calls for the same point (e.g. tap-without-drag fires moveend).
    if (
      lastResolvedRef.current.lat === next.lat &&
      lastResolvedRef.current.lng === next.lng
    ) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setGeoLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await reverseGeocode(next.lat, next.lng, lang);
        const short = shortAddressFrom(data) || `${next.lat.toFixed(5)}, ${next.lng.toFixed(5)}`;
        setAddress(short);
        lastResolvedRef.current = next;
      } catch {
        setAddress(`${next.lat.toFixed(5)}, ${next.lng.toFixed(5)}`);
        lastResolvedRef.current = next;
      } finally {
        setGeoLoading(false);
      }
    }, 400);
  }, [lang]);

  const handleCenterChange = useCallback((next) => {
    setCenter(next);
    updateAddressForCenter(next);
  }, [updateAddressForCenter]);

  const handleLocateMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setFlyTo({ lat, lng, zoom: PIN_DROP_ZOOM });
        }
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const handleConfirm = () => {
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return;
    onConfirm({
      lat: center.lat,
      lng: center.lng,
      address: address || `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`,
    });
  };

  if (!open) return null;

  const accent = markerColor === 'red' ? '#ef4444' : 'var(--accent)';
  const pinShadow = markerColor === 'red' ? '#ef444466' : '#f9731666';

  // Portal to document.body so the sheet escapes any ancestor stacking
  // context (the order form has glass-blur sticky elements that would
  // otherwise trap it underneath the sticky bottom CTA).
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <style>{`
        @keyframes mapPickerBackdropFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes mapPickerSheetIn {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
      {/* Dim backdrop so the rounded top corners read against something
          darker than the page underneath. Tapping the backdrop dismisses
          the picker, matching the rest of the sheet pattern. */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 1999,
          background: 'rgba(0, 0, 0, 0.4)',
          animation: 'mapPickerBackdropFadeIn 200ms ease-out',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          left: 0, right: 0, bottom: 0,
          zIndex: 2000,
          background: 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column',
          // Respect device home indicator at the bottom
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          overflow: 'hidden',
          animation: 'mapPickerSheetIn 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.18)',
        }}
      >
        {/* Drag-indicator bar at the very top of the sheet */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border-color)',
          margin: '8px auto 4px',
          flexShrink: 0,
        }} />
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border-color)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <button
          onClick={onCancel}
          aria-label={t('common.cancel')}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--surface-hover)',
            border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-primary)', fontSize: 18,
          }}
        >
          <LeftOutlined />
        </button>
        <div style={{
          flex: 1, fontWeight: 700, fontSize: 16,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title || t('newOrder.pinOnMap')}
        </div>
      </div>

      {/* ── Map area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={isValidLatLng([center.lat, center.lng]) ? PIN_DROP_ZOOM : DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CenterTracker onCenterChange={handleCenterChange} />
          <MapFlyTo flyTo={flyTo} />
        </MapContainer>

        {/* ── Fixed crosshair pin (CSS overlay, not a Leaflet marker) ── */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%, -100%)',
            zIndex: 500,
            pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            background: accent,
            border: '3px solid #ffffff',
            boxShadow: `0 4px 14px ${pinShadow}`,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#ffffff',
              position: 'relative',
              top: 6, left: 6,
            }} />
          </div>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'rgba(0,0,0,0.18)',
            marginTop: 2, filter: 'blur(2px)',
          }} />
        </div>

        {/* ── Locate-me FAB ────────────────────────────────────────── */}
        <button
          onClick={handleLocateMe}
          disabled={locating}
          aria-label={t('newOrder.locateMe')}
          style={{
            position: 'absolute', right: 12, bottom: 12,
            zIndex: 600,
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
            cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: locating ? 'var(--text-tertiary)' : '#4285F4',
            fontSize: 18, padding: 0,
          }}
        >
          {locating ? <LoadingOutlined spin /> : <AimOutlined />}
        </button>
      </div>

      {/* ── Bottom sticky sheet: address + Confirm ──────────────────── */}
      <div style={{
        background: 'var(--card-bg)',
        borderTop: '1px solid var(--border-color)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        padding: '14px 16px 18px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase', letterSpacing: 0.3,
        }}>
          {t('newOrder.selectedLocation')}
        </div>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          minHeight: 44,
        }}>
          <CompassOutlined style={{ color: accent, fontSize: 18, marginTop: 2, flexShrink: 0 }} />
          <div style={{
            flex: 1, minWidth: 0,
            fontSize: 15, fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}>
            {geoLoading && !address
              ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('newOrder.locatingAddress')}</span>
              : (address || <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>{t('newOrder.moveMapHint')}</span>)}
            {geoLoading && address && (
              <LoadingOutlined spin style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-tertiary)' }} />
            )}
          </div>
        </div>

        <button
          onClick={handleConfirm}
          disabled={!address || geoLoading}
          style={{
            height: 50, borderRadius: 14,
            background: (!address || geoLoading) ? 'var(--border-color)' : accent,
            color: '#ffffff', border: 'none',
            fontSize: 15, fontWeight: 700, letterSpacing: 0.2,
            cursor: (!address || geoLoading) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: (!address || geoLoading) ? 'none' : `0 4px 14px ${pinShadow}`,
          }}
        >
          {t('newOrder.confirmLocation')}
        </button>
      </div>
      </div>
    </>,
    document.body
  );
}
