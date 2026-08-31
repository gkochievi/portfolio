import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import enCommon from '@/locales/en/common.json';
import enAuth from '@/locales/en/auth.json';
import enErrors from '@/locales/en/errors.json';
import enNav from '@/locales/en/nav.json';
import enHome from '@/locales/en/home.json';
import enServices from '@/locales/en/services.json';
import enBarbers from '@/locales/en/barbers.json';
import enBook from '@/locales/en/book.json';
import enProfile from '@/locales/en/profile.json';
import enAbout from '@/locales/en/about.json';
import enContact from '@/locales/en/contact.json';

import kaCommon from '@/locales/ka/common.json';
import kaAuth from '@/locales/ka/auth.json';
import kaErrors from '@/locales/ka/errors.json';
import kaNav from '@/locales/ka/nav.json';
import kaHome from '@/locales/ka/home.json';
import kaServices from '@/locales/ka/services.json';
import kaBarbers from '@/locales/ka/barbers.json';
import kaBook from '@/locales/ka/book.json';
import kaProfile from '@/locales/ka/profile.json';
import kaAbout from '@/locales/ka/about.json';
import kaContact from '@/locales/ka/contact.json';

const namespaces = [
  'common',
  'auth',
  'errors',
  'nav',
  'home',
  'services',
  'barbers',
  'book',
  'profile',
  'about',
  'contact',
];

/**
 * Init options, exported for tests (language rehydration).
 *
 * NOTE: deliberately no `lng` here — an explicit `lng` makes i18next skip the
 * LanguageDetector entirely, and the detector is what reads `<html lang>`.
 * `navigator` is intentionally excluded from the order so the visitor's browser
 * language does not override the app's own default.
 */
/*
 * DEMO DIVERGENCE — one line, and it is the language the app opens in.
 *
 * Upstream this shop is in Tbilisi and its customers read Georgian, so a fresh
 * browser starts in KA and the switcher's choice is remembered forever. This
 * demo's visitor is reading a portfolio, and every visit is somebody's first
 * impression — including the visits where it is the same person opening it
 * again to show someone else. So EN is pinned rather than defaulted: detection
 * reads `<html lang="en">` from index.html and nothing else, and nothing is
 * written back.
 *
 * That is why `localStorage` is absent from both `order` and `caches`, where
 * upstream sets both. With it, a stored `ka` outranked the English default on
 * every later load — the demo opened in Georgian for precisely the people who
 * had already seen it. The switcher still works and `i18n-bridge.ts` still
 * relays the change to the other surface; the choice simply lasts the session
 * instead of outliving it, and the Georgian stays one click away, which is the
 * point, since the bilingual work is half of what there is to see.
 */
export const i18nInitOptions = {
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      errors: enErrors,
      nav: enNav,
      home: enHome,
      services: enServices,
      barbers: enBarbers,
      book: enBook,
      profile: enProfile,
      about: enAbout,
      contact: enContact,
    },
    ka: {
      common: kaCommon,
      auth: kaAuth,
      errors: kaErrors,
      nav: kaNav,
      home: kaHome,
      services: kaServices,
      barbers: kaBarbers,
      book: kaBook,
      profile: kaProfile,
      about: kaAbout,
      contact: kaContact,
    },
  },
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: namespaces,
  supportedLngs: ['ka', 'en'],
  detection: {
    order: ['htmlTag'],
    caches: [],
  },
  interpolation: { escapeValue: false },
};

i18n.use(LanguageDetector).use(initReactI18next).init(i18nInitOptions);

document.documentElement.lang = i18n.language;

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

export default i18n;
