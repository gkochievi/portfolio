/**
 * Overlays on Radix Dialog. Every create/edit form uses `SideSheet` (480px
 * right sheet, full width on phones); `Modal` is for drill-downs and short
 * dialogs; `BottomSheet` is the phone menu. Deletes use `InlineConfirm`.
 */
import * as Dialog from '@radix-ui/react-dialog'
import { Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button, IconButton } from './Button'

interface OverlayBase {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Sticky action row (Save / Cancel). */
  footer?: ReactNode
  className?: string
}

// Rendered as a Radix primitive directly: Presence needs to pass it a ref.
const SCRIM_CLASS = 'fixed inset-0 z-[60] bg-scrim data-[state=open]:animate-fade-in'

function CloseButton() {
  const { t } = useTranslation()
  return (
    <Dialog.Close asChild>
      <IconButton label={t('common:actions.close')} icon={<X />} size="md" className="-mr-2 -mt-1" />
    </Dialog.Close>
  )
}

const MODAL_W = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]', xl: 'max-w-[960px]' } as const

export interface ModalProps extends OverlayBase {
  size?: keyof typeof MODAL_W
}

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={SCRIM_CLASS} />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-hero border-[1.5px] border-line bg-panel text-ink shadow-pop data-[state=open]:animate-pop-in focus:outline-none',
            MODAL_W[size],
            className,
          )}
        >
          <div className="flex items-start gap-3 px-5 pb-2 pt-5 sm:px-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-lg leading-snug">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</Dialog.Description>
              )}
            </div>
            <CloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2 sm:px-6">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t-[1.5px] border-line px-5 py-4 sm:px-6">{footer}</div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export interface SideSheetProps extends OverlayBase {
  /** Default 480px. */
  width?: number
}

/** 480px right sheet for every create/edit form. Put the <form> around children+footer via `asForm`-style: pass the form as children and buttons in footer with form="id". */
export function SideSheet({ open, onOpenChange, title, description, children, footer, width = 480, className }: SideSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={SCRIM_CLASS} />
        <Dialog.Content
          style={{ maxWidth: width }}
          className={cn(
            'fixed inset-y-0 right-0 z-[61] flex w-full flex-col border-l-[1.5px] border-line bg-panel text-ink shadow-pop data-[state=open]:animate-sheet-in focus:outline-none',
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b-[1.5px] border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-lg leading-snug">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</Dialog.Description>
              )}
            </div>
            <CloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
          {footer && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t-[1.5px] border-line bg-panel px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Alias: some agents call it Drawer. */
export const Drawer = SideSheet

/** Phone menu sheet rising from the bottom. */
export function BottomSheet({ open, onOpenChange, title, description, children, footer, className }: OverlayBase) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={SCRIM_CLASS} />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-[61] flex max-h-[85dvh] flex-col rounded-t-hero border-t-[1.5px] border-line bg-panel text-ink shadow-pop data-[state=open]:animate-sheet-up focus:outline-none',
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line" aria-hidden />
          <div className="flex items-center gap-3 px-5 pb-2 pt-3">
            <Dialog.Title className="min-w-0 flex-1 font-display text-base">{title}</Dialog.Title>
            <CloseButton />
          </div>
          <Dialog.Description className={description ? 'px-5 text-sm text-muted' : 'sr-only'}>
            {description ?? (typeof title === 'string' ? title : '')}
          </Dialog.Description>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(16px,env(safe-area-inset-bottom))]">{children}</div>
          {footer && <div className="border-t-[1.5px] border-line px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export interface InlineConfirmProps {
  onConfirm: () => void | Promise<unknown>
  /** Question shown while confirming. Default "Delete this?". */
  question?: ReactNode
  /** Default "Delete". */
  confirmLabel?: ReactNode
  /** Trigger label. Default "Delete". */
  label?: string
  /** Show the trigger as a trash icon button only. */
  iconOnly?: boolean
  busy?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** Delete without a modal: the trigger turns into "Delete this? [Delete] [Cancel]" in place. */
export function InlineConfirm({
  onConfirm,
  question,
  confirmLabel,
  label,
  iconOnly,
  busy,
  disabled,
  size = 'sm',
  className,
}: InlineConfirmProps) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])

  const triggerLabel = label ?? t('common:actions.delete')
  if (!confirming) {
    return iconOnly ? (
      <IconButton
        label={triggerLabel}
        icon={<Trash2 />}
        variant="danger-ghost"
        size={size}
        disabled={disabled}
        className={className}
        onClick={(event) => {
          event.stopPropagation()
          setConfirming(true)
        }}
      />
    ) : (
      <Button
        variant="danger-ghost"
        size={size}
        leftIcon={<Trash2 />}
        disabled={disabled}
        className={className}
        onClick={(event) => {
          event.stopPropagation()
          setConfirming(true)
        }}
      >
        {triggerLabel}
      </Button>
    )
  }
  return (
    <span
      role="group"
      className={cn('inline-flex flex-wrap items-center gap-2 animate-fade-in', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setConfirming(false)
      }}
    >
      <span className="text-sm font-semibold text-danger">{question ?? t('common:confirmDelete')}</span>
      <Button
        variant="danger"
        size="sm"
        loading={busy}
        onClick={async () => {
          await onConfirm()
          setConfirming(false)
        }}
      >
        {confirmLabel ?? t('common:actions.delete')}
      </Button>
      <Button ref={cancelRef} variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        {t('common:actions.cancel')}
      </Button>
    </span>
  )
}
