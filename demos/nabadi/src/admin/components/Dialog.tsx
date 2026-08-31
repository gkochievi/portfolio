import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root {...props} />;
}
export function DialogTrigger(props: ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger {...props} />;
}
export function DialogClose(props: ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close {...props} />;
}

interface DialogContentProps extends ComponentProps<typeof DialogPrimitive.Content> {
  children: ReactNode;
}

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 border border-line bg-surface p-6 rounded-2xl shadow-[var(--shadow-pop)]',
          // Tall dialogs (service form, photo cropper) must not overflow small
          // viewports: cap the height and scroll inside instead.
          'max-h-[85vh] overflow-y-auto',
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-xl text-ink tracking-tight', className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-ink-muted', className)} {...props} />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-2',
        // Sticky inside the scrolling DialogContent so the actions stay
        // reachable when a tall form scrolls (1px line, no shadow — brand).
        'sticky bottom-0 -mx-6 -mb-6 px-6 py-4 bg-surface border-t border-line rounded-b-2xl',
        className,
      )}
      {...props}
    />
  );
}

interface DialogContentWithCloseProps extends DialogContentProps {
  /** Accessible label for the close button (i18n). */
  closeLabel?: string;
}

/** Dialog with a built-in close X in the corner. */
export function DialogContentWithClose(props: DialogContentWithCloseProps) {
  const { children, closeLabel = 'Close', ...rest } = props;
  return (
    <DialogContent {...rest}>
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 inline-flex items-center justify-center w-8 h-8 rounded-pill text-ink-muted hover:text-ink hover:bg-line/50 transition"
        aria-label={closeLabel}
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogContent>
  );
}
