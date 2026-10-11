/** Radix dropdown menu, styled. Compose: DropdownMenu > DropdownMenuTrigger asChild + DropdownMenuContent > DropdownMenuItem. */
import * as DM from '@radix-ui/react-dropdown-menu'
import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

export const DropdownMenu = DM.Root
export const DropdownMenuTrigger = DM.Trigger
export const DropdownMenuGroup = DM.Group

export function DropdownMenuContent({ className, sideOffset = 6, align = 'end', ...props }: ComponentPropsWithoutRef<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={12}
        className={cn(
          'z-[80] min-w-[220px] overflow-hidden rounded-card border-[1.5px] border-line bg-panel p-1 text-ink shadow-pop data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </DM.Portal>
  )
}

export function DropdownMenuItem({
  className,
  danger,
  ...props
}: ComponentPropsWithoutRef<typeof DM.Item> & { danger?: boolean }) {
  return (
    <DM.Item
      className={cn(
        'flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-chip px-2.5 text-[15px] outline-none transition-colors',
        'data-[highlighted]:bg-sunken data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-[18px] [&_svg]:text-muted',
        danger && 'text-danger [&_svg]:text-danger data-[highlighted]:bg-danger-soft',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Label>) {
  return <DM.Label className={cn('px-2.5 py-2 text-sm', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithoutRef<typeof DM.Separator>) {
  return <DM.Separator className={cn('-mx-1 my-1 h-[1.5px] bg-line', className)} {...props} />
}
