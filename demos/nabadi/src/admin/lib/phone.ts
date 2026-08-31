/**
 * E.164 phone validation, Georgian defaults.
 *
 * Project standard (spec + backend `USERNAME_FIELD = "phone"`): phones are
 * stored E.164 with default region GE (+995). Staff type numbers however the
 * customer dictates them — "555 12 34 56", "+995555123456", "995555123456" —
 * so we normalize rather than reject formatting noise.
 */

/** Strip spaces, dots, dashes, and parentheses. */
function stripFormatting(raw: string): string {
  return raw.replace(/[\s().-]/g, '');
}

/**
 * Returns the E.164 form of `raw`, or null when it can't be one.
 *
 * Accepted inputs:
 * - full E.164:        +995555123456 (any country, 8–15 digits)
 * - GE without plus:   995555123456
 * - GE local mobile:   555123456 (9 digits starting with 5)
 */
export function normalizePhoneE164(raw: string): string | null {
  const s = stripFormatting(raw);
  if (!s) return null;
  if (/^\+\d{8,15}$/.test(s)) return s;
  if (/^995\d{9}$/.test(s)) return `+${s}`;
  if (/^5\d{8}$/.test(s)) return `+995${s}`;
  return null;
}

/** True when `raw` normalizes to a valid E.164 number. */
export function isValidPhone(raw: string): boolean {
  return normalizePhoneE164(raw) !== null;
}
