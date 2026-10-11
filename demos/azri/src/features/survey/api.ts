/**
 * Survey-group query hooks. Keys live under the `survey` scope, which
 * src/lib/realtime.ts never invalidates (re-validating a just-submitted token
 * would bounce the respondent to "already answered").
 * Owner: feature group survey.
 */
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { api } from '@/api/client'
import { queryKeys } from '@/api/queryKeys'
import { useLang } from '@/hooks/useLang'
import { useMeta } from '@/hooks/useMeta'
import { lt } from '@/lib/utils'
import type { ApiEnvelope, Lang, SubmitRequest, Tenant, TenantBranding, ValidateData } from '@/types'

/**
 * Validate the token once per (id, language). `gcTime: 0` drops the cached
 * answer when the page unmounts, so coming back to a spent or newly expired
 * link re-validates instead of showing a stale form. `keepPreviousData` keeps
 * the form (and its ratings) on screen while a language switch refetches.
 */
export function useValidateSurvey(surveyId: string | null, lang: Lang) {
  return useQuery({
    queryKey: queryKeys.survey.validate(surveyId ?? '', lang),
    queryFn: ({ signal }) => api.post<ApiEnvelope<ValidateData>>('/surveys/validate', { survey_id: surveyId, lang }, { signal }),
    enabled: Boolean(surveyId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

export function useSubmitSurvey() {
  return useMutation({
    mutationFn: (payload: SubmitRequest) => api.post<ApiEnvelope<{ responseId: string }>>('/surveys/responses', payload),
  })
}

/** Client-side twin of the handler's tenantBranding() (for end pages that only know `?t`). */
export function toBranding(tenant: Tenant, lang: Lang): TenantBranding {
  return {
    id: tenant.id,
    name: lt(tenant.name, lang),
    monogram: tenant.monogram,
    copyrightName: tenant.copyrightName,
    smsSender: tenant.smsSender,
    primary: tenant.primary,
    onPrimary: tenant.onPrimary,
    tint: tenant.tint,
    primaryDark: tenant.primaryDark,
  }
}

/** The tenant named by `?t=` (end pages), memoised so the frame claim is stable. */
export function useTenantFromParam(): { tenant: TenantBranding | null; loading: boolean } {
  const [params] = useSearchParams()
  const tenantId = params.get('t')
  const lang = useLang()
  const meta = useMeta()
  const tenant = useMemo(() => {
    const found = tenantId ? meta.data?.tenants.find((item) => item.id === tenantId) : undefined
    return found ? toBranding(found, lang) : null
  }, [meta.data, tenantId, lang])
  return { tenant, loading: Boolean(tenantId) && meta.isLoading }
}

/** Classify a failed validation envelope the way the source did (by message text). */
export function failureRoute(message: string, tenantId: string | undefined): string {
  const lower = message.toLowerCase()
  const t = tenantId ? `t=${encodeURIComponent(tenantId)}` : ''
  if (lower.includes('expired')) return `/expired${t ? `?${t}` : ''}`
  if (lower.includes('already completed')) return `/finished?state=already${t ? `&${t}` : ''}`
  return '/invalid'
}
