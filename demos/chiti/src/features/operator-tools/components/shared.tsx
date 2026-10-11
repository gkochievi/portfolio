import { Camera, Globe, MessageCircle, MessagesSquare, Music2, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import type { Channel } from '@/types'

const CHANNEL_ICON = {
  web_widget: Globe,
  whatsapp: MessageCircle,
  telegram: Send,
  facebook_messenger: MessagesSquare,
  instagram: Camera,
  tiktok: Music2,
} as const

/** Generic monochrome glyph + label for a channel (no real brand marks). */
export function ChannelTag({ channel, className }: { channel: Channel; className?: string }) {
  const { t } = useTranslation()
  const Icon = CHANNEL_ICON[channel]
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-muted', className)}>
      <Icon size={14} strokeWidth={1.75} aria-hidden />
      {t(`channel.${channel}`)}
    </span>
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
      document.body.removeChild(area)
      return ok
    } catch {
      return false
    }
  }
}

/** Remove `[1]`-style citation markers and tidy the spacing they leave behind. */
export function stripCitations(text: string): string {
  return text
    .replace(/\s*\[\d+\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim()
}

/** A small section heading used by the drawer tabs. */
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('mb-2 font-display text-[13px] font-semibold text-ink', className)}>{children}</h3>
}
