import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListOrPaginated } from '@/lib/list';
import { toPaginated, withPage, type Paginated } from '@/lib/paginated';
import { useMutationFeedback } from './mutation-feedback';

export interface AdminPromotion {
  id: number;
  code: string;
  description: string;
  percent_off: number | null;
  amount_off: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PromotionInput = {
  code: string;
  description?: string;
  percent_off?: number | null;
  amount_off?: string | null;
  valid_from?: string | null;
  valid_until?: string | null;
  max_uses?: number | null;
  is_active?: boolean;
};

/** Server-paged promotions (newest first — Promotion.Meta ordering). */
export function useAdminPromotions(page = 1) {
  return useQuery<Paginated<AdminPromotion>>({
    queryKey: ['admin-promotions', page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AdminPromotion>>(withPage('/admin/promotions/', page)),
      ),
    placeholderData: keepPreviousData,
  });
}

export function useAdminCreatePromotion() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: PromotionInput) => api.post<AdminPromotion>('/admin/promotions/', vars),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdatePromotion() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number } & Partial<PromotionInput>) => {
      const { id, ...body } = vars;
      return api.patch<AdminPromotion>(`/admin/promotions/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminDeletePromotion() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (id: number) => api.delete<void>(`/admin/promotions/${id}/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promotions'] });
      feedback.deleted();
    },
    onError: feedback.error,
  });
}
