import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import type { Lang, LocalizedText } from '@/types'

/** Owner: design-system agent. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Pick the current language from a seed `LocalizedText`. */
export function lt(text: LocalizedText, lang: string): string {
  return (lang === 'ka' ? text.ka : text.en) || text.en
}

export function asLang(value: string | undefined): Lang {
  return value === 'ka' ? 'ka' : 'en'
}
