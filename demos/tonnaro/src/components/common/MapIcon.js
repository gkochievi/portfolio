import React from 'react';

/**
 * Folded-map glyph. Used in location-input action buttons across the app
 * (LocationAutocomplete trigger, LocationSearchOverlay search bar, etc.)
 * to communicate "tap to open the map picker" — much clearer than the
 * generic pin/marker icon (EnvironmentOutlined) that previously occupied
 * those slots and tended to read as "this is a location" rather than
 * "open the map".
 *
 * Inherits stroke color from `currentColor` so it picks up the surrounding
 * color (accent green for pickups, red for destinations, etc.).
 */
export default function MapIcon({ size = 14, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  );
}
