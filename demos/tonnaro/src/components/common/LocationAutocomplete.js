import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef, lazy, Suspense } from 'react';
import { Input, Tooltip, Grid, message } from 'antd';
import {
  LoadingOutlined, EnvironmentOutlined, RightOutlined, AimOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import LocationSearchOverlay from './LocationSearchOverlay';
import MapIcon from './MapIcon';
import { useLang } from '../../contexts/LanguageContext';

// Lazy: pulls in Leaflet (~150KB). Only loads when the user opens the
// "pin on map" overlay, keeping the landing/login bundles map-free.
const FullscreenLocationPicker = lazy(() => import('../map/FullscreenLocationPicker'));

/**
 * Location autocomplete input using OpenStreetMap Nominatim API.
 *
 * Two rendering modes:
 *   - Desktop / md+ viewports: inline input with a dropdown of suggestions
 *     as the user types, plus a "pin on map" button in the suffix.
 *   - Mobile (sm and below): the field becomes a tap target that opens a
 *     full-screen LocationSearchOverlay (Bolt / Yandex pattern). The
 *     overlay handles typing, recent addresses, "current location", and
 *     forwards "pin on map" requests to FullscreenLocationPicker.
 *
 * Same outward API in both modes — `onChange` for typed values and
 * `onSelect` for confirmed picks.
 */
const LocationAutocomplete = forwardRef(function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder,
  prefix,
  style,
  size = 'large',
  dropdownStyle,
  countryCode,
  // Bolt/Yandex-style fullscreen map picker. Set to false to suppress the
  // pin-on-map button (e.g. when the parent already shows its own map UI).
  enableMapPicker = true,
  // Marker tint for the fullscreen picker — green for pickups, red for drops.
  pickerMarkerColor = 'green',
  pickerTitle,
  // Optional last-known coordinates so the picker opens centered on the
  // currently-chosen address instead of the default fallback.
  initialCoords = null,
  // Force inline rendering even on small viewports (e.g. landing-page
  // hero where the search field IS the page focus). Defaults to false:
  // mobile gets the overlay.
  forceInline = false,
  // When true, renders a green ✓ indicator to signal this address has been
  // committed (a Nominatim suggestion was picked). Fully parent-driven.
  confirmed = false,
}, ref) {
  const { t } = useLang();
  const screens = Grid.useBreakpoint();
  // Treat anything narrower than `md` (≈ 768 px) as mobile. The overlay's
  // bottom-up feel is great there; on desktop the inline dropdown is
  // simpler and uses less screen.
  const isMobile = !screens.md;
  const useOverlay = !forceInline && isMobile && enableMapPicker;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Expose .focus() to the parent so it can land the cursor here when
  // the New Order submit gate detects a typed-but-not-committed value.
  useImperativeHandle(ref, () => ({
    focus: () => {
      // Desktop: Ant's <Input> exposes .focus(). Mobile: the tap-card div
      // we wire up below has tabIndex=0 and supports .focus() directly.
      const node = inputRef.current?.input || inputRef.current;
      if (node && typeof node.focus === 'function') node.focus();
    },
  }), []);

  const searchLocations = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
      if (countryCode) {
        url += `&countrycodes=${countryCode}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      const results = data.map((item) => ({
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        short_name: formatShortName(item),
        country_code: item.address?.country_code || '',
      }));
      setSuggestions(results);
      setOpen(results.length > 0);
      setActiveIndex(-1);
    } catch {
      setSuggestions([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => searchLocations(val), 600);
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.short_name);
    setOpen(false);
    setSuggestions([]);
    if (onSelect) {
      onSelect({
        address: suggestion.short_name,
        fullAddress: suggestion.display_name,
        lat: suggestion.lat,
        lng: suggestion.lng,
        countryCode: suggestion.country_code,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const handleMapConfirm = ({ lat, lng, address }) => {
    setPickerOpen(false);
    onChange(address);
    if (onSelect) {
      onSelect({ address, fullAddress: address, lat, lng });
    }
  };

  const handleOverlaySelect = (item) => {
    setOverlayOpen(false);
    onChange(item.address);
    if (onSelect) onSelect(item);
  };

  // One-tap "use my current location" — fires geolocation API + reverse
  // geocodes the result via Nominatim, with `accept-language` set to the
  // active UI language so the resolved street comes back in Georgian for
  // KA users. Failures (denied, timeout) surface a quiet toast so the
  // user knows why the chip didn't work.
  const [locating, setLocating] = useState(false);
  const handleUseCurrent = (e) => {
    e?.stopPropagation();
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      message.warning(t('newOrder.locationUnavailable') || t('common.error'));
      return;
    }
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
          if (countryCode) params.set('countrycodes', countryCode);
          const langCode = (typeof localStorage !== 'undefined' && localStorage.getItem('lang')) || 'en';
          params.set('accept-language', langCode);
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
          const data = await res.json();
          const short = formatShortName(data) || data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setLocating(false);
          onChange(short);
          if (onSelect) {
            onSelect({ address: short, fullAddress: data.display_name || short, lat, lng });
          }
        } catch {
          setLocating(false);
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          onChange(fallback);
          if (onSelect) onSelect({ address: fallback, fullAddress: '', lat, lng });
        }
      },
      () => {
        setLocating(false);
        message.warning(t('newOrder.locationDenied') || t('common.error'));
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // ─── Mobile: tap-to-open card + LocationSearchOverlay ──────────────
  if (useOverlay) {
    const accentColor = pickerMarkerColor === 'red' ? '#ef4444' : 'var(--accent)';
    const accentTint  = pickerMarkerColor === 'red' ? '#ef444414' : 'var(--accent-bg)';
    const isFilled = !!value;

    return (
      // `minWidth: 0` is critical here — without it, the default flex
      // `min-width: auto` lets long Georgian/Russian content push the card
      // past the timeline-row parent's right edge.
      <div ref={wrapperRef} style={{ position: 'relative', flex: 1, minWidth: 0, ...style }}>
        {/* Tap-to-open card — visually distinct from a text input so the
            user immediately understands "tap to open a chooser" rather
            than "tap to start typing here". */}
        <div
          ref={inputRef}
          role="button"
          tabIndex={0}
          onClick={() => setOverlayOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setOverlayOpen(true);
            }
          }}
          aria-label={placeholder}
          title={value || ''}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: isFilled ? 'var(--card-bg)' : 'var(--bg-secondary)',
            border: `1.5px solid ${isFilled ? accentTint : 'var(--border-color)'}`,
            borderRadius: 14,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {/* Optional left prefix (timeline dot etc. — usually not needed
              because NewOrderFlow draws its own dot outside) */}
          {prefix && <span style={{ color: 'var(--text-tertiary)', display: 'inline-flex' }}>{prefix}</span>}

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Small uppercase label that always identifies the field */}
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: accentColor, letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginBottom: 2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {placeholder}
            </div>
            {/* Value or hint — bigger, primary, easy to scan */}
            <div style={{
              fontSize: 14,
              fontWeight: isFilled ? 600 : 500,
              color: isFilled ? 'var(--text-primary)' : 'var(--text-tertiary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              lineHeight: 1.3,
            }}>
              {value || t('newOrder.tapToChoose')}
            </div>
          </div>

          {confirmed && value && (
            <span
              aria-label={t('newOrder.locationConfirmed')}
              title={t('newOrder.locationConfirmed')}
              style={{
                width: 24, height: 24, borderRadius: 8,
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircleFilled style={{ fontSize: 14 }} />
            </span>
          )}
          {enableMapPicker && (
            <span
              onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
              role="button"
              tabIndex={-1}
              aria-label={t('newOrder.pinOnMap')}
              style={{
                width: 34, height: 34, borderRadius: 10,
                background: accentTint,
                color: accentColor,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MapIcon size={16} />
            </span>
          )}
          <RightOutlined style={{ color: 'var(--text-placeholder)', fontSize: 12, flexShrink: 0 }} />
        </div>

        {/* Inline "Use my current location" chip — only when empty.
            Saves a tap on the most common pickup case. */}
        {!isFilled && (
          <button
            type="button"
            onClick={handleUseCurrent}
            disabled={locating}
            style={{
              marginTop: 8, marginLeft: 4,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 10px',
              background: 'transparent',
              border: `1px dashed ${accentColor}`,
              color: accentColor,
              borderRadius: 999,
              fontSize: 12, fontWeight: 600,
              cursor: locating ? 'wait' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            {locating ? <LoadingOutlined spin /> : <AimOutlined />}
            {t('newOrder.useCurrentLocation')}
          </button>
        )}

        <LocationSearchOverlay
          open={overlayOpen}
          title={pickerTitle || placeholder}
          countryCode={countryCode}
          initialValue={value || ''}
          initialCoords={initialCoords}
          markerColor={pickerMarkerColor}
          onCancel={() => setOverlayOpen(false)}
          onSelect={handleOverlaySelect}
        />
        {/* The direct-to-map shortcut still uses the same fullscreen picker */}
        {pickerOpen && (
          <Suspense fallback={null}>
            <FullscreenLocationPicker
              open={pickerOpen}
              title={pickerTitle || placeholder}
              initialPosition={initialCoords}
              markerColor={pickerMarkerColor}
              onCancel={() => setPickerOpen(false)}
              onConfirm={handleMapConfirm}
            />
          </Suspense>
        )}
      </div>
    );
  }

  // ─── Desktop: existing inline input + dropdown ─────────────────────
  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, ...style }}>
      <Input
        ref={inputRef}
        prefix={prefix}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        size={size}
        // Browser-native tooltip shows the full address on hover when the
        // visible text is truncated by Ant Design's single-line input.
        title={value || ''}
        style={{ height: 48, fontSize: 15 }}
        suffix={
          // Fixed-size suffix slot so AntD's affix wrapper stays mounted
          // — toggling between null and a node remounts the inner <input>
          // and kills focus mid-typing.
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            minWidth: enableMapPicker ? 56 : 30,
            height: 18,
          }}>
            {loading && <LoadingOutlined spin style={{ fontSize: 14, color: 'var(--text-tertiary)' }} />}
            {confirmed && !loading && (
              <Tooltip title={t('newOrder.locationConfirmed')}>
                <CheckCircleFilled style={{ fontSize: 15, color: 'var(--accent)' }} />
              </Tooltip>
            )}
            {enableMapPicker && (
              <Tooltip title={t('newOrder.pinOnMap')}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => { e.stopPropagation(); setPickerOpen(true); }}
                  aria-label={t('newOrder.pinOnMap')}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: 'var(--accent-bg)',
                    color: 'var(--accent)',
                    border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, padding: 0,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <MapIcon size={14} />
                </button>
              </Tooltip>
            )}
          </span>
        }
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: 'var(--card-bg, #fff)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: '1px solid var(--border-color, #f0f0f0)',
            marginTop: 4,
            overflow: 'hidden',
            ...dropdownStyle,
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                padding: '10px 16px',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--text-primary, #222)',
                background: i === activeIndex ? 'var(--accent-bg, #f0f0ff)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-color, #f5f5f5)' : 'none',
                transition: 'background 0.15s',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span style={{
                color: 'var(--accent, #F97316)',
                fontSize: 16,
                marginTop: 1,
                flexShrink: 0,
              }}>
                📍
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {s.short_name}
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'var(--text-tertiary, #999)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 2,
                }}>
                  {s.display_name}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {enableMapPicker && pickerOpen && (
        <Suspense fallback={null}>
          <FullscreenLocationPicker
            open={pickerOpen}
            title={pickerTitle}
            initialPosition={initialCoords}
            markerColor={pickerMarkerColor}
            onCancel={() => setPickerOpen(false)}
            onConfirm={handleMapConfirm}
          />
        </Suspense>
      )}
    </div>
  );
});

export default LocationAutocomplete;

function formatShortName(item) {
  const addr = item.address || {};
  const parts = [];
  // City / town / village
  const city = addr.city || addr.town || addr.village || addr.municipality || '';
  const road = addr.road || addr.pedestrian || '';
  const houseNumber = addr.house_number || '';
  const state = addr.state || '';
  const country = addr.country || '';

  if (road) {
    parts.push(houseNumber ? `${road} ${houseNumber}` : road);
  }
  if (city) parts.push(city);
  if (!city && state) parts.push(state);
  if (country) parts.push(country);

  return parts.length > 0 ? parts.join(', ') : item.display_name;
}
