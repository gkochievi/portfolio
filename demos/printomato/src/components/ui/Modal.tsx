import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useOverlay } from '@/lib/overlay'
import { Button } from './primitives'

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const

/**
 * Layer order across the app — a dialog must sit above the lightbox, because
 * the lightbox opens the delete confirmation:
 *   lightbox 120 < modal 160 < command palette 170 < toasts 200
 */
export const MODAL_Z = 'z-[160]'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: keyof typeof SIZES
  footer?: React.ReactNode
  children: React.ReactNode
}

export function Modal({ open, onClose, title, description, size = 'md', footer, children }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useOverlay({ open, onClose, containerRef: panelRef })

  if (!open) return null

  return createPortal(
    <div className={cn('fixed inset-0 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6', MODAL_Z)}>
      <div
        className="animate-fade fixed inset-0 bg-void/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-rise relative z-10 flex w-full flex-col',
          'rounded-t-panel border border-hairline-strong bg-surface shadow-raised sm:rounded-panel',
          'max-h-[92vh] sm:max-h-[86vh]',
          SIZES[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-sm text-ink-faint">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-m-1 shrink-0 rounded-md p-1 text-ink-faint transition-colors hover:bg-white/6 hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-hairline bg-void/30 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  loading,
  tone = 'danger',
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  loading?: boolean
  tone?: 'danger' | 'primary'
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            data-autofocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <div
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full',
            tone === 'danger' ? 'bg-danger/12 text-danger' : 'bg-gold/12 text-gold',
          )}
        >
          <AlertTriangle className="size-4.5" />
        </div>
        <p className="pt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
      </div>
    </Modal>
  )
}
