/**
 * Shared helpers for the seed builders: deterministic randomness, tenant-time
 * arithmetic around the seed anchor, and the Georgian name pools.
 *
 * Every builder runs once at module load from a fixed seed, so every visitor
 * (and every Reset) gets byte-identical data before `rebaseDates` moves it
 * onto "now".
 */
import { createRandom, type Random } from '@portfolio/demo-kit'

/** The instant the seed is authored as "now" (15:30 in Tbilisi). */
export const SEED_ANCHOR = '2026-09-02T11:30:00.000Z'
export const ANCHOR_MS = Date.parse(SEED_ANCHOR)

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
/** Asia/Tbilisi is UTC+4 all year (no DST). */
export const TENANT_OFFSET_MS = 4 * HOUR

/** One generator per domain, so adding records to one domain never reshuffles another. */
export function rngFor(domain: number): Random {
  return createRandom(20260902 + domain)
}

export const iso = (ms: number): string => new Date(ms).toISOString()

/** Epoch ms of `h:m:s` tenant time on the tenant day `daysAgo` days before the anchor day. */
export function tenantMs(daysAgo: number, h: number, m = 0, s = 0): number {
  return Date.UTC(2026, 8, 2 - daysAgo, h, m, s) - TENANT_OFFSET_MS
}

export const tenantIso = (daysAgo: number, h: number, m = 0, s = 0): string => iso(tenantMs(daysAgo, h, m, s))

export const agoIso = (ms: number): string => iso(ANCHOR_MS - ms)

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** Tenant-local calendar parts of an instant. */
export function tenantParts(ms: number): { y: number; mo: number; d: number; h: number; mi: number; s: number; dow: number } {
  const t = new Date(ms + TENANT_OFFSET_MS)
  return {
    y: t.getUTCFullYear(),
    mo: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    h: t.getUTCHours(),
    mi: t.getUTCMinutes(),
    s: t.getUTCSeconds(),
    dow: t.getUTCDay(),
  }
}

/** '2026-09-02' (tenant calendar day). */
export function tenantDay(ms: number): string {
  const p = tenantParts(ms)
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`
}

/** '20260902-101512' (tenant time), the stamp used in recording file names. */
export function fileStamp(ms: number): string {
  const p = tenantParts(ms)
  return `${p.y}${pad(p.mo)}${pad(p.d)}-${pad(p.h)}${pad(p.mi)}${pad(p.s)}`
}

/** '2026/09/02' (tenant day directory in the file archive). */
export function dateDir(ms: number): string {
  return tenantDay(ms).replace(/-/g, '/')
}

export function isWeekend(daysAgo: number): boolean {
  const dow = tenantParts(tenantMs(daysAgo, 12)).dow
  return dow === 0 || dow === 6
}

/**
 * External numbers and DIDs live only in the obviously fake block
 * +995 32 2 00 xx xx, stored as ten national digits ('0322004417').
 */
export function fakeNumber(rng: Random): string {
  return `032200${pad(rng.int(0, 99))}${pad(rng.int(0, 99))}`
}

export { pad }

/* ------------------------------------------------------------- name pools */

export const MALE_FIRST = [
  'Giorgi', 'Davit', 'Levan', 'Irakli', 'Luka', 'Sandro', 'Tornike', 'Zurab', 'Beka', 'Lasha',
  'Otar', 'Vakhtang', 'Gela', 'Mamuka', 'Revaz', 'Shota', 'Archil', 'Tamaz', 'Ilia', 'Nodar',
  'Dachi', 'Saba', 'Temur', 'Aleksandre', 'Guram', 'Kakha', 'Paata', 'Rati',
] as const

export const FEMALE_FIRST = [
  'Nino', 'Mariam', 'Tamar', 'Ana', 'Salome', 'Eka', 'Natia', 'Ketevan', 'Maia', 'Lela',
  'Sopho', 'Nana', 'Tinatin', 'Khatia', 'Irma', 'Manana', 'Teona', 'Elene', 'Mzia', 'Nato',
  'Lika', 'Tako', 'Gvantsa', 'Marika', 'Rusudan', 'Medea',
] as const

export const SURNAMES = [
  'Maisuradze', 'Tsiklauri', 'Abashidze', 'Javakhishvili', 'Kvaratskhelia', 'Bakradze', 'Dolidze',
  'Gogoladze', 'Mchedlishvili', 'Nozadze', 'Kharaishvili', 'Tabatadze', 'Khutsishvili', 'Chkheidze',
  'Mamaladze', 'Lortkipanidze', 'Sulaberidze', 'Kobakhidze', 'Gvenetadze', 'Jgerenaia', 'Shonia',
  'Kvirikashvili', 'Melikidze', 'Gogua', 'Bolkvadze', 'Asatiani', 'Natroshvili', 'Papava',
  'Kurtanidze', 'Zhvania', 'Datunashvili', 'Gabunia', 'Esakia', 'Margvelashvili', 'Sharashenidze',
  'Ramishvili', 'Tsintsadze', 'Kiladze', 'Beradze', 'Kandelaki', 'Okropiridze', 'Vashakmadze',
  'Gelovani', 'Pirtskhalava', 'Chanturia', 'Mikeladze', 'Tavadze', 'Darchia', 'Kupatadze', 'Nadiradze',
] as const

/**
 * Georgian-script spellings of the name pools. A Georgian directory service
 * stores many display names in Mkhedruli, so some seeded people (and the
 * directory entries) use them; usernames, e-mail and agent records stay Latin.
 */
export const KA_GIVEN: Record<string, string> = {
  Giorgi: 'გიორგი', Davit: 'დავით', Levan: 'ლევან', Irakli: 'ირაკლი', Luka: 'ლუკა', Sandro: 'სანდრო',
  Tornike: 'თორნიკე', Zurab: 'ზურაბ', Beka: 'ბექა', Lasha: 'ლაშა', Otar: 'ოთარ', Vakhtang: 'ვახტანგ',
  Gela: 'გელა', Mamuka: 'მამუკა', Revaz: 'რევაზ', Shota: 'შოთა', Archil: 'არჩილ', Tamaz: 'თამაზ',
  Ilia: 'ილია', Nodar: 'ნოდარ', Dachi: 'დაჩი', Saba: 'საბა', Temur: 'თემურ', Aleksandre: 'ალექსანდრე',
  Guram: 'გურამ', Kakha: 'კახა', Paata: 'პაატა', Rati: 'რატი',
  Nino: 'ნინო', Mariam: 'მარიამ', Tamar: 'თამარ', Ana: 'ანა', Salome: 'სალომე', Eka: 'ეკა',
  Natia: 'ნათია', Ketevan: 'ქეთევან', Maia: 'მაია', Lela: 'ლელა', Sopho: 'სოფო', Nana: 'ნანა',
  Tinatin: 'თინათინ', Khatia: 'ხატია', Irma: 'ირმა', Manana: 'მანანა', Teona: 'თეონა', Elene: 'ელენე',
  Mzia: 'მზია', Nato: 'ნატო', Lika: 'ლიკა', Tako: 'თაკო', Gvantsa: 'გვანცა', Marika: 'მარიკა',
  Rusudan: 'რუსუდან', Medea: 'მედეა',
}

export const KA_SURNAME: Record<string, string> = {
  Maisuradze: 'მაისურაძე', Tsiklauri: 'წიკლაური', Abashidze: 'აბაშიძე', Javakhishvili: 'ჯავახიშვილი',
  Kvaratskhelia: 'ყვარაცხელია', Bakradze: 'ბაკრაძე', Dolidze: 'დოლიძე', Gogoladze: 'გოგოლაძე',
  Mchedlishvili: 'მჭედლიშვილი', Nozadze: 'ნოზაძე', Kharaishvili: 'ხარაიშვილი', Tabatadze: 'ტაბატაძე',
  Khutsishvili: 'ხუციშვილი', Chkheidze: 'ჩხეიძე', Mamaladze: 'მამალაძე', Lortkipanidze: 'ლორთქიფანიძე',
  Sulaberidze: 'სულაბერიძე', Kobakhidze: 'კობახიძე', Gvenetadze: 'გვენეტაძე', Jgerenaia: 'ჯგერენაია',
  Shonia: 'შონია', Kvirikashvili: 'კვირიკაშვილი', Melikidze: 'მელიქიძე', Gogua: 'გოგუა',
  Bolkvadze: 'ბოლქვაძე', Asatiani: 'ასათიანი', Natroshvili: 'ნატროშვილი', Papava: 'პაპავა',
  Kurtanidze: 'ყურტანიძე', Zhvania: 'ჟვანია', Datunashvili: 'დათუნაშვილი', Gabunia: 'გაბუნია',
  Esakia: 'ესაკია', Margvelashvili: 'მარგველაშვილი', Sharashenidze: 'შარაშენიძე', Ramishvili: 'რამიშვილი',
  Tsintsadze: 'ცინცაძე', Kiladze: 'კილაძე', Beradze: 'ბერაძე', Kandelaki: 'კანდელაკი',
  Okropiridze: 'ოქროპირიძე', Vashakmadze: 'ვაშაკმაძე', Gelovani: 'გელოვანი', Pirtskhalava: 'ფირცხალავა',
  Chanturia: 'ჩანტურია', Mikeladze: 'მიქელაძე', Tavadze: 'თავაძე', Darchia: 'დარჩია',
  Kupatadze: 'კუპატაძე', Nadiradze: 'ნადირაძე',
}

/** Georgian-script full name, or null when either part has no spelling. */
export function kaName(first: string, last: string): string | null {
  const given = KA_GIVEN[first]
  const family = KA_SURNAME[last]
  return given && family ? `${given} ${family}` : null
}

/** Stable 0-99 bucket for a string (no random draws, so it never reshuffles a generator). */
export function bucket(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % 100
}

export interface FakePerson {
  first: string
  last: string
  /** 'tbakradze' style login id. */
  login: string
  /** 'tamar.bakradze' style directory username. */
  username: string
  /** Display name as a Georgian directory would store it: Mkhedruli for about a third of people, else Latin. */
  displayName: string
}

/**
 * A deterministic stream of unique Georgian people. `skip` holds full names
 * already used (the personas), so nobody is generated twice.
 */
export function peopleStream(rng: Random, skip: readonly string[] = []): () => FakePerson {
  const used = new Set(skip.map((s) => s.toLowerCase()))
  const logins = new Set<string>(
    skip.map((s) => {
      const [first = '', last = ''] = s.split(' ')
      return `${first[0] ?? ''}${last}`.toLowerCase()
    }),
  )
  return () => {
    for (;;) {
      const first = rng.chance(0.5) ? rng.pick(MALE_FIRST) : rng.pick(FEMALE_FIRST)
      const last = rng.pick(SURNAMES)
      const full = `${first} ${last}`.toLowerCase()
      if (used.has(full)) continue
      let login = `${first[0]}${last}`.toLowerCase()
      let n = 2
      while (logins.has(login)) login = `${first[0]}${last}${n++}`.toLowerCase()
      used.add(full)
      logins.add(login)
      const username = `${first}.${last}`.toLowerCase()
      const ka = bucket(username) < 34 ? kaName(first, last) : null
      return { first, last, login, username, displayName: ka ?? `${first} ${last}` }
    }
  }
}
