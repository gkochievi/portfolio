/** Radix Tabs with an underline indicator. */
import * as RT from '@radix-ui/react-tabs'
import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

export const Tabs = RT.Root

export function TabsList({ className, ...props }: ComponentPropsWithoutRef<typeof RT.List>) {
  return (
    <RT.List
      className={cn('flex max-w-full gap-1 overflow-x-auto border-b-[1.5px] border-line [scrollbar-width:none]', className)}
      {...props}
    />
  )
}

export function TabsTrigger({ className, ...props }: ComponentPropsWithoutRef<typeof RT.Trigger>) {
  return (
    <RT.Trigger
      className={cn(
        '-mb-[1.5px] inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-[15px] font-semibold text-muted transition-colors hover:text-ink',
        'data-[state=active]:border-primary data-[state=active]:text-ink [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  )
}

export function TabsContent({ className, ...props }: ComponentPropsWithoutRef<typeof RT.Content>) {
  return <RT.Content className={cn('pt-5 focus-visible:outline-none', className)} {...props} />
}
