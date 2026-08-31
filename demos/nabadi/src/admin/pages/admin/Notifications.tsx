import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Eye, Save, Send } from 'lucide-react';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Badge } from '@/components/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/Dialog';
import { ErrorMessage } from '@/components/ErrorMessage';
import { Input } from '@/components/Input';
import { EmptyState } from '@/components/EmptyState';
import { SectionError } from '@/components/SectionError';
import {
  useAdminNotificationTemplates,
  useAdminPreviewNotification,
  useAdminTestSendNotification,
  useAdminUpdateNotificationTemplate,
  type NotificationTemplate,
} from '@/features/admin/notification-hooks';
import { cn } from '@/lib/cn';
import { normalizePhoneE164 } from '@/lib/phone';

export function AdminNotifications() {
  const { t } = useTranslation('admin');
  const templates = useAdminNotificationTemplates();
  const { data, isLoading } = templates;
  const items = useMemo<NotificationTemplate[]>(() => data ?? [], [data]);

  const [activeId, setActiveId] = useState<number | null>(null);
  const active = useMemo(
    () => items.find((it) => it.id === activeId) ?? items[0] ?? null,
    [items, activeId],
  );

  // The editor is remounted via key={active.id}, so switching templates would
  // silently discard unsaved subject/body edits — guard with a confirm.
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<number | null>(null);

  const onPickTemplate = (id: number) => {
    if (id === active?.id) return;
    if (editorDirty) {
      setPendingSwitch(id);
    } else {
      setActiveId(id);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={t('page.notifications')}
        title={t('page.notifications')}
        subtitle={t('notifications_page.subtitle')}
      />

      {templates.isError ? (
        <SectionError error={templates.error} onRetry={() => templates.refetch()} />
      ) : isLoading ? (
        <Card>
          <p role="status" aria-live="polite" className="text-ink-muted text-sm">
            {t('actions.loading')}
          </p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title={t('notifications_page.no_templates')}
        />
      ) : (
        <div className="grid md:grid-cols-[280px_1fr] gap-4">
          <Card className="md:sticky md:top-20 self-start">
            <h2 className="font-display text-lg mb-3 tracking-tight">
              {t('notifications_page.templates')}
            </h2>
            <div className="flex flex-col gap-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onPickTemplate(it.id)}
                  className={cn(
                    'text-left px-3 py-2.5 rounded-md text-sm transition flex flex-col gap-0.5',
                    active?.id === it.id ? 'bg-ink text-bg' : 'text-ink hover:bg-line/50',
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] opacity-70">
                    <span>{it.channel}</span>
                    <span>·</span>
                    <span>{it.language}</span>
                  </div>
                  <span className="font-medium">{it.key}</span>
                </button>
              ))}
            </div>
          </Card>
          {active && (
            <TemplateEditor key={active.id} template={active} onDirtyChange={setEditorDirty} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={pendingSwitch !== null}
        onOpenChange={(o) => !o && setPendingSwitch(null)}
        title={t('notifications_page.discard_title')}
        body={t('notifications_page.discard_body')}
        confirmLabel={t('notifications_page.discard_confirm')}
        cancelLabel={t('actions.cancel')}
        destructive
        onConfirm={() => {
          if (pendingSwitch !== null) {
            setActiveId(pendingSwitch);
            setEditorDirty(false);
          }
          setPendingSwitch(null);
        }}
      />
    </div>
  );
}

function TemplateEditor({
  template,
  onDirtyChange,
}: {
  template: NotificationTemplate;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const { t } = useTranslation('admin');
  const update = useAdminUpdateNotificationTemplate();
  const preview = useAdminPreviewNotification();
  const [testOpen, setTestOpen] = useState(false);

  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [isActive, setIsActive] = useState(template.is_active);

  const dirty =
    subject !== template.subject || body !== template.body || isActive !== template.is_active;

  // Report dirtiness up so the template list can guard against silent discard.
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const onSave = async () => {
    if (!dirty) return;
    try {
      await update.mutateAsync({
        id: template.id,
        subject,
        body,
        is_active: isActive,
      });
    } catch {
      /* surfaced */
    }
  };

  const onPreview = async () => {
    try {
      await preview.mutateAsync({ subject, body });
    } catch {
      /* surfaced */
    }
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h2 className="font-display text-2xl text-ink tracking-tight">{template.key}</h2>
          <div className="flex gap-2 mt-1.5">
            <Badge variant="default">{template.channel}</Badge>
            <Badge variant="outline">{template.language}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onPreview}
            loading={preview.isPending}
            className="rounded-pill"
            size="sm"
          >
            <Eye className="h-3.5 w-3.5" />
            {t('notifications_page.preview')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setTestOpen(true)}
            className="rounded-pill"
            size="sm"
          >
            <Send className="h-3.5 w-3.5" />
            {t('notifications_page.test_send')}
          </Button>
          <Button
            onClick={onSave}
            disabled={!dirty}
            loading={update.isPending}
            variant="accent"
            className="rounded-pill"
            size="sm"
          >
            <Save className="h-3.5 w-3.5" />
            {t('notifications_page.save')}
          </Button>
        </div>
      </div>

      {/* Fresh mount per open so recipient + result state reset. */}
      {testOpen && (
        <TestSendDialog template={template} dirty={dirty} onClose={() => setTestOpen(false)} />
      )}

      <div className="flex flex-col gap-3">
        {template.channel === 'email' && (
          <Input
            label={t('notifications_page.f_subject')}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-muted">
            {t('notifications_page.f_body')}{' '}
            <code className="text-xs">{'{{ customer_first_name }}'}</code>,{' '}
            <code className="text-xs">{'{{ barber_first_name }}'}</code>,{' '}
            <code className="text-xs">{'{{ service_name }}'}</code>,{' '}
            <code className="text-xs">{'{{ start_at_local }}'}</code>,{' '}
            <code className="text-xs">{'{{ price }}'}</code>
          </span>
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="px-3.5 py-2.5 bg-surface-2 border border-line rounded-md font-mono text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t('notifications_page.f_active')}
        </label>

        <ErrorMessage error={update.error ?? preview.error} />

        {preview.data && (
          <div className="border-t border-line pt-4 mt-2">
            <h3 className="text-[10px] uppercase tracking-[0.12em] text-ink-muted font-medium mb-2">
              {t('notifications_page.preview_label')}
            </h3>
            {template.channel === 'email' && preview.data.subject && (
              <p className="text-sm mb-2">
                <span className="text-ink-muted">{t('notifications_page.subject_label')}</span>{' '}
                <span className="text-ink">{preview.data.subject}</span>
              </p>
            )}
            <pre className="text-sm bg-bg border border-line rounded-md p-3 whitespace-pre-wrap">
              {preview.data.body}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Test-send dialog (spec §9.8): asks for a recipient — phone for SMS
 * templates (E.164-normalized via lib/phone), email otherwise — then POSTs
 * the test-send action. The backend renders the SAVED template, delivers it
 * synchronously, and returns the rendered output, which shows inline here.
 */
function TestSendDialog({
  template,
  dirty,
  onClose,
}: {
  template: NotificationTemplate;
  /** Unsaved editor changes — warn that the saved version is what's sent. */
  dirty: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation('admin');
  const testSend = useAdminTestSendNotification();
  const [recipient, setRecipient] = useState('');

  const isSms = template.channel === 'sms';
  const trimmed = recipient.trim();
  const normalizedPhone = isSms ? normalizePhoneE164(trimmed) : null;
  const emailValid = /^\S+@\S+\.\S+$/.test(trimmed);
  const valid = isSms ? normalizedPhone !== null : emailValid;
  const inputError =
    trimmed !== '' && !valid
      ? isSms
        ? 'phone_invalid' // errors-namespace key, translated by <Input>
        : t('notifications_page.recipient_invalid_email')
      : undefined;

  const sent = testSend.data;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || testSend.isPending) return;
    try {
      await testSend.mutateAsync({
        id: template.id,
        recipient: isSms ? (normalizedPhone as string) : trimmed,
      });
    } catch {
      /* surfaced via toast + inline ErrorMessage */
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !testSend.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>{t('notifications_page.test_send_title')}</DialogTitle>
        <DialogDescription>{t('notifications_page.test_send_hint')}</DialogDescription>
        {dirty && !sent && (
          <p className="text-xs text-accent">{t('notifications_page.test_send_dirty_warning')}</p>
        )}

        {sent ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] uppercase tracking-[0.12em] text-ink-muted font-medium">
              {t('notifications_page.test_send_result')}
            </h3>
            {template.channel === 'email' && sent.rendered.subject && (
              <p className="text-sm">
                <span className="text-ink-muted">{t('notifications_page.subject_label')}</span>{' '}
                <span className="text-ink">{sent.rendered.subject}</span>
              </p>
            )}
            <pre className="text-sm bg-bg border border-line rounded-md p-3 whitespace-pre-wrap">
              {sent.rendered.body}
            </pre>
            <DialogFooter>
              <Button type="button" variant="accent" onClick={onClose} className="rounded-pill">
                {t('actions.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <Input
              label={
                isSms
                  ? t('notifications_page.f_recipient_phone')
                  : t('notifications_page.f_recipient_email')
              }
              type={isSms ? 'tel' : 'email'}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={isSms ? '+995…' : 'name@example.com'}
              error={inputError}
              dir="ltr"
              autoFocus
            />
            <ErrorMessage error={testSend.error} />
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={testSend.isPending}
                className="rounded-pill"
              >
                {t('actions.cancel')}
              </Button>
              <Button
                type="submit"
                variant="accent"
                loading={testSend.isPending}
                disabled={!valid}
                className="rounded-pill"
              >
                <Send className="h-3.5 w-3.5" />
                {t('notifications_page.test_send_send')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
