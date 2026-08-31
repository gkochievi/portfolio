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

const ME_KEY = ['me'] as const;

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

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      phone: string;
      password: string;
      first_name: string;
      last_name: string;
      email?: string;
    }) => api.post<User>('/auth/register/', vars),
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

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { first_name?: string; last_name?: string; email?: string | null }) =>
      api.patch<User>('/auth/me/', vars),
    onSuccess: (user) => qc.setQueryData(ME_KEY, user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (vars: { old_password: string; new_password: string }) =>
      api.post<void>('/auth/change-password/', vars),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (vars: { phone: string }) => api.post<void>('/auth/forgot-password/', vars),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (vars: { phone: string; code: string; new_password: string }) =>
      api.post<void>('/auth/reset-password/', vars),
  });
}
