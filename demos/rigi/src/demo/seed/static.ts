/**
 * Hand-authored seed facts: the cast, the partners (brand brief "Fictional
 * entities"), the license and task catalogues, and text pools. Every person,
 * company, domain and number here is fictional. Phone numbers use the
 * obviously-fake +995 555 00 xx xx / +995 32 200 xx xx ranges; IPs use the
 * documentation ranges (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24).
 */
import type { Architecture, Currency, LicenseKind, StaffRole, TechnicianType } from '@/types'

/* ------------------------------------------------------------------ staff */

export interface StaffSeed {
  id: string
  first: string
  last: string
  fullNameKa: string
  role: StaffRole
  technicianType: TechnicianType | null
  isActive: boolean
  /** Days since the account was created. */
  createdDaysAgo: number
}

export const STAFF: readonly StaffSeed[] = [
  { id: 'usr_nino', first: 'Nino', last: 'Kapanadze', fullNameKa: 'ნინო კაპანაძე', role: 'superadmin', technicianType: null, isActive: true, createdDaysAgo: 1240 },
  { id: 'usr_levan', first: 'Levan', last: 'Abashidze', fullNameKa: 'ლევან აბაშიძე', role: 'accountant', technicianType: null, isActive: true, createdDaysAgo: 1100 },
  { id: 'usr_mariam', first: 'Mariam', last: 'Japaridze', fullNameKa: 'მარიამ ჯაფარიძე', role: 'l1_employee', technicianType: null, isActive: true, createdDaysAgo: 820 },
  { id: 'usr_ana', first: 'Ana', last: 'Tsereteli', fullNameKa: 'ანა წერეთელი', role: 'l1_employee', technicianType: null, isActive: true, createdDaysAgo: 410 },
  { id: 'usr_giorgi', first: 'Giorgi', last: 'Lomidze', fullNameKa: 'გიორგი ლომიძე', role: 'technician', technicianType: 'voip_engineer', isActive: true, createdDaysAgo: 1010 },
  { id: 'usr_saba', first: 'Saba', last: 'Kiknadze', fullNameKa: 'საბა კიკნაძე', role: 'technician', technicianType: 'webdeveloper', isActive: true, createdDaysAgo: 760 },
  { id: 'usr_sopo', first: 'Sopo', last: 'Gelashvili', fullNameKa: 'სოფო გელაშვილი', role: 'technician', technicianType: 'both', isActive: true, createdDaysAgo: 540 },
  { id: 'usr_irakli', first: 'Irakli', last: 'Machavariani', fullNameKa: 'ირაკლი მაჭავარიანი', role: 'technician', technicianType: 'voip_engineer', isActive: true, createdDaysAgo: 380 },
  { id: 'usr_davit', first: 'Davit', last: 'Tsiklauri', fullNameKa: 'დავით წიკლაური', role: 'technician', technicianType: 'webdeveloper', isActive: false, createdDaysAgo: 900 },
]

export const L1_IDS = ['usr_mariam', 'usr_ana'] as const
export const VOIP_TECHS = ['usr_giorgi', 'usr_irakli', 'usr_sopo'] as const
export const WEB_TECHS = ['usr_saba', 'usr_sopo'] as const

export function staffName(id: string): string {
  const s = STAFF.find((x) => x.id === id)
  return s ? `${s.first} ${s.last}` : 'Rigi staff'
}

/* --------------------------------------------------------------- partners */

export type PartnerKey = 'zemo' | 'kolkheti' | 'batumiwave' | 'mzeo' | 'lukma' | 'talgha' | 'alvani' | 'vake' | 'ruisi'

export interface PartnerProfile {
  key: PartnerKey
  id: string
  name: string
  legalName: string
  domain: string
  city: string
  currency: Currency
  architecture: Architecture
  vpnType: string
  ratePerPoint: number
  allowance: number
  /** Optional earlier rate row (3 months ago the rate changed). */
  previousRate?: { ratePerPoint: number; allowance: number }
  invoiceDay: number
  contractStartDays: number
  contractEndDays: number
  /** Synced user names in Georgian script (the partner's own system stores them so). */
  georgianNames: boolean
  /** Per license code: seats in the pool now. */
  seats: Record<string, number>
  /** Per license code: seats left free on purpose (the rest are mapped). */
  free?: Record<string, number>
  isActive: boolean
  notes: string
  /** Portal admins: first is the main one. */
  admins: Array<{ first: string; last: string; isActive: boolean }>
  /** Contacts: technical, management, financial, legal. */
  contacts: Array<[first: string, last: string]>
  /** Monthly count of partner-verified tasks, P-6 .. P0. */
  verifiedPerMonth: [number, number, number, number, number, number, number]
}

export const PARTNERS: readonly PartnerProfile[] = [
  {
    key: 'zemo', id: 'prt_zemo', name: 'Zemo Systems', legalName: 'შპს ზემო სისტემსი', domain: 'zemo.example', city: 'Tbilisi',
    currency: 'GEL', architecture: 'cloud', vpnType: 'WireGuard site-to-site', ratePerPoint: 20, allowance: 10, invoiceDay: 3,
    contractStartDays: -900, contractEndDays: 420, georgianNames: false,
    seats: { AGENT_BASIC: 10, AGENT_PRO: 8, SUPERVISOR: 3, QUALITY_ANALYST: 1, CALL_RECORDING: 22 },
    free: { AGENT_BASIC: 1, AGENT_PRO: 0, SUPERVISOR: 0, QUALITY_ANALYST: 0 },
    isActive: true,
    notes: 'Reseller. Runs Rigi-managed contact centres for small clients in Tbilisi; first-line support stays with Zemo.',
    admins: [{ first: 'Tamar', last: 'Gogua', isActive: true }, { first: 'Lasha', last: 'Dolidze', isActive: false }],
    contacts: [['Luka', 'Beridze'], ['Tamar', 'Gogua'], ['Maka', 'Nozadze'], ['Irma', 'Svanidze']],
    verifiedPerMonth: [1, 1, 1, 1, 1, 2, 1],
  },
  {
    key: 'kolkheti', id: 'prt_kolkheti', name: 'Kolkheti Networks', legalName: 'შპს კოლხეთი ნეთვორქსი', domain: 'kolkheti.example', city: 'Kutaisi',
    currency: 'USD', architecture: 'hybrid', vpnType: 'IPsec (IKEv2)', ratePerPoint: 8, allowance: 10, invoiceDay: 5,
    contractStartDays: -720, contractEndDays: 10, georgianNames: false,
    seats: { AGENT_BASIC: 14, AGENT_PRO: 10, SUPERVISOR: 3, SMS_GATEWAY: 1 },
    isActive: true,
    notes: 'Reseller for western Georgia. Contract renewal in negotiation; keep the current price list until signed.',
    admins: [{ first: 'Eka', last: 'Shengelia', isActive: true }],
    contacts: [['Beka', 'Gorgadze'], ['Eka', 'Shengelia'], ['Nana', 'Kurtanidze'], ['Shota', 'Esakia']],
    verifiedPerMonth: [1, 0, 1, 1, 0, 1, 0],
  },
  {
    key: 'batumiwave', id: 'prt_batumiwave', name: 'Batumi Wave Integrations', legalName: 'შპს ბათუმი ვეივ ინტეგრეიშენსი', domain: 'batumiwave.example', city: 'Batumi',
    currency: 'EUR', architecture: 'onprem', vpnType: 'OpenVPN (TLS)', ratePerPoint: 7, allowance: 8, invoiceDay: 1,
    contractStartDays: -400, contractEndDays: 330, georgianNames: false,
    seats: { AGENT_PRO: 12, SUPERVISOR: 2, QUALITY_ANALYST: 2, CALL_RECORDING: 16 },
    isActive: true,
    notes: 'Integrator. On-prem PBX at the client site; Rigi manages it over VPN. Seasonal peaks June to September.',
    admins: [{ first: 'Nika', last: 'Abuladze', isActive: true }],
    contacts: [['Tornike', 'Iashvili'], ['Nika', 'Abuladze'], ['Teona', 'Papava'], ['Archil', 'Lortkipanidze']],
    verifiedPerMonth: [0, 1, 0, 1, 0, 1, 0],
  },
  {
    key: 'mzeo', id: 'prt_mzeo', name: 'Mzeo Bank', legalName: 'სს მზეო ბანკი', domain: 'mzeobank.example', city: 'Tbilisi',
    currency: 'GEL', architecture: 'cloud', vpnType: 'IPsec (IKEv2), dual tunnel', ratePerPoint: 18, allowance: 25, invoiceDay: 2,
    contractStartDays: -600, contractEndDays: 500, georgianNames: true,
    seats: { AGENT_BASIC: 70, AGENT_PRO: 30, SUPERVISOR: 12, QUALITY_ANALYST: 8, CALL_RECORDING: 120, SMS_GATEWAY: 2 },
    free: { AGENT_BASIC: 0, AGENT_PRO: 2, SUPERVISOR: 1, QUALITY_ANALYST: 1 },
    isActive: true,
    notes: 'Retail bank contact centre, 120 seats. Procurement needs the invoice in their own format (partner template).',
    admins: [{ first: 'Ketevan', last: 'Bakuradze', isActive: true }, { first: 'Otar', last: 'Melikidze', isActive: true }],
    contacts: [['Gela', 'Kharaishvili'], ['Ketevan', 'Bakuradze'], ['Mzia', 'Tskhadadze'], ['Vakhtang', 'Natsvlishvili']],
    verifiedPerMonth: [1, 2, 1, 2, 1, 7, 1],
  },
  {
    key: 'lukma', id: 'prt_lukma', name: 'Lukma Delivery', legalName: 'შპს ლუკმა დელივერი', domain: 'lukma.example', city: 'Tbilisi',
    currency: 'GEL', architecture: 'cloud', vpnType: 'None (cloud only)', ratePerPoint: 20, allowance: 12, previousRate: { ratePerPoint: 18, allowance: 10 }, invoiceDay: 4,
    contractStartDays: -500, contractEndDays: 230, georgianNames: true,
    seats: { AGENT_BASIC: 36, SUPERVISOR: 5, QUALITY_ANALYST: 4, SMS_GATEWAY: 1 },
    isActive: true,
    notes: 'Food-delivery hotline, 45 seats. Peak hours 12:00-15:00 and 19:00-22:00; schedule changes outside those windows.',
    admins: [{ first: 'Salome', last: 'Gabunia', isActive: true }],
    contacts: [['Dato', 'Mamaladze'], ['Salome', 'Gabunia'], ['Khatia', 'Dzneladze'], ['Otar', 'Kipiani']],
    verifiedPerMonth: [1, 1, 0, 1, 1, 1, 0],
  },
  {
    key: 'talgha', id: 'prt_talgha', name: 'Talgha Telecom', legalName: 'შპს ტალღა ტელეკომი', domain: 'talgha.example', city: 'Rustavi',
    currency: 'USD', architecture: 'hybrid', vpnType: 'IPsec (IKEv2)', ratePerPoint: 8, allowance: 15, previousRate: { ratePerPoint: 7, allowance: 15 }, invoiceDay: 6,
    contractStartDays: -1100, contractEndDays: -20, georgianNames: true,
    seats: { AGENT_BASIC: 46, AGENT_PRO: 20, SUPERVISOR: 8, QUALITY_ANALYST: 2, LEGACY_SEAT: 4, CALL_RECORDING: 80 },
    isActive: true,
    notes: 'Regional ISP support desk, 80 seats. Contract expired; renewal draft sent. Four agents still on legacy seats.',
    admins: [{ first: 'Zurab', last: 'Tabatadze', isActive: true }],
    contacts: [['Lasha', 'Chikovani'], ['Zurab', 'Tabatadze'], ['Eliso', 'Sharashidze'], ['Revaz', 'Gogoladze']],
    verifiedPerMonth: [1, 1, 1, 1, 2, 1, 0],
  },
  {
    key: 'alvani', id: 'prt_alvani', name: 'Alvani Insurance', legalName: 'სს ალვანი დაზღვევა', domain: 'alvani.example', city: 'Tbilisi',
    currency: 'GEL', architecture: 'onprem', vpnType: 'IPsec (IKEv1, legacy)', ratePerPoint: 22, allowance: 8, previousRate: { ratePerPoint: 20, allowance: 10 }, invoiceDay: 10,
    contractStartDays: -300, contractEndDays: 65, georgianNames: true,
    seats: { AGENT_BASIC: 20, AGENT_PRO: 6, SUPERVISOR: 4, CALL_RECORDING: 30 },
    isActive: true,
    notes: 'Claims line, 30 seats. On-prem; change windows only on Sundays.',
    admins: [{ first: 'Natia', last: 'Chkheidze', isActive: true }],
    contacts: [['Irakli', 'Odisharia'], ['Natia', 'Chkheidze'], ['Sopio', 'Maisuradze'], ['Giorgi', 'Khutsishvili']],
    verifiedPerMonth: [0, 1, 0, 0, 1, 1, 0],
  },
  {
    key: 'vake', id: 'prt_vake', name: 'Vake Dental Group', legalName: 'შპს ვაკე დენტალ ჯგუფი', domain: 'vakedental.example', city: 'Tbilisi',
    currency: 'GEL', architecture: 'cloud', vpnType: 'None (cloud only)', ratePerPoint: 20, allowance: 5, invoiceDay: 8,
    contractStartDays: -150, contractEndDays: 580, georgianNames: true,
    seats: { AGENT_BASIC: 10, SUPERVISOR: 2 },
    isActive: true,
    notes: 'Clinic booking desk, 12 seats. Onboarded this year; set-up fee invoiced separately.',
    admins: [{ first: 'Lika', last: 'Papava', isActive: true }],
    contacts: [['Nutsa', 'Abuladze'], ['Lika', 'Papava'], ['Tamta', 'Dolidze'], ['Gvantsa', 'Melikidze']],
    verifiedPerMonth: [0, 0, 0, 1, 0, 1, 0],
  },
  {
    key: 'ruisi', id: 'prt_ruisi', name: 'Ruisi Utilities', legalName: 'შპს რუისი კომუნალური', domain: 'ruisi.example', city: 'Gori',
    currency: 'GEL', architecture: 'hybrid', vpnType: 'IPsec (IKEv2)', ratePerPoint: 20, allowance: 10, invoiceDay: 1,
    contractStartDays: -800, contractEndDays: 100, georgianNames: true,
    seats: { AGENT_BASIC: 20, SUPERVISOR: 3, QUALITY_ANALYST: 2 },
    isActive: false,
    notes: 'Outage hotline, 25 seats. Suspended: the tenant moved to an in-house PBX; the account stays for history.',
    admins: [{ first: 'Revaz', last: 'Odisharia', isActive: true }],
    contacts: [['Beka', 'Nozadze'], ['Revaz', 'Odisharia'], ['Ketevan', 'Esakia'], ['Archil', 'Gabunia']],
    verifiedPerMonth: [1, 1, 0, 0, 0, 0, 0],
  },
]

/** Days ago Vake was onboarded (no history before), and Ruisi was suspended. */
export const VAKE_ONBOARD_DAYS = 150
export const RUISI_SUSPENDED_PERIOD = -4

export function profileById(id: string): PartnerProfile | undefined {
  return PARTNERS.find((p) => p.id === id)
}

/* --------------------------------------------------------------- licenses */

export interface LicenseSeed {
  code: string
  name: string
  kind: LicenseKind
  unitPrice: number
  isActive: boolean
  /** Synced-user role label for agents on this license. */
  userRole: string
}

export const LICENSES: readonly LicenseSeed[] = [
  { code: 'AGENT_BASIC', name: 'Agent Basic', kind: 'per_user', unitPrice: 45, isActive: true, userRole: 'agent' },
  { code: 'AGENT_PRO', name: 'Agent Pro', kind: 'per_user', unitPrice: 65, isActive: true, userRole: 'agent' },
  { code: 'SUPERVISOR', name: 'Supervisor', kind: 'per_user', unitPrice: 80, isActive: true, userRole: 'supervisor' },
  { code: 'QUALITY_ANALYST', name: 'Quality Analyst', kind: 'per_user', unitPrice: 55, isActive: true, userRole: 'quality analyst' },
  { code: 'CALL_RECORDING', name: 'Call Recording', kind: 'addon', unitPrice: 12, isActive: true, userRole: '' },
  { code: 'SMS_GATEWAY', name: 'SMS Gateway', kind: 'addon', unitPrice: 90, isActive: true, userRole: '' },
  { code: 'LEGACY_SEAT', name: 'Legacy Seat', kind: 'per_user', unitPrice: 35, isActive: false, userRole: 'agent' },
]

/** Per-partner license prices: every license held by USD/EUR partners, plus Mzeo's Agent Basic. */
export const LICENSE_OVERRIDES: ReadonlyArray<[partnerId: string, code: string, unitPrice: number]> = [
  ['prt_kolkheti', 'AGENT_BASIC', 16], ['prt_kolkheti', 'AGENT_PRO', 23], ['prt_kolkheti', 'SUPERVISOR', 29], ['prt_kolkheti', 'SMS_GATEWAY', 32],
  ['prt_batumiwave', 'AGENT_PRO', 21], ['prt_batumiwave', 'SUPERVISOR', 26], ['prt_batumiwave', 'QUALITY_ANALYST', 18], ['prt_batumiwave', 'CALL_RECORDING', 4],
  ['prt_talgha', 'AGENT_BASIC', 15], ['prt_talgha', 'AGENT_PRO', 22], ['prt_talgha', 'SUPERVISOR', 28], ['prt_talgha', 'QUALITY_ANALYST', 19],
  ['prt_talgha', 'LEGACY_SEAT', 12], ['prt_talgha', 'CALL_RECORDING', 4],
  ['prt_mzeo', 'AGENT_BASIC', 39],
]

/* ---------------------------------------------------------- task catalogue */

export type WorkKind = 'voip' | 'web' | 'any'

export interface TemplateSeed {
  code: string
  name: string
  description: string
  points: number | null
  kind: WorkKind
  titles: string[]
  request: string
}

export const TEMPLATES: readonly TemplateSeed[] = [
  {
    code: 'IVR_CHANGE', name: 'IVR change', points: 3, kind: 'voip',
    description: 'Change menu options, greetings or opening-hours logic in an existing IVR. Includes one round of revisions.',
    titles: ['Update the main IVR greeting for holiday hours', 'IVR: send option 3 to the collections queue', 'Add an English/Georgian language choice to the IVR', 'შეცვალეთ IVR მისალმება ახალი სამუშაო საათებით', 'IVR: add a callback option after 2 minutes in queue'],
    request: 'Please change our IVR as described below. The new recordings are attached or will follow in this thread.',
  },
  {
    code: 'NEW_QUEUE', name: 'New queue', points: 2.5, kind: 'voip',
    description: 'Create a new call queue with its strategy, music on hold, wrap-up time and agent membership.',
    titles: ['Create a queue for corporate clients', 'New queue for the night shift', 'ახალი რიგი ვიდეო-კონსულტაციებისთვის', 'Separate queue for VIP callbacks'],
    request: 'We need a new queue. Ring strategy: longest idle agent. Wrap-up 15 seconds. Members listed below.',
  },
  {
    code: 'AGENT_ONBOARDING', name: 'Agent onboarding', points: 1.5, kind: 'voip',
    description: 'Create extensions and accounts for new agents, assign queues and skills, test login on their workstation.',
    titles: ['Onboard 4 new agents', 'Accounts for 3 seasonal agents', 'ახალი ოპერატორების დამატება (5)', 'Add two supervisors to the morning team'],
    request: 'New agents start on Monday. Names and preferred extensions are below; please give them the same queues as team B.',
  },
  {
    code: 'CALL_RECORDING_EXPORT', name: 'Call-recording export', points: 2, kind: 'voip',
    description: 'Export call recordings for a date range or a list of call ids, delivered as an encrypted archive.',
    titles: ['Export last month\'s recordings for the audit', 'Recordings for complaint case 4471', 'ზარების ჩანაწერების ექსპორტი აუდიტისთვის'],
    request: 'Please export the recordings for the calls listed below. We need them for an internal review by Friday.',
  },
  {
    code: 'SIP_TRUNK_ISSUE', name: 'SIP trunk issue', points: 4, kind: 'voip',
    description: 'Diagnose and fix registration, audio or call-setup problems on a SIP trunk, including carrier follow-up.',
    titles: ['One-way audio on outbound calls via trunk 2', 'Trunk registration drops every night', 'Inbound calls fail with 503 since the morning', 'გამავალი ზარები წყდება 30 წამში'],
    request: 'Since this morning we have problems on the trunk. Example call times and numbers are below.',
  },
  {
    code: 'REPORT_BUILD', name: 'Report build', points: 5, kind: 'web',
    description: 'Build a new scheduled report from contact-centre data (CSV or e-mailed PDF).',
    titles: ['Monthly SLA report per queue', 'Abandoned-call report with callback status', 'ოპერატორების დატვირთვის ანგარიში', 'Weekly first-call-resolution report'],
    request: 'We would like a new report. Columns and filters are described below; delivery every Monday at 09:00.',
  },
  {
    code: 'CRM_INTEGRATION_FIX', name: 'CRM integration fix', points: 8, kind: 'web',
    description: 'Fix screen-pop, click-to-call or call-logging between the contact centre and the partner CRM.',
    titles: ['Screen-pop opens the wrong customer card', 'Call notes are not saved to the CRM', 'Click-to-call from the CRM times out', 'CRM-ში ზარის ისტორია არ ჩანს'],
    request: 'The CRM integration is misbehaving. Steps to reproduce are below; it started after the last CRM update on our side.',
  },
  {
    code: 'NUMBER_PORTING', name: 'Number porting', points: 3.5, kind: 'voip',
    description: 'Coordinate porting of numbers from another operator, update routing on the cut-over day.',
    titles: ['Port 4 numbers from the old provider', 'Move the hotline number to the new trunk', 'ნომრების გადმოტანა ახალ ოპერატორზე'],
    request: 'Please port the numbers below. The signed porting form is attached.',
  },
  {
    code: 'WALLBOARD_SETUP', name: 'Wallboard setup', points: 2.5, kind: 'web',
    description: 'Configure a live wallboard (queues, waiting calls, SLA) for a TV or browser screen.',
    titles: ['Wallboard for the support floor TV', 'Add a waiting-time widget to the wallboard', 'Wallboard for the dispatch room'],
    request: 'We want a wallboard on the big screen. Please show waiting calls, longest wait and today\'s SLA per queue.',
  },
  {
    code: 'SKILL_ROUTING_CHANGE', name: 'Skill routing change', points: 2, kind: 'voip',
    description: 'Change skill-based routing rules: skills, levels and overflow between skill groups.',
    titles: ['Route Georgian speakers to senior agents first', 'Skill routing for premium clients', 'უნარებზე დაფუძნებული მარშრუტიზაცია', 'Overflow from the claims skill after 60 seconds'],
    request: 'Please adjust the routing as below. Current skills export is attached.',
  },
  {
    code: 'OTHER_PROBLEM', name: 'Other problem', points: null, kind: 'any',
    description: 'Anything not in the catalogue. Our team reviews it and sets the points before work starts.',
    titles: ['Agents cannot log in after a password change', 'Headset echo on some workstations', 'Advice on adding a second site', 'Supervisor barge-in does not work'],
    request: 'We have a problem that does not fit the catalogue. Details below.',
  },
]

/** Partner catalogue overrides: [partnerId, code, change]. */
export const TEMPLATE_OVERRIDES: ReadonlyArray<{ partnerId: string; code: string; isHidden?: boolean; points?: number; name?: string; description?: string }> = [
  { partnerId: 'prt_zemo', code: 'WALLBOARD_SETUP', isHidden: true },
  { partnerId: 'prt_mzeo', code: 'IVR_CHANGE', points: 2.5 },
  { partnerId: 'prt_mzeo', code: 'REPORT_BUILD', points: 4 },
  { partnerId: 'prt_mzeo', code: 'CRM_INTEGRATION_FIX', points: 7 },
  { partnerId: 'prt_talgha', code: 'SIP_TRUNK_ISSUE', points: 3 },
  { partnerId: 'prt_talgha', code: 'NUMBER_PORTING', points: 3 },
  {
    partnerId: 'prt_lukma', code: 'AGENT_ONBOARDING', name: 'Hotline agent onboarding',
    description: 'New hotline agents with courier-app access and the dispatch queues preset.',
  },
]

/* ------------------------------------------------------------- name pools */

export const FIRST_NAMES: ReadonlyArray<[latin: string, ka: string]> = [
  ['Nino', 'ნინო'], ['Giorgi', 'გიორგი'], ['Mariam', 'მარიამ'], ['Davit', 'დავით'], ['Ana', 'ანა'], ['Luka', 'ლუკა'],
  ['Tamar', 'თამარ'], ['Levan', 'ლევან'], ['Salome', 'სალომე'], ['Irakli', 'ირაკლი'], ['Natia', 'ნათია'], ['Zurab', 'ზურაბ'],
  ['Eka', 'ეკა'], ['Lasha', 'ლაშა'], ['Ketevan', 'ქეთევან'], ['Nika', 'ნიკა'], ['Sopio', 'სოფიო'], ['Beka', 'ბექა'],
  ['Tamta', 'თამთა'], ['Dato', 'დათო'], ['Maka', 'მაკა'], ['Gela', 'გელა'], ['Lika', 'ლიკა'], ['Vakhtang', 'ვახტანგ'],
  ['Nana', 'ნანა'], ['Revaz', 'რევაზ'], ['Elene', 'ელენე'], ['Tornike', 'თორნიკე'], ['Khatia', 'ხატია'], ['Shota', 'შოთა'],
  ['Teona', 'თეონა'], ['Otar', 'ოთარ'], ['Mzia', 'მზია'], ['Gvantsa', 'გვანცა'], ['Archil', 'არჩილ'], ['Nutsa', 'ნუცა'],
]

export const LAST_NAMES: ReadonlyArray<[latin: string, ka: string]> = [
  ['Beridze', 'ბერიძე'], ['Maisuradze', 'მაისურაძე'], ['Chikovani', 'ჩიქოვანი'], ['Mchedlishvili', 'მჭედლიშვილი'], ['Dolidze', 'დოლიძე'],
  ['Nozadze', 'ნოზაძე'], ['Shengelia', 'შენგელია'], ['Kharaishvili', 'ხარაიშვილი'], ['Bakuradze', 'ბაკურაძე'], ['Jgerenaia', 'ჯღერენაია'],
  ['Gabunia', 'გაბუნია'], ['Tskhadadze', 'ცხადაძე'], ['Melikidze', 'მელიქიძე'], ['Kurtanidze', 'ქურთანიძე'], ['Svanidze', 'სვანიძე'],
  ['Abuladze', 'აბულაძე'], ['Tabatadze', 'ტაბატაძე'], ['Chkheidze', 'ჩხეიძე'], ['Gorgadze', 'გორგაძე'], ['Papava', 'პაპავა'],
  ['Sharashidze', 'შარაშიძე'], ['Natsvlishvili', 'ნაცვლიშვილი'], ['Lortkipanidze', 'ლორთქიფანიძე'], ['Khutsishvili', 'ხუციშვილი'],
  ['Kipiani', 'ყიფიანი'], ['Odisharia', 'ოდიშარია'], ['Gogoladze', 'გოგოლაძე'], ['Dzneladze', 'ძნელაძე'], ['Mamaladze', 'მამალაძე'],
  ['Esakia', 'ესაკია'], ['Iashvili', 'იაშვილი'], ['Bregvadze', 'ბრეგვაძე'], ['Kvirikashvili', 'კვირიკაშვილი'], ['Rukhadze', 'რუხაძე'],
]

/* -------------------------------------------------------------- text pools */

export const PARTNER_MESSAGES: readonly string[] = [
  'Any update on this one?',
  'We can give you a test window tonight after 21:00.',
  'Thanks, confirmed on our side.',
  'გამარჯობა, რა სტატუსია?',
  'ტესტი ჩავატარეთ, ყველაფერი მუშაობს.',
  'The call ids from this morning are in the mail thread.',
  'Our supervisors will check it during the morning shift and come back to you.',
  'Please do the change after 22:00, the hotline is busy before that.',
  'შეგიძლიათ ხვალ დილით დაგვირეკოთ?',
]

export const STAFF_MESSAGES: readonly string[] = [
  'Picked up. Checking the trunk logs now.',
  'The change is ready on staging; please test with extension 2001.',
  'Deployed. Please verify and close the task when you are happy.',
  'ვამოწმებთ, დაგიბრუნდებით ერთ საათში.',
  'Could you send two example call times? We cannot reproduce it yet.',
  'Waiting on the carrier; they promised an answer by tomorrow noon.',
  'ცვლილება განხორციელდა, გთხოვთ გადაამოწმოთ.',
  'Scheduled for the Sunday change window.',
]

export const INTERNAL_NOTES: readonly string[] = [
  'Carrier ticket opened, waiting on their NOC.',
  'Partner admin confirmed by phone, go ahead.',
  'Root cause was our config change last week; keep the points as is but mention it in the reply.',
  'Needs a second pair of eyes on the dial plan before deploy.',
  'შიდა: ლოგები შენახულია სერვერზე, ვუყურებ ხვალ.',
  'Same issue as the one we fixed for another tenant in spring; reuse that patch.',
]

export const SEND_BACK_NOTES: readonly string[] = [
  'Still happening on queue 2, see the call at 10:42.',
  'The greeting plays twice, please check.',
  'The report misses the abandoned calls column.',
]
