import { useState } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button, IconButton, Skeleton, Textarea, toast } from '@/components/ui'
import { errorMessage, fieldError } from '@/api/client'
import { useAccount } from '@/lib/account'
import { formatSmartDate } from '@/lib/format'

import { useAddNote, useDeleteNote, useNotes } from '../api'

const MAX = 1000

/** Internal notes: staff only, dashed warm border with a lock (never shown to the customer). */
export function NotesPanel({ sessionId, canWrite }: { sessionId: string; canWrite: boolean }) {
  const { t, i18n } = useTranslation('operatorTools')
  const { t: tc } = useTranslation()
  const account = useAccount()
  const notes = useNotes(sessionId)
  const add = useAddNote(sessionId)
  const remove = useDeleteNote(sessionId)
  const [draft, setDraft] = useState('')

  const submit = () => {
    const content = draft.trim()
    if (!content) {
      add.reset()
      toast.error(t('notes.empty'))
      return
    }
    add.mutate(content, {
      onSuccess: () => {
        setDraft('')
        toast.success(t('notes.added'))
      },
    })
  }

  const error = add.isError ? (fieldError(add.error, 'content') ?? errorMessage(add.error)) : undefined

  return (
    <section aria-label={t('notes.title')} className="rounded-ui border border-dashed border-[#8C846E] p-3">
      <h3 className="mb-0.5 flex items-center gap-1.5 font-display text-[13px] font-semibold text-ink">
        <Lock size={14} strokeWidth={1.75} aria-hidden />
        {t('notes.title')}
      </h3>
      <p className="mb-2.5 text-xs text-muted">{t('notes.hint')}</p>

      {notes.isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : notes.isError ? (
        <p className="text-xs text-danger" role="alert">
          {t('notes.loadError')}
        </p>
      ) : (notes.data?.length ?? 0) === 0 ? (
        <p className="text-[12.5px] text-muted">{t('notes.none')}</p>
      ) : (
        <ul className="space-y-2">
          {notes.data?.map((note) => {
            const mine = account?.staffId === note.authorId
            const canDelete = canWrite && (mine || account?.role === 'admin')
            return (
              <li key={note.id} className="group rounded-ui bg-sunken px-2.5 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[11.5px] text-muted">
                    <span className="font-medium text-ink">{note.authorName}</span> · {formatSmartDate(note.createdAt, i18n.language)}
                  </p>
                  {canDelete ? (
                    <IconButton
                      size="xs"
                      variant="danger"
                      label={tc('actions.delete')}
                      icon={<Trash2 />}
                      loading={remove.isPending && remove.variables === note.id}
                      onClick={() =>
                        remove.mutate(note.id, {
                          onSuccess: () => toast.success(t('notes.deleted')),
                          onError: (err) => toast.error(errorMessage(err)),
                        })
                      }
                    />
                  ) : null}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink">{note.content}</p>
              </li>
            )
          })}
        </ul>
      )}

      {canWrite ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <Textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (add.isError) add.reset()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                submit()
              }
            }}
            rows={2}
            maxLength={MAX}
            invalid={!!error}
            placeholder={t('notes.placeholder')}
            aria-label={t('notes.placeholder')}
          />
          {error ? (
            <p className="text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="tabular text-[11px] text-muted">
              {draft.length}/{MAX}
            </span>
            <Button type="submit" size="xs" variant="outline" loading={add.isPending} leftIcon={<Plus size={14} />}>
              {t('notes.add')}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
