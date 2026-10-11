import type { ReactElement, ReactNode } from 'react'
import * as RadixDialog from '@radix-ui/react-dialog'
import * as RadixMenu from '@radix-ui/react-dropdown-menu'
import * as RadixTooltip from '@radix-ui/react-tooltip'
import { Check, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

import { Button } from './button'

/* ----------------------------------------------------------------- Tooltip */

export interface TooltipProps {
  content: ReactNode
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Skip the tooltip entirely (e.g. when the label is already visible). */
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', disabled }: TooltipProps) {
  if (disabled || content === null || content === undefined || content === '') return children
  return (
    <RadixTooltip.Provider delayDuration={300} skipDelayDuration={200}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content
            side={side}
            sideOffset={6}
            className="z-[60] max-w-xs rounded-md bg-ink px-2 py-1 text-xs leading-4 text-surface shadow-overlay animate-fade"
          >
            {content}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  )
}

/* ------------------------------------------------------------ Dialog/Modal */

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Right-aligned action row under a hairline. */
  footer?: ReactNode
  size?: keyof typeof sizes
  /** Prevent closing on outside click (forms with unsaved input). */
  dismissible?: boolean
  className?: string
}

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', dismissible = true, className }: DialogProps) {
  const { t } = useTranslation('common')
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)] animate-fade" />
        <RadixDialog.Content
          onPointerDownOutside={(e) => !dismissible && e.preventDefault()}
          onInteractOutside={(e) => !dismissible && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-hairline bg-panel text-ink shadow-overlay outline-none animate-pop',
            sizes[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="font-display text-lg font-semibold leading-6">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label={t('actions.close')}
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-ink/6 hover:text-ink"
            >
              <X className="size-4 stroke-[1.75]" aria-hidden />
            </RadixDialog.Close>
          </div>
          {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div> : null}
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Alias of Dialog. */
export const Modal = Dialog

/* ----------------------------------------------------------------- Drawer */

export interface DrawerProps extends Omit<DialogProps, 'size'> {
  side?: 'right' | 'left'
  /** Width class. Default 'w-[min(480px,100vw)]'. */
  widthClassName?: string
}

export function Drawer({ open, onOpenChange, title, description, children, footer, side = 'right', widthClassName, className }: DrawerProps) {
  const { t } = useTranslation('common')
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)] animate-fade" />
        <RadixDialog.Content
          className={cn(
            'fixed inset-y-0 z-50 flex flex-col border-hairline bg-panel text-ink shadow-overlay outline-none animate-sheet',
            side === 'right' ? 'right-0 rounded-l-xl border-l' : 'left-0 rounded-r-xl border-r',
            widthClassName ?? 'w-[min(480px,100vw)]',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="font-display text-lg font-semibold leading-6">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label={t('actions.close')}
              className="-mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-ink/6 hover:text-ink"
            >
              <X className="size-4 stroke-[1.75]" aria-hidden />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">{children}</div>
          {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/* ---------------------------------------------------------- ConfirmDialog */

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  tone?: 'primary' | 'danger'
  onConfirm: () => void
  /** Spinner on the confirm button while the mutation runs. */
  pending?: boolean
  /** Extra body (e.g. a reason textarea or a password field). */
  children?: ReactNode
  /** Disable confirm (e.g. until a reason is typed). */
  confirmDisabled?: boolean
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, cancelLabel, tone = 'primary', onConfirm, pending, children, confirmDisabled }: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button variant={tone === 'danger' ? 'destructive' : 'primary'} onClick={onConfirm} loading={pending} disabled={confirmDisabled}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}

/* ----------------------------------------------------------- DropdownMenu */

export const DropdownMenu = RadixMenu.Root
export const DropdownMenuTrigger = RadixMenu.Trigger

export function DropdownMenuContent({ children, align = 'end', className, sideOffset = 6 }: { children: ReactNode; align?: 'start' | 'center' | 'end'; className?: string; sideOffset?: number }) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn('z-50 min-w-[200px] overflow-hidden rounded-lg border border-hairline bg-panel p-1 text-ink shadow-overlay animate-pop', className)}
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  )
}

export interface DropdownMenuItemProps {
  children: ReactNode
  onSelect?: (event: Event) => void
  icon?: ReactNode
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Right-aligned hint (shortcut, count). */
  hint?: ReactNode
  /** Render the child (e.g. a <Link>) as the item. */
  asChild?: boolean
  className?: string
}

export function DropdownMenuItem({ children, onSelect, icon, tone = 'default', disabled, hint, asChild, className }: DropdownMenuItemProps) {
  const cls = cn(
    'flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-row-hover [&_svg]:size-4 [&_svg]:stroke-[1.75] [&_svg]:text-muted',
    tone === 'danger' && 'text-danger [&_svg]:text-danger',
    className,
  )
  if (asChild) {
    return (
      <RadixMenu.Item asChild onSelect={onSelect} disabled={disabled} className={cls}>
        {children}
      </RadixMenu.Item>
    )
  }
  return (
    <RadixMenu.Item onSelect={onSelect} disabled={disabled} className={cls}>
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {hint ? <span className="text-xs text-subtle">{hint}</span> : null}
    </RadixMenu.Item>
  )
}

export function DropdownMenuCheckboxItem({ children, checked, onCheckedChange }: { children: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <RadixMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(e) => e.preventDefault()}
      className="flex h-8 cursor-default select-none items-center gap-2 rounded-md px-2 text-[13px] outline-none data-[highlighted]:bg-row-hover"
    >
      <span className="inline-flex size-4 items-center justify-center">
        <RadixMenu.ItemIndicator>
          <Check className="size-3.5 stroke-[2] text-primary" aria-hidden />
        </RadixMenu.ItemIndicator>
      </span>
      {children}
    </RadixMenu.CheckboxItem>
  )
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <RadixMenu.Label className="eyebrow px-2 pb-1 pt-2">{children}</RadixMenu.Label>
}

export function DropdownMenuSeparator() {
  return <RadixMenu.Separator className="my-1 h-px bg-hairline" />
}
