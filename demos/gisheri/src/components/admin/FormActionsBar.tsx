import { cn } from '@/lib/utils';

/**
 * Pinned action bar for long edit forms. Sticks to the bottom of the
 * viewport with a subtle backdrop so the primary save action is always
 * reachable without scrolling.
 */
const FormActionsBar = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'sticky bottom-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3',
      'bg-background/95 backdrop-blur-sm border-t border-border',
      'flex items-center justify-end gap-2',
      className,
    )}
  >
    {children}
  </div>
);

export default FormActionsBar;
