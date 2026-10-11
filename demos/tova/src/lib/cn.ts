import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/** tailwind-merge that knows the Tova radius and shadow tokens. */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['chip', 'card', 'hero'] }],
      shadow: [{ shadow: ['card', 'pop'] }],
    },
  },
})

/** clsx + tailwind-merge: later classes win. */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
