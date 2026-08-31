/**
 * Typed wrappers around the /api/admin/* endpoints.
 *
 * All functions delegate to the shared `api` wrapper in src/lib/api.ts so
 * JWT injection + 401 refresh + ApiError are handled uniformly.
 */
import { api, tokenStore } from '@/lib/api';
import type { Role } from '@/context/auth';
import { DemoApiError } from '@/demo/base';
import { dispatch } from '@/demo/router';

// The one endpoint that does not go through the `api` wrapper builds its own
// URL, so it needs the same base the seam uses. Upstream this was
// `import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'`; see the note
// above `API_BASE` in src/lib/api.ts for why it is derived from the deploy base.
const API_URL = `${import.meta.env.BASE_URL}api`;

// --- Products ---

export type Purpose = 'luck' | 'protection' | 'love' | 'safety' | 'energy' | 'balance';
export type ZodiacSign =
  | 'aries' | 'taurus' | 'gemini' | 'cancer'
  | 'leo' | 'virgo' | 'libra' | 'scorpio'
  | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';
export type Gender = 'men' | 'women' | 'unisex';

export interface AdminProduct {
  id: number;
  name: string;
  nameKa: string;
  price: string;
  originalPrice: string | null;
  image: string;
  purposes: Purpose[];
  zodiacSigns: ZodiacSign[];
  stones: string[];
  stonesMeaning: string;
  stonesMeaningKa: string;
  description: string;
  descriptionKa: string;
  gender: Gender;
  isBestseller: boolean;
  isNew: boolean;
}

export interface AdminProductInput {
  name: string;
  nameKa?: string;
  price: string | number;
  originalPrice?: string | number | null;
  image?: string;
  purposes?: Purpose[];
  zodiacSigns?: ZodiacSign[];
  stones?: string[];
  stonesMeaning?: string;
  stonesMeaningKa?: string;
  description?: string;
  descriptionKa?: string;
  gender?: Gender;
  isBestseller?: boolean;
  isNew?: boolean;
}

export interface ProductListParams {
  q?: string;
  gender?: Gender | '';
  isBestseller?: boolean;
  isNew?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ProductListResponse {
  items: AdminProduct[];
  total: number;
  page: number;
  pageSize: number;
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

export type ProductBulkAction =
  | 'set_bestseller'
  | 'unset_bestseller'
  | 'set_new'
  | 'unset_new'
  | 'delete';

export const adminProducts = {
  list: (params: ProductListParams = {}) =>
    api.get<ProductListResponse>(
      `/admin/products${buildQuery({
        q: params.q,
        gender: params.gender,
        is_bestseller: params.isBestseller,
        is_new: params.isNew,
        page: params.page,
        page_size: params.pageSize,
      })}`,
    ),
  get: (id: number) => api.get<AdminProduct>(`/admin/products/${id}`),
  create: (input: AdminProductInput) => api.post<AdminProduct>('/admin/products', input),
  update: (id: number, input: AdminProductInput) =>
    api.patch<AdminProduct>(`/admin/products/${id}`, input),
  remove: (id: number) => api.delete<void>(`/admin/products/${id}`),
  bulk: (ids: number[], action: ProductBulkAction) =>
    api.post<{ affected: number }>('/admin/products/bulk', { ids, action }),
};

// --- Image upload (multipart, bypass JSON wrapper) ---

export interface UploadedImage {
  url: string;
  path: string;
}

export const uploadImage = async (file: File): Promise<UploadedImage> => {
  const form = new FormData();
  form.append('file', file);
  // The `FormData` is handed to `dispatch` intact rather than serialised: the
  // handler is the multipart parser here, and it reads the `file` part back out
  // with `form.get('file')` exactly as Ninja's `UploadedFile` did.
  try {
    return await dispatch<UploadedImage>('POST', `${API_URL}/admin/uploads/image`, {
      body: form,
      token: tokenStore.getAccess(),
    });
  } catch (error) {
    // Upstream threw the raw response text, so a rejected upload surfaced in the
    // form as a paragraph of JSON. That is ugly and it is what the console
    // shows, so it is reproduced rather than tidied — a demo that quietly fixes
    // the product's rough edges is showing something other than the product.
    throw new Error(error instanceof DemoApiError ? JSON.stringify(error.body) : 'Upload failed');
  }
};

// --- Users ---

export interface AdminUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
  dateJoined: string;
  lastLogin: string | null;
}

export interface AdminUserDetail extends AdminUser {
  orderCount: number;
  totalSpent: string;
  lastOrderAt: string | null;
}

export interface AdminUserListParams {
  q?: string;
  role?: Role | '';
  isActive?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserUpdateInput {
  firstName: string;
  lastName: string;
  role: Role;
  isActive: boolean;
}

export interface AdminUserCreateInput extends AdminUserUpdateInput {
  email: string;
  password: string;
}

export type UserBulkAction = 'activate' | 'deactivate';

export const adminUsers = {
  list: (params: AdminUserListParams = {}) =>
    api.get<AdminUserListResponse>(
      `/admin/users${buildQuery({
        q: params.q,
        role: params.role,
        is_active: params.isActive,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        page: params.page,
        page_size: params.pageSize,
      })}`,
    ),
  get: (id: number) => api.get<AdminUserDetail>(`/admin/users/${id}`),
  create: (input: AdminUserCreateInput) => api.post<AdminUser>('/admin/users', input),
  update: (id: number, input: AdminUserUpdateInput) =>
    api.patch<AdminUserDetail>(`/admin/users/${id}`, input),
  bulk: (ids: number[], action: UserBulkAction) =>
    api.post<{ affected: number; skippedSelf: boolean }>('/admin/users/bulk', { ids, action }),
};

// --- Dashboard ---

export type OrderStatusKey = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface DashboardRecentOrder {
  id: number;
  fullName: string;
  email: string;
  status: OrderStatusKey;
  total: string;
  createdAt: string;
}

export interface DashboardStats {
  productCount: number;
  userCount: number;
  activeDiscountCount: number;
  orderCount: number;
  totalRevenue: string;
  ordersByStatus: { status: OrderStatusKey; count: number }[];
  recentOrders: DashboardRecentOrder[];
}

export const adminDashboard = {
  stats: () => api.get<DashboardStats>('/admin/dashboard/stats'),
};

// --- Collections (admin) ---

export interface AdminCollection {
  id: number;
  slug: string;
  name: string;
  nameKa: string;
  description: string;
  descriptionKa: string;
  image: string;
}

export interface AdminCollectionInput {
  slug: string;
  name: string;
  nameKa: string;
  description: string;
  descriptionKa: string;
  image: string;
}

export const adminCollections = {
  list: () => api.get<{ items: AdminCollection[]; total: number }>('/admin/collections'),
  get: (id: number) => api.get<AdminCollection>(`/admin/collections/${id}`),
  create: (input: AdminCollectionInput) => api.post<AdminCollection>('/admin/collections', input),
  update: (id: number, input: AdminCollectionInput) =>
    api.patch<AdminCollection>(`/admin/collections/${id}`, input),
  remove: (id: number) => api.delete<void>(`/admin/collections/${id}`),
};

// --- Zodiac (admin) — edit-only ---

export interface AdminZodiac {
  sign: string;
  name: string;
  nameKa: string;
  symbol: string;
  dates: string;
  datesKa: string;
  element: string;
  elementKa: string;
  stones: string[];
  description: string;
  descriptionKa: string;
}

export interface AdminZodiacInput {
  name: string;
  nameKa: string;
  dates: string;
  datesKa: string;
  element: string;
  elementKa: string;
  description: string;
  descriptionKa: string;
}

export const adminZodiac = {
  list: () => api.get<AdminZodiac[]>('/admin/zodiac'),
  get: (sign: string) => api.get<AdminZodiac>(`/admin/zodiac/${sign}`),
  update: (sign: string, input: AdminZodiacInput) =>
    api.patch<AdminZodiac>(`/admin/zodiac/${sign}`, input),
};
