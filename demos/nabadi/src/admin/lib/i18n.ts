import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enErrors from '@/locales/en/errors.json';
import enAdmin from '@/locales/en/admin.json';
import kaCommon from '@/locales/ka/common.json';
import kaAuth from '@/locales/ka/auth.json';
import kaErrors from '@/locales/ka/errors.json';
import kaAdmin from '@/locales/ka/admin.json';

/*
 * DEMO DIVERGENCE — one line, and it is the language the app opens in.
 *
 * Upstream this shop is in Tbilisi and its customers read Georgian, so a fresh
 * browser starts in KA and the switcher's choice is remembered forever. This
 * demo's visitor is reading a portfolio, and every visit is somebody's first
 * impression, so EN is pinned rather than defaulted: detection reads
 * `<html lang="en">` and nothing else, and nothing is written back. See
 * `customer/lib/i18n.ts` for the full reasoning — the two must agree, or
 * crossing surfaces would change the language.
 *
 * Within a session this instance mounts after the site may already have moved
 * to KA, and reading `<html lang>` is what keeps it in step: the site writes
 * the current language there on every change. A cold load of `/admin` gets the
 * document's own `lang="en"` instead, which is the intended starting point.
 *
 * The instance is also the console's own, not the shared `i18next` singleton.
 * Upstream the two apps are separate deployments and each owns the default
 * instance; sharing a tab, whichever called `init()` last would erase the
 * other's namespaces — the console's four against the site's eleven. Both
 * surfaces now provide their instance explicitly, and `i18n-bridge.ts` relays
 * a language change between them.
 */
const i18n = i18next.createInstance();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, errors: enErrors, admin: enAdmin },
      ka: { common: kaCommon, auth: kaAuth, errors: kaErrors, admin: kaAdmin },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'errors', 'admin'],
    supportedLngs: ['ka', 'en'],
    detection: {
      order: ['htmlTag'],
      caches: [],
    },
    interpolation: { escapeValue: false },
  });

document.documentElement.lang = i18n.language;

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
