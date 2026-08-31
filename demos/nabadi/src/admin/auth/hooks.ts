import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';

export type Role = 'admin' | 'barber' | 'customer';

export interface User {
  id: number;
  phone: string;
  email: string | null;
  first_name: string;
  last_name: string;
  role: Role;
  date_joined: string;
}

export const ME_KEY = ['me'] as const;

export function useMe() {
  return useQuery<User>({
    queryKey: ME_KEY,
    queryFn: () => api.get<User>('/auth/me/'),
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { phone: string; password: string }) => api.post<User>('/auth/login/', vars),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const nav = useNavigate();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout/'),
    onSuccess: () => {
      qc.setQueryData(ME_KEY, null);
      nav('/login');
    },
  });
}
