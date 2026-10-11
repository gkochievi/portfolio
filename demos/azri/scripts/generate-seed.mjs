#!/usr/bin/env node
/**
 * Deterministic seed generator for the Azri demo (no dependencies).
 *
 *   node demos/azri/scripts/generate-seed.mjs
 *
 * Writes plain JSON into src/demo/seed/: catalog.json (tenants, branches, staff,
 * campaigns, questions, recipients), history.json (links, messages, responses)
 * and comments.json (the customer-comment pools, reusable by simulators).
 *
 * Every timestamp is authored relative to SEED_DATE; the store rebases them to
 * boot time with demo-kit's rebaseDates. The PRNG is the same mulberry32 that
 * demo-kit's createRandom uses, seeded with 'azri', so re-running the script
 * always produces byte-identical files.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'demo', 'seed')

/* ------------------------------------------------------------------ random */

function createRandom(seed) {
  const text = String(seed)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 0xc2b2ae35)
  hash ^= hash >>> 16
  let state = hash >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
  const int = (min, max) => min + Math.floor(next() * (max - min + 1))
  return {
    next,
    int,
    pick: (items) => items[int(0, items.length - 1)],
    chance: (p) => next() < p,
    weighted(pairs) {
      const total = pairs.reduce((sum, [, w]) => sum + w, 0)
      let roll = next() * total
      for (const [value, w] of pairs) {
        if (roll < w) return value
        roll -= w
      }
      return pairs[pairs.length - 1][0]
    },
    gauss() {
      let u = 0
      while (u === 0) u = next()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
    },
  }
}

const rng = createRandom('azri')

/* -------------------------------------------------------------------- time */

const SEED_DATE = '2026-10-01T09:00:00Z' // 13:00 in Tbilisi (UTC+4)
const ANCHOR = Date.parse(SEED_DATE)
const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const TBILISI = 4 * HOUR
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z')
/** UTC ms of Tbilisi midnight, `d` days before the anchor's Tbilisi date. */
const tbilisiMidnight = (d) => {
  const local = ANCHOR + TBILISI
  return local - (local % DAY) - d * DAY - TBILISI
}
/** Day of week (0 = Sunday) in Tbilisi, `d` days before the anchor. */
const weekday = (d) => new Date(tbilisiMidnight(d) + TBILISI).getUTCDay()

/* ----------------------------------------------------------------- catalog */

const t = (en, ka) => ({ en, ka })

const tenants = [
  { id: 't_nergi', name: t('Nergi Bank', 'ნერგი ბანკი'), monogram: 'NB', industry: 'bank', copyrightName: 'Nergi Bank JSC', smsSender: 'NERGIBANK', primary: '#1F6B4F', onPrimary: '#FFFFFF', tint: '#E3F1EA', primaryDark: '#7FD3AE' },
  { id: 't_elva', name: t('Elva Telecom', 'ელვა ტელეკომი'), monogram: 'ET', industry: 'telecom', copyrightName: 'Elva Telecom LLC', smsSender: 'ELVA', primary: '#2B47C2', onPrimary: '#FFFFFF', tint: '#E4E9FB', primaryDark: '#9DB0F5' },
  { id: 't_borbali', name: t('Borbali Auto Service', 'ბორბალი ავტოსერვისი'), monogram: 'BA', industry: 'auto', copyrightName: 'Borbali Auto Service LLC', smsSender: 'BORBALI', primary: '#3B4652', onPrimary: '#FFFFFF', tint: '#E6EAEE', primaryDark: '#B7C3CF' },
  { id: 't_kalakuri', name: t('Kalakuri Clinic', 'ქალაქური კლინიკა'), monogram: 'KC', industry: 'clinic', copyrightName: 'Kalakuri Clinic LLC', smsSender: 'KALAKURI', primary: '#0E6B73', onPrimary: '#FFFFFF', tint: '#DDF1F2', primaryDark: '#7BD0D6' },
  { id: 't_puri', name: t('Puri da Chai', 'პური და ჩაი'), monogram: 'PC', industry: 'cafe', copyrightName: 'Puri da Chai LLC', smsSender: 'PURIDACHAI', primary: '#7A5A00', onPrimary: '#FFFFFF', tint: '#F5ECD3', primaryDark: '#E9C467' },
]
const tenantById = Object.fromEntries(tenants.map((x) => [x.id, x]))

const TBS = t('Tbilisi', 'თბილისი')
const branches = [
  { id: 'br_nergi_vake', tenantId: 't_nergi', name: t('Vake', 'ვაკე'), city: TBS },
  { id: 'br_nergi_saburtalo', tenantId: 't_nergi', name: t('Saburtalo', 'საბურთალო'), city: TBS },
  { id: 'br_nergi_batumi', tenantId: 't_nergi', name: t('Old Boulevard', 'ძველი ბულვარი'), city: t('Batumi', 'ბათუმი') },
  { id: 'br_elva_cc', tenantId: 't_elva', name: t('Contact centre', 'საკონტაქტო ცენტრი'), city: TBS },
  { id: 'br_elva_didube', tenantId: 't_elva', name: t('Didube shop', 'დიდუბის მაღაზია'), city: TBS },
  { id: 'br_elva_isani', tenantId: 't_elva', name: t('Isani shop', 'ისნის მაღაზია'), city: TBS },
  { id: 'br_borbali_digomi', tenantId: 't_borbali', name: t('Digomi workshop', 'დიღმის სახელოსნო'), city: TBS },
  { id: 'br_kalakuri_main', tenantId: 't_kalakuri', name: t('Reception desk', 'რეგისტრატურა'), city: TBS },
  { id: 'br_puri_vera', tenantId: 't_puri', name: t('Vera', 'ვერა'), city: TBS },
  { id: 'br_puri_sololaki', tenantId: 't_puri', name: t('Sololaki', 'სოლოლაკი'), city: TBS },
]
const branchById = Object.fromEntries(branches.map((x) => [x.id, x]))

const TITLE = {
  loan: t('Loan officer', 'საკრედიტო ოფიცერი'),
  advisor: t('Customer advisor', 'მომხმარებელთა კონსულტანტი'),
  teller: t('Teller', 'ოპერაციონისტი'),
  senior: t('Senior advisor', 'უფროსი კონსულტანტი'),
  operator: t('Contact-centre operator', 'საკონტაქტო ცენტრის ოპერატორი'),
  sales: t('Sales consultant', 'გაყიდვების კონსულტანტი'),
  service: t('Service advisor', 'სერვის-კონსულტანტი'),
  reception: t('Receptionist', 'რეგისტრატორი'),
  barista: t('Barista', 'ბარისტა'),
  shift: t('Shift lead', 'ცვლის უფროსი'),
}

/** `links` = background links over days 1-44; `mu` = the rating personality. */
const STAFF = [
  ['stf_levan', 'br_nergi_vake', 'Levan Japaridze', 'ლევან ჯაფარიძე', 'loan', 'acc_levan', 50, 4.75],
  ['stf_teona', 'br_nergi_vake', 'Teona Abuladze', 'თეონა აბულაძე', 'advisor', null, 14, 4.37],
  ['stf_rusudan', 'br_nergi_vake', 'Rusudan Kobakhidze', 'რუსუდან კობახიძე', 'teller', null, 10, 4.17],
  ['stf_ana', 'br_nergi_saburtalo', 'Ana Tsiklauri', 'ანა წიკლაური', 'advisor', null, 16, 4.47],
  ['stf_otar', 'br_nergi_saburtalo', 'Otar Lobzhanidze', 'ოთარ ლობჟანიძე', 'loan', null, 10, 4.07],
  ['stf_ketevan', 'br_nergi_batumi', 'Ketevan Dolidze', 'ქეთევან დოლიძე', 'senior', null, 12, 4.27],
  ['stf_natia', 'br_elva_cc', 'Natia Gvaramia', 'ნათია გვარამია', 'operator', null, 22, 4.42],
  ['stf_zurab', 'br_elva_cc', 'Zurab Kiknadze', 'ზურაბ კიკნაძე', 'operator', null, 18, 4.02],
  ['stf_davit', 'br_elva_didube', 'Davit Kapanadze', 'დავით კაპანაძე', 'sales', null, 16, 4.52],
  ['stf_lika', 'br_elva_didube', 'Lika Nadiradze', 'ლიკა ნადირაძე', 'sales', null, 12, 4.27],
  ['stf_giorgi', 'br_elva_isani', 'Giorgi Maisuradze', 'გიორგი მაისურაძე', 'sales', null, 14, 4.02],
  ['stf_sandro', 'br_borbali_digomi', 'Sandro Chikovani', 'სანდრო ჩიქოვანი', 'service', null, 22, 4.22],
  ['stf_salome', 'br_kalakuri_main', 'Salome Gogoladze', 'სალომე გოგოლაძე', 'reception', null, 14, 4.52],
  ['stf_maka', 'br_kalakuri_main', 'Maka Svanidze', 'მაკა სვანიძე', 'reception', null, 10, 4.17],
  ['stf_elene', 'br_puri_vera', 'Elene Tabatadze', 'ელენე ტაბატაძე', 'barista', null, 14, 4.62],
  ['stf_beka', 'br_puri_sololaki', 'Beka Mchedlishvili', 'ბექა მჭედლიშვილი', 'shift', null, 12, 4.27],
]
const staff = STAFF.map(([id, branchId, en, ka, title, accountId]) => ({
  id,
  tenantId: branchById[branchId].tenantId,
  branchId,
  name: t(en, ka),
  title: TITLE[title],
  accountId,
}))
const staffById = Object.fromEntries(staff.map((x) => [x.id, x]))
const staffPlan = Object.fromEntries(STAFF.map(([id, , , , , , links, mu]) => [id, { links, mu }]))

const campaigns = [
  {
    id: 'cmp_nergi_visit',
    tenantId: 't_nergi',
    title: t('How was your branch visit?', 'როგორ შეაფასებდით ფილიალში ვიზიტს?'),
    description: t(
      'You visited one of our branches recently. Four short questions help us serve you better.',
      'ცოტა ხნის წინ ეწვიეთ ჩვენს ფილიალს. გაგვიზიარეთ თქვენი აზრი: ოთხი მოკლე კითხვა დაგვეხმარება, უკეთ მოგემსახუროთ.',
    ),
    createdAt: '2026-03-02T08:00:00Z',
    linkTtlDays: 7,
    touchpoint: t('Branch visit', 'ვიზიტი ფილიალში'),
  },
  {
    id: 'cmp_elva_shop',
    tenantId: 't_elva',
    title: t('How was your visit to our shop?', 'როგორ შეაფასებდით ჩვენს მაღაზიაში ვიზიტს?'),
    description: t(
      'Thanks for stopping by. Tell us how our team helped you today.',
      'გმადლობთ, რომ გვესტუმრეთ. გაგვიზიარეთ თქვენი აზრი ჩვენი გუნდის მომსახურებაზე.',
    ),
    createdAt: '2026-04-14T07:30:00Z',
    linkTtlDays: 7,
    touchpoint: t('Shop visit', 'ვიზიტი მაღაზიაში'),
  },
  {
    id: 'cmp_elva_call',
    tenantId: 't_elva',
    title: t('How did our call go?', 'როგორ შეაფასებდით ჩვენთან საუბარს?'),
    description: t(
      'You called our contact centre. Three questions, thirty seconds.',
      'თქვენ დაუკავშირდით ჩვენს საკონტაქტო ცენტრს. სამი კითხვა, ოცდაათი წამი.',
    ),
    createdAt: '2026-05-06T10:15:00Z',
    linkTtlDays: 7,
    touchpoint: t('Contact-centre call', 'ზარი საკონტაქტო ცენტრში'),
  },
  {
    id: 'cmp_borbali_service',
    tenantId: 't_borbali',
    title: t('How did we look after your car?', 'როგორ მოვუარეთ თქვენს ავტომობილს?'),
    description: t(
      'Your car has left our workshop. Rate the work and how well we kept our word.',
      'თქვენი ავტომობილი უკვე გამოვიდა ჩვენი სახელოსნოდან. შეაფასეთ შესრულებული სამუშაო და რამდენად შევასრულეთ დანაპირები.',
    ),
    createdAt: '2026-06-01T06:45:00Z',
    linkTtlDays: 7,
    touchpoint: t('Car service', 'ავტომობილის მომსახურება'),
  },
  {
    id: 'cmp_kalakuri_visit',
    tenantId: 't_kalakuri',
    title: t('How was your check-in at the clinic?', 'როგორ შეაფასებდით რეგისტრატურის მომსახურებას?'),
    description: t(
      'You visited our clinic today. Tell us about your welcome at the reception desk.',
      'დღეს ეწვიეთ ჩვენს კლინიკას. გაგვიზიარეთ თქვენი აზრი რეგისტრატურაში მიღებაზე.',
    ),
    createdAt: '2026-05-20T09:00:00Z',
    linkTtlDays: 7,
    touchpoint: t('Clinic reception', 'კლინიკის რეგისტრატურა'),
  },
  {
    id: 'cmp_puri_visit',
    tenantId: 't_puri',
    title: t('How was your visit?', 'როგორი იყო თქვენი ვიზიტი?'),
    description: t(
      'Thanks for dropping in. Four quick questions about your order and our team.',
      'გმადლობთ, რომ გვესტუმრეთ. ოთხი მოკლე კითხვა თქვენს შეკვეთასა და ჩვენს გუნდზე.',
    ),
    createdAt: '2026-07-08T05:30:00Z',
    linkTtlDays: 3,
    touchpoint: t('Café visit', 'ვიზიტი კაფეში'),
  },
]
const campaignById = Object.fromEntries(campaigns.map((x) => [x.id, x]))

const Q = [
  ['cmp_nergi_visit', 1101, 'How courteous was the staff member who served you?', 'რამდენად თავაზიანი იყო თანამშრომელი, რომელმაც მოგემსახურათ?'],
  ['cmp_nergi_visit', 1102, 'How satisfied are you with the waiting time?', 'რამდენად კმაყოფილი ხართ ლოდინის დროით?'],
  ['cmp_nergi_visit', 1103, 'How clearly were the loan terms explained to you?', 'რამდენად გასაგებად აგიხსნეს სესხის პირობები?'],
  ['cmp_nergi_visit', 1104, 'How likely are you to recommend Nergi Bank to a friend?', 'რამდენად სავარაუდოა, რომ ნერგი ბანკს მეგობარს ურჩიოთ?'],
  ['cmp_elva_shop', 1201, 'How well did we help you find the right plan?', 'რამდენად დაგეხმარეთ თქვენთვის შესაფერისი ტარიფის შერჩევაში?'],
  ['cmp_elva_shop', 1202, 'How satisfied are you with the waiting time in the shop?', 'რამდენად კმაყოფილი ხართ მაღაზიაში ლოდინის დროით?'],
  ['cmp_elva_shop', 1203, 'How knowledgeable was our consultant?', 'რამდენად კომპეტენტური იყო ჩვენი კონსულტანტი?'],
  ['cmp_elva_call', 1211, 'How fully was your issue resolved?', 'რამდენად სრულად მოგვარდა თქვენი საკითხი?'],
  ['cmp_elva_call', 1212, 'How quickly did you reach an operator?', 'რამდენად სწრაფად შეძელით ოპერატორთან დაკავშირება?'],
  ['cmp_elva_call', 1213, 'How courteous was the operator?', 'რამდენად თავაზიანი იყო ოპერატორი?'],
  ['cmp_borbali_service', 1301, 'How closely did the work match what we agreed?', 'რამდენად შეესაბამებოდა შესრულებული სამუშაო შეთანხმებას?'],
  ['cmp_borbali_service', 1302, 'How well did we keep to the promised ready time?', 'რამდენად დროულად იყო თქვენი ავტომობილი მზად?'],
  ['cmp_borbali_service', 1303, 'How closely did the final price match the estimate?', 'რამდენად შეესაბამებოდა საბოლოო ფასი წინასწარ შეფასებას?'],
  ['cmp_borbali_service', 1304, 'How clean was your car when we returned it?', 'რამდენად სუფთა დაგიბრუნდათ ავტომობილი?'],
  ['cmp_kalakuri_visit', 1401, 'How quick was your registration?', 'რამდენად სწრაფად გაიარეთ რეგისტრაცია?'],
  ['cmp_kalakuri_visit', 1402, 'How courteous was the receptionist?', 'რამდენად თავაზიანი იყო რეგისტრატორი?'],
  ['cmp_kalakuri_visit', 1403, 'How clean and comfortable was the waiting area?', 'რამდენად სუფთა და კომფორტული იყო მოსაცდელი სივრცე?'],
  ['cmp_puri_visit', 1501, 'How quick was the service?', 'რამდენად სწრაფი იყო მომსახურება?'],
  ['cmp_puri_visit', 1502, 'How friendly was our team?', 'რამდენად მეგობრული იყო ჩვენი გუნდი?'],
  ['cmp_puri_visit', 1503, 'How did you like the food and drinks?', 'როგორ მოგეწონათ საჭმელი და სასმელი?'],
  ['cmp_puri_visit', 1504, 'How clean was the café?', 'რამდენად სუფთა იყო კაფე?'],
]
const orderCounter = {}
const questions = Q.map(([campaignId, id, en, ka]) => {
  orderCounter[campaignId] = (orderCounter[campaignId] ?? 0) + 1
  return { id, campaignId, order: orderCounter[campaignId], text: t(en, ka) }
})
const questionIdsOf = (campaignId) => questions.filter((q) => q.campaignId === campaignId).map((q) => q.id)

const recipients = [
  { id: 'rcp_mariam', name: t('Mariam Lomidze', 'მარიამ ლომიძე'), phoneMasked: '+995 5•• ••• 451', avatarColor: '#9EE6C6' },
  { id: 'rcp_eka', name: t('Eka Beridze', 'ეკა ბერიძე'), phoneMasked: '+995 5•• ••• 214', avatarColor: '#E2A3D2' },
  { id: 'rcp_giorgi', name: t('Giorgi Mikadze', 'გიორგი მიქაძე'), phoneMasked: '+995 5•• ••• 387', avatarColor: '#7FB2F0' },
  { id: 'rcp_irakli', name: t('Irakli Abashidze', 'ირაკლი აბაშიძე'), phoneMasked: '+995 5•• ••• 509', avatarColor: '#F5B83D' },
  { id: 'rcp_tamar', name: t('Tamar Khutsishvili', 'თამარ ხუციშვილი'), phoneMasked: '+995 5•• ••• 623', avatarColor: '#B7C3CF' },
  { id: 'rcp_luka', name: t('Luka Meladze', 'ლუკა მელაძე'), phoneMasked: '+995 5•• ••• 778', avatarColor: '#E9C467' },
]
const recipientById = Object.fromEntries(recipients.map((x) => [x.id, x]))

const CAMPAIGN_OF_BRANCH = {
  br_nergi_vake: 'cmp_nergi_visit',
  br_nergi_saburtalo: 'cmp_nergi_visit',
  br_nergi_batumi: 'cmp_nergi_visit',
  br_elva_cc: 'cmp_elva_call',
  br_elva_didube: 'cmp_elva_shop',
  br_elva_isani: 'cmp_elva_shop',
  br_borbali_digomi: 'cmp_borbali_service',
  br_kalakuri_main: 'cmp_kalakuri_visit',
  br_puri_vera: 'cmp_puri_visit',
  br_puri_sololaki: 'cmp_puri_visit',
}

/* ---------------------------------------------------------------- comments */

/**
 * [band, lang, audience, text]. Audience: 'any' fits every tenant; 'bank',
 * 'auto', 'clinic', 'cafe' fit that tenant; 'telecom' fits Elva's shops AND its
 * contact centre; 'shop' only the shops; 'callcentre' only the contact centre.
 * (The runtime simulator only sees a tenant's industry, so it draws from
 * 'any' + that industry and never hands a call-centre remark to a shop.)
 */
const COMMENTS = [
  // ---- positive (average 3.75 and up)
  ['positive', 'ka', 'any', 'ძალიან კმაყოფილი ვარ, ყველაფერი სწრაფად და მარტივად მოგვარდა.'],
  ['positive', 'ka', 'any', 'თანამშრომელი ძალიან ყურადღებიანი იყო, დიდი მადლობა.'],
  ['positive', 'ka', 'any', 'ყველაფერი გასაგებად ამიხსნეს, არანაირი პრობლემა არ შემქმნია.'],
  ['positive', 'ka', 'any', 'სასიამოვნო გარემო და თავაზიანი პერსონალი.'],
  ['positive', 'ka', 'any', 'მადლობა, ასე გააგრძელეთ!'],
  ['positive', 'ka', 'any', 'ლოდინი თითქმის არ მომიწია, ძალიან მოხარული ვარ.'],
  ['positive', 'ka', 'any', 'კარგი მომსახურებაა, აუცილებლად დავბრუნდები.'],
  ['positive', 'ka', 'any', 'პროფესიონალურად მომემსახურნენ, მადლობა.'],
  ['positive', 'ka', 'any', 'ასეთი კარგი მომსახურება იშვიათად შემხვედრია.'],
  ['positive', 'ka', 'any', 'არავის გაუჩქარებივარ, ყველაფერი მშვიდად და გასაგებად ამიხსნეს.'],
  ['positive', 'ka', 'any', 'ძალიან მომეწონა, რომ ჩემი დრო გაითვალისწინეს.'],
  ['positive', 'ka', 'any', 'სწრაფი და თავაზიანი მომსახურებაა, გმადლობთ.'],
  ['positive', 'ka', 'bank', 'სესხის პირობები დეტალურად ამიხსნეს და ყველა კითხვას მიპასუხეს.'],
  ['positive', 'ka', 'bank', 'ფილიალში რიგი არ იყო, ოპერაცია ხუთ წუთში დასრულდა.'],
  ['positive', 'ka', 'bank', 'კონსულტანტმა ჩემთვის საუკეთესო ვარიანტი შეარჩია, მადლობა.'],
  ['positive', 'ka', 'bank', 'ანგარიშის გახსნას ათი წუთი დასჭირდა, ყველაფერი უპრობლემოდ მოხდა.'],
  ['positive', 'ka', 'bank', 'ბარათი იმავე დღეს მივიღე და ლოდინიც არ მომიწია.'],
  ['positive', 'ka', 'bank', 'კონსულტანტმა ყველა პირობა სიმშვიდით ამიხსნა და ზედმეტი არაფერი შემომთავაზა.'],
  ['positive', 'ka', 'bank', 'მობილბანკის გააქტიურებაშიც დამეხმარნენ, დიდი მადლობა.'],
  ['positive', 'ka', 'bank', 'გადახდის გრაფიკი სამჯერ გადამიმოწმეს, რომ ყველაფერი გასაგები ყოფილიყო.'],
  ['positive', 'ka', 'bank', 'ფილიალში სუფთა და მშვიდი გარემოა, თანამშრომლებიც თავაზიანები არიან.'],
  ['positive', 'ka', 'telecom', 'ახალი ტარიფი ზუსტად ჩემს საჭიროებებს შეესაბამება.'],
  ['positive', 'ka', 'telecom', 'ინტერნეტის პაკეტი ისე შემირჩიეს, რომ ზედმეტს არაფერს ვიხდი.'],
  ['positive', 'ka', 'telecom', 'ანგარიშსწორების საკითხიც გასაგებად ამიხსნეს, დიდი მადლობა.'],
  ['positive', 'ka', 'shop', 'ახალი ტელეფონის გამართვაშიც დამეხმარნენ, ძალიან კმაყოფილი ვარ.'],
  ['positive', 'ka', 'shop', 'ნომრის გადატანა ერთ ვიზიტში მოვასწარი, ძალიან მოხერხებულად.'],
  ['positive', 'ka', 'shop', 'კონსულტანტმა რამდენიმე ტარიფი შემადარა და ყველაზე ხელსაყრელი შემირჩია.'],
  ['positive', 'ka', 'callcentre', 'ოპერატორმა პრობლემა ერთ ზარში მომიგვარა.'],
  ['positive', 'ka', 'callcentre', 'ოპერატორი მშვიდად მისმენდა და ბოლომდე მიპასუხა.'],
  ['positive', 'ka', 'callcentre', 'ზარის დასრულებამდე დარწმუნდა, რომ ყველაფერი მოგვარდა, მადლობა.'],
  ['positive', 'ka', 'auto', 'მანქანა დათქმულ დროს მზად იყო და სუფთაც დამიბრუნეს.'],
  ['positive', 'ka', 'auto', 'ფასი ზუსტად ისეთი იყო, როგორიც წინასწარ მითხრეს.'],
  ['positive', 'ka', 'auto', 'ხელოსნებმა ყველაფერი მაჩვენეს და ამიხსნეს, რა შეცვალეს.'],
  ['positive', 'ka', 'auto', 'ხელოსანმა ძველი დეტალი დამანახა და ამიხსნა, რატომ შეიცვალა.'],
  ['positive', 'ka', 'auto', 'ყველაფერი დათქმულ ფასში ჩაეტია, დამატებითი თანხა არ მომთხოვეს.'],
  ['positive', 'ka', 'auto', 'სალონი სუფთა დამიბრუნეს, ამის იმედი არ მქონდა.'],
  ['positive', 'ka', 'clinic', 'რეგისტრაცია ორ წუთში გავიარე, რეგისტრატორი ძალიან თავაზიანი იყო.'],
  ['positive', 'ka', 'clinic', 'ყველაფერი ორგანიზებულად იყო, ექიმთან დროულად შევედი.'],
  ['positive', 'ka', 'clinic', 'მოსაცდელში სუფთა და მყუდრო გარემოა.'],
  ['positive', 'ka', 'clinic', 'რეგისტრატორმა სახელით მომმართა და ყველაფერი სიმშვიდით მომიგვარა.'],
  ['positive', 'ka', 'clinic', 'ჩაწერა სწრაფად მოხერხდა, ლოდინიც მინიმალური იყო.'],
  ['positive', 'ka', 'cafe', 'ყავა ძალიან გემრიელი იყო, ხაჭაპური კი ცხელი და ახალი.'],
  ['positive', 'ka', 'cafe', 'მეგობრული გუნდი და სასიამოვნო ატმოსფერო.'],
  ['positive', 'ka', 'cafe', 'შეკვეთა სწრაფად მომიტანეს, აუცილებლად დავბრუნდები.'],
  ['positive', 'ka', 'cafe', 'საუკეთესო ჩაი ქალაქში!'],
  ['positive', 'ka', 'cafe', 'მაგიდა სუფთა დამხვდა და ყავაც ცხელი მომიტანეს.'],
  ['positive', 'ka', 'cafe', 'ხაჭაპური ახალგამომცხვარი იყო, ბარისტაც ძალიან თავაზიანი.'],
  ['positive', 'en', 'any', 'Quick, friendly and no fuss. Thank you.'],
  ['positive', 'en', 'any', 'Everything was explained clearly. Great service.'],
  ['positive', 'en', 'any', 'Very polite staff, and I barely had to wait.'],
  ['positive', 'en', 'bank', 'The advisor walked me through every line of the loan agreement. Really appreciated it.'],
  ['positive', 'en', 'bank', 'Opened my account in ten minutes, with no queue and no pressure to buy anything else.'],
  ['positive', 'en', 'bank', 'Clear answers about fees. I knew exactly what I was signing.'],
  ['positive', 'en', 'telecom', 'A plain explanation of my bill, finally. Thank you.'],
  ['positive', 'en', 'shop', 'The consultant found me a cheaper plan than I expected.'],
  ['positive', 'en', 'shop', 'Swapped my SIM in five minutes and set up the phone too.'],
  ['positive', 'en', 'callcentre', 'Sorted out my roaming in one call. Impressive.'],
  ['positive', 'en', 'callcentre', 'Polite operator and no endless hold music. Thank you.'],
  ['positive', 'en', 'auto', 'Car was ready on time and the price matched the quote exactly.'],
  ['positive', 'en', 'auto', 'Honest quote, honest work. I will be back for the winter tyres.'],
  ['positive', 'en', 'clinic', 'Check-in took two minutes and the receptionist was lovely.'],
  ['positive', 'en', 'clinic', 'Calm reception and clear directions to the right floor.'],
  ['positive', 'en', 'cafe', 'Great coffee, warm welcome, lovely terrace.'],
  ['positive', 'en', 'cafe', 'Fresh pastries and quick service.'],
  ['positive', 'en', 'cafe', 'Best tea in the city, and the staff remembered my usual.'],
  // ---- neutral (average 2.75 up to 3.75)
  ['neutral', 'ka', 'any', 'ზოგადად ნორმალურად, მაგრამ ლოდინი ცოტა გაჭიანურდა.'],
  ['neutral', 'ka', 'any', 'მომსახურება კარგი იყო, თუმცა საჭირო ინფორმაცია მოგვიანებით მივიღე.'],
  ['neutral', 'ka', 'any', 'საშუალოდ. გასაუმჯობესებელი ნამდვილად არის.'],
  ['neutral', 'ka', 'any', 'ცუდი არაფერია, მაგრამ განსაკუთრებულიც არაფერი.'],
  ['neutral', 'ka', 'any', 'თანამშრომელი თავაზიანი იყო, ოღონდ ჩემს კითხვას ბოლომდე ვერ უპასუხა.'],
  ['neutral', 'ka', 'bank', 'კონსულტანტი კარგი იყო, მაგრამ რიგში 20 წუთი ვიდექი.'],
  ['neutral', 'ka', 'bank', 'საქმე მოგვარდა, თუმცა ერთი საბუთი ორჯერ მთხოვეს.'],
  ['neutral', 'ka', 'bank', 'პირობები გასაგები იყო, ხელმოწერას კი ძალიან დიდი დრო წაართვა.'],
  ['neutral', 'ka', 'telecom', 'საქმე მოგვარდა, თუმცა ტარიფის პირობები უფრო მკაფიოდ უნდა აგიხსნათ.'],
  ['neutral', 'ka', 'shop', 'მაღაზიაში ბევრი ხალხი იყო და კონსულტანტს ძლივს დაველოდე.'],
  ['neutral', 'ka', 'shop', 'კონსულტანტი კომპეტენტური იყო, მაგრამ ლოდინი 25 წუთს გასცდა.'],
  ['neutral', 'ka', 'callcentre', 'ოპერატორი თავაზიანი იყო, მაგრამ ხაზზე დიდხანს მომიწია ლოდინი.'],
  ['neutral', 'ka', 'callcentre', 'პრობლემა გადაწყდა, თუმცა ორჯერ გადამრთეს სხვა განყოფილებაზე.'],
  ['neutral', 'ka', 'auto', 'სამუშაო კარგად შესრულდა, მაგრამ მანქანა ორი საათით გვიან მომცეს.'],
  ['neutral', 'ka', 'auto', 'ხარისხი კარგია, ფასი კი ოდნავ მაღალი მომეჩვენა.'],
  ['neutral', 'ka', 'clinic', 'რეგისტრატურაში სწრაფად მომემსახურნენ, მაგრამ მოსაცდელი ხალხმრავალი იყო.'],
  ['neutral', 'ka', 'clinic', 'რეგისტრატორი თავაზიანი იყო, მოსაცდელში კი ჯდომის ადგილი არ იყო საკმარისი.'],
  ['neutral', 'ka', 'cafe', 'ყავა კარგი იყო, მაგრამ შეკვეთას დიდხანს ველოდებოდი.'],
  ['neutral', 'ka', 'cafe', 'საჭმელი გემრიელი იყო, მაგრამ ხმაური ზედმეტად იყო.'],
  ['neutral', 'en', 'any', 'Okay overall, but the wait was longer than I hoped.'],
  ['neutral', 'en', 'any', 'Fine, nothing special.'],
  ['neutral', 'en', 'any', 'Friendly enough, though I had to ask twice for help.'],
  ['neutral', 'en', 'bank', 'Helpful advisor, but the paperwork took forever.'],
  ['neutral', 'en', 'telecom', 'The plan is fine, but the pricing could be explained more simply.'],
  ['neutral', 'en', 'shop', 'Knowledgeable consultant, but the shop was packed and I waited a while.'],
  ['neutral', 'en', 'callcentre', 'Got there in the end, but I was transferred twice.'],
  ['neutral', 'en', 'auto', 'Good repair, but the final bill was a bit higher than the estimate.'],
  ['neutral', 'en', 'clinic', 'Reception was polite, but the waiting area felt cramped.'],
  ['neutral', 'en', 'cafe', 'Tasty, but a bit noisy at lunchtime.'],
  // ---- negative (average below 2.75)
  ['negative', 'ka', 'any', 'ძალიან დიდხანს მომიწია ლოდინი და არავინ განმიმარტა მიზეზი.'],
  ['negative', 'ka', 'any', 'თანამშრომელი უყურადღებო იყო, იმედგაცრუებული ვარ.'],
  ['negative', 'ka', 'any', 'ჩემს შეკითხვაზე პასუხი ვერ მივიღე, ძალიან უკმაყოფილო ვარ.'],
  ['negative', 'ka', 'bank', 'სესხის პირობები ბოლომდე ვერ გავიგე, ორჯერ მომიწია მოსვლა.'],
  ['negative', 'ka', 'bank', 'ფილიალში ერთი სალარო მუშაობდა და რიგი ძალიან გრძელი იყო.'],
  ['negative', 'ka', 'telecom', 'ტარიფი ერთი რამ მითხრეს, ანგარიშზე სხვა თანხა მომივიდა.'],
  ['negative', 'ka', 'shop', 'რიგი უკიდურესად გრძელი იყო, ერთი კონსულტანტი ემსახურებოდა ყველას.'],
  ['negative', 'ka', 'shop', 'ნომრის გადატანა ვერ მოვახერხე, ორჯერ მომიწია დაბრუნება.'],
  ['negative', 'ka', 'callcentre', 'პრობლემა ისევ არ მომგვარებია, უკვე მესამედ ვრეკავ.'],
  ['negative', 'ka', 'callcentre', 'ხაზზე ნახევარი საათი ველოდებოდი და ბოლოს ზარი გაითიშა.'],
  ['negative', 'ka', 'auto', 'საბოლოო ფასი შეფასებაზე გაცილებით მაღალი აღმოჩნდა.'],
  ['negative', 'ka', 'auto', 'მანქანა დაპირებულზე ერთი დღით გვიან დამიბრუნეს, არც გამაფრთხილეს.'],
  ['negative', 'ka', 'clinic', 'რეგისტრაციისას ჩემი ჩანაწერი ვერ იპოვეს და 30 წუთი დავკარგე.'],
  ['negative', 'ka', 'clinic', 'მოსაცდელი ცივი და გადაჭედილი იყო, ჯდომის ადგილი არ მქონდა.'],
  ['negative', 'ka', 'cafe', 'მაგიდები დაუსუფთავებელი იყო და შეკვეთაც აგვერია.'],
  ['negative', 'ka', 'cafe', 'ყავა ცივი მომიტანეს და ბოდიშიც არავინ მოიხადა.'],
  ['negative', 'en', 'any', 'Long wait and nobody told me why.'],
  ['negative', 'en', 'any', 'Felt like a number, not a customer.'],
  ['negative', 'en', 'bank', 'Had to come back twice because nobody told me which documents to bring.'],
  ['negative', 'en', 'telecom', 'The bill did not match what I was promised.'],
  ['negative', 'en', 'shop', 'One person serving a queue of twelve. Please add staff.'],
  ['negative', 'en', 'callcentre', 'Still not fixed. Third call this week.'],
  ['negative', 'en', 'auto', 'Car came back dirty and a day late.'],
  ['negative', 'en', 'clinic', 'The waiting area was cold and crowded.'],
  ['negative', 'en', 'cafe', 'Order mix-up and no apology.'],
]
const commentPools = { positive: [], neutral: [], negative: [] }
for (const [band, lang, industry, text] of COMMENTS) commentPools[band].push({ lang, industry, text })

/** Its own stream, so wording changes never reshuffle the ratings. */
const commentRng = createRandom('azri-comments')
const usedComments = new Map()
/** `kind` is the branch kind (bank, telecom shop, callcentre, auto, clinic, cafe). */
function appliesTo(c, kind) {
  if (c.industry === 'any') return true
  if (c.industry === 'telecom') return kind === 'telecom' || kind === 'callcentre'
  if (c.industry === 'shop') return kind === 'telecom'
  return c.industry === kind
}
/** Each comment is used once; short generic ones may recur once the specific ones run out. */
function pickComment(avg, kind) {
  const band = avg >= 3.75 ? 'positive' : avg >= 2.75 ? 'neutral' : 'negative'
  const preferred = commentRng.chance(0.75) ? 'ka' : 'en'
  for (const lang of [preferred, preferred === 'ka' ? 'en' : 'ka']) {
    const fits = commentPools[band].filter((c) => c.lang === lang && appliesTo(c, kind))
    const fresh = fits.filter((c) => !usedComments.has(c.text))
    const usable = fresh.length ? fresh : fits.filter((c) => c.industry === 'any' && (usedComments.get(c.text) ?? 0) < 2)
    if (!usable.length) continue
    const specific = usable.filter((c) => c.industry !== 'any')
    const choice = specific.length && commentRng.chance(0.65) ? commentRng.pick(specific) : commentRng.pick(usable)
    usedComments.set(choice.text, (usedComments.get(choice.text) ?? 0) + 1)
    return choice
  }
  return null
}

/* ----------------------------------------------------------------- ratings */

const Q_ADJ = { 1102: -0.35, 1104: 0.05, 1202: -0.2, 1212: -0.6, 1302: -0.35, 1303: -0.25, 1403: -1, 1501: -0.2, 1503: 0.1 }
const BRANCH_Q_ADJ = { 'br_elva_isani|1202': -0.5 }

function makeAnswers(staffId, campaignId) {
  const { mu } = staffPlan[staffId]
  const { branchId } = staffById[staffId]
  const mood = rng.gauss() * 0.55
  const answers = questionIdsOf(campaignId).map((id) => {
    if (rng.chance(0.1)) return { id, question_rate: null }
    const x = mu + (Q_ADJ[id] ?? 0) + (BRANCH_Q_ADJ[`${branchId}|${id}`] ?? 0) + mood + rng.gauss() * 0.6
    return { id, question_rate: Math.min(5, Math.max(1, Math.round(x))) }
  })
  if (answers.every((a) => a.question_rate === null)) answers[0].question_rate = Math.min(5, Math.max(1, Math.round(mu + mood)))
  return answers
}

const average = (answers) => {
  const rated = answers.map((a) => a.question_rate).filter((r) => r !== null)
  return rated.reduce((s, r) => s + r, 0) / rated.length
}

/* ------------------------------------------------------------------ tokens */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const PERSONA_TOKENS = ['7KQ2M9', 'P8VR3D', 'C4WN8T', 'E5SB2K', 'B7DG4N', 'K3RC9W', 'X2HB5R', 'T6CC2H', 'R9BD5M', 'S2PK8Q', 'H4KX7Z']
const UNKNOWN_TOKEN = '4TQ7PL'
const taken = new Set([...PERSONA_TOKENS, UNKNOWN_TOKEN])
function newToken() {
  for (;;) {
    let token = ''
    for (let i = 0; i < 6; i += 1) token += ALPHABET[rng.int(0, ALPHABET.length - 1)]
    if (!taken.has(token)) {
      taken.add(token)
      return token
    }
  }
}

const personaEndings = new Set(recipients.map((r) => r.phoneMasked.slice(-3)))
function maskedPhone() {
  for (;;) {
    const end = String(rng.int(100, 999))
    if (!personaEndings.has(end)) return `+995 5•• ••• ${end}`
  }
}

/* --------------------------------------------------------- background links */

/** Scales every tenant's answer rate; tuned for ~155 responses in 45 days. */
const RESPONSE_BOOST = 1.03
const RESPONSE_P = { t_nergi: 0.58, t_elva: 0.55, t_borbali: 0.62, t_kalakuri: 0.6, t_puri: 0.5 }
/** Business hours in UTC (Tbilisi is UTC+4). */
const HOURS = {
  bank: [5, 13],
  telecom: [6, 16],
  callcentre: [4, 17],
  auto: [5, 14],
  clinic: [4.5, 14],
  cafe: [4, 16.5],
}
const SUNDAY = { bank: 0.12, telecom: 0.7, callcentre: 0.8, auto: 0.3, clinic: 0.4, cafe: 1.2 }
const SATURDAY = { bank: 0.5, telecom: 1, callcentre: 0.9, auto: 0.8, clinic: 0.7, cafe: 1.3 }
const kindOf = (branchId) => (branchId === 'br_elva_cc' ? 'callcentre' : tenantById[branchById[branchId].tenantId].industry)

const links = []
const responses = []

function answerDelay() {
  const bucket = rng.weighted([['fast', 0.5], ['hours', 0.3], ['late', 0.2]])
  if (bucket === 'fast') return rng.int(5, 60) * MIN
  if (bucket === 'hours') return rng.int(60, 300) * MIN
  return rng.int(300, 1200) * MIN
}

/**
 * One background link sent on day `day` (days before the anchor) inside the
 * branch's business hours, or exactly at `at`. `forceAnswer`: a delay in ms
 * to force a response, false to force none, null to roll the dice.
 */
function addLink(staffId, day, { at = null, forceAnswer = null, sentBy = 'system' } = {}) {
  const person = staffById[staffId]
  const kind = kindOf(person.branchId)
  const campaign = campaignById[CAMPAIGN_OF_BRANCH[person.branchId]]
  const [from, to] = HOURS[kind]
  const sentAt = at ?? tbilisiMidnight(day) + TBILISI + Math.round((from + rng.next() * (to - from)) * HOUR)
  const interactionAt = sentAt - (kind === 'callcentre' ? rng.int(2, 10) : rng.int(4, 35)) * MIN
  const expiresAt = sentAt + campaign.linkTtlDays * DAY
  const link = {
    id: newToken(),
    campaignId: campaign.id,
    tenantId: person.tenantId,
    branchId: person.branchId,
    staffId,
    recipientId: null,
    phoneMasked: maskedPhone(),
    interactionAt: iso(interactionAt),
    sentAt: iso(sentAt),
    expiresAt: iso(expiresAt),
    status: 'pending',
    completedAt: null,
    responseId: null,
    sentBy,
  }
  const answers = forceAnswer ?? rng.chance(Math.min(0.95, RESPONSE_P[person.tenantId] * RESPONSE_BOOST))
  const delay = typeof forceAnswer === 'number' ? forceAnswer : answerDelay()
  if (answers && sentAt + delay < ANCHOR - 2 * MIN && sentAt + delay < expiresAt) {
    const submittedAt = sentAt + delay
    link.status = 'completed'
    link.completedAt = iso(submittedAt)
    const answersList = makeAnswers(staffId, campaign.id)
    const comment = rng.chance(0.36) ? pickComment(average(answersList), kind) : null
    responses.push({
      id: null,
      surveyId: link.id,
      campaignId: campaign.id,
      tenantId: person.tenantId,
      branchId: person.branchId,
      staffId,
      answers: answersList,
      comment: comment?.text ?? '',
      commentLang: comment?.lang ?? 'ka',
      submittedAt: iso(submittedAt),
      source: 'seed',
    })
  } else if (expiresAt <= ANCHOR) {
    link.status = 'expired'
  }
  links.push(link)
  return link
}

// Volume ramps up towards the anchor (the service is being rolled out; the last
// week is busiest, so the SMS log always has live pending links), with
// quieter Sundays at the bank and the workshop.
for (const { id: staffId, branchId } of staff) {
  const kind = kindOf(branchId)
  const days = []
  for (let d = 1; d <= 44; d += 1) {
    const dow = weekday(d)
    const weekFactor = dow === 0 ? SUNDAY[kind] : dow === 6 ? SATURDAY[kind] : 1
    days.push([d, (1 + 1.5 * (1 - (d - 1) / 43)) * weekFactor * (d <= 6 ? 1.25 : 1)])
  }
  for (let i = 0; i < staffPlan[staffId].links; i += 1) addLink(staffId, rng.weighted(days))
}

// The anchor day: a handful already answered this morning, the rest pending.
const TODAY = [
  ['stf_levan', 25 * MIN],
  ['stf_natia', 12 * MIN],
  ['stf_davit', 40 * MIN],
  ['stf_elene', 18 * MIN],
  ['stf_ana', false],
  ['stf_zurab', false],
  ['stf_sandro', false],
  ['stf_giorgi', false],
  ['stf_beka', false],
]
for (const [staffId, answer] of TODAY) {
  // Answered ones are sent early enough that the answer lands before the anchor.
  const at = ANCHOR - (answer ? rng.int(70, 230) : rng.int(15, 240)) * MIN
  addLink(staffId, 0, { at, forceAnswer: answer })
}

// Levan sends some surveys by hand from the console; so do a few colleagues.
const levanLinks = links.filter((l) => l.staffId === 'stf_levan').sort((a, b) => b.sentAt.localeCompare(a.sentAt))
for (const link of levanLinks.slice(0, 6)) link.sentBy = 'stf_levan'
for (const link of links) if (link.staffId !== 'stf_levan' && rng.chance(0.05)) link.sentBy = link.staffId

/* ------------------------------------------------------------ persona links */

const messages = []

const PERSONAS = [
  {
    token: '7KQ2M9', recipientId: 'rcp_mariam', staffId: 'stf_levan', sentAt: ANCHOR - 2 * DAY + 65 * MIN, sentBy: 'stf_levan',
    body: t(
      'Nergi Bank: thank you for visiting our Vake branch today. How did we do? It takes 30 seconds: azri.example/s/7KQ2M9',
      'ნერგი ბანკი: გმადლობთ, რომ დღეს ეწვიეთ ჩვენს ვაკის ფილიალს. გაგვიზიარეთ თქვენი აზრი, ამას 30 წამი სჭირდება: azri.example/s/7KQ2M9',
    ),
  },
  {
    token: 'P8VR3D', recipientId: 'rcp_mariam', staffId: 'stf_elene', sentAt: ANCHOR - 22 * HOUR,
    body: t(
      'Puri da Chai: thanks for dropping by our Vera café today! How was your visit? azri.example/s/P8VR3D',
      'პური და ჩაი: გმადლობთ, რომ დღეს ვერის კაფეში გვესტუმრეთ! როგორი იყო თქვენი ვიზიტი? azri.example/s/P8VR3D',
    ),
  },
  {
    token: 'C4WN8T', recipientId: 'rcp_mariam', staffId: 'stf_davit', sentAt: ANCHOR - 2 * DAY - 5 * HOUR,
    answeredAfter: 40 * MIN,
    answers: { 1201: 5, 1202: 4, 1203: 5 },
    comment: ['ka', 'დავითმა ზუსტად ის ტარიფი შემირჩია, რაც მჭირდებოდა. მადლობა!'],
    body: t(
      'Elva Telecom: thanks for visiting our Didube shop. Tell us how it went in 30 seconds: azri.example/s/C4WN8T',
      'ელვა ტელეკომი: გმადლობთ, რომ ეწვიეთ ჩვენს დიდუბის მაღაზიას. გაგვიზიარეთ თქვენი აზრი 30 წამში: azri.example/s/C4WN8T',
    ),
  },
  {
    token: 'E5SB2K', recipientId: 'rcp_eka', staffId: 'stf_ana', sentAt: ANCHOR - DAY - 3 * HOUR,
    body: t(
      'Nergi Bank: thank you for visiting our Saburtalo branch. How did we do? azri.example/s/E5SB2K',
      'ნერგი ბანკი: გმადლობთ, რომ ეწვიეთ ჩვენს საბურთალოს ფილიალს. როგორ მოგემსახურეთ? azri.example/s/E5SB2K',
    ),
  },
  {
    token: 'B7DG4N', recipientId: 'rcp_eka', staffId: 'stf_sandro', sentAt: ANCHOR - 3 * DAY - 2 * HOUR,
    answeredAfter: 50 * MIN,
    answers: { 1301: 5, 1302: 3, 1303: 4, 1304: 5 },
    comment: ['en', 'Good work on the brakes, but the car was ready two hours later than promised.'],
    body: t(
      'Borbali Auto Service: your car is ready. How did we look after it? azri.example/s/B7DG4N',
      'ბორბალი ავტოსერვისი: თქვენი ავტომობილი მზადაა. შეაფასეთ ჩვენი მომსახურება: azri.example/s/B7DG4N',
    ),
  },
  {
    token: 'K3RC9W', recipientId: 'rcp_giorgi', staffId: 'stf_salome', sentAt: ANCHOR - 3 * HOUR - 40 * MIN,
    body: t(
      'Kalakuri Clinic: thank you for your visit today. Please rate our reception desk: azri.example/s/K3RC9W',
      'ქალაქური კლინიკა: გმადლობთ დღევანდელი ვიზიტისთვის. გთხოვთ, შეაფასოთ რეგისტრატურის მომსახურება: azri.example/s/K3RC9W',
    ),
  },
  {
    token: 'X2HB5R', recipientId: 'rcp_giorgi', staffId: 'stf_ketevan', sentAt: ANCHOR - 9 * DAY - HOUR,
    body: t(
      'Nergi Bank: thank you for visiting our Old Boulevard branch in Batumi. How did we do? azri.example/s/X2HB5R',
      'ნერგი ბანკი: გმადლობთ, რომ ეწვიეთ ჩვენს ფილიალს ბათუმში, ძველ ბულვარზე. როგორ მოგემსახურეთ? azri.example/s/X2HB5R',
    ),
  },
  {
    token: 'T6CC2H', recipientId: 'rcp_irakli', staffId: 'stf_natia', sentAt: ANCHOR - DAY - 6 * HOUR,
    answeredAfter: 25 * MIN,
    answers: { 1211: 4, 1212: 2, 1213: 5 },
    comment: ['ka', 'ოპერატორი ძალიან თავაზიანი იყო, მაგრამ ხაზზე 15 წუთს ველოდებოდი.'],
    body: t(
      'Elva Telecom: thank you for calling us today. How did our operator do? azri.example/s/T6CC2H',
      'ელვა ტელეკომი: გმადლობთ დღევანდელი ზარისთვის. შეაფასეთ ოპერატორის მომსახურება: azri.example/s/T6CC2H',
    ),
  },
  {
    token: 'R9BD5M', recipientId: 'rcp_irakli', staffId: 'stf_sandro', sentAt: ANCHOR - 5 * HOUR,
    body: t(
      'Borbali Auto Service: your car is ready for collection in Digomi. How did we do? azri.example/s/R9BD5M',
      'ბორბალი ავტოსერვისი: თქვენი ავტომობილი დიღმის სახელოსნოში მზადაა. როგორ მოგემსახურეთ? azri.example/s/R9BD5M',
    ),
  },
  {
    token: 'S2PK8Q', recipientId: 'rcp_tamar', staffId: 'stf_beka', sentAt: ANCHOR - 50 * MIN,
    body: t(
      'Puri da Chai: thanks for visiting us in Sololaki! How was it? It takes 30 seconds: azri.example/s/S2PK8Q',
      'პური და ჩაი: გმადლობთ, რომ სოლოლაკში გვესტუმრეთ! გაგვიზიარეთ თქვენი აზრი: azri.example/s/S2PK8Q',
    ),
  },
  {
    token: 'H4KX7Z', recipientId: 'rcp_tamar', staffId: 'stf_maka', sentAt: ANCHOR - 11 * DAY - 2 * HOUR,
    body: t(
      'Kalakuri Clinic: thank you for visiting us. How was your check-in? azri.example/s/H4KX7Z',
      'ქალაქური კლინიკა: გმადლობთ ვიზიტისთვის. როგორ შეაფასებდით რეგისტრაციას? azri.example/s/H4KX7Z',
    ),
  },
]

for (const p of PERSONAS) {
  const person = staffById[p.staffId]
  const campaign = campaignById[CAMPAIGN_OF_BRANCH[person.branchId]]
  const expiresAt = p.sentAt + campaign.linkTtlDays * DAY
  const link = {
    id: p.token,
    campaignId: campaign.id,
    tenantId: person.tenantId,
    branchId: person.branchId,
    staffId: p.staffId,
    recipientId: p.recipientId,
    phoneMasked: recipientById[p.recipientId].phoneMasked,
    interactionAt: iso(p.sentAt - 12 * MIN),
    sentAt: iso(p.sentAt),
    expiresAt: iso(expiresAt),
    status: p.answers ? 'completed' : expiresAt <= ANCHOR ? 'expired' : 'pending',
    completedAt: p.answers ? iso(p.sentAt + p.answeredAfter) : null,
    responseId: null,
    sentBy: p.sentBy ?? 'system',
  }
  links.push(link)
  if (p.answers) {
    responses.push({
      id: null,
      surveyId: p.token,
      campaignId: campaign.id,
      tenantId: person.tenantId,
      branchId: person.branchId,
      staffId: p.staffId,
      answers: questionIdsOf(campaign.id).map((id) => ({ id, question_rate: p.answers[id] ?? null })),
      comment: p.comment[1],
      commentLang: p.comment[0],
      submittedAt: link.completedAt,
      source: 'seed',
    })
  }
  messages.push({
    recipientId: p.recipientId,
    tenantId: person.tenantId,
    sender: tenantById[person.tenantId].smsSender,
    body: p.body,
    shortLink: `azri.example/s/${p.token}`,
    href: `/?id=${p.token}`,
    surveyId: p.token,
    kind: 'survey',
    receivedAt: iso(p.sentAt),
  })
}

// Luka's two broken links: a token the CRM never issued, and a link with no id.
messages.push({
  recipientId: 'rcp_luka',
  tenantId: 't_elva',
  sender: 'ELVA',
  body: t(
    `Elva Telecom: thank you for contacting us. Rate our service: azri.example/s/${UNKNOWN_TOKEN}`,
    `ელვა ტელეკომი: გმადლობთ, რომ დაგვიკავშირდით. შეაფასეთ ჩვენი მომსახურება: azri.example/s/${UNKNOWN_TOKEN}`,
  ),
  shortLink: `azri.example/s/${UNKNOWN_TOKEN}`,
  href: `/?id=${UNKNOWN_TOKEN}`,
  surveyId: UNKNOWN_TOKEN,
  kind: 'unknown',
  receivedAt: iso(ANCHOR - DAY - HOUR),
})
messages.push({
  recipientId: 'rcp_luka',
  tenantId: 't_nergi',
  sender: 'NERGIBANK',
  body: t(
    'Nergi Bank: thank you for visiting our Vake branch. Share your opinion: azri.example/s/',
    'ნერგი ბანკი: გმადლობთ, რომ ეწვიეთ ჩვენს ვაკის ფილიალს. გაგვიზიარეთ თქვენი აზრი: azri.example/s/',
  ),
  shortLink: 'azri.example/s/',
  href: '/survey',
  surveyId: null,
  kind: 'missing',
  receivedAt: iso(ANCHOR - 2 * DAY - 6 * HOUR),
})

/* --------------------------------------------------------- ids and ordering */

responses.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
const linkByToken = Object.fromEntries(links.map((l) => [l.id, l]))
responses.forEach((response, index) => {
  response.id = `rsp_${1001 + index}`
  linkByToken[response.surveyId].responseId = response.id
})
responses.reverse()

messages.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt))
const messagesOut = messages.map((m, index) => ({ id: `sms_${101 + index}`, ...m })).reverse()

links.sort((a, b) => b.sentAt.localeCompare(a.sentAt))

/* ------------------------------------------------------------------ checks */

const fail = (message) => {
  throw new Error(`generate-seed: ${message}`)
}
for (const l of links) {
  if (Date.parse(l.sentAt) >= ANCHOR) fail(`link ${l.id} sent after the anchor`)
  if (l.status === 'completed' && !l.responseId) fail(`completed link ${l.id} has no response`)
  if (l.status !== 'completed' && l.responseId) fail(`link ${l.id} has a response but is ${l.status}`)
  if (l.status === 'pending' && Date.parse(l.expiresAt) <= ANCHOR) fail(`pending link ${l.id} already expired`)
}
for (const r of responses) if (Date.parse(r.submittedAt) >= ANCHOR) fail(`response ${r.id} after the anchor`)
if (new Set(links.map((l) => l.id)).size !== links.length) fail('duplicate tokens')
if (linkByToken[UNKNOWN_TOKEN]) fail('the unknown token must not be in the store')

/* ------------------------------------------------------------------ output */

const write = (name, data) => writeFileSync(join(outDir, name), `${JSON.stringify(data, null, 2)}\n`)
write('catalog.json', { tenants, branches, staff, campaigns, questions, recipients })
write('history.json', { links, messages: messagesOut, responses })
write('comments.json', commentPools)

/* ------------------------------------------------------------------- stats */

const rates = responses.flatMap((r) => r.answers.map((a) => a.question_rate)).filter((x) => x !== null)
const meanOf = (xs) => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(2) : '-')
const byStatus = links.reduce((acc, l) => ({ ...acc, [l.status]: (acc[l.status] ?? 0) + 1 }), {})
const qMean = (qid, branchId) =>
  meanOf(
    responses
      .filter((r) => !branchId || r.branchId === branchId)
      .flatMap((r) => r.answers.filter((a) => a.id === qid && a.question_rate !== null).map((a) => a.question_rate)),
  )
const todayStart = tbilisiMidnight(0)
const commented = responses.filter((r) => r.comment)
const staffStats = staff.map((s) => {
  const rs = responses.filter((r) => r.staffId === s.id)
  return `${s.id}:${rs.length}/${meanOf(rs.flatMap((r) => r.answers.map((a) => a.question_rate)).filter((x) => x !== null))}`
})
console.log(
  JSON.stringify(
    {
      links: links.length,
      byStatus,
      background: links.filter((l) => !l.recipientId).length,
      backgroundPending: links.filter((l) => !l.recipientId && l.status === 'pending').length,
      responses: responses.length,
      mean: meanOf(rates),
      skippedShare: (responses.flatMap((r) => r.answers).filter((a) => a.question_rate === null).length / responses.flatMap((r) => r.answers).length).toFixed(2),
      comments: commented.length,
      commentsKa: commented.filter((r) => r.commentLang === 'ka').length,
      today: responses.filter((r) => Date.parse(r.submittedAt) >= todayStart).length,
      isani1202: qMean(1202, 'br_elva_isani'),
      kalakuri1403: qMean(1403),
      manualSends: links.filter((l) => l.sentBy !== 'system').length,
      staff: staffStats.join(' '),
      messages: messagesOut.length,
    },
    null,
    1,
  ),
)
