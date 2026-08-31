import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ME_KEY, type User } from '@/auth/hooks';
import { useMutationFeedback } from './mutation-feedback';

/** PATCH /auth/me/ — only first_name, last_name, email are editable (backend MeUpdateSerializer). */
export function useUpdateMe() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { first_name?: string; last_name?: string; email?: string | null }) =>
      api.patch<User>('/auth/me/', vars),
    onSuccess: (user) => {
      qc.setQueryData(ME_KEY, user);
      feedback.saved();
    },
    onError: feedback.error,
  });
}

/**
 * POST /auth/change-password/ — the backend revokes every other session and
 * re-issues cookies for this client, so the caller stays signed in.
 */
export function useChangePassword() {
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { old_password: string; new_password: string }) =>
      api.post<void>('/auth/change-password/', vars),
    onSuccess: () => feedback.success('toast.password_changed'),
    onError: feedback.error,
  });
}
