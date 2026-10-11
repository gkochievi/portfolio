/**
 * The five one-click demo personas (brand brief, "Demo accounts").
 * Owner: seed. Every account id equals the id of its StaffUser / PartnerAdmin
 * record in the seed, so handlers can join on it.
 */
import type { DemoAccount } from '@portfolio/demo-kit'

import type { AccountRole, ID, TechnicianType } from '@/types'

export const DEMO_PASSWORD = 'rigi-demo'

export interface RigiAccount extends DemoAccount {
  role: AccountRole
  realm: 'staff' | 'partner'
  /** Georgian spelling of the name. */
  nameKa: string
  /** Where `/` and the demo bar send this persona. */
  home: string
  technicianType: TechnicianType | null
  /** partner_admin only: the tenant and the portal username. */
  partnerId: ID | null
  username: string | null
}

export const ACCOUNT_IDS = {
  nino: 'usr_nino',
  levan: 'usr_levan',
  mariam: 'usr_mariam',
  giorgi: 'usr_giorgi',
  tamar: 'padm_tamar',
} as const

/** Fixed partner ids other modules may reference directly. */
export const PARTNER_IDS = {
  zemo: 'prt_zemo',
  kolkheti: 'prt_kolkheti',
  batumiWave: 'prt_batumiwave',
  mzeo: 'prt_mzeo',
  lukma: 'prt_lukma',
  talgha: 'prt_talgha',
  alvani: 'prt_alvani',
  vake: 'prt_vake',
  ruisi: 'prt_ruisi',
} as const

export const accounts: readonly RigiAccount[] = [
  {
    id: ACCOUNT_IDS.nino,
    name: 'Nino Kapanadze',
    nameKa: 'ნინო კაპანაძე',
    email: 'nino@rigi.example',
    password: DEMO_PASSWORD,
    role: 'superadmin',
    roleLabel: 'Superadmin',
    description: 'Owner. Sees every area, partners, licenses, ops tooling.',
    avatarColor: '#1A1B1E',
    realm: 'staff',
    home: '/admin',
    technicianType: null,
    partnerId: null,
    username: null,
  },
  {
    id: ACCOUNT_IDS.levan,
    name: 'Levan Abashidze',
    nameKa: 'ლევან აბაშიძე',
    email: 'levan@rigi.example',
    password: DEMO_PASSWORD,
    role: 'accountant',
    roleLabel: 'Accountant',
    description: 'Finance. Generates, issues and collects invoices.',
    avatarColor: '#2A7A2E',
    realm: 'staff',
    home: '/accountant',
    technicianType: null,
    partnerId: null,
    username: null,
  },
  {
    id: ACCOUNT_IDS.mariam,
    name: 'Mariam Japaridze',
    nameKa: 'მარიამ ჯაფარიძე',
    email: 'mariam@rigi.example',
    password: DEMO_PASSWORD,
    role: 'l1_employee',
    roleLabel: 'Support desk (L1)',
    description: 'Triages the support mailbox and turns mail into tasks.',
    avatarColor: '#0F7062',
    realm: 'staff',
    home: '/l1',
    technicianType: null,
    partnerId: null,
    username: null,
  },
  {
    id: ACCOUNT_IDS.giorgi,
    name: 'Giorgi Lomidze',
    nameKa: 'გიორგი ლომიძე',
    email: 'giorgi@rigi.example',
    password: DEMO_PASSWORD,
    role: 'technician',
    roleLabel: 'Technician',
    description: 'VoIP engineer. Claims and works support tasks.',
    avatarColor: '#5D6067',
    realm: 'staff',
    home: '/technician',
    technicianType: 'voip_engineer',
    partnerId: null,
    username: null,
  },
  {
    id: ACCOUNT_IDS.tamar,
    name: 'Tamar Gogua',
    nameKa: 'თამარ გოგუა',
    email: 'tamar@rigi.example',
    password: DEMO_PASSWORD,
    role: 'partner_admin',
    roleLabel: 'Partner admin',
    description: 'Zemo Systems. Submits tasks, verifies work, pays invoices.',
    avatarColor: '#8A6400',
    realm: 'partner',
    home: '/partner',
    technicianType: null,
    partnerId: PARTNER_IDS.zemo,
    username: 'tamar.gogua',
  },
]

/** First load: signed in as the superadmin, landing on /admin. */
export const INITIAL_ACCOUNT_ID: string = ACCOUNT_IDS.nino
