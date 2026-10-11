import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import * as DM from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'

import { cn } from '@/lib/cn'

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group
export const DropdownMenuRadioGroup = DM.RadioGroup

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DM.Content>>(function DropdownMenuContent(
  { className, sideOffset = 6, align = 'end', ...props },
  ref,
) {
  return (
    <DM.Portal>
      <DM.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn('z-[60] min-w-48 overflow-hidden rounded-ui border border-line bg-panel p-1 text-ink shadow-pop animate-pop-in', className)}
        {...props}
      />
    </DM.Portal>
  )
})

const itemBase =
  'relative flex cursor-default select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover [&_svg]:size-4 [&_svg]:shrink-0'

export interface DropdownMenuItemProps extends ComponentPropsWithoutRef<typeof DM.Item> {
  icon?: ReactNode
  tone?: 'default' | 'danger'
  shortcut?: ReactNode
}

export const DropdownMenuItem = forwardRef<HTMLDivElement, DropdownMenuItemProps>(function DropdownMenuItem({ className, icon, tone, shortcut, children, asChild, ...props }, ref) {
  const cls = cn(itemBase, tone === 'danger' && 'text-danger data-[highlighted]:bg-danger-soft', className)
  // asChild (e.g. a router <Link>): the child must stay the only element; the icon is dropped.
  if (asChild) {
    return (
      <DM.Item ref={ref} asChild className={cls} {...props}>
        {children}
      </DM.Item>
    )
  }
  return (
    <DM.Item ref={ref} className={cn(itemBase, tone === 'danger' && 'text-danger data-[highlighted]:bg-danger-soft', className)} {...props}>
      {icon ? <span className={cn('flex', tone !== 'danger' && 'text-muted')}>{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {shortcut ? <span className="ml-4 text-xs text-muted">{shortcut}</span> : null}
    </DM.Item>
  )
})

export const DropdownMenuCheckboxItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DM.CheckboxItem>>(function DropdownMenuCheckboxItem(
  { className, children, ...props },
  ref,
) {
  return (
    <DM.CheckboxItem ref={ref} className={cn(itemBase, 'pl-8', className)} {...props}>
      <DM.ItemIndicator className="absolute left-2 flex text-accent">
        <Check strokeWidth={2.25} />
      </DM.ItemIndicator>
      {children}
    </DM.CheckboxItem>
  )
})

export const DropdownMenuRadioItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof DM.RadioItem>>(function DropdownMenuRadioItem(
  { className, children, ...props },
  ref,
) {
  return (
    <DM.RadioItem ref={ref} className={cn(itemBase, 'pl-8', className)} {...props}>
      <DM.ItemIndicator className="absolute left-2 flex text-accent">
        <Check strokeWidth={2.25} />
      </DM.ItemIndicator>
      {children}
    </DM.RadioItem>
  )
})

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn('px-2 pb-1 pt-1.5 text-xs font-medium text-muted', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />
}

export interface MenuItem {
  label: ReactNode
  icon?: ReactNode
  onSelect: () => void
  tone?: 'default' | 'danger'
  disabled?: boolean
  /** Draw a separator above this item. */
  separated?: boolean
}

/** Shorthand: <Menu trigger={<IconButton …/>} items={[…]} />. */
export function Menu({ trigger, items, label, align = 'end', className }: { trigger: ReactNode; items: MenuItem[]; label?: ReactNode; align?: 'start' | 'center' | 'end'; className?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={className}>
        {label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
        {items.map((item, i) => (
          <div key={i}>
            {item.separated ? <DropdownMenuSeparator /> : null}
            <DropdownMenuItem icon={item.icon} tone={item.tone} disabled={item.disabled} onSelect={item.onSelect}>
              {item.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
