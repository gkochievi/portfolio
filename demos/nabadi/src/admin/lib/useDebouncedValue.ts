import { useEffect, useState } from 'react';

/**
 * Returns `value` delayed by `delay` ms. Use to key server-hitting queries on
 * text inputs so typing "gio" fires one request, not three.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
