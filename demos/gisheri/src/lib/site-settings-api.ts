import { api } from '@/lib/api';

export interface SiteSettings {
  heroTitleEn: string;
  heroTitleKa: string;
  heroSubtitleEn: string;
  heroSubtitleKa: string;
  heroImage: string;
  heroCtaLabelEn: string;
  heroCtaLabelKa: string;
  heroCtaLink: string;
  bannerTextEn: string;
  bannerTextKa: string;
  bannerLink: string;
  bannerActive: boolean;
  featuredCollectionSlugs: string[];
  siteName: string;
  defaultOgImage: string;
  twitterHandle: string;
  defaultRobots: string;
  updatedAt: string;
}

export type SiteSettingsInput = Omit<SiteSettings, 'updatedAt'>;

export interface PageSeo {
  id: number;
  path: string;
  titleEn: string;
  titleKa: string;
  descriptionEn: string;
  descriptionKa: string;
  ogImage: string;
  robots: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageSeoInput {
  path: string;
  titleEn: string;
  titleKa: string;
  descriptionEn: string;
  descriptionKa: string;
  ogImage: string;
  robots: string;
}

export const siteSettingsApi = {
  get: () => api.get<SiteSettings>('/site-settings', { skipAuth: true }),
  listPageSeo: () => api.get<PageSeo[]>('/site-settings/page-seo', { skipAuth: true }),
};

export const adminSiteSettings = {
  get: () => api.get<SiteSettings>('/admin/site-settings'),
  update: (input: Partial<SiteSettingsInput>) =>
    api.patch<SiteSettings>('/admin/site-settings', input),
};

export const adminPageSeo = {
  list: () => api.get<PageSeo[]>('/admin/page-seo'),
  get: (id: number) => api.get<PageSeo>(`/admin/page-seo/${id}`),
  create: (input: PageSeoInput) => api.post<PageSeo>('/admin/page-seo', input),
  update: (id: number, input: PageSeoInput) => api.patch<PageSeo>(`/admin/page-seo/${id}`, input),
  remove: (id: number) => api.delete<void>(`/admin/page-seo/${id}`),
};
