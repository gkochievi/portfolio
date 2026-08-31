import { api } from '@/lib/api';

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string;
  size: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface Order {
  id: number;
  status: OrderStatus;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  adminNotes: string;
  customerOrderCount: number | null;
  subtotal: string;
  discountCode: string;
  discountAmount: string;
  total: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderAdminUpdate {
  status?: OrderStatus;
  adminNotes?: string;
}

export interface AdminOrderListItem {
  id: number;
  status: OrderStatus;
  fullName: string;
  email: string;
  total: string;
  itemCount: number;
  createdAt: string;
}

export interface OrderListResponse<T = Order> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrderCreateInput {
  items: { productId: number; size: string; quantity: number }[];
  fullName: string;
  email: string;
  phone: string;
  city: string;
  address: string;
  notes?: string;
  discountCode?: string;
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

export const ordersApi = {
  create: (input: OrderCreateInput) => api.post<Order>('/orders', input),
  listMine: (page = 1, pageSize = 20) =>
    api.get<OrderListResponse>(`/orders${buildQuery({ page, page_size: pageSize })}`),
  getMine: (id: number) => api.get<Order>(`/orders/${id}`),
};

export const adminOrdersApi = {
  list: (
    params: {
      q?: string;
      status?: OrderStatus | '';
      userId?: number;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) =>
    api.get<OrderListResponse<AdminOrderListItem>>(
      `/admin/orders${buildQuery({
        q: params.q,
        status: params.status,
        user_id: params.userId,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        page: params.page,
        page_size: params.pageSize,
      })}`,
    ),
  get: (id: number) => api.get<Order>(`/admin/orders/${id}`),
  update: (id: number, patch: OrderAdminUpdate) =>
    api.patch<Order>(`/admin/orders/${id}`, patch),
  updateStatus: (id: number, status: OrderStatus) =>
    api.patch<Order>(`/admin/orders/${id}`, { status }),
  bulkUpdateStatus: (ids: number[], status: OrderStatus) =>
    api.post<{ updated: number }>('/admin/orders/bulk-status', { ids, status }),
  create: (input: OrderCreateInput) => api.post<Order>('/admin/orders', input),
  addItem: (
    orderId: number,
    input: { productId: number; size: string; quantity: number },
  ) => api.post<Order>(`/admin/orders/${orderId}/items`, input),
  updateItem: (
    orderId: number,
    itemId: number,
    input: { quantity?: number; size?: string },
  ) => api.patch<Order>(`/admin/orders/${orderId}/items/${itemId}`, input),
  removeItem: (orderId: number, itemId: number) =>
    api.delete<Order>(`/admin/orders/${orderId}/items/${itemId}`),
};
