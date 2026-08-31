import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Download, Trash2, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useOverlay } from '@/lib/overlay'
import { formatDateTime } from '@/lib/format'
import { IconButton } from '@/components/ui/primitives'
import type { Photo } from '@/types'

export function Lightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  onDelete,
}: {
  photos: Photo[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  onDelete?: (photo: Photo) => void
}) {
  const { t } = useTranslation()
  const [loaded, setLoaded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const photo = photos[index]

  // Scroll lock, focus trap and Escape all come from the shared overlay hook,
  // so nesting the delete dialog on top of this cannot strand body scroll.
  useOverlay({ open: Boolean(photo), onClose, containerRef })

  const step = useCallback(
    (direction: 1 | -1) => {
      if (!photos.length) return
      setLoaded(false)
      onIndexChange((index + direction + photos.length) % photos.length)
    },
    [index, photos.length, onIndexChange],
  )

  useEffect(() => {
    if (!photo) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [photo, step])

  if (!photo) return null

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('photos.openFull')}
      className="fixed inset-0 z-[120] flex flex-col bg-void/96 backdrop-blur-md"
    >
      {/* Toolbar */}
      <header className="flex shrink-0 items-center gap-3 border-b border-hairline px-3 py-2.5 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">
            {photo.campaign?.name ?? '—'}
            <span className="text-ink-faint"> · </span>
            <span className="text-ink-muted">{photo.device?.name ?? '—'}</span>
          </p>
          <p className="numeral truncate text-[11px] text-ink-faint">
            {formatDateTime(photo.timestamp)}
            {photo.photo_code ? ` · ${t('photos.code')} ${photo.photo_code}` : ''}
          </p>
        </div>

        <span className="numeral hidden shrink-0 text-xs text-ink-faint sm:block">
          {index + 1} / {photos.length}
        </span>

        {photo.photo_url && (
          <a href={photo.photo_url} download target="_blank" rel="noreferrer">
            <IconButton label={t('common.download')}>
              <Download className="size-4" />
            </IconButton>
          </a>
        )}
        {onDelete && (
          <IconButton label={t('common.delete')} variant="danger" onClick={() => onDelete(photo)}>
            <Trash2 className="size-4" />
          </IconButton>
        )}
        <IconButton label={t('common.close')} onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </header>

      {/* Stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-8">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label={t('photos.previous')}
            className="absolute left-2 z-10 grid size-11 place-items-center rounded-full border border-hairline bg-surface/80 text-ink-muted backdrop-blur transition-colors hover:border-hairline-strong hover:text-ink sm:left-5"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}

        <img
          key={photo.id}
          src={photo.photo_url ?? photo.thumbnail_url ?? ''}
          alt=""
          onLoad={() => setLoaded(true)}
          className={cn(
            'max-h-full max-w-full rounded-control object-contain shadow-raised transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label={t('photos.next')}
            className="absolute right-2 z-10 grid size-11 place-items-center rounded-full border border-hairline bg-surface/80 text-ink-muted backdrop-blur transition-colors hover:border-hairline-strong hover:text-ink sm:right-5"
          >
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      {photos.length > 1 && (
        <footer className="no-scrollbar shrink-0 overflow-x-auto border-t border-hairline px-3 py-2.5">
          <div className="flex gap-1.5">
            {photos.map((entry, entryIndex) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setLoaded(false)
                  onIndexChange(entryIndex)
                }}
                aria-label={`${entryIndex + 1} / ${photos.length}`}
                aria-current={entryIndex === index}
                className={cn(
                  'size-12 shrink-0 overflow-hidden rounded-md border transition-all',
                  entryIndex === index
                    ? 'border-gold opacity-100'
                    : 'border-transparent opacity-45 hover:opacity-80',
                )}
              >
                <img
                  src={entry.thumbnail_url ?? entry.photo_url ?? ''}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        </footer>
      )}
    </div>,
    document.body,
  )
}
