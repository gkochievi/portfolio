/**
 * Pick a localized string. KA is the primary field; EN falls back to KA when blank.
 * Pass i18n.language ('ka' | 'en' | 'ka-…' | 'en-…').
 */
export function pickLocalized(
  primaryKa: string | null | undefined,
  en: string | null | undefined,
  language: string,
): string {
  if (language?.startsWith('en') && en && en.trim() !== '') return en;
  return primaryKa ?? '';
}
