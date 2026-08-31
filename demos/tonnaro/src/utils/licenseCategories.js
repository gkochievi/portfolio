export const LICENSE_CATEGORIES = [
  { value: 'A1', label: 'A1 — Light motorcycle' },
  { value: 'A',  label: 'A — Motorcycle' },
  { value: 'B1', label: 'B1 — Quadricycle' },
  { value: 'B',  label: 'B — Car (≤ 3.5 t)' },
  { value: 'BE', label: 'BE — Car + trailer' },
  { value: 'C1', label: 'C1 — Medium truck (3.5–7.5 t)' },
  { value: 'C1E', label: 'C1E — C1 + trailer' },
  { value: 'C',  label: 'C — Heavy truck (> 3.5 t)' },
  { value: 'CE', label: 'CE — Truck + trailer' },
  { value: 'D1', label: 'D1 — Minibus (≤ 16 pax)' },
  { value: 'D1E', label: 'D1E — D1 + trailer' },
  { value: 'D',  label: 'D — Bus' },
  { value: 'DE', label: 'DE — Bus + trailer' },
  { value: 'T',  label: 'T — Tractor' },
  { value: 'S',  label: 'S — Tram' },
];

export const parseLicenseCategories = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((c) => String(c).trim().toUpperCase()).filter(Boolean);
  return String(raw)
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
};

export const formatLicenseCategories = (list) => {
  if (!list) return '';
  if (Array.isArray(list)) return list.join(',');
  return String(list);
};

// Returns true if driver's categories cover all of vehicle's required categories.
export const driverCoversVehicle = (driverCats, vehicleCats) => {
  const driver = new Set(parseLicenseCategories(driverCats));
  const required = parseLicenseCategories(vehicleCats);
  return required.every((c) => driver.has(c));
};
