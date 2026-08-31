import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import RouteLayer from './RouteLayer';
// DEMO: pin images come from the bundle rather than cdnjs and
// raw.githubusercontent.com. See src/demo/markers.js.
import { DEFAULT_ICON, GREEN_ICON_URL, RED_ICON_URL, SHADOW_URL } from '../../demo/markers';

// Fix default marker icon issue with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions(DEFAULT_ICON);

const greenIcon = new L.Icon({
  iconUrl: GREEN_ICON_URL,
  shadowUrl: SHADOW_URL,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const redIcon = new L.Icon({
  iconUrl: RED_ICON_URL,
  shadowUrl: SHADOW_URL,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Georgia country center — fallback when geolocation is denied
const GEORGIA_CENTER = [42.0, 43.5];
const GEORGIA_ZOOM = 7;
const USER_LOCATION_ZOOM = 14;

function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng);
    },
  });
  return null;
}

// Inner component that can use useMap() hook
function MapController({ flyTo }) {
  const map = useMap();

  // When the MapContainer mounts inside a host that is briefly 0×0 (e.g. an
  // Ant Design Modal opening with an animation, a Drawer transitioning, an
  // initially-collapsed accordion) Leaflet's internal pixel math is computed
  // against a zero-size box and produces NaN/Infinity for getCenter()/getZoom().
  // Any subsequent flyTo() then crashes on `Invalid LatLng (NaN, NaN)` while
  // interpolating from that broken center. Forcing invalidateSize() after the
  // container has real dimensions resets Leaflet's internal state correctly.
  useEffect(() => {
    const id = setTimeout(() => {
      try { map.invalidateSize(); } catch { /* map already torn down */ }
    }, 200);
    return () => clearTimeout(id);
  }, [map]);

  useEffect(() => {
    if (
      flyTo
      && Array.isArray(flyTo.center)
      && Number.isFinite(flyTo.center[0])
      && Number.isFinite(flyTo.center[1])
      && Number.isFinite(flyTo.zoom)
    ) {
      try {
        map.flyTo(flyTo.center, flyTo.zoom, { duration: 1.2 });
      } catch { /* container not ready yet — next render will retry */ }
    }
  }, [flyTo, map]);
  return null;
}

// True only when [lat, lng] are both real, finite numbers. Treats `[null, null]`,
// `[NaN, NaN]`, `undefined`, etc. as "no position" so we never hand Leaflet a
// LatLng it can't parse.
const isValidLatLng = (p) => (
  Array.isArray(p)
  && Number.isFinite(p[0])
  && Number.isFinite(p[1])
);

export default function MapPicker({
  position,
  onSelect,
  height = 200,
  markerColor = 'green',
  placeholder = 'Tap on the map to select location',
  extraMarkers = [],
  routePoints = null,
  steepnessSegments = null,
}) {
  const positionValid = isValidLatLng(position);
  const [center] = useState(() => positionValid ? position : GEORGIA_CENTER);
  const [initialZoom] = useState(() => positionValid ? USER_LOCATION_ZOOM : GEORGIA_ZOOM);
  const [userLocation, setUserLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const mapRef = useRef(null);

  // Try to get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          if (!isValidLatLng(loc)) return;
          setUserLocation(loc);
          // If no position was pre-set, fly to user location
          if (!positionValid) {
            setFlyTo({ center: loc, zoom: 13 });
          }
        },
        () => {
          // Denied or error — stays on Georgia, which is fine
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, []); // eslint-disable-line

  // Fly to position when it changes externally
  useEffect(() => {
    if (positionValid) {
      setFlyTo({ center: position, zoom: USER_LOCATION_ZOOM });
    }
  }, [position, positionValid]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = [pos.coords.latitude, pos.coords.longitude];
        setLocating(false);
        if (!isValidLatLng(loc)) return;
        setUserLocation(loc);
        setFlyTo({ center: loc, zoom: USER_LOCATION_ZOOM });
      },
      () => {
        setLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  const handleClick = async (latlng) => {
    const { lat, lng } = latlng;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      onSelect({ lat, lng, address });
    } catch {
      onSelect({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
    }
  };

  const icon = markerColor === 'red' ? redIcon : greenIcon;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color, #f0f0f0)', position: 'relative' }}>
      <MapContainer
        center={center}
        zoom={initialZoom}
        style={{ height, width: '100%' }}
        ref={mapRef}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onClick={handleClick} />
        <MapController flyTo={flyTo} />

        {/* Extra markers from multi-stop routes */}
        {extraMarkers
          .filter((m) => isValidLatLng(m.position))
          .map((m, i) => (
            <Marker
              key={`extra-${i}`}
              position={m.position}
              icon={m.color === 'red' ? redIcon : greenIcon}
              opacity={0.5}
            />
          ))}

        {/* Selected location marker (active stop) */}
        {positionValid && <Marker position={position} icon={icon} />}

        {/* User's current location — blue circle */}
        {userLocation && (
          <Circle
            center={userLocation}
            radius={60}
            pathOptions={{
              color: '#4285F4',
              fillColor: '#4285F4',
              fillOpacity: 0.35,
              weight: 2,
            }}
          />
        )}

        {/* Truck-aware route polyline (when caller passes points) */}
        {Array.isArray(routePoints) && routePoints.length >= 2 && (
          <RouteLayer
            points={routePoints}
            steepnessSegments={steepnessSegments || []}
            fitBounds={false}
          />
        )}
      </MapContainer>

      {/* Locate me button */}
      <button
        onClick={handleLocateMe}
        disabled={locating}
        style={{
          position: 'absolute', bottom: positionValid ? 8 : 40, right: 8,
          zIndex: 1000,
          width: 36, height: 36, borderRadius: 10,
          background: 'var(--card-bg, #fff)',
          border: '1px solid var(--border-color, #e5e7eb)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: locating ? 'var(--text-tertiary, #999)' : '#4285F4',
          transition: 'all 0.2s ease',
          padding: 0,
        }}
        title="My location"
      >
        {locating ? (
          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        )}
      </button>

      {!positionValid && (
        <div style={{
          padding: '8px 12px', background: 'var(--bg-secondary, #fafafa)',
          fontSize: 12, color: 'var(--text-tertiary, #999)',
          textAlign: 'center',
        }}>
          {placeholder}
        </div>
      )}
    </div>
  );
}

export function MapView({
  markers = [],
  height = 200,
  zoom = 12,
  routePoints = null,
  steepnessSegments = null,
}) {
  const validMarkers = markers.filter((m) => isValidLatLng(m.position));
  if (!validMarkers.length) return null;

  const center = validMarkers[0].position;
  const hasRoute = Array.isArray(routePoints) && routePoints.length >= 2;

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color, #f0f0f0)' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom={false}
        dragging={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {validMarkers.map((m, i) => (
          <Marker
            key={i}
            position={m.position}
            icon={m.color === 'red' ? redIcon : greenIcon}
          />
        ))}
        {hasRoute && (
          <RouteLayer points={routePoints} steepnessSegments={steepnessSegments || []} />
        )}
      </MapContainer>
    </div>
  );
}
