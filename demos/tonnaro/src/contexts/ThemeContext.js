import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { theme as antdTheme } from 'antd';
import { useBranding } from './BrandingContext';
import { COLOR_THEMES, DEFAULT_COLOR_THEME } from '../utils/colorThemes';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const { colorTheme } = useBranding();
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark((d) => !d), []);

  const palette = (COLOR_THEMES[colorTheme] || COLOR_THEMES[DEFAULT_COLOR_THEME])[isDark ? 'dark' : 'light'];
  const primary = palette.accent;
  const primaryHover = palette.accentLight;
  const primaryRgb = palette.accentRgb;

  const antdThemeConfig = {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorSuccess: isDark ? '#34d399' : '#10b981',
      colorWarning: isDark ? '#fbbf24' : '#f59e0b',
      colorError: isDark ? '#f87171' : '#ef4444',
      colorInfo: isDark ? '#60a5fa' : '#3b82f6',
      borderRadius: 12,
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      colorBgContainer: isDark ? '#1c1e27' : '#ffffff',
      colorBgElevated: isDark ? '#22252f' : '#ffffff',
      colorBgLayout: isDark ? '#111318' : '#f6f8fb',
      colorBorder: isDark ? '#2a2d3a' : '#e5e7eb',
      colorBorderSecondary: isDark ? '#22252f' : '#f3f4f6',
      controlHeight: 42,
      controlHeightLG: 50,
      fontSize: 14,
      colorText: isDark ? '#f3f4f6' : '#111827',
      colorTextSecondary: isDark ? '#9ca3af' : '#4b5563',
      colorTextTertiary: isDark ? '#6b7280' : '#9ca3af',
      colorTextQuaternary: isDark ? '#4b5563' : '#d1d5db',
    },
    components: {
      Button: {
        borderRadius: 10,
        controlHeight: 40,
        controlHeightLG: 48,
        fontWeight: 600,
        primaryShadow: `0 2px 8px rgba(${primaryRgb},0.25)`,
      },
      Input: {
        borderRadius: 10,
        controlHeight: 44,
        activeBorderColor: primary,
        hoverBorderColor: primaryHover,
        colorBgContainer: isDark ? '#13151b' : '#f9fafb',
      },
      Select: {
        borderRadius: 10,
        controlHeight: 44,
        colorBgContainer: isDark ? '#13151b' : '#f9fafb',
      },
      Card: {
        borderRadiusLG: 16,
        colorBorderSecondary: isDark ? '#1f2128' : '#e5e7eb',
      },
      Modal: {
        borderRadiusLG: 20,
      },
      Table: {
        borderRadius: 12,
        headerBg: isDark ? '#16181f' : '#f9fafb',
        rowHoverBg: `rgba(${primaryRgb},${isDark ? 0.04 : 0.02})`,
      },
      Tag: {
        borderRadiusSM: 6,
      },
      Menu: {
        borderRadius: 10,
      },
      Descriptions: {
        borderRadius: 12,
      },
    },
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, antdThemeConfig }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
