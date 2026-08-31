import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useMutationFeedback } from './mutation-feedback';

/**
 * BarberService management — nested under /api/admin/barbers/{id}/services/
 * (admin-only, spec §5/§9.4). Row shape mirrors BarberServiceAdminOutSerializer:
 * catalog base values + overrides + resolved effective values (what the
 * booking pipeline actually charges/blocks).
 */
export interface AdminBarberService {
  id: number;
  service_id: number;
  service_name: string;
  service_name_en: string;
  service_is_active: boolean;
  base_price: string;
  base_duration_minutes: number;
  price_override: string | null;
  duration_override: number | null;
  effective_price: string;
  effective_duration_minutes: number;
}

export function useAdminBarberServices(barberId: number | null) {
  return useQuery<AdminBarberService[]>({
    queryKey: ['admin-barber-services', barberId],
    // Unpaginated array — the endpoint returns every assignment at once.
    queryFn: () => api.get<AdminBarberService[]>(`/admin/barbers/${barberId}/services/`),
    enabled: !!barberId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, barberId: number) {
  qc.invalidateQueries({ queryKey: ['admin-barber-services', barberId] });
  // service_count on the barbers list + detail comes from this relation.
  qc.invalidateQueries({ queryKey: ['admin-barbers'] });
  qc.invalidateQueries({ queryKey: ['admin-barber', barberId] });
}

export function useAdminAssignBarberService() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: {
      barberId: number;
      service_id: number;
      price_override?: string | null;
      duration_override?: number | null;
    }) => {
      const { barberId, ...body } = vars;
      return api.post<AdminBarberService>(`/admin/barbers/${barberId}/services/`, body);
    },
    onSuccess: (_d, vars) => {
      invalidate(qc, vars.barberId);
      feedback.created();
    },
    onError: feedback.error,
  });
}

export function useAdminUpdateBarberService() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    // JSON null clears an override; omitting the field leaves it untouched.
    mutationFn: (vars: {
      barberId: number;
      barberServiceId: number;
      price_override?: string | null;
      duration_override?: number | null;
    }) => {
      const { barberId, barberServiceId, ...body } = vars;
      return api.patch<AdminBarberService>(
        `/admin/barbers/${barberId}/services/${barberServiceId}/`,
        body,
      );
    },
    onSuccess: (_d, vars) => {
      invalidate(qc, vars.barberId);
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminUnassignBarberService() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { barberId: number; barberServiceId: number }) =>
      api.delete<void>(`/admin/barbers/${vars.barberId}/services/${vars.barberServiceId}/`),
    onSuccess: (_d, vars) => {
      invalidate(qc, vars.barberId);
      feedback.deleted();
    },
    onError: feedback.error,
  });
}
