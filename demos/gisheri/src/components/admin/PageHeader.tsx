import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  back?: { to: string; label: string };
  actions?: React.ReactNode;
  className?: string;
}

const PageHeader = ({ title, description, back, actions, className }: PageHeaderProps) => (
  <div className={cn('mb-8', className)}>
    {back && (
      <Link
        to={back.to}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ChevronLeft size={16} />
        {back.label}
      </Link>
    )}
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
      <div className="min-w-0">
        <h1 className="font-serif text-2xl md:text-3xl font-medium truncate">{title}</h1>
        {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </div>
);

export default PageHeader;
