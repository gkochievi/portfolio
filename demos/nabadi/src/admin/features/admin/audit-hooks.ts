import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ListOrPaginated } from '@/lib/list';
import { toPaginated, withPage, type Paginated } from '@/lib/paginated';

export interface AuditEntry {
  id: number;
  created_at: string;
  actor: number | null;
  actor_phone: string;
  actor_first_name: string;
  actor_last_name: string;
  actor_role: string;
  action: string;
  entity: string;
  entity_id: string;
  payload: Record<string, unknown>;
  ip: string | null;
  user_agent: string;
}

export interface AuditFilters {
  action?: string;
  entity?: string;
  actor_id?: number;
  date_from?: string;
  date_to?: string;
}

function qs(filters: AuditFilters): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '' && v !== null)
      parts.push(`${k}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Server-paged audit log (spec §9.14: searchable, paginated table). */
export function useAdminAudit(filters: AuditFilters, page = 1) {
  return useQuery<Paginated<AuditEntry>>({
    queryKey: ['admin-audit', filters, page],
    queryFn: async () =>
      toPaginated(
        await api.get<ListOrPaginated<AuditEntry>>(withPage(`/admin/audit/${qs(filters)}`, page)),
      ),
    placeholderData: keepPreviousData,
  });
}
