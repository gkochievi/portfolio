import React, { useMemo } from 'react';
import { Input } from 'antd';

// Georgia is the primary market — every customer-side phone field uses a
// fixed +995 prefix and caps at 9 local digits. The component takes/emits
// an E.164-style string (e.g. "+995555123456") so what the backend stores
// is consistent across the site (registration, profile, order contacts).
// Existing rows in older formats (with spaces, dashes, or missing prefix)
// are coerced into the local-digits view on display.

const DIAL_CODE = '+995';
const MAX_DIGITS = 9;

function toLocalDigits(raw) {
  const onlyDigits = String(raw ?? '').replace(/\D/g, '');
  const withoutCC = onlyDigits.startsWith('995')
    ? onlyDigits.slice(3)
    : onlyDigits;
  return withoutCC.slice(0, MAX_DIGITS);
}

export function isValidGeorgiaPhone(value) {
  return toLocalDigits(value).length === MAX_DIGITS;
}

export { DIAL_CODE, MAX_DIGITS, toLocalDigits };

export default function PhoneInput({
  value, onChange,
  size, style, placeholder,
  disabled, allowClear,
  ...rest
}) {
  const display = useMemo(() => toLocalDigits(value), [value]);

  const handleChange = (e) => {
    const digits = toLocalDigits(e.target.value);
    if (onChange) {
      // Emit '' when empty so Form validators ("required") still fire.
      onChange(digits ? `${DIAL_CODE}${digits}` : '');
    }
  };

  return (
    <Input
      {...rest}
      addonBefore={DIAL_CODE}
      value={display}
      onChange={handleChange}
      inputMode="numeric"
      autoComplete="tel"
      placeholder={placeholder || '555 12 34 56'}
      maxLength={MAX_DIGITS + 4}
      size={size}
      style={style}
      disabled={disabled}
      allowClear={allowClear}
    />
  );
}
