/**
 * Scripted colleague lines for the team-chat simulator (owner: team).
 * Keyed by colleague id; each has a few context-free lines plus keyword
 * replies. All strings are fictional workplace chatter for the Vazi team.
 */
import type { ContentLang } from '@/types'

type Bilingual = { en: string; ka: string }
export type ColleagueId = 'op_mariam' | 'op_lasha' | 'op_salome' | 'op_irakli' | 'op_keti' | 'adm_giorgi' | 'adm_eka' | 'sup_nino'

interface Topic {
  /** Lowercase fragments in en / ka / ru that trigger the reply. */
  match: string[]
  lines: Bilingual[]
}

export const TOPICS: Topic[] = [
  {
    match: ['hello', 'hi ', 'hey', 'გამარჯობა', 'სალამი', 'გაუმარჯოს', 'привет', 'good morning', 'დილა'],
    lines: [
      { en: 'Hey! All good here, the queue is calm.', ka: 'გამარჯობა! აქ ყველაფერი წესრიგშია, რიგი მშვიდია.' },
      { en: 'Hi 👋 how is your shift going?', ka: 'სალამი 👋 როგორ მიდის ცვლა?' },
    ],
  },
  {
    match: ['thanks', 'thank you', 'მადლობა', 'გმადლობ', 'спасибо', 'thx'],
    lines: [
      { en: 'Anytime 🙂', ka: 'ყოველთვის 🙂' },
      { en: 'No problem, that is what the team is for.', ka: 'არაფერს, ამისთვის ვართ გუნდი.' },
    ],
  },
  {
    match: ['courier', 'delivery', 'late', 'კურიერ', 'მიტანა', 'აგვიანებ', 'доставка'],
    lines: [
      { en: 'Courier is running about 40 minutes behind today. Offer the 10% voucher for late orders.', ka: 'კურიერი დღეს დაახლოებით 40 წუთით აგვიანებს. დაგვიანებულ შეკვეთებზე 10%-იანი ვაუჩერი შესთავაზე.' },
      { en: 'I checked with the warehouse, Batumi orders go out tomorrow.', ka: 'საწყობთან გავარკვიე, ბათუმის შეკვეთები ხვალ გადის.' },
    ],
  },
  {
    match: ['stock', 'kisi', 'saperavi', 'wine', 'მარაგ', 'ღვინო', 'საფერავ', 'ქისი', 'наличи'],
    lines: [
      { en: 'Warehouse says the Kisi is back on Thursday. The Saperavi 2023 is in stock.', ka: 'საწყობის მიხედვით ქისი ხუთშაბათს დაბრუნდება. საფერავი 2023 მარაგშია.' },
      { en: 'I would double-check the price list before promising a date.', ka: 'თარიღს რომ დაპირდე, ჯერ ფასების სია გადაამოწმე.' },
    ],
  },
  {
    match: ['refund', 'return', 'broken', 'damaged', 'დაბრუნ', 'გატეხ', 'დაზიან', 'возврат'],
    lines: [
      { en: 'For broken bottles ask for a photo first, then Giorgi can approve the refund.', ka: 'გატეხილ ბოთლებზე ჯერ ფოტო გამოართვი, შემდეგ გიორგი დაადასტურებს თანხის დაბრუნებას.' },
      { en: 'Refunds take up to 3 working days, tell the customer that.', ka: 'თანხის დაბრუნებას 3 სამუშაო დღემდე სჭირდება, მომხმარებელს ეს აცნობე.' },
    ],
  },
  {
    match: ['lunch', 'break', 'cover', 'away', 'შესვენებ', 'ლანჩ', 'ვისადილ', 'გამცვალ', 'перерыв'],
    lines: [
      { en: 'Go ahead, I will cover your chats while you are away.', ka: 'წადი, შენს ჩატებს მე მივხედავ.' },
      { en: 'Sure, ping me when you are back.', ka: 'რა თქმა უნდა, დაბრუნებულმა მომწერე.' },
    ],
  },
  {
    match: ['whatsapp', 'template', 'window', 'შაბლონ', 'ვოთსაფ', 'ფანჯარა'],
    lines: [
      { en: 'If the 24-hour window is closed, use the order_update template.', ka: 'თუ 24-საათიანი ფანჯარა დაიხურა, order_update შაბლონი გამოიყენე.' },
    ],
  },
  {
    match: ['tasting', 'event', 'დეგუსტაცი', 'ღონისძიებ', 'booking', 'დაჯავშნ'],
    lines: [
      { en: 'The tasting is on the 18th, 30 seats. A few are still free.', ka: 'დეგუსტაცია 18-ში, 30 ადგილია. რამდენიმე ჯერ კიდევ თავისუფალია.' },
    ],
  },
  {
    match: ['?'],
    lines: [
      { en: 'Good question, let me check and get back to you in a minute.', ka: 'კარგი კითხვაა, ერთ წუთში გადავამოწმებ და გიპასუხებ.' },
      { en: 'I think yes, but let me confirm with Giorgi.', ka: 'მგონი კი, მაგრამ გიორგისთან გადავამოწმებ.' },
    ],
  },
]

/** Fallback lines when nothing matches. */
export const GENERIC: Bilingual[] = [
  { en: 'Got it 👍', ka: 'გასაგებია 👍' },
  { en: 'Okay, noted. I will keep an eye on it.', ka: 'კარგი, აღვნიშნე. თვალს ვადევნებ.' },
  { en: 'Sounds good to me.', ka: 'მეც ასე მგონია.' },
  { en: 'Thanks for the heads up!', ka: 'გაფრთხილებისთვის მადლობა!' },
]

/** Room chatter: who answers a room message and in which order. */
export const ROOM_ANSWERERS: ColleagueId[] = ['op_mariam', 'adm_giorgi', 'op_lasha', 'adm_eka']

/** Lines for colleagues who greet the visitor when a DM is opened for the first time. */
export const DM_OPENERS: Bilingual[] = [
  { en: 'Hi! What do you need?', ka: 'გამარჯობა! რით დაგეხმარო?' },
  { en: 'Hey, I am here if you need anything.', ka: 'სალამი, აქ ვარ თუ რამე დაგჭირდა.' },
]

export function pickLine(line: Bilingual, lang: ContentLang): string {
  return lang === 'ka' ? line.ka : line.en
}

/** Pick the topic lines matching `text`, or the generic lines. */
export function linesFor(text: string): Bilingual[] {
  const lower = text.toLowerCase()
  const hit = TOPICS.find((topic) => topic.match.some((fragment) => lower.includes(fragment)))
  return hit ? hit.lines : GENERIC
}
