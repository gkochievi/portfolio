import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListOrPaginated } from '@/lib/list';
import { fetchAllPages, toPaginated, withPage, type Paginated } from '@/lib/paginated';
import { useMutationFeedback } from './mutation-feedback';

/** Shape of AdminReviewSerializer (backend/apps/admin_api/serializers/reviews.py). */
export interface AdminReview {
  id: number;
  booking_id: number;
  rating: number;
  text: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_phone: string;
  barber_id: number;
  barber_name: string;
  service_name: string;
  booking_start_at: string;
}

export interface ReviewsFilters {
  is_published?: 'true' | 'false';
  barber_id?: number;
  rating?: number;
}

function qs(filters: ReviewsFilters): string {
  const parts: string[] = [];
  if (filters.is_published) parts.push(`is_published=${filters.is_published}`);
  if (filters.barber_id) parts.push(`barber_id=${filters.barber_id}`);
  if (filters.rating) parts.push(`rating=${filters.rating}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Server-paged moderation queue (newest first — viewset ordering). */
export function useAdminReviews(filters: ReviewsFilters = {}, page = 1) {
  return useQuery<Paginated<AdminReview>>({
    queryKey: ['admin-reviews', filters, page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AdminReview>>(
          withPage(`/admin/reviews/${qs(filters)}`, page),
        ),
      ),
    placeholderData: keepPreviousData,
  });
}

/**
 * Every published review, all pages — the landing featured-picker must be
 * able to resolve ANY selected id (not just the current page) and render
 * its text/stars. Published volume is moderate; MAX_PAGES caps runaway.
 */
export function useAdminPublishedReviewsAll() {
  return useQuery<AdminReview[]>({
    queryKey: ['admin-reviews', 'published-all'],
    queryFn: () => fetchAllPages<AdminReview>('/admin/reviews/?is_published=true'),
  });
}

export function useAdminPublishReview() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.post<AdminReview>(`/admin/reviews/${id}/publish/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      feedback.success('toast.review_published');
    },
    onError: feedback.error,
  });
}

export function useAdminUnpublishReview() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.post<AdminReview>(`/admin/reviews/${id}/unpublish/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      feedback.success('toast.review_unpublished');
    },
    onError: feedback.error,
  });
}

export function useAdminDeleteReview() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/reviews/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}
