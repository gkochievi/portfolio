import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { fetchAllPages } from '@/lib/paginated';
import { useMutationFeedback } from './mutation-feedback';

export type Channel = 'sms' | 'email';
export type Language = 'ka' | 'en';

export interface NotificationTemplate {
  id: number;
  key: string;
  channel: Channel;
  language: Language;
  subject: string;
  body: string;
  is_active: boolean;
  updated_at: string;
}

export function useAdminNotificationTemplates() {
  // All pages: keys × channels × languages can exceed one 25-row page, and
  // the sidebar list must be complete.
  return useQuery<NotificationTemplate[]>({
    queryKey: ['admin-notification-templates'],
    queryFn: () => fetchAllPages<NotificationTemplate>('/admin/notification-templates/'),
  });
}

export function useAdminUpdateNotificationTemplate() {
  const qc = useQueryClient();
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; subject?: string; body?: string; is_active?: boolean }) => {
      const { id, ...body } = vars;
      return api.patch<NotificationTemplate>(`/admin/notification-templates/${id}/`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-notification-templates'] });
      feedback.saved();
    },
    onError: feedback.error,
  });
}

export function useAdminPreviewNotification() {
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { subject?: string; body: string }) =>
      api.post<{ subject: string; body: string }>('/admin/notification-templates/preview/', vars),
    // Preview isn't a persisting write — error toast only, result renders inline.
    onError: feedback.error,
  });
}

export interface TestSendResult {
  detail: string;
  /** Rendered SAVED template; `subject` only present for email templates. */
  rendered: { subject?: string; body: string };
}

/**
 * POST /admin/notification-templates/{id}/test-send/ — renders the SAVED
 * template with sample data and delivers it synchronously to `recipient`
 * (phone for sms templates, email otherwise; backend re-validates per
 * channel). Provider failure comes back as a 502 `test_send_failed`.
 */
export function useAdminTestSendNotification() {
  const feedback = useMutationFeedback();
  return useMutation({
    mutationFn: (vars: { id: number; recipient: string }) =>
      api.post<TestSendResult>(`/admin/notification-templates/${vars.id}/test-send/`, {
        recipient: vars.recipient,
      }),
    onSuccess: () => feedback.success('toast.test_sent'),
    onError: feedback.error,
  });
}
