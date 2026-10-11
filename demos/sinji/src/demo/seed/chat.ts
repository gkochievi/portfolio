/**
 * Bot / copilot conversations (20, over the last 30 days) with their turns and
 * the operator feedback on copilot drafts. Grounded answers cite real chunks of
 * the workspace knowledge base (resolved through `lookup`).
 */
import type { Channel, ChatConversation, ChatTurn, Citation, ContentLang, CopilotFeedback, Id, KbChunk, KbDocument } from '@/types'
import { after, ago } from './build'
import { estimateTokens, snippetFor } from '../lib/text'

type Lookup = (id: Id) => { chunk: KbChunk; doc: KbDocument } | undefined

interface TurnSpec {
  r: ChatTurn['role']
  t: string
  cite?: string[]
  score?: number
  kind?: 'answer' | 'refusal' | 'canned' | 'plain'
  /** Operator turn: what the operator did with the copilot draft. */
  fb?: CopilotFeedback['action']
}

/** Customer message. */
const c = (t: string): TurnSpec => ({ r: 'customer', t })
/** Grounded bot answer with citations. */
const a = (t: string, cite: string[], score = 0.82): TurnSpec => ({ r: 'bot', t, cite, score, kind: 'answer' })
/** Refusal: nothing grounded, zero tokens. */
const x = (t: string, score = 0.21): TurnSpec => ({ r: 'bot', t, score, kind: 'refusal' })
/** Canned reply (hotline, thanks, hand-off notice), zero tokens. */
const n = (t: string): TurnSpec => ({ r: 'bot', t, kind: 'canned' })
/** Operator message, optionally built from a grounded copilot draft. */
const o = (t: string, cite: string[] = [], fb?: CopilotFeedback['action'], score = 0.84): TurnSpec => ({
  r: 'operator',
  t,
  cite,
  score,
  kind: cite.length ? 'answer' : 'plain',
  ...(fb ? { fb } : {}),
})

interface ConvSpec {
  id: Id
  client: Id
  channel: Channel
  locale: ContentLang
  mode: ChatConversation['mode']
  state: ChatConversation['state']
  subject: string
  days: number
  hours: number
  offTopic?: number
  turns: TurnSpec[]
}

const CONVERSATIONS: ConvSpec[] = [
  /* ------------------------------------------------------- Mtiebi Bank */
  {
    id: 'cnv_mtb_01',
    client: 'tn_mtiebi',
    channel: 'web',
    locale: 'ka',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Gold card annual fee',
    days: 1,
    hours: 3,
    turns: [
      c('გამარჯობა, რა ღირს ოქროს ბარათი წელიწადში?'),
      a(
        'გამარჯობა! ოქროს ბარათის წლიური მომსახურების საფასური 60 ლარია [1]. ყურადღება: პირველი წლის უფასო მომსახურება ოქროს ბარათზე არ ვრცელდება; კლასიკური ბარათის საფასური კი 12 ლარია და პირველი წელი უფასოა [2].',
        ['chk_mtb_cards_1', 'chk_mtb_cards_0'],
        0.91,
      ),
      c('გასაგებია, მადლობა.'),
      n('გთხოვთ! თუ კიდევ რამე გაინტერესებთ, სიამოვნებით დაგეხმარებით.'),
    ],
  },
  {
    id: 'cnv_mtb_02',
    client: 'tn_mtiebi',
    channel: 'web',
    locale: 'ka',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Early repayment fee, written confirmation',
    days: 2,
    hours: 6,
    turns: [
      c('სესხის ნაწილობრივ ვადამდე დაფარვა მინდა. საკომისიო თუ იქნება?'),
      a(
        'სესხის ვადამდე დაფარვისას პირველი 12 თვის განმავლობაში ბანკი იღებს დაფარული თანხის 1%-ს; 12 თვის შემდეგ საკომისიო არ გამოიყენება [1].',
        ['chk_mtb_loans_1'],
        0.9,
      ),
      c('ჩემი სესხი 8 თვისაა. გარანტიას მაძლევთ, რომ 5000 ლარის დაფარვაზე მხოლოდ 50 ლარი ჩამოიჭრება? წერილობით დამიდასტურეთ.'),
      n('წერილობითი დადასტურებისა და კონკრეტული თანხის გარანტიისთვის გადაგაწვდით ოპერატორს. ის რამდენიმე წუთში შეგიერთდებათ.'),
      o(
        'გამარჯობა, საბა ვარ მთიები ბანკიდან. 8 თვის სესხზე 5 000 ლარის დაფარვისას საკომისიო 1%-ია, ანუ 50 ლარი [1]. წერილობით დადასტურებას ახლავე გამოგიგზავნით ელფოსტით.',
        ['chk_mtb_loans_1'],
        'inserted',
      ),
      c('კარგი, მადლობა.'),
      o('გთხოვთ! წერილს ათ წუთში მიიღებთ.'),
    ],
  },
  {
    id: 'cnv_mtb_03',
    client: 'tn_mtiebi',
    channel: 'instagram',
    locale: 'ka',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Hotline number and branch hours',
    days: 4,
    hours: 2,
    turns: [
      c('ცხელი ხაზის ნომერი მომწერეთ'),
      n('ცხელი ხაზი *7070 მუშაობს 24/7.'),
      c('და ფილიალები შაბათს მუშაობენ?'),
      a(
        'დიახ, ფილიალები შაბათს 10:00-დან 15:00-მდე მუშაობს. კვირას ღიაა მხოლოდ ორი ცენტრალური ფილიალი [1].',
        ['chk_mtb_branches_hours_0'],
        0.88,
      ),
    ],
  },
  {
    id: 'cnv_mtb_04',
    client: 'tn_mtiebi',
    channel: 'messenger',
    locale: 'ka',
    mode: 'autopilot',
    state: 'open',
    subject: 'Off-topic: crypto rates',
    days: 5,
    hours: 7,
    offTopic: 2,
    turns: [
      c('ბიტკოინის კურსი რამდენია დღეს?'),
      x('ამ საკითხზე ინფორმაცია არ მაქვს: ვპასუხობ მხოლოდ მთიები ბანკის პროდუქტებსა და მომსახურებაზე. ბარათებზე, გადარიცხვებზე, სესხებსა და ანაბრებზე სიამოვნებით დაგეხმარებით.'),
      c('და ეთერიუმის?'),
      x('ვწუხვარ, ამაზეც ვერ გიპასუხებთ. თუ ბარათის ან გადარიცხვის შესახებ გაქვთ კითხვა, მომწერეთ.'),
    ],
  },
  {
    id: 'cnv_mtb_05',
    client: 'tn_mtiebi',
    channel: 'web',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Lost card, block and reissue',
    days: 3,
    hours: 4,
    turns: [
      c('ბარათი დამეკარგა, რა ვქნა?'),
      o(
        'გამარჯობა, საბა ვარ. დაუყოვნებლივ დაბლოკეთ ბარათი: აპლიკაციაში (ბარათები → დაბლოკვა) ან ცხელ ხაზზე *7070, 24/7 [1].',
        ['chk_mtb_card_security_0'],
        'inserted',
        0.91,
      ),
      c('დავბლოკე. ახალი რა ღირს და რამდენ ხანში იქნება მზად?'),
      o('ბარათის ხელახალი გამოშვება ღირს 10 ლარი და მზადდება 3 სამუშაო დღეში [1].', ['chk_mtb_cards_2'], 'edited', 0.87),
      c('სახლში მოიტანენ?'),
      o('დიახ: თბილისში მიწოდება უფასოა, რეგიონებში — 5 ლარი [1].', ['chk_mtb_cards_3'], 'inserted', 0.9),
      c('მადლობა!'),
      o('გთხოვთ, წარმატებები!'),
    ],
  },
  {
    id: 'cnv_mtb_06',
    client: 'tn_mtiebi',
    channel: 'whatsapp',
    locale: 'en',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Mortgage for foreign citizens',
    days: 8,
    hours: 5,
    turns: [
      c('Hi, can a foreign citizen get a mortgage with you?'),
      o(
        'Hello, this is Saba from Mtiebi Bank. Yes, foreign citizens can take a mortgage as long as they have a confirmed income in Georgia [1].',
        ['chk_mtb_faq_3'],
        'edited',
        0.79,
      ),
      c("What's the rate and the down payment?"),
      o('Rates start from 9.5% in GEL, the down payment is at least 20% of the property value and the term is up to 20 years [1].', ['chk_mtb_mortgage_0'], 'inserted', 0.9),
      c('How fast can I get a pre-approval?'),
      o('A pre-qualification decision is issued within 1 business day, based on your income [1].', ['chk_mtb_mortgage_2'], 'inserted', 0.86),
    ],
  },
  {
    id: 'cnv_mtb_07',
    client: 'tn_mtiebi',
    channel: 'web',
    locale: 'ru',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Transfer fee to another Georgian bank',
    days: 11,
    hours: 3,
    turns: [
      c('Сколько стоит перевод в другой банк Грузии?'),
      a('Перевод в другие банки Грузии стоит 0,50 лари в мобильном или интернет-банке и 1 лари в отделении [1].', ['chk_mtb_transfers_1'], 0.86),
      c('А до скольки принимаются международные переводы?'),
      a('Приём поручений на SWIFT-перевод заканчивается в 17:00 [1].', ['chk_mtb_transfers_3'], 0.84),
    ],
  },
  {
    id: 'cnv_mtb_08',
    client: 'tn_mtiebi',
    channel: 'web',
    locale: 'ka',
    mode: 'autopilot',
    state: 'open',
    subject: 'Internal discount limits (refused), deposit rates',
    days: 13,
    hours: 1,
    turns: [
      c('ოპერატორს რამდენი პროცენტით შეუძლია სესხის განაკვეთის შემცირება?'),
      x('ამ ინფორმაციას ვერ გაგიზიარებთ. ინდივიდუალური განაკვეთის გასარკვევად შეგიძლიათ შეავსოთ სესხის განაცხადი აპლიკაციაში.', 0.33),
      c('კარგით, მაშინ ანაბრის პროცენტი რამდენია?'),
      a(
        'შემნახველი ანაბარი ლარში: წლიური 9%, ვადა 12 თვე, მინიმალური თანხა 500 ლარი [1]. ვადიანი ანაბარი: წლიური 10.5% 24 თვით [2].',
        ['chk_mtb_deposits_0', 'chk_mtb_deposits_1'],
        0.9,
      ),
    ],
  },
  {
    id: 'cnv_mtb_09',
    client: 'tn_mtiebi',
    channel: 'web',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Complaint about a transfer fee',
    days: 17,
    hours: 5,
    turns: [
      c('საჩივრის შეტანა მინდა გადარიცხვის საკომისიოზე.'),
      o(
        'გამარჯობა! საჩივრის წარდგენა შეგიძლიათ ფილიალში, ცხელ ხაზზე *7070, მობილურ აპლიკაციაში ან ელფოსტით [1].',
        ['chk_mtb_complaints_0'],
        'inserted',
        0.88,
      ),
      c('რამდენ ხანში მიპასუხებენ?'),
      o(
        'ბანკი საჩივარზე 10 სამუშაო დღეში პასუხობს; რთულ შემთხვევაში ვადა შეიძლება გაგრძელდეს, რაზეც აუცილებლად შეგატყობინებთ [1].',
        ['chk_mtb_complaints_1'],
        'edited',
        0.85,
      ),
      c('გასაგებია, მადლობა.'),
    ],
  },
  /* ------------------------------------------------------ Pari Insurance */
  {
    id: 'cnv_pari_01',
    client: 'tn_pari',
    channel: 'web',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Kasko deductible options',
    days: 3,
    hours: 5,
    turns: [
      c('კასკოს ფრანშიზა რამდენია?'),
      o('გამარჯობა! კასკოს ფრანშიზის ვარიანტებია 0, 150, 300 ან 500 ლარი; სტანდარტული ფრანშიზა 300 ლარია [1].', ['chk_pari_kasko_0'], 'inserted', 0.92),
      c('მაშინ 150-ს ავირჩევ. ფასი ბევრად იზრდება?'),
      o('დაბალი ფრანშიზა პოლისის ღირებულებას ზრდის. ზუსტ ფასს აგენტი დაგითვლით ავტომობილის მონაცემების მიხედვით.'),
    ],
  },
  {
    id: 'cnv_pari_02',
    client: 'tn_pari',
    channel: 'web',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Third-party liability prices',
    days: 6,
    hours: 2,
    turns: [
      c('მესამე პირის დაზღვევა რა ღირს?'),
      o('გამარჯობა! სავალდებულო მესამე პირის პასუხისმგებლობის დაზღვევა ღირს 95 ლარი წელიწადში (30 000 ლარის ლიმიტი), 140 ლარი (50 000) და 220 ლარი (100 000) [1].', ['chk_pari_motor_liability_0'], 'inserted', 0.9),
      c('გადახდის მომდევნო დღეს ძალაში შედის?'),
      o('დიახ, პოლისი ძალაშია გადახდიდან მომდევნო დღის 00:00 საათიდან [1].', ['chk_pari_motor_liability_1'], 'edited', 0.83),
    ],
  },
  {
    id: 'cnv_pari_03',
    client: 'tn_pari',
    channel: 'messenger',
    locale: 'en',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Schengen policy and skiing',
    days: 9,
    hours: 4,
    turns: [
      c('Does your Schengen travel policy cover skiing?'),
      o(
        'Our Schengen policy covers up to 30,000 EUR in medical costs [1]. Skiing counts as an extreme sport, which is not covered unless you add the extra package [2].',
        ['chk_pari_travel_0', 'chk_pari_travel_1'],
        'edited',
        0.85,
      ),
      c('How much is the add-on?'),
      o("I don't have the add-on price in front of me, so I'll check and come back to you within a few minutes."),
    ],
  },
  {
    id: 'cnv_pari_04',
    client: 'tn_pari',
    channel: 'web',
    locale: 'ka',
    mode: 'copilot',
    state: 'handoff',
    subject: 'Claim notice deadline after an accident',
    days: 14,
    hours: 6,
    turns: [
      c('მანქანა დამეჯახა გუშინ. როდის უნდა შეგატყობინოთ?'),
      o('ზარალის შესახებ უნდა გვაცნობოთ 24 საათის განმავლობაში ცხელ ხაზზე ან აპლიკაციაში [1].', ['chk_pari_claims_0'], 'inserted', 0.92),
      c('და რამდენ ხანში განიხილავთ?'),
      o('განხილვა სრულდება 10 სამუშაო დღეში ყველა დოკუმენტის მიღებიდან [1].', ['chk_pari_claims_1'], 'inserted', 0.88),
      c('უკვე ორი დღე გავიდა. მაინც მიიღებთ?'),
    ],
  },
  /* ---------------------------------------------------------- Iasamani */
  {
    id: 'cnv_ias_01',
    client: 'tn_iasamani',
    channel: 'web',
    locale: 'ka',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Booking a doctor visit',
    days: 7,
    hours: 3,
    turns: [
      c('როგორ დავჯავშნო ვიზიტი ექიმთან?'),
      a('ვიზიტის დაჯავშნა შესაძლებელია ტელეფონით +995 555 00 36 36 ან ვებ-ჩატით [1].', ['chk_ias_appointments_0'], 0.9),
      c('ოჯახის ექიმი რა ღირს?'),
      a('ოჯახის ექიმის კონსულტაცია 60 ლარია [1].', ['chk_ias_services_0'], 0.87),
    ],
  },
  {
    id: 'cnv_ias_02',
    client: 'tn_iasamani',
    channel: 'whatsapp',
    locale: 'ka',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Blood test results',
    days: 15,
    hours: 2,
    turns: [
      c('სისხლის ანალიზის პასუხი როდის იქნება?'),
      a('სისხლის საერთო ანალიზის შედეგი მზადდება იმავე დღეს [1].', ['chk_ias_lab_0'], 0.85),
      c('გმადლობთ!'),
      n('სიამოვნებით! გისურვებთ ჯანმრთელობას.'),
    ],
  },
  /* ----------------------------------------------------------- Darbazi */
  {
    id: 'cnv_drb_01',
    client: 'tn_darbazi',
    channel: 'web',
    locale: 'ka',
    mode: 'autopilot',
    state: 'handoff',
    subject: 'Roaming pack for Europe',
    days: 10,
    hours: 4,
    turns: [
      c('ევროპაში მივდივარ. როუმინგის პაკეტი რა ღირს?'),
      a('როუმინგის პაკეტი „ევროპა“: 7 დღე, 3 GB — 19 ლარი [1]. პაკეტის გარეშე 1 MB-ის ღირებულება 0.50 ლარია, ამიტომ პაკეტის დაკავშირება უფრო ხელსაყრელია.', ['chk_drb_roaming_0'], 0.89),
      c('როგორ ვაკავშირებ?'),
      x('ამ კითხვაზე ზუსტი პასუხი ჩემს ცოდნის ბაზაში არ არის. გადაგაწვდით ოპერატორს, ის დაგეხმარებათ დაკავშირებაში.', 0.31),
    ],
  },
  {
    id: 'cnv_drb_02',
    client: 'tn_darbazi',
    channel: 'messenger',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Home internet outage',
    days: 20,
    hours: 3,
    turns: [
      c('ორი დღეა ინტერნეტი არ მუშაობს.'),
      o(
        'გამარჯობა, თეა ვარ დარბაზიდან. ბოდიშს გიხდით უხერხულობისთვის. გთხოვთ, გადატვირთოთ როუტერი 30 წამით და შეამოწმოთ ოპტიკური კაბელი [1].',
        ['chk_drb_troubleshooting_0'],
        'edited',
        0.84,
      ),
      c('გადავტვირთე, არ გამოდის.'),
      o(
        'გასაგებია. თუ ქსელის გაუმართაობა 24 საათზე მეტხანს გრძელდება, აბონენტს ეკუთვნის ავტომატური კომპენსაცია [1]. ტექნიკოსს ახლავე დაგიგეგმავთ.',
        ['chk_drb_internet_1'],
        'inserted',
        0.86,
      ),
      c('კარგი, ველოდები.'),
    ],
  },
  /* ------------------------------------------------------------ Nobati */
  {
    id: 'cnv_nob_01',
    client: 'tn_nobati',
    channel: 'web',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Free delivery threshold',
    days: 5,
    hours: 2,
    turns: [
      c('მიწოდება რა ღირს?'),
      o('გამარჯობა! მიწოდება უფასოა 40 ლარზე მეტი შეკვეთისას [1]. სხვა შემთხვევაში მიწოდების საფასურს შეკვეთის გაფორმებისას დაინახავთ.', ['chk_nob_fees_0'], 'edited', 0.86),
      c('გასაგებია, მადლობა.'),
      o('გთხოვთ, გემრიელად მიირთვით!'),
    ],
  },
  {
    id: 'cnv_nob_02',
    client: 'tn_nobati',
    channel: 'instagram',
    locale: 'ka',
    mode: 'copilot',
    state: 'resolved',
    subject: 'Missing item in an order',
    days: 12,
    hours: 6,
    turns: [
      c('შეკვეთიდან ერთი პროდუქტი აკლდა.'),
      o('ბოდიშს გიხდით! თუ პროდუქტი აკლია ან დაზიანებულია, შეგვატყობინეთ 2 საათის განმავლობაში და თანხას დაგიბრუნებთ [1].', ['chk_nob_refunds_0'], 'inserted', 0.88),
      c('ახლა დაგიწერეთ, ორ საათში ვეტევი?'),
      o('დიახ, ვეტევით. თანხა ბალანსზე დაგიბრუნდება.'),
    ],
  },
  /* -------------------------------------------------------- Mzetamze */
  {
    id: 'cnv_mze_01',
    client: 'tn_mzetamze',
    channel: 'web',
    locale: 'ka',
    mode: 'autopilot',
    state: 'resolved',
    subject: 'Check-in and check-out times',
    days: 28,
    hours: 3,
    turns: [
      c('შესახლება რომელი საათიდანაა?'),
      a('შესახლება 14:00-დან, გამოსახლება 12:00-მდეა [1]. გვიანი გამოსახლება 16:00-მდე შეიძლება წინასწარი შეთანხმებით.', ['chk_mze_checkin_0'], 0.9),
      c('მადლობა!'),
      n('გთხოვთ! გელოდებით.'),
    ],
  },
]

const REF_PREFIX: Record<Channel, string> = { web: 'wc', instagram: 'ig', messenger: 'ms', whatsapp: 'wa' }

export interface ChatSeed {
  conversations: ChatConversation[]
  turns: ChatTurn[]
  feedback: CopilotFeedback[]
}

export function buildChat(lookup: Lookup): ChatSeed {
  const conversations: ChatConversation[] = []
  const turns: ChatTurn[] = []
  const feedback: CopilotFeedback[] = []

  CONVERSATIONS.forEach((spec, ci) => {
    const created_at = ago(spec.days, spec.hours)
    let at = created_at
    spec.turns.forEach((t, k) => {
      at = after(at, (k === 0 ? 0 : 24_000 + ((ci * 7 + k * 13) % 41) * 1000) + (t.r === 'customer' ? 8000 : 2000))
      const citations: Citation[] = (t.cite ?? []).map((chunkId, idx) => {
        const ref = lookup(chunkId)
        if (!ref) throw new Error(`seed: conversation ${spec.id} cites unknown chunk ${chunkId}`)
        return {
          n: idx + 1,
          document_id: ref.doc.id,
          chunk_id: ref.chunk.id,
          title: ref.doc.title,
          score: Math.max(0.5, Math.round(((t.score ?? 0.8) - idx * 0.06) * 100) / 100),
          snippet: snippetFor(ref.chunk.content, t.t, 200),
        }
      })
      const grounded = t.r === 'customer' ? null : t.kind === 'answer' ? true : t.kind === 'refusal' ? false : null
      const method: ChatTurn['method'] =
        t.r === 'customer' ? null : t.kind === 'answer' ? 'vector' : t.kind === 'refusal' ? 'none' : t.kind === 'canned' ? 'canned' : null
      const tokens = t.kind === 'answer' ? 640 + estimateTokens(t.t) * 3 + 230 * citations.length : 0
      const turn: ChatTurn = {
        id: `trn_${spec.id.replace(/^cnv_/, '')}_${k + 1}`,
        conversation_id: spec.id,
        role: t.r,
        content: t.t,
        grounded,
        method,
        top_score: t.r === 'customer' || t.kind === 'canned' || t.kind === 'plain' ? null : t.score ?? null,
        citations,
        tokens,
        created_at: at,
      }
      turns.push(turn)
      if (t.fb) {
        feedback.push({
          id: `fbk_${turn.id.replace(/^trn_/, '')}`,
          conversation_id: spec.id,
          turn_id: turn.id,
          suggestion_index: (ci + k) % 3,
          action: t.fb,
          final_text: t.fb === 'inserted' || t.fb === 'edited' ? t.t : null,
          created_at: after(at, 1500),
        })
      }
    })
    conversations.push({
      id: spec.id,
      client_id: spec.client,
      external_ref: `${REF_PREFIX[spec.channel]}-${(0x3a1f2c + ci * 0x1b3d7).toString(16)}`,
      channel: spec.channel,
      locale: spec.locale,
      mode: spec.mode,
      state: spec.state,
      subject: spec.subject,
      off_topic_count: spec.offTopic ?? 0,
      created_at,
      last_message_at: at,
    })
  })

  return { conversations, turns, feedback }
}
