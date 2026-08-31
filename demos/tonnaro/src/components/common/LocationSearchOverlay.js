import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { Input } from 'antd';
import {
  CloseOutlined, SearchOutlined, EnvironmentOutlined,
  AimOutlined, ClockCircleOutlined, LoadingOutlined,
} from '@ant-design/icons';
import { useLang } from '../../contexts/LanguageContext';
import MapIcon from './MapIcon';

// Lazy: pulls Leaflet (~150KB). Only loaded when the user opens the
// "pin on map" sub-overlay from inside this search overlay.
const FullscreenLocationPicker = lazy(() => import('../map/FullscreenLocationPicker'));

const RECENTS_KEY = 'tonnaro.locationRecents';
const RECENTS_MAX = 6;

/**
 * Full-screen search overlay for picking a location on mobile. Mimics the
 * Bolt / Yandex Go pattern:
 *
 *   ┌──────────────────────────────────┐
 *   │  X  Pickup                       │  header
 *   │  🔍 [ search… ]   ✕  📍         │  input + pin-on-map shortcut
 *   │  ↗ Current location              │  quick action (geolocation)
 *   │  🕐 Recent address 1              │  localStorage history
 *   │  🕐 Recent address 2              │
 *   │  📍 Search result 1               │  Nominatim suggestions (after typing)
 *   └──────────────────────────────────┘
 *
 * `onSelect({address, lat, lng})` fires when the user picks anything —
 * a suggestion, a recent, current location, or a map pin. Selections are
 * persisted to localStorage so they appear in "Recent" next time.
 *
 * The 📍 button in the search bar opens the full-screen map picker
 * (FullscreenLocationPicker) for tap-to-pin selection.
 */
export default function LocationSearchOverlay({
  open,
  title,
  countryCode,
  initialValue = '',
  initialCoords = null,
  markerColor = 'green',
  onCancel,
  onSelect,
}) {
  const { t, lang } = useLang();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState([]);
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Hydrate recents + pre-fill query with whatever's already in the field
  // so the user can edit it. If they really want a fresh search, they can
  // tap the input's clear (✕) button — but most of the time when a value
  // exists, the user is just tweaking it ("change 12-1" → "12-3", swap
  // street name, etc.) rather than starting from scratch.
  useEffect(() => {
    if (!open) return;
    const seed = (initialValue || '').toString();
    setQuery(seed);
    setSuggestions([]);
    setSearching(false);
    // If we have a non-trivial existing value, kick off a search right
    // away so the suggestions list isn't empty when the user lands.
    if (seed.length >= 3) {
      // Skip the debounce on the initial seeded query
      searchLocations(seed);
    }
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setRecents(Array.isArray(arr) ? arr.slice(0, RECENTS_MAX) : []);
    } catch {
      setRecents([]);
    }
    // Focus the input after the overlay's enter transition starts. On iOS
    // Safari, calling focus() too early often misses the keyboard. With a
    // pre-filled value we also move the cursor to the end so the user can
    // start typing or backspacing immediately.
    const id = setTimeout(() => {
      const el = inputRef.current?.input;
      if (el) {
        el.focus();
        try {
          const end = el.value.length;
          el.setSelectionRange(end, end);
        } catch { /* not all browsers support setSelectionRange on type=text */ }
      } else {
        inputRef.current?.focus();
      }
    }, 80);
    return () => clearTimeout(id);
  }, [open]); // eslint-disable-line

  const searchLocations = useCallback(async (text) => {
    if (!text || text.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        format: 'json',
        q: text,
        limit: '6',
        addressdetails: '1',
      });
      if (countryCode) params.set('countrycodes', countryCode);
      if (lang) params.set('accept-language', lang);
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const data = await res.json();
      const results = data.map((item) => ({
        display_name: item.display_name,
        short_name: formatShortName(item),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
      }));
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, [countryCode, lang]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchLocations(val), 500);
  };

  const persistRecent = (item) => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const filtered = Array.isArray(arr)
        ? arr.filter((r) => r.address !== item.address)
        : [];
      const next = [item, ...filtered].slice(0, RECENTS_MAX);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    } catch {
      // localStorage full or disabled — recents are a nice-to-have
    }
  };

  const finalize = (item) => {
    persistRecent(item);
    onSelect(item);
  };

  const handlePickSuggestion = (s) => {
    finalize({
      address: s.short_name,
      fullAddress: s.display_name,
      lat: s.lat,
      lng: s.lng,
    });
  };

  const handlePickRecent = (r) => {
    finalize(r);
  };

  const handleCurrentLocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        try {
          const params = new URLSearchParams({
            format: 'json',
            lat: String(lat),
            lon: String(lng),
            zoom: '18',
            addressdetails: '1',
          });
          if (lang) params.set('accept-language', lang);
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
          const data = await res.json();
          const short = formatShortName(data) || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setLocating(false);
          finalize({
            address: short,
            fullAddress: data.display_name || short,
            lat,
            lng,
          });
        } catch {
          setLocating(false);
          finalize({
            address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            fullAddress: '',
            lat,
            lng,
          });
        }
      },
      () => setLocating(false),
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handlePickerConfirm = ({ lat, lng, address }) => {
    setPickerOpen(false);
    finalize({ address, fullAddress: address, lat, lng });
  };

  if (!open) return null;
  // Portal to document.body so the overlay escapes any nested stacking
  // context — the order form has `backdrop-filter` ancestors (sticky CTA,
  // glass header) that would otherwise trap the overlay's z-index 1900
  // beneath the sticky "Review Order" bar at z-index 99.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <style>{`
        @keyframes locationOverlayIn {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes locationBackdropFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      {/* Dim backdrop. Tapping it dismisses the overlay, matching the
          Bolt / Yandex pattern. */}
      <div
        onClick={onCancel}
        style={{
          position: 'fixed', inset: 0, zIndex: 1899,
          background: 'rgba(0, 0, 0, 0.4)',
          animation: 'locationBackdropFadeIn 200ms ease-out',
        }}
      />
      {/* Bottom sheet — rounded top corners (radius 18 to match the
          order section cards), pulled 16px down from the very top so
          the rounded corners are visible against the dim backdrop. */}
      <div
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          left: 0, right: 0, bottom: 0,
          zIndex: 1900,
          background: 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          overflow: 'hidden',
          animation: 'locationOverlayIn 220ms cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.18)',
        }}
      >
        {/* Drag indicator — purely decorative bar at the top to signal
            "this is a sheet you can swipe down". (Actual swipe-down
            dismiss is wired through the backdrop's onClick + the X.) */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--border-color)',
          margin: '8px auto 4px',
          flexShrink: 0,
        }} />
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <button
          onClick={onCancel}
          aria-label={t('common.cancel')}
          style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--surface-hover)',
            border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-primary)', fontSize: 16,
          }}
        >
          <CloseOutlined />
        </button>
        <div style={{
          flex: 1, fontWeight: 700, fontSize: 16,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title || t('newOrder.selectLocation')}
        </div>
      </div>

      {/* Search input */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--card-bg)',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <Input
          ref={inputRef}
          value={query}
          onChange={handleQueryChange}
          prefix={<SearchOutlined style={{ color: 'var(--text-tertiary)' }} />}
          placeholder={t('newOrder.searchAddress') || t('common.search')}
          allowClear
          size="large"
          style={{
            borderRadius: 12,
            border: '1.5px solid var(--accent)',
            background: 'var(--input-bg)',
          }}
          suffix={
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label={t('newOrder.pinOnMap')}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: markerColor === 'red' ? '#ef444414' : 'var(--accent-bg)',
                color: markerColor === 'red' ? '#ef4444' : 'var(--accent)',
                border: 'none', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}
            >
              <MapIcon size={16} />
            </button>
          }
        />
      </div>

      {/* Results / quick actions list */}
      <div style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--bg-primary)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {/* Current location quick action */}
        <Row
          icon={<AimOutlined />}
          iconColor="var(--accent)"
          iconBg="var(--accent-bg)"
          title={t('newOrder.currentLocation')}
          loading={locating}
          onClick={handleCurrentLocation}
        />

        {/* Search results (Nominatim) take over when the user is typing */}
        {query.length >= 3 ? (
          <>
            {searching && suggestions.length === 0 && (
              <div style={{
                padding: '24px 16px', textAlign: 'center',
                color: 'var(--text-tertiary)', fontSize: 14,
              }}>
                <LoadingOutlined spin /> {t('newOrder.searching') || t('common.loading')}
              </div>
            )}
            {!searching && suggestions.length === 0 && (
              <div style={{
                padding: '24px 16px', textAlign: 'center',
                color: 'var(--text-tertiary)', fontSize: 14,
              }}>
                {t('newOrder.noResults')}
              </div>
            )}
            {suggestions.map((s, i) => (
              <Row
                key={`s-${i}`}
                icon={<MapIcon size={16} />}
                iconColor="var(--text-secondary)"
                title={s.short_name}
                subtitle={s.display_name}
                onClick={() => handlePickSuggestion(s)}
              />
            ))}
          </>
        ) : (
          // Recents list (shown only when not searching)
          recents.length > 0 && (
            <>
              <div style={{
                padding: '14px 16px 6px',
                fontSize: 11, fontWeight: 700,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                {t('newOrder.recentLocations')}
              </div>
              {recents.map((r, i) => (
                <Row
                  key={`r-${i}`}
                  icon={<ClockCircleOutlined />}
                  iconColor="var(--text-secondary)"
                  title={r.address}
                  subtitle={r.fullAddress && r.fullAddress !== r.address ? r.fullAddress : null}
                  onClick={() => handlePickRecent(r)}
                />
              ))}
            </>
          )
        )}
      </div>

      {/* Fullscreen map picker is a separate overlay layered on top of this one */}
      {pickerOpen && (
        <Suspense fallback={null}>
          <FullscreenLocationPicker
            open={pickerOpen}
            title={title}
            initialPosition={initialCoords}
            markerColor={markerColor}
            onCancel={() => setPickerOpen(false)}
            onConfirm={handlePickerConfirm}
          />
        </Suspense>
      )}
      </div>
    </>,
    document.body
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function formatShortName(item) {
  const addr = item.address || {};
  const parts = [];
  const city = addr.city || addr.town || addr.village || addr.municipality || '';
  const road = addr.road || addr.pedestrian || '';
  const houseNumber = addr.house_number || '';
  const state = addr.state || '';
  const country = addr.country || '';
  if (road) parts.push(houseNumber ? `${road} ${houseNumber}` : road);
  if (city) parts.push(city);
  if (!city && state) parts.push(state);
  if (country && !city) parts.push(country);
  return parts.length > 0 ? parts.join(', ') : item.display_name;
}

function Row({ icon, iconColor, iconBg, title, subtitle, onClick, loading }) {
  return (
    <div
      onClick={loading ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        cursor: loading ? 'default' : 'pointer',
        borderBottom: '1px solid var(--border-light)',
        background: 'var(--bg-primary)',
        opacity: loading ? 0.6 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: iconBg || 'var(--bg-secondary)',
        color: iconColor || 'var(--text-secondary)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>
        {loading ? <LoadingOutlined spin /> : icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 600,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
