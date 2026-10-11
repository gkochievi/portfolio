/**
 * The four sign-in-able demo accounts. One shared password.
 * Account ids equal the seeded User ids. Order = DemoBar order; the session
 * starts signed in as the operator.
 */
import type { DarekeAccount, Role } from '@/types'

export const DEMO_PASSWORD = 'dareke-demo'

export const accounts: DarekeAccount[] = [
  {
    id: 'u_mariam',
    userId: 'u_mariam',
    name: 'Mariam Gelashvili',
    email: 'mariam@dareke.example',
    password: DEMO_PASSWORD,
    role: 'operator',
    roleLabel: 'Operator',
    description: 'Agent workspace: dial, talk, disposition',
    home: '/agent',
    avatarColor: '#C2EF4A',
  },
  {
    id: 'u_levan',
    userId: 'u_levan',
    name: 'Levan Chikovani',
    email: 'levan@dareke.example',
    password: DEMO_PASSWORD,
    role: 'supervisor',
    roleLabel: 'Supervisor',
    description: 'Live wallboard and reports',
    home: '/supervisor',
    avatarColor: '#2F5C9E',
  },
  {
    id: 'u_tamar',
    userId: 'u_tamar',
    name: 'Tamar Lomidze',
    email: 'tamar@dareke.example',
    password: DEMO_PASSWORD,
    role: 'admin',
    roleLabel: 'Admin',
    description: 'Campaigns, lead lists, users, dialer settings',
    home: '/admin',
    avatarColor: '#1C2523',
  },
  {
    id: 'u_nino',
    userId: 'u_nino',
    name: 'Nino Beridze',
    email: 'nino@dareke.example',
    password: DEMO_PASSWORD,
    role: 'super_admin',
    roleLabel: 'Super admin',
    description: 'Everything, plus PBX and directory integrations',
    home: '/admin',
    avatarColor: '#9C5700',
  },
]

/** Where `/` sends each role. */
export const roleHome: Record<Role, string> = {
  operator: '/agent',
  supervisor: '/supervisor',
  admin: '/admin',
  super_admin: '/admin',
}

/** Georgian display names of the demo accounts (the `name` field is English). */
export const accountNameKa: Record<string, string> = {
  u_mariam: 'მარიამ გელაშვილი',
  u_levan: 'ლევან ჩიქოვანი',
  u_tamar: 'თამარ ლომიძე',
  u_nino: 'ნინო ბერიძე',
}
