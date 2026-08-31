import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client';
import { applyColorTheme, DEFAULT_COLOR_THEME } from '../utils/colorThemes';
import { deriveCurrencyFromSettings, DEFAULT_CURRENCY } from '../utils/currency';

const BrandingContext = createContext({});

// localStorage key — bump the suffix if the shape changes so we don't try to
// hydrate from an old structure.
const CACHE_KEY = 'tonnaro_branding_v1';

const DEFAULT_BRANDING = {
  siteName: null,
  siteTitle: null,
  headerDisplay: 'both',
  siteIconUrl: null,
  siteIconDarkUrl: null,
  faviconUrl: null,
  colorTheme: DEFAULT_COLOR_THEME,
  currency: DEFAULT_CURRENCY,
  contactPhone: '',
  whatsappNumber: '',
  contactEmail: '',
  defaultSearchScope: 'georgia',
  defaultSearchCountries: [],
  // Multilingual footer text {en, ka, ru}. Empty object → public footer
  // falls back to the t('footer.copyright') translation + dynamic year.
  footerText: {},
};

function normalize(data) {
  if (!data || typeof data !== 'object') return null;
  const headerDisplay = ['both', 'logo_only', 'name_only'].includes(data.header_display)
    ? data.header_display : 'both';
  return {
    siteName: data.site_name || null,
    // site_title is for <title> / SEO; site_name remains the navbar brand text.
    siteTitle: data.site_title || data.site_name || null,
    headerDisplay,
    siteIconUrl: data.site_logo_url || null,
    siteIconDarkUrl: data.site_logo_dark_url || null,
    faviconUrl: data.favicon_url || null,
    colorTheme: data.color_theme || DEFAULT_COLOR_THEME,
    currency: deriveCurrencyFromSettings(data),
    contactPhone: (data.contact_phone || '').trim(),
    whatsappNumber: (data.whatsapp_number || '').trim(),
    contactEmail: (data.contact_email || '').trim(),
    defaultSearchScope: data.default_search_scope || 'georgia',
    defaultSearchCountries: data.default_search_countries || [],
    footerText: (data.footer_text && typeof data.footer_text === 'object')
      ? data.footer_text : {},
  };
}

// Sync read at module load time so the very first render has the right
// palette. Order of preference:
//   1. window.__BOOT__.site — server-injected by SpaShellView (always fresh)
//   2. localStorage cache from prior visit — instant on reload even offline
//   3. DEFAULT_BRANDING — first-time visitor in a dev environment
function readInitialBranding() {
  if (typeof window === 'undefined') return DEFAULT_BRANDING;
  try {
    const boot = window.__BOOT__?.site;
    if (boot) return normalize(boot) || DEFAULT_BRANDING;
  } catch {}
  try {
    const cached = window.localStorage?.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const out = normalize(parsed);
      if (out) return out;
    }
  } catch {}
  return DEFAULT_BRANDING;
}

// applyColorTheme also runs at module load — this is what stops the green
// flash for paths that don't get server-injected CSS (dev mode, mostly).
const INITIAL_BRANDING = readInitialBranding();
if (typeof document !== 'undefined' && INITIAL_BRANDING.colorTheme) {
  try { applyColorTheme(INITIAL_BRANDING.colorTheme); } catch {}
  if (INITIAL_BRANDING.siteTitle) document.title = INITIAL_BRANDING.siteTitle;
  if (INITIAL_BRANDING.faviconUrl) {
    try {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = INITIAL_BRANDING.faviconUrl;
    } catch {}
  }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(INITIAL_BRANDING);

  const setColorTheme = useCallback((themeKey) => {
    applyColorTheme(themeKey);
    setBranding((prev) => ({ ...prev, colorTheme: themeKey }));
  }, []);

  const refresh = useCallback(() => {
    return api.get('/site-settings/').then(({ data }) => {
      const next = normalize(data);
      if (!next) return data;
      setBranding(next);
      applyColorTheme(next.colorTheme);

      // Persist the raw API response so the cached shape matches the
      // server's contract; normalize() runs again on next page load.
      try { window.localStorage?.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}

      if (next.siteTitle) document.title = next.siteTitle;
      if (next.faviconUrl) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = next.faviconUrl;
      }
      return data;
    }).catch(() => null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Re-apply palette when light/dark mode toggles, so accent picks the right shade.
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-theme') {
          applyColorTheme(branding.colorTheme || DEFAULT_COLOR_THEME);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [branding.colorTheme]);

  return (
    <BrandingContext.Provider value={{ ...branding, setColorTheme, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
