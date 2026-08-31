import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-2xl',
  md: 'max-w-4xl',
  lg: 'max-w-6xl',
  xl: 'max-w-7xl',
} as const;

export function Container({ size = 'lg', className, ...props }: Props) {
  return <div className={cn('mx-auto px-4 md:px-8', SIZES[size], className)} {...props} />;
}
