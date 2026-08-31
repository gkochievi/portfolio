import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { pickLocalized } from '@/lib/localized';

/** One featured review as shipped by PublicReviewSerializer (PII-reduced). */
export interface LandingReview {
  id: number;
  rating: number;
  text: string;
  created_at: string;
  customer_name: string;
  barber_name: string;
  service_name: string;
  service_name_en: string;
}

/** Business-contact block sourced from SiteSetting rows. */
export interface LandingBusiness {
  address: { ka: string; en: string };
  phone: string;
  email: string;
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
  featured_reviews: LandingReview[];
  business: LandingBusiness;
  /** Verbatim SiteSetting map, e.g. {"facebook": url, "instagram": url}. */
  social_links: Record<string, string>;
  /** Google Maps embed URL; "" when the setting is unset. */
  map_embed_url: string;
}

export function useLandingContent() {
  return useQuery<LandingContent>({
    queryKey: ['landing'],
    queryFn: () => api.get<LandingContent>('/landing/'),
  });
}

/** Known-good project constant — used when the CMS has no facebook link yet. */
export const FACEBOOK_FALLBACK_URL = 'https://facebook.com/nabadibarbershop';

export interface BusinessInfo {
  isLoading: boolean;
  /** Localized address; falls back to the brand locale string when unset. */
  address: string;
  /** E.164 phone, '' when the shop hasn't provided one (hide the row). */
  phone: string;
  /** '' when the shop hasn't provided one (hide the row). */
  email: string;
  facebook: string;
  /** '' when there is no instagram link (hide the icon). */
  instagram: string;
  /** Google Maps embed URL, '' when unset (render the text-only fallback). */
  mapEmbedUrl: string;
  /** Google-Maps search link derived from the resolved address. */
  mapsUrl: string;
}

/**
 * Resolve the business-contact block from /landing/ with graceful fallbacks.
 * Single source of truth for the footer, /contact, and the landing VisitBand
 * so all three degrade identically when the payload is missing or errored.
 */
export function useBusinessInfo(): BusinessInfo {
  const { t, i18n } = useTranslation('home');
  const { data, isLoading } = useLandingContent();

  const biz = data?.business;
  const address =
    pickLocalized(biz?.address?.ka, biz?.address?.en, i18n.language).trim() ||
    (biz?.address?.en ?? '').trim() ||
    t('section_visit_address');

  return {
    isLoading,
    address,
    phone: (biz?.phone ?? '').trim(),
    email: (biz?.email ?? '').trim(),
    facebook: (data?.social_links?.facebook ?? '').trim() || FACEBOOK_FALLBACK_URL,
    instagram: (data?.social_links?.instagram ?? '').trim(),
    mapEmbedUrl: (data?.map_embed_url ?? '').trim(),
    mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(address)}`,
  };
}
