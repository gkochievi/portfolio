import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const merge = extendTailwindMerge({
  extend: {
    theme: {
      color: ['bg', 'panel', 'sunken', 'line', 'line-strong', 'ink', 'muted', 'subtle', 'primary', 'primary-hover', 'on-primary', 'accent', 'on-accent', 'success', 'warning', 'danger', 'info'],
      radius: ['card', 'ctl', 'pill'],
    },
  },
})

/** Join class names and resolve Tailwind conflicts (later wins). */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
