import { useQuery } from '@tanstack/react-query';
import { siteSettingsApi } from '@/lib/site-settings-api';

export const useSiteSettings = () =>
  useQuery({
    queryKey: ['site-settings'],
    queryFn: siteSettingsApi.get,
    staleTime: 60 * 1000, // 1 minute — settings can change while admin is editing
  });

export const useAllPageSeo = () =>
  useQuery({
    queryKey: ['page-seo'],
    queryFn: siteSettingsApi.listPageSeo,
    staleTime: 60 * 1000,
  });

/** Pick the right language variant from a `*_en` / `*_ka` pair. */
export const pickLang = (en: string, ka: string, lang: string): string => {
  const value = lang === 'ka' ? ka : en;
  return value || ka || en || '';
};
