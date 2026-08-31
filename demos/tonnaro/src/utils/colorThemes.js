// Site-wide color palettes. Each theme defines values for both light & dark.
// Applied via CSS variables on <html> at runtime by BrandingContext.

export const COLOR_THEMES = {
  green: {
    label: 'Green',
    swatch: '#00B856',
    light: {
      accent: '#00B856',
      accentLight: '#33C97A',
      accentDark: '#009E4A',
      accentRgb: '0,184,86',
    },
    dark: {
      accent: '#33C97A',
      accentLight: '#5FDA96',
      accentDark: '#00B856',
      accentRgb: '51,201,122',
    },
  },
  blue: {
    label: 'Blue',
    swatch: '#3B82F6',
    light: {
      accent: '#3B82F6',
      accentLight: '#60A5FA',
      accentDark: '#2563EB',
      accentRgb: '59,130,246',
    },
    dark: {
      accent: '#60A5FA',
      accentLight: '#93C5FD',
      accentDark: '#3B82F6',
      accentRgb: '96,165,250',
    },
  },
  purple: {
    label: 'Purple',
    swatch: '#8B5CF6',
    light: {
      accent: '#8B5CF6',
      accentLight: '#A78BFA',
      accentDark: '#7C3AED',
      accentRgb: '139,92,246',
    },
    dark: {
      accent: '#A78BFA',
      accentLight: '#C4B5FD',
      accentDark: '#8B5CF6',
      accentRgb: '167,139,250',
    },
  },
  orange: {
    label: 'Orange',
    swatch: '#F97316',
    light: {
      accent: '#F97316',
      accentLight: '#FB923C',
      accentDark: '#EA580C',
      accentRgb: '249,115,22',
    },
    dark: {
      accent: '#FB923C',
      accentLight: '#FDBA74',
      accentDark: '#F97316',
      accentRgb: '251,146,60',
    },
  },
  red: {
    label: 'Red',
    swatch: '#EF4444',
    light: {
      accent: '#EF4444',
      accentLight: '#F87171',
      accentDark: '#DC2626',
      accentRgb: '239,68,68',
    },
    dark: {
      accent: '#F87171',
      accentLight: '#FCA5A5',
      accentDark: '#EF4444',
      accentRgb: '248,113,113',
    },
  },
  teal: {
    label: 'Teal',
    swatch: '#14B8A6',
    light: {
      accent: '#14B8A6',
      accentLight: '#2DD4BF',
      accentDark: '#0D9488',
      accentRgb: '20,184,166',
    },
    dark: {
      accent: '#2DD4BF',
      accentLight: '#5EEAD4',
      accentDark: '#14B8A6',
      accentRgb: '45,212,191',
    },
  },
  indigo: {
    label: 'Indigo',
    swatch: '#6366F1',
    light: {
      accent: '#6366F1',
      accentLight: '#818CF8',
      accentDark: '#4F46E5',
      accentRgb: '99,102,241',
    },
    dark: {
      accent: '#818CF8',
      accentLight: '#A5B4FC',
      accentDark: '#6366F1',
      accentRgb: '129,140,248',
    },
  },
  rose: {
    label: 'Rose',
    swatch: '#F43F5E',
    light: {
      accent: '#F43F5E',
      accentLight: '#FB7185',
      accentDark: '#E11D48',
      accentRgb: '244,63,94',
    },
    dark: {
      accent: '#FB7185',
      accentLight: '#FDA4AF',
      accentDark: '#F43F5E',
      accentRgb: '251,113,133',
    },
  },
};

// DEMO: the fictional brand is orange. The full palette set is untouched —
// picking a different swatch in /admin/settings still works.
export const DEFAULT_COLOR_THEME = 'orange';

/**
 * Apply a color theme to the document root by setting CSS variables.
 * Listens to current data-theme (light/dark) so values match palette mode.
 */
export function applyColorTheme(themeKey) {
  const theme = COLOR_THEMES[themeKey] || COLOR_THEMES[DEFAULT_COLOR_THEME];
  const root = document.documentElement;
  const mode = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const palette = theme[mode];

  const { accent, accentLight, accentDark, accentRgb } = palette;

  root.style.setProperty('--accent', accent);
  root.style.setProperty('--accent-light', accentLight);
  root.style.setProperty('--accent-dark', accentDark);
  root.style.setProperty('--accent-bg', `rgba(${accentRgb},0.06)`);
  root.style.setProperty('--accent-bg-strong', `rgba(${accentRgb},0.12)`);
  root.style.setProperty('--input-focus', accent);
  root.style.setProperty('--ring-color', `rgba(${accentRgb},0.22)`);
  root.style.setProperty('--nav-active-bg', `rgba(${accentRgb},0.10)`);
  root.style.setProperty(
    '--header-gradient',
    `linear-gradient(135deg, ${accent} 0%, ${accentDark} 50%, ${accentDark} 100%)`,
  );
  root.style.setProperty(
    '--header-gradient-soft',
    `linear-gradient(135deg, ${accent} 0%, ${accentLight} 100%)`,
  );
  root.style.setProperty('--fab-shadow', `0 8px 24px rgba(${accentRgb},0.35)`);
  root.style.setProperty(
    '--fab-gradient',
    `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
  );
}
