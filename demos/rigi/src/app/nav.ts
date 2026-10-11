/**
 * Sidebar / portal navigation. Labels are `common:nav.*`. Owner: shell.
 */
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  ClipboardList,
  CreditCard,
  FileStack,
  FileText,
  FolderKanban,
  Gauge,
  HeartPulse,
  Inbox,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  PiggyBank,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import type { RigiAccount } from '@/demo/accounts'
import type { StaffArea } from '@/types'

export interface NavItem {
  /** i18n key under `common:nav`. */
  label: string
  to: string
  icon: LucideIcon
  /** Exact match only (area dashboards). */
  end?: boolean
  /** `?tab=` value that must match (technician task tabs). */
  tab?: string
  /** Also active under these path prefixes. */
  alsoActive?: string[]
}

export interface NavGroup {
  /** i18n key under `common:nav`; omitted = no label. */
  label?: string
  items: NavItem[]
  superadminOnly?: boolean
}

export const AREA_ICON: Record<StaffArea | 'partner', LucideIcon> = {
  admin: ShieldCheck,
  accountant: Landmark,
  l1: Inbox,
  technician: Wrench,
  partner: Building2,
}

export const AREA_HOME: Record<StaffArea, string> = {
  admin: '/admin',
  accountant: '/accountant',
  l1: '/l1',
  technician: '/technician',
}

const ROLE_AREAS: NavGroup = {
  label: 'roleAreas',
  superadminOnly: true,
  items: [
    { label: 'areas.admin', to: '/admin', icon: ShieldCheck, end: true },
    { label: 'areas.accountant', to: '/accountant', icon: Landmark, end: true },
    { label: 'areas.l1', to: '/l1', icon: Inbox, end: true },
    { label: 'areas.technician', to: '/technician', icon: Wrench, end: true },
  ],
}

export const STAFF_NAV: Record<StaffArea, NavGroup[]> = {
  admin: [
    {
      items: [
        { label: 'dashboard', to: '/admin', icon: LayoutDashboard, end: true },
        { label: 'partners', to: '/admin/partners', icon: Building2 },
        { label: 'licenses', to: '/admin/licenses', icon: BadgeCheck },
        { label: 'taskTemplates', to: '/admin/task-templates', icon: ClipboardList },
        { label: 'users', to: '/admin/users', icon: Users },
        { label: 'apiKeys', to: '/admin/api-keys', icon: KeyRound },
      ],
    },
    {
      label: 'opsGroup',
      items: [
        { label: 'audit', to: '/admin/audit', icon: ScrollText },
        { label: 'systemLogs', to: '/admin/system-logs', icon: FileStack },
        { label: 'systemHealth', to: '/admin/system-health', icon: HeartPulse },
        { label: 'settings', to: '/admin/settings', icon: Settings },
      ],
    },
  ],
  accountant: [
    {
      items: [
        { label: 'dashboard', to: '/accountant', icon: LayoutDashboard, end: true },
        { label: 'invoices', to: '/accountant/invoices', icon: ReceiptText, alsoActive: ['/accountant/partners'] },
        { label: 'reports', to: '/accountant/reports', icon: BarChart3, end: true },
        { label: 'payments', to: '/accountant/reports/payments', icon: CreditCard },
        { label: 'unusedAllowance', to: '/accountant/reports/unused-allowance', icon: PiggyBank },
        { label: 'templates', to: '/accountant/templates', icon: FileText },
        { label: 'billing', to: '/accountant/billing', icon: Landmark },
      ],
    },
  ],
  l1: [
    {
      items: [
        { label: 'dashboard', to: '/l1', icon: LayoutDashboard, end: true },
        { label: 'mails', to: '/l1/mails', icon: Inbox, alsoActive: ['/l1/threads'] },
        { label: 'tasks', to: '/l1/tasks', icon: ListTodo },
        { label: 'projects', to: '/l1/projects', icon: FolderKanban },
      ],
    },
  ],
  technician: [
    {
      items: [
        { label: 'dashboard', to: '/technician', icon: Gauge, end: true },
        { label: 'myTasks', to: '/technician/tasks?tab=mine', icon: ListChecks, tab: 'mine' },
        { label: 'allTasks', to: '/technician/tasks?tab=all', icon: ListTodo, tab: 'all' },
      ],
    },
  ],
}

export const PORTAL_NAV: NavItem[] = [
  { label: 'portalTasks', to: '/partner', icon: Ticket, alsoActive: ['/partner/tasks'] },
  { label: 'portalProjects', to: '/partner/projects', icon: FolderKanban },
  { label: 'portalAccount', to: '/partner/account', icon: Users },
  { label: 'portalInvoices', to: '/partner/invoices', icon: ReceiptText },
  { label: 'portalDocuments', to: '/partner/documents', icon: FileText },
  { label: 'portalPoints', to: '/partner/points', icon: Activity },
]

/** Groups the sidebar shows for `area` (adds "Role areas" for the superadmin). */
export function navFor(area: StaffArea, me: RigiAccount | null): NavGroup[] {
  const groups = STAFF_NAV[area]
  return me?.role === 'superadmin' ? [...groups, ROLE_AREAS] : groups
}

/** Is `item` the current location? */
export function isNavActive(item: NavItem, pathname: string, search: string): boolean {
  const [path] = item.to.split('?') as [string]
  if (item.tab) {
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false
    if (pathname !== path) return item.tab === 'mine'
    const tab = new URLSearchParams(search).get('tab') ?? 'mine'
    return tab === item.tab
  }
  if (item.end) return pathname === path || pathname === `${path}/`
  if (item.to === '/partner') return pathname === '/partner' || pathname.startsWith('/partner/tasks')
  if (pathname === path || pathname.startsWith(`${path}/`)) return true
  return (item.alsoActive ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Every destination a persona can reach (command palette). */
export function destinationsFor(me: RigiAccount | null): Array<{ area: StaffArea | 'partner'; item: NavItem }> {
  if (!me) return []
  if (me.realm === 'partner') return PORTAL_NAV.map((item) => ({ area: 'partner' as const, item }))
  const areas: StaffArea[] = me.role === 'superadmin' ? ['admin', 'accountant', 'l1', 'technician'] : ([({ accountant: 'accountant', l1_employee: 'l1', technician: 'technician' } as Record<string, StaffArea>)[me.role]].filter(Boolean) as StaffArea[])
  return areas.flatMap((area) => STAFF_NAV[area].flatMap((g) => g.items.map((item) => ({ area, item }))))
}

