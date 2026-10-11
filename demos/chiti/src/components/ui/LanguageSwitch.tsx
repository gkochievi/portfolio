import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'

/** EN / ქარ toggle. Changes i18n only (nothing is stored). */
export function LanguageSwitch({ className, size = 'md' }: { className?: string; size?: 'sm' | 'md' }) {
  const { i18n, t } = useTranslation()
  const current = i18n.language?.startsWith('ka') ? 'ka' : 'en'
  const opts = [
    { value: 'en', label: 'EN' },
    { value: 'ka', label: 'ქარ' },
  ] as const
  return (
    <div role="radiogroup" aria-label={t('language')} className={cn('inline-flex items-center rounded-full border border-line bg-sunken p-0.5', className)}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          lang={o.value}
          onClick={() => void i18n.changeLanguage(o.value)}
          className={cn(
            'rounded-full font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent',
            size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-7 px-2.5 text-xs',
            current === o.value ? 'bg-ink text-bg' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
