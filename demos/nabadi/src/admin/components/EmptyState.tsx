import type { ReactNode } from 'react';
import { Card } from './Card';

interface Props {
  title: string;
  hint?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({ title, hint, icon, actions }: Props) {
  return (
    <Card className="text-center py-14 flex flex-col items-center gap-3">
      {icon && (
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-pill bg-line/60 text-ink-muted">
          {icon}
        </span>
      )}
      <h3 className="font-display text-xl text-ink tracking-tight">{title}</h3>
      {hint && <p className="text-sm text-ink-muted max-w-md">{hint}</p>}
      {actions && <div className="mt-2 flex gap-2 justify-center">{actions}</div>}
    </Card>
  );
}
