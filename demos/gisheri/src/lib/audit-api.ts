import { api } from '@/lib/api';

export interface AdminAction {
  id: number;
  actorEmail: string | null;
  actorName: string;
  verb: string;
  summary: string;
  createdAt: string;
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

export const adminAudit = {
  list: (targetType: 'order' | 'user' | 'product' | 'discount', targetId: number, limit = 50) =>
    api.get<AdminAction[]>(
      `/admin/audit${buildQuery({ target_type: targetType, target_id: targetId, limit })}`,
    ),
};
