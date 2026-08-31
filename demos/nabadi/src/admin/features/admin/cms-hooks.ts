import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/paginated';
import { useMutationFeedback } from './mutation-feedback';

export interface SiteSetting {
  id: number;
  key: string;
  value: unknown;
  description: string;
  updated_at: string;
}

export interface LandingContent {
  hero_heading_ka: string;
  hero_heading_en: string;
  hero_subheading_ka: string;
  hero_subheading_en: string;
  hero_image_url: string;
  about_text_ka: string;
  about_text_en: string;
  gallery_image_urls: string[];
  /** Published-review ids featured on the landing page (admin serializer). */
  featured_review_ids: number[];
  updated_at: string;
}

// ---- SiteSetting ---------------------------------------------------------

export function useAdminSiteSettings() {
  // All pages: the Settings page indexes rows by key and must see every one.
  return useQuery<SiteSetting[]>({
    queryKey: ['admin-site-settings'],
    queryFn: () => fetchAllPages<SiteSetting>('/admin/settings/'),
  });
}

export function useAdminCreateSiteSetting() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { key: string; value: unknown; description?: string }) =>
      api.post<SiteSetting>('/admin/settings/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-site-settings'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateSiteSetting() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; value: unknown; description?: string }) => {
      const { id, ...body } = vars;
      return api.patch<SiteSetting>(`/admin/settings/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-site-settings'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteSiteSetting() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/settings/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-site-settings'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}

// ---- LandingContent ------------------------------------------------------

export function useAdminLanding() {
  return useQuery<LandingContent>({
    queryKey: ['admin-landing'],
    queryFn: () => api.get<LandingContent>('/admin/landing/'),
  });
}

export function useAdminUpdateLanding() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: Partial<LandingContent>) =>
      api.patch<LandingContent>('/admin/landing/1/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-landing'] });
      qc.invalidateQueries({ queryKey: ['landing'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}
