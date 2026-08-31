import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function DropdownMenu(props: ComponentProps<typeof DropdownPrimitive.Root>) {
  return <DropdownPrimitive.Root {...props} />;
}

export function DropdownMenuTrigger(props: ComponentProps<typeof DropdownPrimitive.Trigger>) {
  return <DropdownPrimitive.Trigger {...props} />;
}

export function DropdownMenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-[200px] rounded-md bg-surface border border-line p-1 shadow-[var(--shadow-soft)]',
          className,
        )}
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item> & { destructive?: boolean }) {
  const { destructive, ...rest } = props as ComponentProps<typeof DropdownPrimitive.Item> & {
    destructive?: boolean;
  };
  return (
    <DropdownPrimitive.Item
      className={cn(
        'flex items-center gap-2 px-3 py-2 text-sm rounded-sm cursor-pointer transition outline-none',
        'data-[highlighted]:bg-line/60 text-ink',
        destructive && 'text-danger data-[highlighted]:bg-danger/10',
        className,
      )}
      {...rest}
    />
  );
}

export function DropdownMenuSeparator(props: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" {...props} />;
}
