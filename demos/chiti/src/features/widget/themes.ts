/**
 * Client theme presets for the widget. The widget root always sets a complete
 * token set, so it looks the same in the console's light and dark mode.
 */
import type { CSSProperties } from 'react'

import type { ThemePreset } from '@/types'

type Tokens = Record<string, string>

const LIGHT: Tokens = {
  '--c-bg': '#fbf7ee',
  '--c-panel': '#fffdf8',
  '--c-sunken': '#f4eedf',
  '--c-hover': '#f1ead8',
  '--c-ink': '#1e1b12',
  '--c-muted': '#665f4e',
  '--c-line': '#e7dfcb',
  '--c-line-strong': '#8c846e',
  '--c-primary': '#f2c12e',
  '--c-primary-hover': '#e8b51c',
  '--c-on-primary': '#1e1b12',
  '--c-accent': '#4e5c17',
  '--c-accent-hover': '#3f4b11',
  '--c-on-accent': '#fffdf8',
  '--c-accent-soft': '#eef0d9',
  '--c-success': '#3a7424',
  '--c-success-soft': '#e6f0dc',
  '--c-warning': '#a65400',
  '--c-warning-soft': '#f8e9d5',
  '--c-danger': '#b02a1f',
  '--c-danger-soft': '#f7e1dc',
  '--c-info': '#4d5866',
  '--c-info-soft': '#e7eaee',
  '--c-hard-shadow': '#1e1b12',
  '--c-overlay': 'rgb(30 27 18 / 0.45)',
  '--c-pop-shadow': '0 8px 24px rgb(30 27 18 / 0.12)',
}

const NIGHT: Tokens = {
  '--c-bg': '#13130d',
  '--c-panel': '#1e1f16',
  '--c-sunken': '#18190f',
  '--c-hover': '#26271c',
  '--c-ink': '#f3eddc',
  '--c-muted': '#a9a28c',
  '--c-line': '#2c2d22',
  '--c-line-strong': '#7a765f',
  '--c-primary': '#f2c12e',
  '--c-primary-hover': '#e8b51c',
  '--c-on-primary': '#1e1b12',
  '--c-accent': '#c3d06e',
  '--c-accent-hover': '#d2dd86',
  '--c-on-accent': '#13130d',
  '--c-accent-soft': '#2a2e17',
  '--c-success': '#8cc46e',
  '--c-success-soft': '#22301a',
  '--c-warning': '#f0a04b',
  '--c-warning-soft': '#3a2a14',
  '--c-danger': '#f08a7e',
  '--c-danger-soft': '#3b201b',
  '--c-info': '#a9b6c6',
  '--c-info-soft': '#232830',
  '--c-hard-shadow': '#000000',
  '--c-overlay': 'rgb(0 0 0 / 0.6)',
  '--c-pop-shadow': '0 8px 24px rgb(0 0 0 / 0.45)',
}

const PRESETS: Record<ThemePreset, Tokens> = {
  canary: {},
  olive: { '--c-primary': '#6b7a24', '--c-primary-hover': '#5b6a1c', '--c-on-primary': '#fffdf8' },
  clay: {
    '--c-primary': '#c4663a', '--c-primary-hover': '#b25a31', '--c-on-primary': '#fffdf8',
    '--c-accent': '#8a3f1e', '--c-accent-hover': '#733416', '--c-accent-soft': '#f6e4d9',
  },
  plum: {
    '--c-primary': '#7a3b69', '--c-primary-hover': '#693158', '--c-on-primary': '#fffdf8',
    '--c-accent': '#6b2d5c', '--c-accent-hover': '#58244b', '--c-accent-soft': '#f3e3ef',
  },
  moss: {
    '--c-primary': '#3f6b4a', '--c-primary-hover': '#345a3e', '--c-on-primary': '#fffdf8',
    '--c-accent': '#2f5238', '--c-accent-hover': '#264330', '--c-accent-soft': '#e1eee3',
  },
  slate: {
    '--c-primary': '#4d5866', '--c-primary-hover': '#3f4955', '--c-on-primary': '#fffdf8',
    '--c-accent': '#3b4552', '--c-accent-hover': '#2e3641', '--c-accent-soft': '#e7eaee',
  },
  night: {},
  paper: {
    '--c-primary': '#1e1b12', '--c-primary-hover': '#38342a', '--c-on-primary': '#fbf7ee',
    '--c-accent': '#1e1b12', '--c-accent-hover': '#38342a', '--c-accent-soft': '#f1ecdd',
  },
}

export const THEME_PRESETS = Object.keys(PRESETS) as ThemePreset[]

/** Inline style for the widget root (or the launcher host). */
export function themeStyle(theme: ThemePreset): CSSProperties {
  const base = theme === 'night' ? NIGHT : LIGHT
  return { ...base, ...PRESETS[theme], colorScheme: theme === 'night' ? 'dark' : 'light' } as CSSProperties
}

export function isDarkTheme(theme: ThemePreset): boolean {
  return theme === 'night'
}

/** Swatch colour for the demo panel's theme picker. */
export function themeSwatch(theme: ThemePreset): string {
  if (theme === 'night') return '#13130d'
  return PRESETS[theme]['--c-primary'] ?? LIGHT['--c-primary'] ?? '#f2c12e'
}
