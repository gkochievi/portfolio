/**
 * Raw palette for places that cannot take a Tailwind class: the game canvas
 * and Recharts. Use `useBrandColors()` so charts follow the light/dark theme.
 */
import { useResolvedTheme } from '@/shell/theme'

export interface BrandColors {
  primary: string
  onPrimary: string
  primaryEdge: string
  accent: string
  accentInk: string
  surface: string
  panel: string
  sunken: string
  line: string
  ink: string
  muted: string
  success: string
  warning: string
  danger: string
  info: string
  ownRow: string
  skyTop: string
  skyBottom: string
  /** Categorical series order for charts: glacier, persimmon, ink/frost, info, success. */
  series: readonly string[]
}

export const LIGHT: BrandColors = {
  primary: '#0A6F94',
  onPrimary: '#FFFFFF',
  primaryEdge: '#06506B',
  accent: '#FF6B3D',
  accentInk: '#C2410C',
  surface: '#F3F7F6',
  panel: '#FFFFFF',
  sunken: '#E7F0F0',
  line: '#D3E2E4',
  ink: '#0B2A31',
  muted: '#4A666C',
  success: '#17804A',
  warning: '#A65300',
  danger: '#C42B3A',
  info: '#2860C4',
  ownRow: '#FFE3D8',
  skyTop: '#F3F7F6',
  skyBottom: '#DCEAEE',
  series: ['#0A6F94', '#FF6B3D', '#0B2A31', '#2860C4', '#17804A'],
}

export const DARK: BrandColors = {
  primary: '#38B6D6',
  onPrimary: '#071B20',
  primaryEdge: '#1D7C95',
  accent: '#FF6B3D',
  accentInk: '#FF9066',
  surface: '#071B20',
  panel: '#0F2A31',
  sunken: '#0A2329',
  line: '#1E3D45',
  ink: '#E6F2F1',
  muted: '#93B3B8',
  success: '#4CC98A',
  warning: '#F0A24A',
  danger: '#FF7A85',
  info: '#7FA8F5',
  ownRow: '#47291D',
  skyTop: '#0D2B33',
  skyBottom: '#071B20',
  series: ['#38B6D6', '#FF6B3D', '#E6F2F1', '#7FA8F5', '#4CC98A'],
}

export function brandColors(theme: 'light' | 'dark'): BrandColors {
  return theme === 'dark' ? DARK : LIGHT
}

/** The palette for the current theme; re-renders when the theme flips. */
export function useBrandColors(): BrandColors {
  return brandColors(useResolvedTheme())
}

/** Shared Recharts styling: axis ticks, grid and tooltip in brand tokens. */
export function chartTheme(c: BrandColors) {
  return {
    axisTick: { fill: c.muted, fontSize: 12, fontFamily: 'Onest Variable, Noto Sans Georgian Variable, sans-serif' },
    axisLine: { stroke: c.line },
    grid: { stroke: c.line, strokeDasharray: '3 4' },
    tooltip: {
      contentStyle: {
        background: c.panel,
        border: `1.5px solid ${c.line}`,
        borderRadius: 10,
        color: c.ink,
        fontSize: 13,
        boxShadow: '0 10px 24px -14px rgba(11,42,49,.35)',
      },
      labelStyle: { color: c.muted, fontWeight: 600 },
      cursor: { fill: c.sunken },
    },
  }
}
