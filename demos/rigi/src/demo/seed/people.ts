/** Staff, partners, rate cards, portal admins, documents and API keys. */
import { addDays, firstDayOfPeriod } from '@/demo/domain/dates'
import { newId } from '@/demo/domain/ids'
import type { ContactRole, DocumentVersion, PartnerDocument, PartnerRateHistory } from '@/types'

import { plusHours, type SeedCtx } from './ctx'
import { PARTNERS, RUISI_SUSPENDED_PERIOD, STAFF, type PartnerProfile } from './static'

const pad2 = (n: number) => String(n).padStart(2, '0')

export const latinEmail = (first: string, last: string, domain: string) => `${first}.${last}@${domain}`.toLowerCase()

export function fakeMobile(ctx: SeedCtx): string {
  return `+995 555 00 ${pad2(ctx.rng.int(10, 99))} ${pad2(ctx.rng.int(10, 99))}`
}

export function seedStaff(ctx: SeedCtx): void {
  for (const s of STAFF) {
    ctx.data.staffUsers.push({
      id: s.id,
      email: `${s.first.toLowerCase()}@rigi.example`,
      fullName: `${s.first} ${s.last}`,
      fullNameKa: s.fullNameKa,
      role: s.role,
      technicianType: s.technicianType,
      isActive: s.isActive,
      lastLoginAt: s.isActive ? ctx.ago(0.02 + ctx.rng.next() * 1.5) : ctx.ago(150),
      createdAt: ctx.at(-s.createdDaysAgo, 9, 30),
      deletedAt: null,
    })
  }
}

export function suspendedAt(ctx: SeedCtx): string {
  return ctx.inPeriod(RUISI_SUSPENDED_PERIOD, 0.35)
}

function seedPartner(ctx: SeedCtx, p: PartnerProfile, index: number): void {
  const roles: ContactRole[] = ['technical', 'management', 'financial', 'legal']
  const onboardedAt = ctx.at(p.contractStartDays, 11, 0)
  const billingEmails = [`billing@${p.domain}`]
  if (p.key === 'mzeo') billingEmails.push('procurement@mzeobank.example', 'ap.invoices@mzeobank.example')
  else if (p.currency !== 'GEL') billingEmails.push(`finance@${p.domain}`)
  const dids = Array.from({ length: p.seats.AGENT_BASIC && p.seats.AGENT_BASIC > 40 ? 5 : 2 + (index % 3) }, (_, k) => `+995 32 200 ${pad2(index * 10 + k)} ${pad2(ctx.rng.int(10, 99))}`)
  ctx.data.partners.push({
    id: p.id,
    name: p.name,
    legalName: p.legalName,
    companyId: `40${ctx.rng.int(1_000_000, 9_999_999)}`,
    city: p.city,
    contactEmail: `info@${p.domain}`,
    billingEmail: billingEmails[0],
    billingEmails,
    currency: p.currency,
    ratePerPoint: p.ratePerPoint,
    freeMonthlyAllowance: p.allowance,
    isActive: p.isActive,
    onboardedAt,
    contractStartOn: ctx.day(p.contractStartDays),
    contractEndOn: ctx.day(p.contractEndDays),
    invoiceGenerationDay: p.invoiceDay,
    pbxServerIp: `192.0.2.${10 + index * 7}`,
    webServerIp: `198.51.100.${20 + index * 9}`,
    webServerDomain: `cc.${p.domain}`,
    architecture: p.architecture,
    vpnType: p.vpnType,
    phoneNumbers: dids,
    contacts: p.contacts.map(([first, last], i) => ({ role: roles[i], name: `${first} ${last}`, phone: fakeMobile(ctx), email: latinEmail(first, last, p.domain) })),
    notes: p.notes,
    createdAt: onboardedAt,
    updatedAt: p.isActive ? ctx.ago(3 + ctx.rng.int(0, 50)) : suspendedAt(ctx),
    deletedAt: null,
  })

  // Rate card history: one change three months ago for some partners.
  const startDay = ctx.day(p.contractStartDays)
  if (p.previousRate) {
    const changeDay = firstDayOfPeriod(ctx.period(-3).year, ctx.period(-3).month)
    const rows: PartnerRateHistory[] = [
      { id: newId('rate_'), partnerId: p.id, ratePerPoint: p.previousRate.ratePerPoint, freeAllowance: p.previousRate.allowance, effectiveFrom: startDay, effectiveTo: addDays(changeDay, -1), createdByName: 'Nino Kapanadze', createdAt: onboardedAt },
      { id: newId('rate_'), partnerId: p.id, ratePerPoint: p.ratePerPoint, freeAllowance: p.allowance, effectiveFrom: changeDay, effectiveTo: null, createdByName: 'Nino Kapanadze', createdAt: ctx.clamp(plusHours(`${changeDay}T09:00:00.000Z`, -24 * 6)) },
    ]
    ctx.data.partnerRates.push(...rows)
  } else {
    ctx.data.partnerRates.push({ id: newId('rate_'), partnerId: p.id, ratePerPoint: p.ratePerPoint, freeAllowance: p.allowance, effectiveFrom: startDay, effectiveTo: null, createdByName: 'Nino Kapanadze', createdAt: onboardedAt })
  }

  // Portal admins.
  p.admins.forEach((a, i) => {
    const isTamar = p.key === 'zemo' && i === 0
    ctx.data.partnerAdmins.push({
      id: isTamar ? 'padm_tamar' : newId('padm_'),
      partnerId: p.id,
      username: `${a.first}.${a.last}`.toLowerCase(),
      email: isTamar ? 'tamar@rigi.example' : latinEmail(a.first, a.last, p.domain),
      fullName: `${a.first} ${a.last}`,
      isActive: a.isActive,
      lastLoginAt: a.isActive && p.isActive ? ctx.ago(0.1 + ctx.rng.next() * 5) : ctx.ago(170 + i * 20),
      createdAt: plusHours(onboardedAt, 48 + i * 24 * 40),
    })
  })

  // Documents: MSA (pdf), network diagram (png), IVR call flow (txt, some partners).
  const docs: Array<{ kind: PartnerDocument['kind']; title: string; ext: string; mime: string; sample: string; versions: number; notes: string[] }> = [
    { kind: 'contract', title: 'Master service agreement', ext: 'pdf', mime: 'application/pdf', sample: 'samples/service-agreement.pdf', versions: 1 + (index % 3), notes: ['Signed copy', 'Annex 2: updated seat prices', 'Renewal addendum'] },
    { kind: 'technical', title: 'Network diagram', ext: 'png', mime: 'image/png', sample: 'samples/network-diagram.png', versions: 1 + (index % 2), notes: ['Initial topology', 'Second VPN tunnel added'] },
  ]
  if (index % 2 === 0) docs.push({ kind: 'technical', title: 'IVR call flow', ext: 'txt', mime: 'text/plain', sample: 'samples/ivr-flow.txt', versions: 1, notes: ['Exported from the IVR designer'] })
  const slug = p.domain.replace('.example', '')
  for (const doc of docs) {
    const first = plusHours(onboardedAt, 72)
    const versions: DocumentVersion[] = Array.from({ length: doc.versions }, (_, v) => ({
      id: newId('ver_'),
      versionNo: v + 1,
      filename: `${doc.title.toLowerCase().replace(/\s+/g, '-')}-${slug}-v${v + 1}.${doc.ext}`,
      sizeBytes: doc.ext === 'pdf' ? 180_000 + ctx.rng.int(0, 400_000) : doc.ext === 'png' ? 90_000 + ctx.rng.int(0, 200_000) : 2_000 + ctx.rng.int(0, 6_000),
      mimeType: doc.mime,
      note: doc.notes[v] ?? '',
      createdAt: v === 0 ? first : ctx.ago(Math.max(5, (-p.contractStartDays * (doc.versions - v)) / (doc.versions + 1))),
      uploadedByName: v % 2 === 0 ? 'Nino Kapanadze' : 'Levan Abashidze',
      sampleFile: doc.sample,
    }))
    ctx.data.partnerDocuments.push({ id: newId('doc_'), partnerId: p.id, kind: doc.kind, title: doc.title, createdAt: first, versions })
  }
}

const API_KEYS: ReadonlyArray<[partnerId: string, label: string, revoked: boolean]> = [
  ['prt_zemo', 'PBX user sync', false],
  ['prt_zemo', 'Staging sync (old)', true],
  ['prt_kolkheti', 'Kutaisi PBX sync', false],
  ['prt_batumiwave', 'On-prem connector', false],
  ['prt_mzeo', 'Primary site sync', false],
  ['prt_mzeo', 'Standby site sync', false],
  ['prt_lukma', 'Cloud tenant sync', false],
  ['prt_talgha', 'Rustavi PBX sync', false],
  ['prt_vake', 'Clinic tenant sync', false],
  ['prt_ruisi', 'Outage desk sync', true],
]

export function seedPartners(ctx: SeedCtx): void {
  PARTNERS.forEach((p, i) => seedPartner(ctx, p, i))
  for (const [partnerId, label, revoked] of API_KEYS) {
    const partner = ctx.data.partners.find((p) => p.id === partnerId)
    if (!partner) continue
    const createdAt = plusHours(partner.onboardedAt, 24 * (5 + ctx.rng.int(0, 30)))
    const revokedAt = revoked ? (partner.isActive ? ctx.ago(40 + ctx.rng.int(0, 30)) : suspendedAt(ctx)) : null
    ctx.data.apiKeys.push({
      id: newId('key_'),
      partnerId,
      keyId: `demo_${ctx.code(8)}`,
      label,
      scopes: ctx.rng.chance(0.6) ? ['user_count:write', 'user_count:read'] : ['user_count:write'],
      createdAt,
      createdByName: 'Nino Kapanadze',
      lastUsedAt: revokedAt ? plusHours(revokedAt, -30) : ctx.ago(ctx.rng.next() * 0.5),
      revokedAt,
    })
  }
}
