/** Toasts: `toast.success('Saved')`, `toast.error(msg)`, `toast.promise(p, {...})`. The <Toaster> is mounted once by RootLayout. */
export { toast } from 'sonner'

/**
 * Chart series colours in brand order (primary, accent, info, success, muted).
 * CSS variables, so they follow light/dark automatically; recharts accepts them as fill/stroke.
 */
export const chartColors = {
  series: [
    'var(--color-primary)',
    'var(--color-accent)',
    'var(--color-info)',
    'var(--color-success)',
    'var(--color-muted)',
    'var(--color-warning)',
    'var(--color-danger)',
  ],
  primary: 'var(--color-primary)',
  accent: 'var(--color-accent)',
  info: 'var(--color-info)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  muted: 'var(--color-muted)',
  grid: 'var(--color-line)',
  axis: 'var(--color-muted)',
  ink: 'var(--color-ink)',
  panel: 'var(--color-panel)',
} as const

/** Shared recharts props for axes / grid / tooltip so every chart matches. */
export const chartTheme = {
  axis: { stroke: 'var(--color-line)', tick: { fill: 'var(--color-muted)', fontSize: 11 }, tickLine: false },
  grid: { stroke: 'var(--color-line)', strokeDasharray: '2 4', vertical: false },
  tooltip: {
    contentStyle: {
      background: 'var(--color-panel)',
      border: '1px solid var(--color-line)',
      borderRadius: 10,
      color: 'var(--color-ink)',
      fontSize: 12,
      boxShadow: 'var(--shadow-pop)',
    },
    labelStyle: { color: 'var(--color-muted)' },
    cursor: { fill: 'var(--color-ink)', fillOpacity: 0.05 },
  },
} as const
