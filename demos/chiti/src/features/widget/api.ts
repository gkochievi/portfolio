/** Query hooks for the widget feature (public endpoints + the storefront demo panel). */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { request } from '@/lib/api'
import { useInvalidateOn } from '@/lib/realtime'
import type { DemoControls, ThemePreset, WidgetPosition } from '@/types'

import type { HoursMode, WidgetConfig } from '@/demo/handlers/widget'

export type { HoursMode, WidgetConfig }

export const widgetKeys = {
  config: (slug: string) => ['widget', 'config', slug] as const,
  controls: ['widget', 'controls'] as const,
}

export function useWidgetConfig(slug: string) {
  const query = useQuery({
    queryKey: widgetKeys.config(slug),
    queryFn: () => request<WidgetConfig>('GET', `/widget/${encodeURIComponent(slug)}/config`),
    staleTime: 0,
  })
  useInvalidateOn(['settings:update', 'working-hours:update', 'tenant:upsert', 'demo:reset'], widgetKeys.config(slug))
  return query
}

export function useDemoControls() {
  const query = useQuery({
    queryKey: widgetKeys.controls,
    queryFn: () => request<DemoControls>('GET', '/demo/controls'),
  })
  useInvalidateOn(['demo:controls', 'demo:reset'], widgetKeys.controls)
  return query
}

export function usePatchDemoControls() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<DemoControls> & { aiOutageSeconds?: number }) => request<DemoControls>('PATCH', '/demo/controls', { body: patch }),
    onSuccess: (controls) => client.setQueryData(widgetKeys.controls, controls),
  })
}

export interface WidgetControlsPatch {
  slug?: string
  widgetPosition?: WidgetPosition
  clientTheme?: ThemePreset
  aiBotEnabled?: boolean
  hoursMode?: HoursMode
}

export function usePatchWidgetControls(slug: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch: WidgetControlsPatch) => request<WidgetConfig>('PATCH', '/demo/widget-controls', { body: { slug, ...patch } }),
    onSuccess: (config) => client.setQueryData(widgetKeys.config(slug), config),
  })
}
