/**
 * Channel rules (pure): free-form reply windows, the TikTok consecutive-message
 * cap, the per-channel media matrix and where the bot may answer first.
 */
import type { Channel, ChannelWindowState, ChatSession, ExternalChannel } from '@/types'

/** Effective free-form window per channel, in hours (Instagram includes the human-agent tag). */
export const CHANNEL_WINDOW_HOURS: Record<ExternalChannel, number> = {
  facebook_messenger: 168,
  instagram: 168,
  whatsapp: 24,
  telegram: 24,
  tiktok: 48,
}

/** Business messages allowed in a row on TikTok before the customer must write again. */
export const TIKTOK_CAP = 10

export interface ChannelMedia {
  location: boolean
  pdf: boolean
  reactions: boolean
}

export const CHANNEL_MEDIA: Record<Channel, ChannelMedia> = {
  web_widget: { location: true, pdf: true, reactions: true },
  facebook_messenger: { location: false, pdf: true, reactions: true },
  instagram: { location: false, pdf: false, reactions: true },
  whatsapp: { location: true, pdf: true, reactions: true },
  telegram: { location: true, pdf: true, reactions: false },
  tiktok: { location: true, pdf: true, reactions: true },
}

/** Bot-first is not allowed on Telegram and TikTok. */
export const BOT_ALLOWED: Record<Channel, boolean> = {
  web_widget: true,
  facebook_messenger: true,
  instagram: true,
  whatsapp: true,
  telegram: false,
  tiktok: false,
}

/** Customer number prefix per external channel (`wa:…`, `fb:…`). */
export const NUMBER_PREFIX: Record<ExternalChannel, string> = {
  facebook_messenger: 'fb',
  instagram: 'ig',
  whatsapp: 'wa',
  telegram: 'tg',
  tiktok: 'tt',
}

export function isExternalChannel(channel: Channel): channel is ExternalChannel {
  return channel !== 'web_widget'
}

const HOUR = 3_600_000

/** Reply-window state of a session at `now`. */
export function computeWindow(
  session: Pick<ChatSession, 'channel' | 'lastInboundAt' | 'consecutiveBusinessMessages'>,
  now: number = Date.now(),
): ChannelWindowState {
  const { channel } = session
  const media = CHANNEL_MEDIA[channel]
  const base = {
    channel,
    allowsLocation: media.location,
    allowsPdf: media.pdf,
    allowsReactions: media.reactions,
    botAllowed: BOT_ALLOWED[channel],
  }
  if (!isExternalChannel(channel)) {
    return { ...base, open: true, windowHours: null, closesAt: null, remedy: null, capLimit: null, capRemaining: null }
  }
  const hours = CHANNEL_WINDOW_HOURS[channel]
  const last = session.lastInboundAt ? Date.parse(session.lastInboundAt) : null
  const closesAtMs = last === null ? null : last + hours * HOUR
  const open = closesAtMs !== null && now < closesAtMs
  return {
    ...base,
    open,
    windowHours: hours,
    closesAt: closesAtMs === null ? null : new Date(closesAtMs).toISOString(),
    remedy: open ? null : channel === 'whatsapp' ? 'template' : 'none',
    capLimit: channel === 'tiktok' ? TIKTOK_CAP : null,
    capRemaining: channel === 'tiktok' ? Math.max(0, TIKTOK_CAP - session.consecutiveBusinessMessages) : null,
  }
}
