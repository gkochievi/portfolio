import {
  AudioWaveform,
  BookOpen,
  Bot,
  ChartColumn,
  Cpu,
  ListChecks,
  MessagesSquare,
  PhoneCall,
  Scale,
  ServerCog,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

import type { SinjiAccount } from '@/types'

export interface NavEntry {
  to: string
  /** Key in the `shell` namespace. */
  label: string
  icon: LucideIcon
  end?: boolean
}

export interface NavSection {
  /** Key in the `shell` namespace; null = no heading. */
  heading: string | null
  items: NavEntry[]
}

const workspace: NavEntry[] = [
  { to: '/workspace/calls', label: 'nav.calls', icon: PhoneCall },
  { to: '/workspace/kb', label: 'nav.kb', icon: BookOpen },
  { to: '/workspace/curation', label: 'nav.curation', icon: ListChecks },
  { to: '/workspace/rubric', label: 'nav.rubric', icon: Scale },
  { to: '/workspace/settings', label: 'nav.settings', icon: SlidersHorizontal },
  { to: '/workspace/bot', label: 'nav.bot', icon: Bot },
  { to: '/copilot', label: 'nav.copilot', icon: MessagesSquare },
]

const tools: NavSection = {
  heading: 'nav.tools',
  items: [{ to: '/', label: 'nav.voiceTools', icon: AudioWaveform, end: true }],
}

/** Every route the account can see, grouped for the left rail. */
export function navFor(account: SinjiAccount | null): NavSection[] {
  if (!account) return [tools]
  if (account.role === 'operator') {
    return [
      {
        heading: 'nav.platform',
        items: [
          { to: '/console', label: 'nav.console', icon: ServerCog },
          { to: '/ai-config', label: 'nav.aiSetup', icon: Cpu },
          { to: '/usage', label: 'nav.usage', icon: ChartColumn },
        ],
      },
      { heading: 'nav.workspace', items: workspace },
      tools,
    ]
  }
  return [{ heading: null, items: workspace }, tools]
}
