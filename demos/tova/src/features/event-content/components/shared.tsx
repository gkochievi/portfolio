/** Pieces shared by the three event-content screens. */
import { useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { ImagePlus, Shuffle, Sparkles, Trash2 } from 'lucide-react'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { ApiError } from '@/lib/api'
import { assetUrl } from '@/lib/assets'
import { canEditRole } from '@/lib/roles'
import { cn } from '@/lib/cn'
import { useCurrentUser } from '@/shell/session'
import { Button, PageHeader, StatusBadge, toast, toastError } from '@/components/ui'
import { uploadImage, useEventSummary } from '../api'

export function useCanEdit(): boolean {
  const me = useCurrentUser()
  return me ? canEditRole(me.role) : false
}

/** Put a mock 400's field errors on the form; anything else becomes a toast. */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): void {
  if (error instanceof ApiError && Object.keys(error.fieldErrors).length) {
    let placed = false
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      if (fields.includes(field)) {
        setError(field as Path<T>, { type: 'server', message: messages[0] })
        placed = true
      }
    }
    if (placed) return
  }
  toastError(error)
}

/** Event name, back link to its settings, and the Items / Trivia / Prizes switcher. */
export function ContentHeader({
  eventId,
  title,
  description,
  actions,
}: {
  eventId: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  const { t } = useTranslation('content')
  const event = useEventSummary(eventId)
  const name = event.data?.name ?? (event.isLoading ? '…' : t('header.eventFallback'))
  const tabs = [
    { to: `/admin/events/${eventId}/items`, label: t('nav.items'), count: event.data?.itemCount },
    { to: `/admin/events/${eventId}/trivia`, label: t('nav.trivia'), count: event.data?.triviaCount },
    { to: `/admin/events/${eventId}/prizes`, label: t('nav.prizes'), count: event.data?.prizeCount },
  ]
  return (
    <div className="mb-5">
      <PageHeader
        back={{ to: `/admin/events/${eventId}`, label: t('header.back') }}
        eyebrow={
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="truncate">{name}</span>
            {event.data ? <StatusBadge status={event.data.status} /> : null}
          </span>
        }
        title={title}
        description={description}
        actions={actions}
      />
      <nav aria-label={t('nav.label')} className="mt-4 flex gap-1 overflow-x-auto border-b-[1.5px] border-line">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-[1.5px] inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'border-primary text-ink' : 'border-transparent text-muted hover:text-ink',
              )
            }
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span className="rounded-chip bg-sunken px-1.5 text-xs tabular-nums text-muted">{tab.count}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

/** Image well with upload / sample / remove. `aspect` square for item art, 4:3 for prizes. */
export function ImagePicker({
  value,
  onChange,
  aspect = 'square',
  showAi = false,
  fallback,
}: {
  value: string | null
  onChange: (url: string | null) => void
  aspect?: 'square' | 'wide'
  showAi?: boolean
  fallback?: ReactNode
}) {
  const { t } = useTranslation('content')
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const src = assetUrl(value)

  const pick = async (file: File | null) => {
    setBusy(true)
    try {
      onChange(await uploadImage(file))
    } catch (error) {
      toastError(error)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div
        className={cn(
          'grid shrink-0 place-items-center overflow-hidden border-[1.5px] border-dashed border-line bg-sunken',
          aspect === 'square' ? 'size-24 rounded-full' : 'aspect-[4/3] w-full rounded-card sm:w-40',
        )}
      >
        {src ? (
          <img src={src} alt={t('image.alt')} className={cn('size-full', aspect === 'square' ? 'object-cover' : 'object-contain')} />
        ) : (
          fallback ?? <ImagePlus aria-hidden className="size-7 text-muted" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void pick(e.target.files?.[0] ?? null)}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" leftIcon={<ImagePlus className="size-4" />} loading={busy} onClick={() => fileRef.current?.click()}>
            {value ? t('image.replace') : t('image.upload')}
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<Shuffle className="size-4" />} disabled={busy} onClick={() => void pick(null)}>
            {t('image.sample')}
          </Button>
          {value ? (
            <Button size="sm" variant="danger-ghost" leftIcon={<Trash2 className="size-4" />} onClick={() => onChange(null)}>
              {t('image.remove')}
            </Button>
          ) : null}
        </div>
        {showAi ? (
          <Button
            size="sm"
            variant="outline"
            className="self-start"
            leftIcon={<Sparkles className="size-4" />}
            onClick={() => toast(t('ai.comingSoon'), { description: t('ai.notInDemo') })}
          >
            {t('ai.button')}
          </Button>
        ) : null}
        <p className="text-xs text-muted">{t('image.hint')}</p>
      </div>
    </div>
  )
}
