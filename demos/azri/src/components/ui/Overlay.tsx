/**
 * Overlays on Radix: Modal (alias Dialog), Drawer, DropdownMenu, Tooltip.
 * Owner: design-system agent.
 */
import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { X } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------- Tooltip */

export interface TooltipProps {
  content: ReactNode
  /** A single focusable element. */
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', delay = 300, disabled }: TooltipProps) {
  if (disabled || content === null || content === undefined || content === '') return children
  return (
    <TooltipPrimitive.Provider delayDuration={delay}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            className="z-[70] max-w-64 animate-fade-in rounded-lg bg-plum px-2.5 py-1.5 text-xs font-medium leading-snug text-mist shadow-float dark:bg-mist dark:text-plum"
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

/* ------------------------------------------------------------------ Modal */

const overlayClass = 'fixed inset-0 z-50 animate-fade-in bg-plum/45 dark:bg-black/60'

function CloseButton() {
  const { t } = useTranslation('common')
  return (
    <DialogPrimitive.Close
      aria-label={t('actions.close')}
      className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-ink/6 hover:text-ink"
    >
      <X className="size-5" strokeWidth={1.75} />
    </DialogPrimitive.Close>
  )
}

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Right-aligned action row (buttons). */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  hideClose?: boolean
  className?: string
}

const modalWidths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', hideClose, className }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-bubble border border-border bg-panel text-ink shadow-float focus:outline-none',
            modalWidths[size],
            className,
          )}
        >
          <div className="animate-dialog-in flex min-h-0 flex-1 flex-col">
            <div className="flex items-start gap-3 px-5 pb-2 pt-5">
              <div className="min-w-0 flex-1">
                <DialogPrimitive.Title className="font-display text-xl font-semibold leading-tight">{title}</DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
                ) : (
                  <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : ''}</DialogPrimitive.Description>
                )}
              </div>
              {!hideClose && <CloseButton />}
            </div>
            {children !== undefined && <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3 text-sm">{children}</div>}
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** Alias: some feature briefs call it Dialog. */
export const Dialog = Modal

/* ----------------------------------------------------------------- Drawer */

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  /** Small content above the title (e.g. a TenantMark + badge row). */
  eyebrow?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg'
  className?: string
}

const drawerWidths = { sm: 'sm:max-w-sm', md: 'sm:max-w-[520px]', lg: 'sm:max-w-[680px]' } as const

/** Right-side sheet (full width on phones). Scrolls its body; footer sticks. */
export function Drawer({ open, onOpenChange, title, description, eyebrow, children, footer, width = 'md', className }: DrawerProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={overlayClass} />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full animate-drawer-in flex-col border-l border-border bg-panel text-ink shadow-float focus:outline-none',
            drawerWidths[width],
            className,
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              {eyebrow && <div className="mb-2">{eyebrow}</div>}
              <DialogPrimitive.Title className="font-display text-xl font-semibold leading-tight">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="mt-1 text-sm text-muted">{description}</DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">{typeof title === 'string' ? title : ''}</DialogPrimitive.Description>
              )}
            </div>
            <CloseButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/* ----------------------------------------------------------- DropdownMenu */

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger
export const DropdownMenuGroup = MenuPrimitive.Group

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }, ref) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          'z-[60] min-w-52 animate-fade-in rounded-[14px] border border-border bg-panel p-1.5 text-sm text-ink shadow-float focus:outline-none',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
})

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  icon?: ReactNode
  danger?: boolean
  /** Right-aligned hint (shortcut, count). */
  hint?: ReactNode
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(function DropdownMenuItem(
  { className, icon, danger, hint, children, ...props },
  ref,
) {
  return (
    <MenuPrimitive.Item
      ref={ref}
      className={cn(
        'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-[10px] px-2.5 outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-ink/6 data-[disabled]:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger',
        className,
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </MenuPrimitive.Item>
  )
})

export function DropdownMenuLabel({ className, children }: { className?: string; children: ReactNode }) {
  return <MenuPrimitive.Label className={cn('px-2.5 pb-1.5 pt-2 text-xs font-medium text-muted', className)}>{children}</MenuPrimitive.Label>
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <MenuPrimitive.Separator className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} />
}
