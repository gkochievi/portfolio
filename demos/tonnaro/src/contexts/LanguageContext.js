import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

const SUPPORTED_LANGS = ['en', 'ka', 'ru'];
const LANG_LABELS = { en: 'English', ka: 'ქართული', ru: 'Русский' };
const LANG_FLAGS = { en: '🇬🇧', ka: '🇬🇪', ru: '🇷🇺' };

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang');
    if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    // DEMO: upstream returns 'ka' here — Georgia is the product's market, so a
    // first-time customer should land in Georgian. This demo's first-time
    // visitor is reading a portfolio, not booking a crane, so it opens in
    // English and leaves the switcher to show the other two.
    //
    // The translation-lookup fallback below still resolves missing keys
    // against the English bundle, so partially-translated screens stay
    // readable instead of returning the raw key.
    return 'en';
  });

  const changeLang = useCallback((newLang) => {
    if (SUPPORTED_LANGS.includes(newLang)) {
      setLang(newLang);
      localStorage.setItem('lang', newLang);
    }
  }, []);

  // Mirror the selected language onto <html lang="..."> so CSS can target
  // language-specific layout fixes via :lang(ka) / :lang(ru) selectors
  // (Georgian script has no uppercase and tends to be 2-3× wider than
  // English at the same character count, so a few :lang(ka) overrides in
  // theme.css adjust letter-spacing + text-transform where needed).
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const t = useCallback((key, params) => {
    const keys = key.split('.');
    let val = translations[lang];
    for (const k of keys) {
      if (val && typeof val === 'object') {
        val = val[k];
      } else {
        val = undefined;
        break;
      }
    }
    if (val === undefined) {
      // Fallback to English
      val = translations.en;
      for (const k of keys) {
        if (val && typeof val === 'object') {
          val = val[k];
        } else {
          val = undefined;
          break;
        }
      }
    }
    if (val === undefined) return key;
    if (typeof val === 'string' && params) {
      return val.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? `{${k}}`);
    }
    return val;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{
      lang, changeLang, t,
      SUPPORTED_LANGS, LANG_LABELS, LANG_FLAGS,
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
