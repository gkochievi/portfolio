const COUNTRY_CURRENCY = {
  ge: { code: 'GEL', symbol: '₾' },
  tr: { code: 'TRY', symbol: '₺' },
  az: { code: 'AZN', symbol: '₼' },
  am: { code: 'AMD', symbol: '֏' },
  ru: { code: 'RUB', symbol: '₽' },
  ua: { code: 'UAH', symbol: '₴' },
  de: { code: 'EUR', symbol: '€' },
  fr: { code: 'EUR', symbol: '€' },
  it: { code: 'EUR', symbol: '€' },
  es: { code: 'EUR', symbol: '€' },
  gr: { code: 'EUR', symbol: '€' },
  gb: { code: 'GBP', symbol: '£' },
  us: { code: 'USD', symbol: '$' },
  pl: { code: 'PLN', symbol: 'zł' },
  bg: { code: 'BGN', symbol: 'лв' },
  ro: { code: 'RON', symbol: 'lei' },
  kz: { code: 'KZT', symbol: '₸' },
  il: { code: 'ILS', symbol: '₪' },
  ae: { code: 'AED', symbol: 'AED' },
  cn: { code: 'CNY', symbol: '¥' },
};

export const GEORGIA_CURRENCY = { code: 'GEL', symbol: '₾' };
// Tonnaro is a Georgia-based platform; default to GEL everywhere
// (logged-out visitors, pre-hydration renders, admin pages loaded before
// /site-settings/ comes back) so prices never flash USD on first paint.
// The admin can still override per-region by setting default_search_scope
// to 'custom' with a country list — see deriveCurrencyFromSettings below.
export const DEFAULT_CURRENCY = GEORGIA_CURRENCY;

export function getCurrencyForCountry(code) {
  if (!code) return null;
  return COUNTRY_CURRENCY[code.toLowerCase()] || null;
}

export function deriveCurrencyFromSettings({ default_search_scope, default_search_countries } = {}) {
  if (default_search_scope === 'georgia') return GEORGIA_CURRENCY;
  if (default_search_scope === 'custom' && Array.isArray(default_search_countries) && default_search_countries.length) {
    return getCurrencyForCountry(default_search_countries[0]) || DEFAULT_CURRENCY;
  }
  return DEFAULT_CURRENCY;
}
