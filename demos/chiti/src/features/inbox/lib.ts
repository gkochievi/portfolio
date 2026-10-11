/** Small helpers shared by the inbox components (owner: inbox). */
import { useEffect, useRef, useState, type RefObject } from 'react'

import type { SessionSummary } from '@/types'

import type { ChannelFilter } from './types'

export function matchesFilter(session: SessionSummary, filter: ChannelFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'bot') return session.aiState === 'bot'
  return session.channel === filter
}

export type PreviewIcon = 'image' | 'file' | 'location' | 'audio' | null

/** What the second line of a row shows: a glyph for media, the text otherwise. */
export function previewOf(session: SessionSummary): { icon: PreviewIcon; text: string; fromStaff: boolean } {
  const last = session.lastMessage
  if (!last) return { icon: null, text: '', fromStaff: false }
  const icon: PreviewIcon =
    last.type === 'image' ? 'image' : last.type === 'file' ? 'file' : last.type === 'location' ? 'location' : last.type === 'audio' ? 'audio' : null
  return { icon, text: last.text, fromStaff: last.sender === 'operator' || last.sender === 'admin' }
}

/** Measures an element (ResizeObserver); `fallback` until the first measurement. */
export function useElementWidth<T extends HTMLElement>(fallback = 1280): [RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    setWidth(node.getBoundingClientRect().width || fallback)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width
      if (next) setWidth(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [fallback])
  return [ref as RefObject<T>, width]
}

/** Composer drafts survive switching chats (memory only; a reload restores the seed). */
const drafts = new Map<string, string>()
export const draftStore = {
  get: (sessionId: string) => drafts.get(sessionId) ?? '',
  set: (sessionId: string, value: string) => {
    if (value) drafts.set(sessionId, value)
    else drafts.delete(sessionId)
  },
}
