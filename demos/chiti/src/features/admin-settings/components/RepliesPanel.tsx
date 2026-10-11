import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, LocalizedTextField, Modal, Pill, Select, Skeleton, Switch, toast } from '@/components/ui'
import { pickText } from '@/lib/format'
import type { QuickReply, QuickReplyCategory } from '@/types'

import { useQuickReplies, useReplyMutations, type ReplyInput } from '../api'
import { cleanText, localizedSchema, locError, textValue, useSettingsErrors } from '../shared'

const FORM_ID = 'reply-form'
const CATEGORIES: QuickReplyCategory[] = ['greetings', 'delivery', 'payment', 'closing']

interface FormValues {
  title: { ka: string; en: string; ru?: string }
  content: { ka: string; en: string; ru?: string }
  category: QuickReplyCategory
  enabled: boolean
}

function ReplyForm({ reply, defaultCategory, onBack, onSaved }: { reply: QuickReply | null; defaultCategory: QuickReplyCategory; onBack: () => void; onSaved: () => void }) {
  const { t } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const { create, update } = useReplyMutations()
  const errors = useSettingsErrors()

  const schema = useMemo(
    () =>
      z.object({
        title: localizedSchema(t, ['ka', 'en'], 60),
        content: localizedSchema(t, ['ka', 'en'], 1000),
        category: z.enum(['greetings', 'delivery', 'payment', 'closing']),
        enabled: z.boolean(),
      }),
    [t],
  )
  const { control, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: textValue(reply?.title), content: textValue(reply?.content), category: reply?.category ?? defaultCategory, enabled: reply?.enabled ?? true },
  })
  const e = formState.errors

  const submit = handleSubmit(async (values) => {
    const input: ReplyInput = { title: cleanText(values.title), content: cleanText(values.content), category: values.category, enabled: values.enabled }
    try {
      if (reply) await update.mutateAsync({ id: reply.id, patch: input })
      else await create.mutateAsync(input)
      toast.success(t(reply ? 'replies.updated' : 'replies.created'))
      onSaved()
    } catch (error) {
      toast.error(errors.text(error))
    }
  })

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onBack()}
      size="lg"
      title={reply ? t('replies.editTitle') : t('replies.newTitle')}
      description={t('replies.formDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onBack}>
            {t('replies.backToList')}
          </Button>
          <Button type="submit" form={FORM_ID} loading={create.isPending || update.isPending}>
            {tc('actions.save')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
        <Field label={t('replies.titleLabel')} hint={t('replies.titleHint')} error={locError(e.title)} required>
          <Controller control={control} name="title" render={({ field }) => <LocalizedTextField maxLength={60} value={field.value} onChange={field.onChange} invalid={!!e.title} />} />
        </Field>
        <Field label={t('replies.content')} hint={t('replies.contentHint')} error={locError(e.content)} required>
          <Controller control={control} name="content" render={({ field }) => <LocalizedTextField multiline rows={5} maxLength={1000} value={field.value} onChange={field.onChange} invalid={!!e.content} />} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('replies.category')} htmlFor="reply-category">
            <Controller
              control={control}
              name="category"
              render={({ field }) => <Select id="reply-category" value={field.value} onValueChange={(value) => field.onChange(value)} options={CATEGORIES.map((value) => ({ value, label: t(`replies.categories.${value}`) }))} />}
            />
          </Field>
        </div>
        <div className="rounded-ui border border-line bg-panel px-4 py-3">
          <Controller control={control} name="enabled" render={({ field }) => <Switch labelFirst checked={field.value} onCheckedChange={field.onChange} label={t('replies.enabled')} description={t('replies.enabledHint')} />} />
        </div>
      </form>
    </Modal>
  )
}

export function RepliesPanel({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('adminSettings')
  const tc = useTranslation().t
  const lang = i18n.language.startsWith('ka') ? 'ka' : 'en'
  const query = useQuickReplies()
  const { update, move, remove } = useReplyMutations()
  const errors = useSettingsErrors()
  const [editing, setEditing] = useState<{ reply: QuickReply | null; category: QuickReplyCategory } | null>(null)
  const [deleting, setDeleting] = useState<QuickReply | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const rows = query.data ?? []
  const groups = CATEGORIES.map((category) => ({ category, items: rows.filter((row) => row.category === category).sort((a, b) => a.sortOrder - b.sortOrder) })).filter((group) => group.items.length > 0)

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id)
    try {
      await action()
    } catch (error) {
      toast.error(errors.text(error))
    } finally {
      setBusyId(null)
    }
  }

  if (editing) {
    return <ReplyForm reply={editing.reply} defaultCategory={editing.category} onBack={() => setEditing(null)} onSaved={() => setEditing(null)} />
  }

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => !open && onClose()}
        size="xl"
        title={t('replies.title')}
        description={t('replies.description')}
        footer={
          <Button variant="ghost" onClick={onClose}>
            {tc('actions.close')}
          </Button>
        }
      >
        {query.isError ? (
          <ErrorState title={t('replies.loadError')} onRetry={() => void query.refetch()} retryLabel={tc('actions.retry')} />
        ) : query.isLoading ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] text-muted">{t('replies.count', { count: rows.length })}</p>
              <Button size="sm" leftIcon={<Plus className="size-4" strokeWidth={1.75} />} onClick={() => setEditing({ reply: null, category: 'greetings' })}>
                {t('replies.add')}
              </Button>
            </div>
            {groups.length === 0 ? (
              <EmptyState compact title={t('replies.emptyTitle')} description={t('replies.emptyDescription')} />
            ) : (
              groups.map(({ category, items }) => (
                <section key={category} aria-label={t(`replies.categories.${category}`)}>
                  <h3 className="mb-2 flex items-center gap-2 font-display text-[14px] font-semibold text-ink">
                    {t(`replies.categories.${category}`)}
                    <span className="text-[12px] font-normal text-muted tabular">{items.length}</span>
                  </h3>
                  <ul className="divide-y divide-line rounded-ui border border-line bg-panel">
                    {items.map((row, index) => (
                      <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                        <div className="min-w-0 flex-1 basis-56">
                          <p className="flex items-center gap-2 text-sm font-medium text-ink">
                            <span className={row.enabled ? 'truncate' : 'truncate text-muted'}>{pickText(row.title, lang)}</span>
                            {!row.enabled ? (
                              <Pill tone="muted" size="sm">
                                {t('replies.disabled')}
                              </Pill>
                            ) : null}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{pickText(row.content, lang)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <IconButton
                            label={t('replies.moveUp')}
                            variant="ghost"
                            size="sm"
                            icon={<ArrowUp strokeWidth={1.75} />}
                            disabled={index === 0 || busyId === row.id}
                            onClick={() => void run(row.id, () => move.mutateAsync({ id: row.id, direction: 'up' }))}
                          />
                          <IconButton
                            label={t('replies.moveDown')}
                            variant="ghost"
                            size="sm"
                            icon={<ArrowDown strokeWidth={1.75} />}
                            disabled={index === items.length - 1 || busyId === row.id}
                            onClick={() => void run(row.id, () => move.mutateAsync({ id: row.id, direction: 'down' }))}
                          />
                          <Switch
                            size="sm"
                            checked={row.enabled}
                            disabled={busyId === row.id}
                            onCheckedChange={(enabled) => void run(row.id, () => update.mutateAsync({ id: row.id, patch: { enabled } }))}
                            aria-label={t('replies.toggle', { name: pickText(row.title, lang) })}
                          />
                          <IconButton label={t('replies.edit')} variant="ghost" size="sm" icon={<Pencil strokeWidth={1.75} />} onClick={() => setEditing({ reply: row, category })} />
                          <IconButton label={t('replies.delete')} variant="ghost" size="sm" icon={<Trash2 strokeWidth={1.75} />} onClick={() => setDeleting(row)} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        tone="danger"
        title={t('replies.deleteTitle')}
        description={t('replies.deleteDescription', { name: deleting ? pickText(deleting.title, lang) : '' })}
        confirmLabel={tc('actions.delete')}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success(t('replies.deleted'))
          } catch (error) {
            toast.error(errors.text(error))
            throw error
          }
        }}
      />
    </>
  )
}
