import { Camera, MessageCircle, MessageSquare, Music2, Send, Smartphone, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/cn'
import type { Channel } from '@/types'

/** Generic monochrome marks (bubble, phone-bubble, paper plane, camera, note): no third-party logos. */
const GLYPHS: Record<Channel, LucideIcon> = {
  web_widget: MessageCircle,
  whatsapp: Smartphone,
  telegram: Send,
  facebook_messenger: MessageSquare,
  instagram: Camera,
  tiktok: Music2,
}

export interface ChannelGlyphProps {
  channel: Channel
  size?: number
  className?: string
}

/** Icon-only channel mark. Decorative: pair it with the text label where meaning matters. */
export function ChannelGlyph({ channel, size = 16, className }: ChannelGlyphProps) {
  const Icon = GLYPHS[channel]
  return <Icon size={size} strokeWidth={1.75} aria-hidden className={cn('shrink-0 text-muted', className)} />
}

export interface ChannelBadgeProps {
  channel: Channel
  /** Show the channel name next to the mark. Without it the badge is icon-only with an accessible label. */
  withLabel?: boolean
  className?: string
}

export function ChannelBadge({ channel, withLabel, className }: ChannelBadgeProps) {
  const { t } = useTranslation('common')
  const label = t(`channel.${channel}`)
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full bg-sunken px-1.5 py-px text-[11px] font-medium leading-4 text-ink ring-1 ring-line', className)}
      title={label}
      {...(withLabel ? {} : { role: 'img', 'aria-label': label })}
    >
      <ChannelGlyph channel={channel} size={12} className="text-accent" />
      {withLabel ? <span>{label}</span> : null}
    </span>
  )
}
