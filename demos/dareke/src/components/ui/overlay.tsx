import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { Check, X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button } from './button'

/* ----------------------------------------------------------------- Tooltip */

export const TooltipProvider = TooltipPrimitive.Provider

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delay?: number
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', align = 'center', delay = 250, disabled }: TooltipProps) {
  if (disabled || content == null || content === '') return children
  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={6}
            className="dk-popover z-[60] max-w-xs rounded-control bg-carbon px-2.5 py-1.5 text-xs font-medium text-[#E8EFE9] shadow-pop"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/* ------------------------------------------------------------------ Dialog */

const overlayClass = 'dk-overlay fixed inset-0 z-50 bg-[#0B1517]/45'

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Footer row (buttons), right-aligned. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Hide the close (x) button. */
  hideClose?: boolean
  className?: string
}

const DIALOG_WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

/** Centered modal dialog (radix). Alias: `Modal`. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', hideClose, className }: DialogProps) {
  const { t } = useTranslation()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          className={cn(
            'dk-dialog fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-hairline bg-panel text-ink shadow-pop focus:outline-none',
            DIALOG_WIDTH[size],
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-display text-lg font-bold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : ''}</DialogPrimitive.Description>
              )}
            </div>
            {!hideClose && (
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="sm" className="-mr-2 px-0" aria-label={t('actions.close')}>
                  <X size={18} strokeWidth={1.75} />
                </Button>
              </DialogPrimitive.Close>
            )}
          </div>
          {children != null && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>}
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export const Modal = Dialog

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  /** `danger` for destructive confirmations. */
  tone?: 'danger' | 'dial'
  loading?: boolean
  onConfirm: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'dial',
  loading,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'dial'} loading={loading} onClick={onConfirm}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

/* ------------------------------------------------------------------ Drawer */

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Small line above the title (e.g. an ID or a status pill). */
  eyebrow?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Panel width in px (default 480; full width on phones). */
  width?: number
  className?: string
}

/** Right-hand drawer, 480px, slides in over 180ms. */
export function Drawer({ open, onOpenChange, title, description, eyebrow, children, footer, width = 480, className }: DrawerProps) {
  const { t } = useTranslation()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          className={cn(
            'dk-drawer fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-hairline bg-panel text-ink shadow-pop focus:outline-none',
            className,
          )}
          style={{ maxWidth: width }}
        >
          <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
            <div className="min-w-0 flex-1">
              {eyebrow && <div className="mb-1 text-xs text-muted">{eyebrow}</div>}
              <DialogPrimitive.Title className="font-display text-lg font-bold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : ''}</DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="sm" className="-mr-2 px-0" aria-label={t('actions.close')}>
                <X size={18} strokeWidth={1.75} />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-3">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Left sheet (mobile navigation). */
export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content className="dk-sheet fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col border-r border-hairline bg-panel text-ink shadow-pop focus:outline-none">
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* ------------------------------------------------------------ DropdownMenu */

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof MenuPrimitive.Content>>(
  function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }, ref) {
    return (
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          align={align}
          className={cn(
            'dk-popover z-[55] min-w-[200px] overflow-hidden rounded-card border border-hairline bg-panel p-1 text-ink shadow-pop',
            className,
          )}
          {...props}
        />
      </MenuPrimitive.Portal>
    )
  },
)

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  icon?: ReactNode
  /** Keyboard hint on the right. */
  shortcut?: string
  danger?: boolean
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(function DropdownMenuItem(
  { className, icon, shortcut, danger, children, ...props },
  ref,
) {
  return (
    <MenuPrimitive.Item
      ref={ref}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[5px] px-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-sunken data-[disabled]:opacity-45 [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <span className="font-mono text-[11px] text-muted">{shortcut}</span>}
    </MenuPrimitive.Item>
  )
})

export const DropdownMenuRadioItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>>(
  function DropdownMenuRadioItem({ className, children, ...props }, ref) {
    return (
      <MenuPrimitive.RadioItem
        ref={ref}
        className={cn(
          'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[5px] pl-8 pr-2.5 text-sm outline-none data-[disabled]:pointer-events-none data-[highlighted]:bg-sunken data-[disabled]:opacity-45 relative',
          className,
        )}
        {...props}
      >
        <MenuPrimitive.ItemIndicator className="absolute left-2.5 inline-flex">
          <Check size={16} strokeWidth={2} />
        </MenuPrimitive.ItemIndicator>
        {children}
      </MenuPrimitive.RadioItem>
    )
  },
)

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2.5 pb-1 pt-2 text-xs font-medium text-muted', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('my-1 h-px bg-hairline', className)} {...props} />
}
