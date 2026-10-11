import * as RDialog from '@radix-ui/react-dialog'
import * as RMenu from '@radix-ui/react-dropdown-menu'
import * as RTooltip from '@radix-ui/react-tooltip'
import { AlertTriangle, Check, ChevronRight, KeyRound, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import { Button, CopyButton } from './button'

/* ------------------------------------------------------------------ Tooltip */

/** Wrap the app once (RootLayout does). */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <RTooltip.Provider delayDuration={250} skipDelayDuration={150}>
    {children}
  </RTooltip.Provider>
)

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  /** Skip the tooltip entirely (render children only). */
  disabled?: boolean
}

export function Tooltip({ content, children, side = 'top', align = 'center', disabled }: TooltipProps) {
  if (disabled || content == null || content === '') return <>{children}</>
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className="z-[60] max-w-xs animate-fade-in rounded-md bg-ink px-2.5 py-1.5 text-xs leading-snug text-bg"
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

/**
 * Rich hover popover (evidence popovers on fact-check claims, chunk previews).
 * Opens on hover/focus, stays open while the pointer is inside it.
 */
export function HoverCard({
  trigger,
  children,
  side = 'top',
  align = 'start',
  width = 360,
  className,
}: {
  trigger: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  width?: number
  className?: string
}) {
  return (
    <RTooltip.Root delayDuration={150}>
      <RTooltip.Trigger asChild>{trigger}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          style={{ width }}
          className={cn(
            'z-[60] max-w-[calc(100vw-24px)] animate-panel-in rounded-card border border-line bg-panel p-4 text-sm text-ink shadow-pop',
            className,
          )}
        >
          {children}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}

/* ------------------------------------------------------------------- Dialog */

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Footer buttons (right-aligned). */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Prevent closing on overlay click / Escape (e.g. while saving). */
  locked?: boolean
  className?: string
}

const dialogWidth = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', locked, className }: DialogProps) {
  const { t } = useTranslation('common')
  return (
    <RDialog.Root open={open} onOpenChange={(next) => (!locked || next ? onOpenChange(next) : undefined)}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-[#1b1915]/40 dark:bg-black/60" />
        <RDialog.Content
          onEscapeKeyDown={(e) => locked && e.preventDefault()}
          onPointerDownOutside={(e) => locked && e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card border border-line bg-panel shadow-pop',
            dialogWidth[size],
            className,
          )}
        >
          <div className="flex items-start gap-4 border-b border-line px-6 py-4">
            <div className="min-w-0 flex-1">
              <RDialog.Title className="font-display text-xl font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-1 text-sm text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RDialog.Description>
              )}
            </div>
            <RDialog.Close
              className="-mr-2 grid size-8 place-items-center rounded-ctl text-muted hover:bg-ink/6 hover:text-ink disabled:opacity-40"
              aria-label={t('actions.close')}
              disabled={locked}
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </RDialog.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-3">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/** Alias kept for readers who look for "Modal". */
export const Modal = Dialog

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  body?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button + warning glyph. */
  danger?: boolean
  loading?: boolean
  onConfirm: () => void | Promise<unknown>
  /** Extra content (e.g. a password field) between body and buttons. */
  children?: ReactNode
  confirmDisabled?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
  onConfirm,
  children,
  confirmDisabled,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common')
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }
  const working = loading || busy
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      locked={working}
      title={
        <span className="flex items-center gap-2">
          {danger ? <AlertTriangle className="size-5 text-danger" strokeWidth={1.75} aria-hidden /> : null}
          {title}
        </span>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={working}>
            {cancelLabel ?? t('actions.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={working} disabled={confirmDisabled} onClick={() => void run()}>
            {confirmLabel ?? t('actions.confirm')}
          </Button>
        </>
      }
    >
      {body ? <div className="text-sm text-muted">{body}</div> : null}
      {children ? <div className={cn(body && 'mt-4')}>{children}</div> : null}
    </Dialog>
  )
}

/** Shows a freshly generated secret (API key, password) once, with copy. */
export function SecretOnceDialog({
  open,
  onOpenChange,
  title,
  secret,
  label,
  note,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: ReactNode
  secret: string | null
  /** Small caption above the value, e.g. "API key for Mtiebi Bank". */
  label?: ReactNode
  note?: ReactNode
}) {
  const { t } = useTranslation('common')
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <KeyRound className="size-5 text-accent" strokeWidth={1.75} aria-hidden />
          {title ?? t('secret.title')}
        </span>
      }
      description={note ?? t('secret.body')}
      footer={
        <Button variant="primary" icon={<Check aria-hidden />} onClick={() => onOpenChange(false)}>
          {t('secret.acknowledge')}
        </Button>
      }
    >
      {label ? <div className="mb-2 text-xs font-medium text-muted">{label}</div> : null}
      <div className="flex items-center gap-2 rounded-ctl border border-accent/40 bg-accent/8 p-2 pl-3">
        <code className="min-w-0 flex-1 break-all font-mono text-[13px] text-ink">{secret ?? ''}</code>
        {secret ? <CopyButton value={secret} withText variant="secondary" /> : null}
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------- Drawer */

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 440,
  side = 'right',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  /** Desktop width in px (full width on phones). */
  width?: number
  side?: 'right' | 'left'
}) {
  const { t } = useTranslation('common')
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-[#1b1915]/30 dark:bg-black/50" />
        <RDialog.Content
          style={{ width: `min(${width}px, 100vw)` }}
          className={cn(
            'fixed inset-y-0 z-50 flex flex-col border-line bg-panel shadow-pop animate-drawer-in',
            side === 'right' ? 'right-0 border-l' : 'left-0 border-r',
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 flex-1">
              <RDialog.Title className="font-display text-lg font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-sm text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RDialog.Description>
              )}
            </div>
            <RDialog.Close
              className="-mr-1 grid size-8 place-items-center rounded-ctl text-muted hover:bg-ink/6 hover:text-ink"
              aria-label={t('actions.close')}
            >
              <X className="size-[18px]" strokeWidth={1.75} />
            </RDialog.Close>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}

/* ------------------------------------------------------------- DropdownMenu */

export type MenuItem =
  | {
      type?: 'item'
      label: ReactNode
      icon?: ReactNode
      onSelect: () => void
      danger?: boolean
      disabled?: boolean
      /** Right-aligned hint (shortcut, count). */
      hint?: ReactNode
    }
  | { type: 'separator' }
  | { type: 'label'; label: ReactNode }
  | { type: 'check'; label: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void }
  | { type: 'sub'; label: ReactNode; icon?: ReactNode; items: MenuItem[] }

const itemCls =
  'relative flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-ink/6 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]'
const contentCls = 'z-[60] min-w-48 animate-fade-in rounded-card border border-line bg-panel p-1 text-ink shadow-pop'

function renderItems(items: MenuItem[]) {
  return items.map((item, i) => {
    if (item.type === 'separator') return <RMenu.Separator key={i} className="my-1 h-px bg-line" />
    if (item.type === 'label')
      return (
        <RMenu.Label key={i} className="px-2.5 pb-1 pt-2 text-xs font-medium text-muted">
          {item.label}
        </RMenu.Label>
      )
    if (item.type === 'check')
      return (
        <RMenu.CheckboxItem
          key={i}
          className={cn(itemCls, 'pl-8')}
          checked={item.checked}
          onCheckedChange={(v) => item.onCheckedChange(v === true)}
          onSelect={(e) => e.preventDefault()}
        >
          <RMenu.ItemIndicator className="absolute left-2.5">
            <Check />
          </RMenu.ItemIndicator>
          {item.label}
        </RMenu.CheckboxItem>
      )
    if (item.type === 'sub')
      return (
        <RMenu.Sub key={i}>
          <RMenu.SubTrigger className={itemCls}>
            {item.icon}
            <span className="flex-1">{item.label}</span>
            <ChevronRight className="text-muted" />
          </RMenu.SubTrigger>
          <RMenu.Portal>
            <RMenu.SubContent className={contentCls} sideOffset={4}>
              {renderItems(item.items)}
            </RMenu.SubContent>
          </RMenu.Portal>
        </RMenu.Sub>
      )
    return (
      <RMenu.Item
        key={i}
        className={cn(itemCls, item.danger && 'text-danger data-[highlighted]:bg-danger/10')}
        disabled={item.disabled}
        onSelect={item.onSelect}
      >
        {item.icon}
        <span className="flex-1">{item.label}</span>
        {item.hint ? <span className="text-xs text-muted">{item.hint}</span> : null}
      </RMenu.Item>
    )
  })
}

export function DropdownMenu({
  trigger,
  items,
  align = 'end',
  side = 'bottom',
  header,
}: {
  /** A single focusable element (Button / IconButton). */
  trigger: ReactNode
  items: MenuItem[]
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Optional non-interactive block at the top (e.g. user name + role). */
  header?: ReactNode
}) {
  return (
    <RMenu.Root modal={false}>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} side={side} sideOffset={6} collisionPadding={8} className={contentCls}>
          {header ? <div className="border-b border-line px-2.5 pb-2 pt-1.5 mb-1">{header}</div> : null}
          {renderItems(items)}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  )
}
