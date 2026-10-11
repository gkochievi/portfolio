/** Navigation model: groups, items, icons. Labels come from `common:nav.*`. */
import {
  Activity,
  Archive,
  Gauge,
  Hash,
  Headset,
  Megaphone,
  PhoneCall,
  Plug,
  ScrollText,
  Server,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { canSeeExtensionActivity, ROUTE_FEATURES } from '@/lib/rbac'
import type { FeatureKey, RoleId } from '@/types'

export interface NavItem {
  path: string
  labelKey: string
  icon: LucideIcon
  feature: FeatureKey
  adminOnly?: boolean
  /** Short label for the mobile tab bar. */
  shortKey?: string
}

export interface NavGroup {
  id: 'calls' | 'contactCentre' | 'extensions' | 'operations' | 'administration'
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { id: 'calls', items: [{ path: '/calls', labelKey: 'nav.calls', icon: PhoneCall, feature: 'cdr' }] },
  {
    id: 'contactCentre',
    items: [
      { path: '/campaigns', labelKey: 'nav.campaigns', icon: Megaphone, feature: 'cc_campaigns' },
      { path: '/agents', labelKey: 'nav.agents', icon: Headset, feature: 'cc_agents' },
      { path: '/nodes', labelKey: 'nav.nodes', icon: Server, feature: 'cc_nodes' },
    ],
  },
  {
    id: 'extensions',
    items: [
      { path: '/extensions', labelKey: 'nav.extensions', icon: Hash, feature: 'extensions' },
      { path: '/extensions/activity', labelKey: 'nav.extensionActivity', icon: ScrollText, feature: 'extensions', adminOnly: true },
    ],
  },
  {
    id: 'operations',
    items: [
      { path: '/archive', labelKey: 'nav.archive', icon: Archive, feature: 'systems_sync' },
      { path: '/activity', labelKey: 'nav.activity', icon: Activity, feature: 'logs' },
      { path: '/status', labelKey: 'nav.status', icon: Gauge, feature: 'health' },
    ],
  },
  {
    id: 'administration',
    items: [
      { path: '/connections', labelKey: 'nav.connections', icon: Plug, feature: 'settings' },
      { path: '/people', labelKey: 'nav.people', icon: Users, feature: 'users' },
      { path: '/roles', labelKey: 'nav.roles', icon: ShieldCheck, feature: 'rbac' },
    ],
  },
]

export function visibleGroups(features: readonly FeatureKey[], role: RoleId | null): NavGroup[] {
  return NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => features.includes(i.feature) && (!i.adminOnly || canSeeExtensionActivity(role))),
  })).filter((g) => g.items.length > 0)
}

/** First route this feature set may open (spec order); '/login' when none. */
export function firstPathFor(features: readonly FeatureKey[]): string {
  return ROUTE_FEATURES.find((r) => features.includes(r.feature))?.path ?? '/login'
}

/** The nav item a pathname belongs to (longest prefix). */
export function itemForPath(pathname: string): { group: NavGroup; item: NavItem } | null {
  let best: { group: NavGroup; item: NavItem } | null = null
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
        if (!best || item.path.length > best.item.path.length) best = { group, item }
      }
    }
  }
  return best
}
