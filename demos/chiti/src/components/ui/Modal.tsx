import { useState, type ReactNode } from 'react'
import * as RD from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Field, Input } from './Input'

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-[min(1200px,calc(100vw-32px))]' } as const

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Footer row (right-aligned buttons). */
  footer?: ReactNode
  size?: keyof typeof SIZES
  hideClose?: boolean
  /** Prevent closing on outside click (forms with unsaved input). */
  dismissible?: boolean
  /** Optional element that opens the dialog. */
  trigger?: ReactNode
  className?: string
  bodyClassName?: string
}

/** Centered dialog, 14px radius, scrollable body, sticky header/footer. */
export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', hideClose, dismissible = true, trigger, className, bodyClassName }: ModalProps) {
  const { t } = useTranslation()
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RD.Trigger asChild>{trigger}</RD.Trigger> : null}
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <RD.Content
          onPointerDownOutside={dismissible ? undefined : (e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-modal border border-line bg-panel text-ink shadow-pop focus:outline-none',
            SIZES[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 animate-pop-in">
            <div className="min-w-0">
              <RD.Title className="font-display text-lg font-semibold leading-snug">{title}</RD.Title>
              {description ? <RD.Description className="mt-1 text-[13px] text-muted">{description}</RD.Description> : <RD.Description className="sr-only">{typeof title === 'string' ? title : ''}</RD.Description>}
            </div>
            {hideClose ? null : (
              <RD.Close className="-mr-1.5 -mt-0.5 grid size-8 shrink-0 place-items-center rounded-ui text-muted hover:bg-hover hover:text-ink" aria-label={t('actions.close')}>
                <X size={18} strokeWidth={1.75} />
              </RD.Close>
            )}
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
/** Alias used in the plan. */
export const Dialog = Modal

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  side?: 'right' | 'left'
  /** CSS width (default 420px, capped to the viewport). */
  width?: number | string
  /** Extra header content right of the title (tabs, actions). */
  headerActions?: ReactNode
  className?: string
  bodyClassName?: string
}

/** Side panel (Radix dialog). On phones it takes the full width. */
export function Drawer({ open, onOpenChange, title, description, children, footer, side = 'right', width = 420, headerActions, className, bodyClassName }: DrawerProps) {
  const { t } = useTranslation()
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <RD.Content
          style={{ width: typeof width === 'number' ? `${width}px` : width }}
          className={cn(
            'fixed inset-y-0 z-50 flex max-w-full flex-col border-line bg-panel text-ink shadow-pop focus:outline-none',
            side === 'right' ? 'right-0 border-l animate-slide-in-right' : 'left-0 border-r animate-slide-in-left',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RD.Title className="font-display text-base font-semibold">{title}</RD.Title>
              {description ? <RD.Description className="mt-0.5 text-[13px] text-muted">{description}</RD.Description> : <RD.Description className="sr-only">{typeof title === 'string' ? title : ''}</RD.Description>}
            </div>
            <div className="flex items-center gap-1">
              {headerActions}
              <RD.Close className="grid size-8 place-items-center rounded-ui text-muted hover:bg-hover hover:text-ink" aria-label={t('actions.close')}>
                <X size={18} strokeWidth={1.75} />
              </RD.Close>
            </div>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
          {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  )
}
/** Alias used in the plan. */
export const Sheet = Drawer

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  /** 'danger' paints the confirm button red. */
  tone?: 'default' | 'danger'
  /** Ask for a password before confirming (destructive super-admin actions). Any non-empty value passes; the mock checks it. */
  requirePassword?: boolean
  passwordLabel?: ReactNode
  /** Receives the typed password when requirePassword. Return a promise to show a spinner; the dialog closes when it resolves. */
  onConfirm: (password?: string) => void | Promise<unknown>
  children?: ReactNode
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, tone = 'default', requirePassword, passwordLabel, onConfirm, children }: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const close = (next: boolean) => {
    if (!next) setPassword('')
    onOpenChange(next)
  }
  const confirm = async () => {
    try {
      setBusy(true)
      await onConfirm(requirePassword ? password : undefined)
      close(false)
    } catch {
      /* caller shows the error toast; keep the dialog open */
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={close}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)} disabled={busy}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={busy} disabled={requirePassword && !password} onClick={() => void confirm()}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      {children}
      {requirePassword ? (
        <Field label={passwordLabel ?? t('confirm.password')} htmlFor="confirm-password" className={children ? 'mt-4' : ''}>
          <Input id="confirm-password" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && password && void confirm()} />
        </Field>
      ) : null}
      {!children && !requirePassword ? <span className="sr-only">{title}</span> : null}
    </Modal>
  )
}
