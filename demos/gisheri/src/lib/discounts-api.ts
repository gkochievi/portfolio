import { api } from '@/lib/api';

export type DiscountKind = 'percent' | 'fixed';

export interface Discount {
  id: number;
  code: string;
  kind: DiscountKind;
  value: string;
  minOrderTotal: string;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DiscountInput {
  code: string;
  kind: DiscountKind;
  value: string | number;
  minOrderTotal: string | number;
  maxUses: number | null;
  expiresAt: string | null;
  isActive: boolean;
}

export interface DiscountListResponse {
  items: Discount[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DiscountValidateResult {
  valid: true;
  code: string;
  kind: DiscountKind;
  value: string;
  discountAmount: string;
  finalTotal: string;
}

const buildQuery = (params: Record<string, unknown>): string => {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, String(v));
  });
  const s = sp.toString();
  return s ? `?${s}` : '';
};

export const discountsApi = {
  validate: (code: string, subtotal: number | string) =>
    api.post<DiscountValidateResult>('/discounts/validate', { code, subtotal }),
};

export type DiscountBulkAction = 'activate' | 'deactivate' | 'delete';

export const adminDiscounts = {
  list: (
    params: {
      q?: string;
      isActive?: boolean;
      kind?: DiscountKind | '';
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) =>
    api.get<DiscountListResponse>(
      `/admin/discounts${buildQuery({
        q: params.q,
        is_active: params.isActive,
        kind: params.kind,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        page: params.page,
        page_size: params.pageSize,
      })}`,
    ),
  get: (id: number) => api.get<Discount>(`/admin/discounts/${id}`),
  create: (input: DiscountInput) => api.post<Discount>('/admin/discounts', input),
  update: (id: number, input: DiscountInput) => api.patch<Discount>(`/admin/discounts/${id}`, input),
  remove: (id: number) => api.delete<void>(`/admin/discounts/${id}`),
  bulk: (ids: number[], action: DiscountBulkAction) =>
    api.post<{ affected: number }>('/admin/discounts/bulk', { ids, action }),
};
