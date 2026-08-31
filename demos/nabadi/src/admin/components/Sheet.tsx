import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Sheet(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}
export function SheetTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}
export function SheetClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />;
}

interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right' | 'top' | 'bottom';
  children?: ReactNode;
  /** Accessible label for the close button (i18n). */
  closeLabel?: string;
}

const sideClasses = {
  left: 'inset-y-0 left-0 h-full w-3/4 sm:max-w-md border-r',
  right: 'inset-y-0 right-0 h-full w-full sm:max-w-md border-l',
  top: 'inset-x-0 top-0 w-full border-b',
  bottom: 'inset-x-0 bottom-0 w-full border-t',
};

export function SheetContent({
  side = 'right',
  className,
  children,
  closeLabel = 'Close',
  ...props
}: SheetContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-surface border-line p-6 flex flex-col gap-4 overflow-y-auto',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex items-center justify-center w-8 h-8 rounded-pill text-ink-muted hover:text-ink hover:bg-line/50 transition"
          aria-label={closeLabel}
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={className} {...props} />;
}

/** Visually-hidden accessible title — satisfies the Radix Dialog name requirement. */
export function SheetTitleHidden(props: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className="sr-only" {...props} />;
}

export function SheetDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-ink-muted', className)} {...props} />
  );
}
