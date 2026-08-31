import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
export function SheetTitle(props: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title {...props} />;
}

interface SheetContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  side?: 'left' | 'right' | 'top' | 'bottom';
  children: ReactNode;
}

const sideClasses = {
  left: 'inset-y-0 left-0 h-full w-3/4 sm:max-w-sm border-r',
  right: 'inset-y-0 right-0 h-full w-3/4 sm:max-w-sm border-l',
  top: 'inset-x-0 top-0 w-full border-b',
  bottom: 'inset-x-0 bottom-0 w-full border-t',
};

export function SheetContent({ side = 'right', className, children, ...props }: SheetContentProps) {
  const { t } = useTranslation('common');
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed z-50 bg-surface border-line p-6 flex flex-col gap-4',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 text-ink-muted hover:text-ink transition"
          aria-label={t('close')}
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
