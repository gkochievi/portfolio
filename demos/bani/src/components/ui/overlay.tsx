/** Dialog, ConfirmDialog, Drawer and DropdownMenu (radix). */
import { type ReactNode } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Check, X, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button } from './controls'

/* ------------------------------------------------------------------- Dialog */

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Block closing on overlay click / Escape (e.g. while busy). */
  dismissible?: boolean
  className?: string
}

const dialogWidth = { sm: 'max-w-[420px]', md: 'max-w-[560px]', lg: 'max-w-[760px]', xl: 'max-w-[1000px]' }

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  dismissible = true,
  className,
}: DialogProps) {
  const { t } = useTranslation('common')
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => (dismissible || o ? onOpenChange(o) : undefined)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <DialogPrimitive.Content
          onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[10px] border border-pop-border bg-panel text-ink shadow-pop animate-pop-in focus:outline-none',
            dialogWidth[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-[17px] font-semibold leading-snug">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-[13.5px] text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : ''}</DialogPrimitive.Description>
              )}
            </div>
            {dismissible && (
              <DialogPrimitive.Close
                aria-label={t('actions.close')}
                className="-mr-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
              >
                <X size={17} aria-hidden />
              </DialogPrimitive.Close>
            )}
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
/** Alias of Dialog. */
export const Modal = Dialog

/* ------------------------------------------------------------ ConfirmDialog */

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  body?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  tone?: 'default' | 'danger'
  busy?: boolean
  /** Disable confirm (e.g. until a password is typed). */
  confirmDisabled?: boolean
  onConfirm: () => void
  /** Extra content under the body (inputs). */
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  busy,
  confirmDisabled,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      {body && <div className="text-[14px] text-muted">{body}</div>}
      {children && <div className={cn(body && 'mt-4')}>{children}</div>}
    </Dialog>
  )
}

/* ------------------------------------------------------------------- Drawer */

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  subtitle?: ReactNode
  /** Header actions next to the close button. */
  actions?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  /** Width in px on desktop; full width on phones. Default 480. */
  width?: number
}

/** Right-side detail panel (480px). */
export function Drawer({ open, onOpenChange, title, subtitle, actions, footer, children, width = 480 }: DrawerProps) {
  const { t } = useTranslation('common')
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-pop-border bg-panel text-ink shadow-pop animate-drawer-in focus:outline-none sm:rounded-l-[10px]"
          style={{ maxWidth: width }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-[17px] font-semibold leading-snug">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className={subtitle ? 'mt-0.5 text-[13px] text-muted' : 'sr-only'}>
                {subtitle ?? (typeof title === 'string' ? title : '')}
              </DialogPrimitive.Description>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {actions}
              <DialogPrimitive.Close
                aria-label={t('actions.close')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-ink"
              >
                <X size={17} aria-hidden />
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* ------------------------------------------------------------- DropdownMenu */

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...rest
}: Menu.DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[60] min-w-[200px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[10px] border border-pop-border bg-panel p-1 text-ink shadow-pop animate-pop-in',
          className,
        )}
        {...rest}
      />
    </Menu.Portal>
  )
}

export interface DropdownMenuItemProps extends Omit<Menu.DropdownMenuItemProps, 'children'> {
  icon?: LucideIcon
  tone?: 'default' | 'danger'
  /** Shows a check mark (radio-like menus). */
  checked?: boolean
  children: ReactNode
  hint?: ReactNode
}

export function DropdownMenuItem({ icon: Icon, tone = 'default', checked, hint, className, children, ...rest }: DropdownMenuItemProps) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover',
        tone === 'danger' && 'text-danger',
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={16} strokeWidth={1.75} className={tone === 'danger' ? 'text-danger' : 'text-muted'} aria-hidden />}
      <span className="min-w-0 flex-1">{children}</span>
      {hint && <span className="text-[12px] text-muted">{hint}</span>}
      {checked !== undefined && <Check size={15} className={cn('text-primary', checked ? 'opacity-100' : 'opacity-0')} aria-hidden />}
    </Menu.Item>
  )
}

export function DropdownMenuLabel({ className, ...rest }: Menu.DropdownMenuLabelProps) {
  return <Menu.Label className={cn('px-2.5 pb-1 pt-2 text-[12px] font-medium text-muted', className)} {...rest} />
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn('my-1 h-px bg-line', className)} />
}
