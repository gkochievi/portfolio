import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

import { steepnessColor } from '../../utils/elevation';

/**
 * Draw a steepness-colored route polyline onto the parent <MapContainer>.
 * Must be rendered as a child of <MapContainer> so useMap() resolves.
 *
 * Cleans up its layers on unmount and whenever the points/segments change,
 * so we never leak stale lines when pickup/destination is edited.
 */
export default function RouteLayer({ points, steepnessSegments, fitBounds = true }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !Array.isArray(points) || points.length < 2) return undefined;

    const layerGroup = L.layerGroup().addTo(map);

    // ORS gives [startIdx, endIdx, category]. Categories cover the full polyline,
    // but if any indices are missing we fall back to a flat green polyline so the
    // route still renders.
    const segments = (Array.isArray(steepnessSegments) && steepnessSegments.length > 0)
      ? steepnessSegments
      : [[0, points.length - 1, 0]];

    segments.forEach(([startIdx, endIdx, category]) => {
      const slice = points.slice(startIdx, endIdx + 1);
      if (slice.length < 2) return;
      const latlngs = slice.map((p) => [p[1], p[0]]); // [lng,lat,ele] -> [lat,lng]
      L.polyline(latlngs, {
        color: steepnessColor(category),
        weight: 5,
        opacity: 0.95,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(layerGroup);
    });

    if (fitBounds) {
      const bounds = L.latLngBounds(points.map((p) => [p[1], p[0]]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24] });
      }
    }

    return () => {
      layerGroup.remove();
    };
  }, [map, points, steepnessSegments, fitBounds]);

  return null;
}
