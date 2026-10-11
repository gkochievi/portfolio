/** Class name helper: clsx + tailwind-merge aware of Dareke's tokens. */
import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      rounded: [{ rounded: ['control', 'card'] }],
      shadow: [{ shadow: ['pop'] }],
      'font-family': [{ font: ['display', 'sans', 'mono'] }],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs))
}
