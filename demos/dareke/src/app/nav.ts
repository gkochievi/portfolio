/** Navigation per role. Labels live in shell.json `nav.*`. */
import {
  Ban,
  BarChart3,
  Cable,
  Headset,
  History,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MonitorPlay,
  SlidersHorizontal,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react'

import type { Role } from '@/types'

export interface NavItem {
  to: string
  key: string
  icon: LucideIcon
  roles: Role[]
  /** Match only the exact path (for /admin). */
  end?: boolean
  group: 'work' | 'supervise' | 'admin'
  /** Single-key "g then x" style hint shown in the palette. */
}

const SUP: Role[] = ['supervisor', 'admin', 'super_admin']
const ADM: Role[] = ['admin', 'super_admin']

export const NAV: NavItem[] = [
  { to: '/agent', key: 'workspace', icon: Headset, roles: ['operator'], group: 'work' },
  { to: '/admin', key: 'dashboard', icon: LayoutDashboard, roles: ADM, end: true, group: 'admin' },
  { to: '/admin/campaigns', key: 'campaigns', icon: Megaphone, roles: ADM, group: 'admin' },
  { to: '/admin/users', key: 'users', icon: Users, roles: ADM, group: 'admin' },
  { to: '/admin/agent-statuses', key: 'agentStatuses', icon: ListChecks, roles: ADM, group: 'admin' },
  { to: '/admin/dispositions', key: 'dispositions', icon: Tags, roles: ADM, group: 'admin' },
  { to: '/admin/dnc', key: 'dnc', icon: Ban, roles: ADM, group: 'admin' },
  { to: '/admin/settings', key: 'settings', icon: SlidersHorizontal, roles: ADM, group: 'admin' },
  { to: '/admin/integrations', key: 'integrations', icon: Cable, roles: ['super_admin'], group: 'admin' },
  { to: '/supervisor', key: 'wall', icon: MonitorPlay, roles: SUP, group: 'supervise' },
  { to: '/reports', key: 'reports', icon: BarChart3, roles: SUP, group: 'supervise' },
  { to: '/calls', key: 'calls', icon: History, roles: SUP, group: 'supervise' },
]

export function navFor(role: Role | null | undefined): NavItem[] {
  if (!role) return []
  return NAV.filter((item) => item.roles.includes(role))
}
