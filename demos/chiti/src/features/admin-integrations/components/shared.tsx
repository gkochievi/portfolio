import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Facebook, Instagram, MessageCircle, Music2, Send, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

import { fieldError } from '@/api/client'
import { cn } from '@/lib/cn'
import type { Channel } from '@/types'

export type Lang = 'en' | 'ka'

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return i18n.language?.startsWith('ka') ? 'ka' : 'en'
}

/** "Back to settings" link shown above every sub-page title. */
export function BackLink() {
  const { t } = useTranslation('adminIntegrations')
  return (
    <Link to="/admin/settings" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
      <ArrowLeft size={16} strokeWidth={1.75} aria-hidden />
      {t('common.backToSettings')}
    </Link>
  )
}

/** Our own generic monochrome channel marks (lucide glyphs, no brand logos). */
export function ChannelIcon({ channel, size = 20, className }: { channel: Channel; size?: number; className?: string }) {
  const props = { size, strokeWidth: 1.75, className, 'aria-hidden': true } as const
  switch (channel) {
    case 'facebook_messenger':
      return <Facebook {...props} />
    case 'instagram':
      return <Instagram {...props} />
    case 'whatsapp':
      return <MessageCircle {...props} />
    case 'telegram':
      return <Send {...props} />
    case 'tiktok':
      return <Music2 {...props} />
    default:
      return <MessageCircle {...props} />
  }
}

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const NOTICE: Record<NoticeTone, { icon: typeof Info; box: string }> = {
  info: { icon: Info, box: 'bg-info-soft text-info' },
  success: { icon: CheckCircle2, box: 'bg-success-soft text-success' },
  warning: { icon: AlertTriangle, box: 'bg-warning-soft text-warning' },
  danger: { icon: XCircle, box: 'bg-danger-soft text-danger' },
}

/** Inline banner (result of a test, platform notes). Text stays ink for contrast; the tint carries the tone. */
export function Notice({ tone = 'info', title, children, action, className }: { tone?: NoticeTone; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { icon: Icon, box } = NOTICE[tone]
  return (
    <div role={tone === 'danger' || tone === 'warning' ? 'alert' : 'status'} className={cn('flex items-start gap-2.5 rounded-ui px-3 py-2.5 text-sm', box, className)}>
      <Icon size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5', 'text-[13px] text-ink/80 dark:text-ink/80')}>{children}</div> : null}
      </div>
      {action}
    </div>
  )
}

/** One label / value line of a credential summary. */
export function SummaryRow({ label, children, mono }: { label: ReactNode; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={cn('min-w-0 break-all text-right text-ink', mono && 'font-mono text-[13px]')}>{children}</dd>
    </div>
  )
}

/** Copy to the clipboard; falls back to a hidden textarea inside sandboxed iframes. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

/** A translated inline message for a server field error (the mock sends machine codes). */
export function useFieldMessage() {
  const { t } = useTranslation('adminIntegrations')
  return (error: unknown, field: string): string | undefined => {
    const code = fieldError(error, field)
    return code ? t(`errors.${code}`, { defaultValue: code }) : undefined
  }
}
