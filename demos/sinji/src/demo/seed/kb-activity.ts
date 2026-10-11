/**
 * KB activity log (derived from the documents + a few authored maintenance
 * events) and the Mtiebi curation queue (7 proposals mined from failures).
 */
import type { CurationProposal, Id, KbChunk, KbDocument, KbEvent } from '@/types'
import { after, ago } from './build'

const METHOD: Record<KbDocument['source_type'], string> = { file: 'file', paste: 'paste', csv: 'csv', api: 'api' }

interface ExtraEvent {
  doc: Id | null
  title?: string
  action: KbEvent['action']
  days: number
  hours?: number
  detail: string
  actor?: string
  method?: string | null
  status?: KbEvent['status']
  chunks?: number | null
  ms?: number | null
}

const MTIEBI_EXTRA: ExtraEvent[] = [
  { doc: 'doc_mtb_cards', action: 'edit', days: 18, detail: 'Content updated: Gold card annual fee paragraph', chunks: 5, ms: 2140 },
  { doc: 'doc_mtb_transfers', action: 'edit', days: 22, detail: 'Content updated: SWIFT cut-off time', chunks: 5, ms: 1980 },
  { doc: 'doc_mtb_deposits', action: 'edit', days: 20, detail: 'Content updated: 2026 deposit rates', chunks: 5, ms: 2050 },
  { doc: 'doc_mtb_branches_hours', action: 'edit', days: 6, detail: 'Content updated: Sunday opening hours', chunks: 3, ms: 1210 },
  { doc: 'doc_mtb_loans', action: 'edit', days: 31, detail: 'Tags changed: +ტარიფები', chunks: null, ms: 80 },
  { doc: 'doc_mtb_faq', action: 'edit', days: 9, detail: 'CSV re-imported: 30 rows', method: 'csv', chunks: 6, ms: 3320 },
  { doc: 'doc_mtb_mobile_app', action: 'reembed', days: 12, detail: 'Re-embedded 4 chunks', chunks: 4, ms: 1640 },
  { doc: 'doc_mtb_faq', action: 'chunk_edit', days: 9, hours: -1, detail: 'Chunk 3 edited: early repayment answer clarified', chunks: 1, ms: 420 },
  { doc: 'doc_mtb_glossary', action: 'chunk_delete', days: 24, detail: 'Chunk 4 deleted: duplicate SWIFT definition', chunks: 1, ms: 95 },
  { doc: null, action: 'bulk', days: 14, detail: 'Bulk retag: 3 documents +ტარიფები', chunks: null, ms: 310 },
  { doc: null, action: 'export', days: 7, detail: 'Exported 14 documents as JSON', method: 'json', chunks: null, ms: 260, actor: 'Nino Kurtanidze' },
  { doc: null, action: 'export', days: 26, detail: 'Exported 12 documents as CSV', method: 'csv', chunks: null, ms: 240 },
  { doc: 'doc_mtb_tariffs_2024', title: 'ტარიფები 2024 (დუბლიკატი)', action: 'delete', days: 33, detail: 'Document deleted with 6 chunks', chunks: 6, ms: 130 },
  { doc: 'doc_mtb_complaints', action: 'curation', days: 5, detail: 'Curation proposal accepted: early-repayment choice after a partial repayment', actor: 'Tamar Gelashvili', chunks: 3, ms: 1100 },
  { doc: null, action: 'reembed', days: 44, detail: 'Full re-embed: 13 of 14 documents (1 failed: no text)', status: 'error', chunks: 58, ms: 41_200, actor: 'Levan Kipiani' },
]

/** Activity log for every workspace: one import per document + authored maintenance events (Mtiebi). */
export function buildKbEvents(documents: readonly KbDocument[]): KbEvent[] {
  const events: Omit<KbEvent, 'id'>[] = documents.map((d) => ({
    client_id: d.client_id,
    document_id: d.id,
    document_title: d.title,
    action: 'import',
    method: METHOD[d.source_type],
    status: d.status === 'error' ? 'error' : 'ok',
    detail:
      d.status === 'error'
        ? `Import failed: ${d.filename ?? 'pasted text'} - ${d.error ?? 'unknown error'}`
        : `Imported ${d.filename ?? 'pasted text'} (${d.chunk_count} chunks)`,
    actor: d.actor,
    chunk_count: d.status === 'error' ? 0 : d.chunk_count,
    duration_ms: d.ingest_ms ?? 1800,
    created_at: d.created_at,
  }))
  const titleOf = (id: Id | null) => documents.find((d) => d.id === id)?.title ?? null
  for (const e of MTIEBI_EXTRA) {
    events.push({
      client_id: 'tn_mtiebi',
      document_id: e.doc,
      document_title: e.title ?? titleOf(e.doc),
      action: e.action,
      method: e.method ?? null,
      status: e.status ?? 'ok',
      detail: e.detail,
      actor: e.actor ?? 'Tamar Gelashvili',
      chunk_count: e.chunks ?? null,
      duration_ms: e.ms ?? null,
      created_at: ago(e.days, e.hours ?? 0),
    })
  }
  events.sort((a, b) => b.created_at.localeCompare(a.created_at))
  const counters: Record<string, number> = {}
  return events.map((e) => {
    const n = (counters[e.client_id] = (counters[e.client_id] ?? 0) + 1)
    return { id: `kbe_${e.client_id.replace(/^tn_/, '')}_${String(n).padStart(3, '0')}`, ...e }
  })
}

/* ------------------------------------------------------------- curation */

type Lookup = (id: Id) => { chunk: KbChunk; doc: KbDocument } | undefined

const target = (lookup: Lookup, chunkId: Id): CurationProposal['target'] => {
  const ref = lookup(chunkId)
  if (!ref) throw new Error(`seed: curation target ${chunkId} missing`)
  return { document_id: ref.doc.id, title: ref.doc.title, content: ref.chunk.content }
}

export function buildCuration(lookup: Lookup): CurationProposal[] {
  const base = {
    client_id: 'tn_mtiebi',
    apply_error: null,
    decline_reason: null,
    decided_at: null,
    decided_by: null,
  }
  return [
    {
      ...base,
      id: 'cur_mtb_01',
      op: 'update',
      state: 'pending',
      signal: 'S3',
      cluster: 'ვადამდელი დაფარვის საკომისიო',
      title: 'ვადამდელი დაფარვის პირობის დაზუსტება მაგალითით',
      title_en: 'Make the early-repayment condition explicit, with an example',
      proposed_content:
        'ვადამდელი დაფარვა: სესხის აღებიდან პირველი 12 თვის განმავლობაში ნაწილობრივი ან სრული ვადამდელი დაფარვისას ბანკი იღებს საკომისიოს დაფარული თანხის 1%-ის ოდენობით. მაგალითი: 8 თვის წინ აღებულ სესხზე 5 000 ლარის დაფარვისას საკომისიო 50 ლარია. 12 თვის შემდეგ ვადამდელი დაფარვა უფასოა (0%). ოპერატორი ვალდებულია ეს პირობა გააჟღეროს ყოველთვის, როცა მომხმარებელი ვადამდელ დაფარვაზე კითხულობს.',
      rationale:
        'ოპერატორებმა ორ ზარში ვადამდელი დაფარვა „ნებისმიერ დროს უფასოდ“ დაასახელეს. მიმდინარე ფორმულირებაში 12-თვიანი ზღვარი ადვილად შეუმჩნეველია; მაგალითი გაამარტივებს სწორ პასუხს.',
      rationale_en:
        'Agents described early repayment as "free at any time" on two calls. The 12-month threshold is easy to miss in the current wording; a worked example makes the right answer obvious.',
      target: target(lookup, 'chk_mtb_loans_1'),
      suggested_tags: ['სესხები', 'ტარიფები'],
      occurrences: 4,
      distinct_sources: 3,
      confidence: 0.91,
      priority: 'high',
      risk: 'medium',
      evidence: [
        { channel: 'call', locale: 'ka', occurred_at: ago(2, 1), source_kind: 'factcheck_contradiction',
          question: 'ხუთი ათასის ვადამდე დაფარვისას რამეს გადავიხდი?', answer: 'არა, ვადამდელი დაფარვა ნებისმიერ დროს სრულიად უფასოა.' },
        { channel: 'web', locale: 'ka', occurred_at: ago(6, 3), source_kind: 'operator_rewrite',
          question: 'სესხის ვადამდე დაფარვა რა ღირს?', answer: 'პირველ 12 თვეში 1%, შემდეგ უფასოდ - მაგალითად 5 000 ლარზე 50 ლარი.' },
        { channel: 'whatsapp', locale: 'ka', occurred_at: ago(11, 5), source_kind: 'weak_retrieval',
          question: 'ნახევარი წლის წინ ავიღე სესხი, დავფარო თუ დაველოდო?', answer: 'ბოტმა სანდო პასუხი ვერ იპოვა (top 0.41) და გადაამისამართა.' },
      ],
      created_at: ago(1, 20),
    },
    {
      ...base,
      id: 'cur_mtb_02',
      op: 'update',
      state: 'pending',
      signal: 'S3',
      cluster: 'ოქროს ბარათის საფასური',
      title: 'ოქროს ბარათი: „პირველი წელი უფასო არ არის“ - პირველ წინადადებაში',
      title_en: 'Gold card: put "the first year is not free" in the first sentence',
      proposed_content:
        'ოქროს ბარათი: წლიური მომსახურების საფასური 60 ლარი ჩამოიჭრება ბარათის გააქტიურებისთანავე - პირველი წლის უფასო მომსახურება მხოლოდ კლასიკურ ბარათზე ვრცელდება. ოქროს ბარათი მოიცავს სამოგზაურო დაზღვევას და ბიზნეს-მოსაცდელში ორ უფასო ვიზიტს წელიწადში.',
      rationale:
        'ოპერატორმა ოქროს ბარათზე პირველი წელი უფასოდ დაასახელა და თანხის დაბრუნება დაჰპირდა. ფილიალშიც იგივე უთხრეს მომხმარებელს. შეღავათის პირობა ჩანს მხოლოდ მეორე წინადადებაში.',
      rationale_en:
        'An agent said the Gold card\'s first year is free and promised a refund; the branch told the customer the same. The exception only appears in the second sentence today.',
      target: target(lookup, 'chk_mtb_cards_1'),
      suggested_tags: ['ბარათები', 'ტარიფები'],
      occurrences: 3,
      distinct_sources: 2,
      confidence: 0.87,
      priority: 'high',
      risk: 'low',
      evidence: [
        { channel: 'call', locale: 'ka', occurred_at: ago(4, 2), source_kind: 'factcheck_contradiction',
          question: 'ფილიალში მითხრეს, რომ პირველი წელი უფასოა!', answer: 'დიახ, ოქროს ბარათზეც პირველი წელი უფასოა.' },
        { channel: 'whatsapp', locale: 'ka', occurred_at: ago(0, 5), source_kind: 'operator_answer',
          question: 'ოქროს ბარათზე პირველი წელი უფასოა?', answer: 'არა: ოქროს ბარათის წლიური საფასური 60 ლარია და შეღავათი მასზე არ ვრცელდება.' },
      ],
      created_at: ago(3, 8),
    },
    {
      ...base,
      id: 'cur_mtb_03',
      op: 'update',
      state: 'pending',
      signal: 'S1',
      cluster: 'SWIFT შუამავალი ბანკები',
      title: 'SWIFT: შუამავალი ბანკების საკომისიოს ახსნა',
      title_en: 'SWIFT: explain intermediary-bank fees',
      proposed_content:
        'საერთაშორისო გადარიცხვა (SWIFT): საკომისიო 0.2% თანხიდან, მინიმუმ 15 ლარი, მაქსიმუმ 150 ლარი. თანხა ადრესატის ბანკში ჩვეულებრივ აისახება 1-3 სამუშაო დღეში. შუამავალმა ბანკებმა შესაძლოა დამატებით დააკავონ საკომისიო (ჩვეულებრივ 10-40 ევრო), რომელიც წინასწარ არ არის ცნობილი. ოპერატორი ამის შესახებ მომხმარებელს წინასწარ აფრთხილებს.',
      rationale:
        'მომხმარებლები ხშირად კითხულობენ, რატომ მივიდა ადრესატთან ნაკლები თანხა. ოპერატორების პასუხები განსხვავდება; ცოდნის ბაზა არ ავალდებულებს წინასწარ გაფრთხილებას.',
      rationale_en:
        'Customers often ask why less money arrived. Agents answer inconsistently, and the knowledge base does not require a warning up front.',
      target: target(lookup, 'chk_mtb_transfers_2'),
      suggested_tags: ['გადარიცხვები'],
      occurrences: 5,
      distinct_sources: 4,
      confidence: 0.78,
      priority: 'medium',
      risk: 'medium',
      evidence: [
        { channel: 'call', locale: 'ka', occurred_at: ago(9, 4), source_kind: 'operator_answer',
          question: 'რატომ მივიდა შვილთან ას ოცი ევროთი ნაკლები?', answer: 'ეგ შუამავალმა ბანკებმა დააკავეს, ჩვენ ამას ვერ ვაკონტროლებთ.' },
        { channel: 'web', locale: 'ka', occurred_at: ago(13, 1), source_kind: 'weak_retrieval',
          question: 'SWIFT-ით გაგზავნილს რამდენი ჩამოეჭრება მიმღებს?', answer: 'ბოტმა ნაწილობრივი პასუხი გასცა (top 0.52).' },
        { channel: 'instagram', locale: 'ka', occurred_at: ago(17, 6), source_kind: 'operator_rewrite',
          question: 'ევროში გადარიცხვაზე დამატებით რამე ჩამოიჭრება?', answer: 'შესაძლოა შუამავალმა ბანკმა 10-40 ევრო დააკავოს.' },
      ],
      created_at: ago(8, 2),
    },
    {
      ...base,
      id: 'cur_mtb_04',
      op: 'add',
      state: 'pending',
      signal: 'S4',
      cluster: 'ანაბრების აქცია',
      title: 'ახალი: საშემოდგომო აქცია ანაბრებზე (+0.5%) - დასადასტურებელი',
      title_en: 'New: autumn deposit promotion (+0.5%) - needs confirmation',
      proposed_content:
        'საშემოდგომო აქცია: ახლად გახსნილ შემნახველ ანაბრებზე განაკვეთს ემატება 0.5 პროცენტული პუნქტი. აქციის ვადა და პირობები: [დაადასტურეთ პროდუქტის გუნდთან].',
      rationale:
        'ოპერატორმა ზარზე აქცია დაასახელა, ცოდნის ბაზაში კი ის არ არის. თუ აქცია რეალურია, საჭიროა დოკუმენტი; თუ არა - ოპერატორის მწვრთნელობა.',
      rationale_en:
        'An agent quoted this promotion on a call, but it is not in the knowledge base. If it is real it needs a document; if not, it is a coaching point.',
      target: null,
      suggested_tags: ['ანაბრები', 'აქციები'],
      occurrences: 2,
      distinct_sources: 2,
      confidence: 0.58,
      priority: 'medium',
      risk: 'high',
      evidence: [
        { channel: 'call', locale: 'ka', occurred_at: ago(6, 5), source_kind: 'factcheck_not_in_kb',
          question: 'უფრო მაღალი განაკვეთი არ გაქვთ?', answer: 'ახლა საშემოდგომო აქციაც გვაქვს: ახალ ანაბრებზე დამატებით ნახევარი პროცენტი ემატება.' },
        { channel: 'messenger', locale: 'ka', occurred_at: ago(10, 2), source_kind: 'bot_refusal',
          question: 'აქცია გაქვთ ანაბრებზე?', answer: 'ბოტმა უარი თქვა: ცოდნის ბაზაში ინფორმაცია არ მოიძებნა.' },
      ],
      created_at: ago(5, 9),
    },
    {
      ...base,
      id: 'cur_mtb_05',
      op: 'add',
      state: 'declined',
      signal: 'S2',
      cluster: 'ლიმიტის ცვლილების დრო',
      title: 'ახალი: ბარათის ლიმიტის ცვლილება მოქმედებს მყისიერად',
      title_en: 'New: card limit changes take effect immediately',
      proposed_content: 'ბარათის ლიმიტის დროებითი ცვლილება ძალაში შედის მყისიერად, დადასტურებისთანავე.',
      rationale: 'მომხმარებლები კითხულობენ, როდის ამოქმედდება ლიმიტის ცვლილება; ოპერატორები „მაშინვე“ პასუხობენ.',
      rationale_en: 'Customers ask when a limit change takes effect; agents answer "immediately".',
      target: null,
      suggested_tags: ['ბარათები'],
      occurrences: 2,
      distinct_sources: 2,
      confidence: 0.52,
      priority: 'low',
      risk: 'medium',
      decline_reason: 'დამოკიდებულია პროცესინგის სისტემაზე და ზოგჯერ 15 წუთამდე გრძელდება - ასეთ დაპირებას არ ვაძლევთ.',
      decided_at: ago(3, 1),
      decided_by: 'Tamar Gelashvili',
      evidence: [
        { channel: 'call', locale: 'ka', occurred_at: ago(1, 4), source_kind: 'factcheck_not_in_kb',
          question: 'ახლავე ამოქმედდება?', answer: 'დიახ, ცვლილება მაშინვე ამოქმედდება.' },
        { channel: 'web', locale: 'ka', occurred_at: ago(15, 2), source_kind: 'weak_retrieval',
          question: 'ლიმიტი გავზარდე და მაინც არ მიშვებს', answer: 'ბოტმა სანდო პასუხი ვერ იპოვა (top 0.38).' },
      ],
      created_at: ago(4, 6),
    },
    {
      ...base,
      id: 'cur_mtb_06',
      op: 'add',
      state: 'accepted',
      signal: 'S4',
      cluster: 'ნაწილობრივი დაფარვის შემდეგ',
      title: 'ახალი: ნაწილობრივი დაფარვის შემდეგ - შენატანი თუ ვადა',
      title_en: 'New: after a partial repayment - lower payment or shorter term',
      proposed_content:
        'ნაწილობრივი ვადამდელი დაფარვის შემდეგ მომხმარებელი ირჩევს: შეამციროს ყოველთვიური შენატანი იმავე ვადით, ან შეამოკლოს ვადა იმავე შენატანით. არჩევანი კეთდება აპლიკაციაში დაფარვის დადასტურებისას.',
      rationale: 'ზარებზე ეს კითხვა ხშირია, ცოდნის ბაზაში კი პასუხი არ იყო.',
      rationale_en: 'A frequent question on calls with no answer in the knowledge base.',
      target: null,
      suggested_tags: ['სესხები'],
      occurrences: 3,
      distinct_sources: 3,
      confidence: 0.83,
      priority: 'medium',
      risk: 'low',
      decided_at: ago(5),
      decided_by: 'Tamar Gelashvili',
      evidence: [
        { channel: 'call', locale: 'ka', occurred_at: ago(2, 1), source_kind: 'factcheck_not_in_kb',
          question: 'დაფარვის მერე ყოველთვიური შენატანი შემიმცირდება თუ ვადა?', answer: 'თქვენ ირჩევთ: შეგიძლიათ შენატანი შეამციროთ ან ვადა შეამოკლოთ.' },
        { channel: 'web', locale: 'ka', occurred_at: ago(12, 3), source_kind: 'operator_answer',
          question: 'ნაწილი რომ დავფარო, გრაფიკი შეიცვლება?', answer: 'დიახ, აირჩევთ შენატანის შემცირებას ან ვადის შემოკლებას.' },
      ],
      created_at: ago(7, 4),
    },
    {
      ...base,
      id: 'cur_mtb_07',
      op: 'remove',
      state: 'pending',
      signal: 'S6',
      cluster: 'მოძველებული FAQ',
      title: 'წაშლა: ძველი FAQ (მოძველებული ტარიფები)',
      title_en: 'Remove: old FAQ (outdated fees)',
      proposed_content: '',
      rationale:
        'ძველი FAQ ახალის თითქმის დუბლიკატია, მაგრამ შეიცავს მოძველებულ ტარიფებს (გადარიცხვა 0.70 ლარი, იპოთეკა 10%-დან). ძიებისას ის ზოგჯერ ახალ FAQ-ზე მაღლა ხვდება.',
      rationale_en:
        'The old FAQ nearly duplicates the current one but carries outdated fees (transfers 0.70 GEL, mortgage from 10%). Retrieval sometimes ranks it above the current FAQ.',
      target: target(lookup, 'chk_mtb_faq_old_1'),
      suggested_tags: [],
      occurrences: 6,
      distinct_sources: 3,
      confidence: 0.89,
      priority: 'medium',
      risk: 'low',
      evidence: [
        { channel: 'web', locale: 'ka', occurred_at: ago(3, 7), source_kind: 'weak_retrieval',
          question: 'სხვა ბანკში გადარიცხვა რა ღირს?', answer: 'ტოპ შედეგებში ორი ურთიერთგამომრიცხავი პასუხი: 0.50 და 0.70 ლარი.' },
        { channel: 'web', locale: 'ka', occurred_at: ago(9, 2), source_kind: 'operator_rewrite',
          question: 'იპოთეკის განაკვეთი?', answer: 'ოპერატორმა ასწორა 10% → 9.5%.' },
      ],
      created_at: ago(2, 3),
    },
  ].map((p) => ({ ...p, created_at: p.created_at, ...(p.decided_at ? { decided_at: after(p.decided_at, 0) } : {}) })) as CurationProposal[]
}
