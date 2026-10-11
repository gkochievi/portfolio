/**
 * The pure half of the copilot / autopilot simulation: cross-language query
 * bridging, retrieval glue, triage, answer composition and the localized
 * copy the bot speaks. No store access here (the handler wires it up).
 * OWNED BY: copilot.
 */
import type {
  BotConfig,
  Citation,
  ContentLang,
  Handoff,
  KbChunk,
  KbDocument,
  RetrievalHit,
  Triage,
  Weekday,
} from '@/types'
import { rankByText, snippetFor, tokenize, type Ranked } from '@/demo/lib/text'
import { DISCLOSURE } from './copy'
import { pickFact } from './facts'

export type Pooled = KbChunk & { doc: KbDocument }
export type RankedChunk = Ranked<Pooled>

/* -------------------------------------------------------------- bridging */

/** The knowledge base is Georgian; English / Russian questions are widened with Georgian terms before ranking. */
const BRIDGE: Array<[RegExp, string]> = [
  [/gold|золот/i, 'ოქროს ბარათი'],
  [/classic|классич/i, 'კლასიკური'],
  [/card|карт/i, 'ბარათი ბარათის ბარათს'],
  [/fee|cost|price|charge|how much|стоит|сколько|комисс|тариф/i, 'ღირს საფასური საკომისიო'],
  [/annual|yearly|per year|годов/i, 'წლიური'],
  [/reissue|replace|new card|перевыпуск/i, 'ხელახალი გამოშვება'],
  [/deliver|courier|достав/i, 'მიწოდება'],
  [/transfer|перевод|перевест/i, 'გადარიცხვა გადარიცხვის'],
  [/international|swift|abroad|междунар/i, 'SWIFT საერთაშორისო'],
  [/loan|credit|кредит|заем/i, 'სესხი სესხის სამომხმარებლო'],
  [/early|repay|prepay|досрочн|погаш/i, 'ვადამდე დაფარვა'],
  [/rate|interest|apr|ставк|процент/i, 'განაკვეთი პროცენტი'],
  [/mortgage|ипотек/i, 'იპოთეკა იპოთეკის'],
  [/down payment|первоначал/i, 'თანამონაწილეობა'],
  [/deposit|saving|депозит|вклад/i, 'ანაბარი ანაბრის'],
  [/block|lost|stolen|потер|заблок|украд/i, 'ბარათი დაბლოკვა დაიკარგა'],
  [/complain|жалоб/i, 'საჩივარი'],
  [/branch|opening hours|hours|филиал|отделен|график/i, 'ფილიალი მუშაობს სამუშაო საათები'],
  [/hotline|горяч/i, 'ცხელი ხაზი'],
  [/password|login|парол/i, 'აპლიკაცია პაროლი'],
  [/insur|polic|страхов|полис/i, 'დაზღვევა პოლისი'],
  [/kasko|каско/i, 'კასკო ფრანშიზა'],
  [/deductible|франшиз/i, 'ფრანშიზა'],
  [/motor|compulsory|автостр|осаго/i, 'ავტო სავალდებულო'],
]

export function bridge(query: string): string {
  if (!/[A-Za-zЀ-ӿ]/.test(query)) return query
  const extra = BRIDGE.filter(([re]) => re.test(query)).map(([, ka]) => ka)
  return extra.length ? `${query} ${extra.join(' ')}` : query
}

export function retrieve(query: string, pool: Pooled[]): RankedChunk[] {
  if (pool.length === 0) return []
  return rankByText(bridge(query), pool)
}

export const slugOf = (doc: KbDocument): string => doc.id.replace(/^doc_[a-z]+_/, '')

export function docTitle(doc: KbDocument, locale: ContentLang): string {
  return locale === 'ka' ? doc.title : (doc.title_en ?? doc.title)
}

export function toHit(r: RankedChunk, query: string, locale: ContentLang): RetrievalHit {
  const { item } = r
  return {
    chunk_id: item.id,
    document_id: item.document_id,
    title: docTitle(item.doc, locale),
    doc_type: item.doc.doc_type,
    visibility: item.doc.visibility,
    chunk_index: item.chunk_index,
    score: r.score,
    snippet: snippetFor(item.content, bridge(query), 200),
  }
}

export function toCitation(n: number, r: RankedChunk, query: string, locale: ContentLang): Citation {
  return {
    n,
    document_id: r.item.document_id,
    chunk_id: r.item.id,
    title: docTitle(r.item.doc, locale),
    score: r.score,
    snippet: snippetFor(r.item.content, bridge(query), 420),
  }
}

/* --------------------------------------------------------------- triage */

export interface Signals {
  internalProbe: boolean
  escalation: boolean
  risky: boolean
  commitment: boolean
  requested: boolean
  chitchat: 'greeting' | 'thanks' | 'bye' | null
  offTopic: boolean
  domain: boolean
}

const INTERNAL_PROBE: RegExp[] = [
  /(max(imum)?|highest|limit|biggest).{0,40}(discount|waiver)/i,
  /(discount|waiver).{0,40}(max(imum)?|limit|agent|operator|manager|director)/i,
  /(agent|operator|manager).{0,30}(give|offer|grant).{0,30}discount/i,
  /(მაქსიმალურ|ლიმიტ|ზღვარ|უდიდეს).{0,50}(ფასდაკლ|პატიებ)/i,
  /(ფასდაკლ|პატიებ).{0,50}(მაქსიმალურ|ლიმიტ|ზღვარ|ოპერატორ|აგენტ|მენეჯერ)/i,
  /(ოპერატორ|აგენტ|მენეჯერ).{0,50}(ფასდაკლ|პროცენტით შეუძლია)/i,
  /(максимальн|предел|лимит).{0,40}скидк/i,
  /скидк.{0,40}(максимальн|лимит|оператор|агент|менеджер)/i,
]
const RISKY = /fraud|scam|lawyer|lawsuit|\bsue\b|court|hacked|თაღლით|ადვოკატ|სასამართლ|გატეხ|мошенн|адвокат|в суд|взлом/i
const COMMITMENT: RegExp[] = [
  /(open|issue|give|approve|grant|sign|set up|process|confirm).{0,30}(right now|immediately|at once|asap|now)\b/i,
  /(right now|immediately|at once).{0,30}(loan|policy|card|account|order|mortgage)/i,
  /\bguarantee\b/i,
  /(გამიფორმ|გამომიშვი|გამიხსენი|დამიმტკიც|დამიდასტურ|დამიამტკიც|მომიწერეთ ხელი).{0,30}(ახლავე|ახლა|დაუყოვნებლივ|ეხლა)/i,
  /(ახლავე|დაუყოვნებლივ).{0,30}(გამიფორმ|გამომიშვი|გამიხსენი|დამიმტკიც|დამიდასტურ)/i,
  /გარანტი/i,
  /(оформи|выдай|откройте?|одобри|подтверди).{0,30}(сейчас|немедленно|прямо сейчас|сразу)/i,
  /(сейчас|немедленно).{0,30}(кредит|полис|карт|заказ)/i,
]
const REQUESTED: RegExp[] = [
  /(talk|speak|connect|transfer|put).{0,25}(human|operator|agent|person|someone|colleague)/i,
  /(human|real person|live agent)/i,
  /(ოპერატორ|ადამიან)\S{0,6}.{0,25}(დამაკავშირ|გადამიყვან|მინდა|ვისაუბრ|ლაპარაკ)/i,
  /(соедин|переключ|позов).{0,20}(оператор|человек|сотрудник)/i,
]
const GREETING = /^(hi|hello|hey|good (morning|afternoon|evening)|გამარჯობა|სალამი|გაუმარჯოს|добрый день|здравствуйте|привет)\b/i
const THANKS = /(thanks|thank you|მადლობა|გმადლობ|спасибо|благодарю)/i
const BYE = /^(bye|goodbye|see you|ნახვამდის|კარგად|до свидания|пока)\b/i
const OFF_TOPIC =
  /weather|bitcoin|ethereum|football|soccer|basketball|joke|recipe|movie|horoscope|poem|president|election|ამინდ|ბიტკოინ|ეთერიუმ|ფეხბურთ|ანეკდოტ|რეცეპტ|ფილმ|ლექს|პრეზიდენტ|არჩევნ|погод|биткоин|футбол|анекдот|рецепт|фильм|стих|президент|выбор/i
const DOMAIN =
  /card|loan|account|bank|fee|rate|insur|polic|deposit|transfer|mortgage|price|cost|order|deliver|clinic|appointment|hours|complain|ბარათ|სესხ|ანგარიშ|ბანკ|საფასურ|განაკვეთ|დაზღვევ|პოლის|ანაბარ|გადარიცხვ|იპოთეკ|ფასი|ღირს|შეკვეთ|მიწოდებ|კლინიკ|ვიზიტ|საჩივარ|карт|кредит|счёт|счет|банк|страхов|вклад|перевод|ипотек|цена|стоит|заказ|доставк|жалоб/i

export function readSignals(text: string, config: BotConfig): Signals {
  const t = text.trim()
  const lower = t.toLowerCase()
  const words = tokenize(t).length
  const internalProbe = INTERNAL_PROBE.some((re) => re.test(t))
  const escalation = config.settings.escalation_keywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()))
  const risky = RISKY.test(t)
  const commitment = COMMITMENT.some((re) => re.test(t))
  const requested = REQUESTED.some((re) => re.test(t))
  let chitchat: Signals['chitchat'] = null
  if (words <= 7) {
    if (THANKS.test(t)) chitchat = 'thanks'
    else if (BYE.test(t)) chitchat = 'bye'
    else if (GREETING.test(t) && !DOMAIN.test(t)) chitchat = 'greeting'
  }
  return {
    internalProbe,
    escalation,
    risky,
    commitment,
    requested,
    chitchat,
    offTopic: OFF_TOPIC.test(t),
    domain: DOMAIN.test(t),
  }
}

export function classify(signals: Signals, grounded: boolean): Triage {
  if (signals.internalProbe || signals.escalation || signals.risky) return 'risky'
  if (signals.chitchat) return 'chitchat'
  if (signals.offTopic && !grounded) return 'off_topic'
  if (grounded) return 'business'
  return signals.domain ? 'related' : 'off_topic'
}

/* ---------------------------------------------------------- composition */

const sentences = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)

const overlap = (a: Set<string>, text: string): number => {
  const tokens = tokenize(text)
  if (tokens.length === 0) return 0
  let hit = 0
  for (const token of tokens) if (a.has(token)) hit += 1
  return hit / Math.sqrt(tokens.length)
}

/** The best 1-2 sentences of a chunk for a query (Q/A chunks answer with the best matching pair's answer). */
export function bestSentences(content: string, query: string, max = 2): string {
  const q = new Set(tokenize(bridge(query)))
  if (content.includes('პასუხი:')) {
    const lines = content.split('\n')
    let best = { score: -1, answer: '' }
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? ''
      if (!line.startsWith('კითხვა:')) continue
      const answer = (lines[i + 1] ?? '').replace(/^პასუხი:\s*/, '').trim()
      const score = overlap(q, line) + 0.3 * overlap(q, answer)
      if (answer && score > best.score) best = { score, answer }
    }
    if (best.answer) return best.answer
  }
  const list = sentences(content)
  if (list.length <= max) return list.join(' ')
  const scored = list.map((text, index) => ({ text, index, score: overlap(q, text) }))
  const picked = [...scored].sort((a, b) => b.score - a.score || a.index - b.index).slice(0, max)
  return picked.sort((a, b) => a.index - b.index).map((x) => x.text).join(' ')
}

const withCite = (text: string, n: number): string => {
  const t = text.trim()
  return /[.!?]$/.test(t) ? `${t.slice(0, -1)} [${n}]${t.slice(-1)}` : `${t} [${n}]`
}

const clip = (text: string, max: number): string => {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '))
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`
}

export interface Composed {
  text: string
  /** 1-based citation numbers used in the text. */
  cites: number[]
}

const KB_LEAD: Record<ContentLang, string> = {
  ka: '',
  en: 'From the knowledge base: ',
  ru: 'Из базы знаний: ',
}

/** One grounded answer from the ranked, quotable hits (index 0 = citation [1]). */
export function composeAnswer(locale: ContentLang, query: string, hits: RankedChunk[], minScore: number, maxChars: number): Composed {
  const primary = hits[0]
  if (!primary) return { text: '', cites: [] }
  const fact =
    locale !== 'ka' && primary.item.client_id === 'tn_mtiebi'
      ? pickFact(query, hits.map((h) => slugOf(h.item.doc)), locale)
      : null
  if (fact) return { text: clip(withCite(fact, 1), maxChars), cites: [1] }

  let text = `${KB_LEAD[locale]}${withCite(bestSentences(primary.item.content, query), 1)}`
  const cites = [1]
  const second = hits.find((h, i) => i > 0 && h.item.document_id !== primary.item.document_id && h.score >= minScore)
  if (second) {
    const extra = bestSentences(second.item.content, query, 1)
    if (extra && extra !== bestSentences(primary.item.content, query)) {
      const n = hits.indexOf(second) + 1
      text = `${text} ${withCite(extra, n)}`
      cites.push(n)
    }
  }
  return { text: clip(text, maxChars), cites }
}

export const clarifyText = (locale: ContentLang, title: string): string =>
  ({
    ka: `რომ ზუსტად გიპასუხოთ, დამიზუსტეთ, გთხოვთ: გაინტერესებთ „${title}“? მიუთითეთ, რომელი პროდუქტი ან თანხა გაქვთ მხედველობაში.`,
    en: `Just to make sure I give you the right answer: is this about "${title}"? Could you tell me which product or amount you have in mind?`,
    ru: `Чтобы ответить точно, уточните, пожалуйста: вас интересует «${title}»? Укажите, какой продукт или сумма вам нужны.`,
  })[locale]

export const escalateText = (locale: ContentLang): string =>
  ({
    ka: 'ამ საკითხს სპეციალისტთან გადავამოწმებ და მალე დაგიბრუნდებით პასუხით.',
    en: 'I will check this with a specialist and get back to you shortly.',
    ru: 'Я уточню это у специалиста и скоро вернусь с ответом.',
  })[locale]

export const introText = (locale: ContentLang): string =>
  ({ ka: 'გამარჯობა! ', en: 'Hello! ', ru: 'Здравствуйте! ' })[locale]

export const thanksText = (locale: ContentLang): string =>
  ({
    ka: 'გთხოვთ! თუ კიდევ რამე გაინტერესებთ, სიამოვნებით დაგეხმარებით.',
    en: 'You are welcome! If there is anything else, I am happy to help.',
    ru: 'Пожалуйста! Если появятся ещё вопросы, буду рад помочь.',
  })[locale]

export const byeText = (locale: ContentLang): string =>
  ({ ka: 'კარგად ბრძანდებოდეთ!', en: 'Goodbye, and have a good day!', ru: 'До свидания, хорошего дня!' })[locale]

export const warnText = (locale: ContentLang): string =>
  ({
    ka: 'შეგახსენებთ, რომ მხოლოდ კომპანიის პროდუქტებსა და მომსახურებასთან დაკავშირებულ კითხვებს ვპასუხობ.',
    en: 'A reminder: I can only answer questions about the company’s products and services.',
    ru: 'Напоминаю: я отвечаю только на вопросы о продуктах и услугах компании.',
  })[locale]

export const cutoffText = (locale: ContentLang): string =>
  ({
    ka: 'ვწუხვარ, ეს საუბარი ჩვენი სერვისის თემას სცდება, ამიტომ მას აქ ვასრულებ. ახალი კითხვის შემთხვევაში დაიწყეთ ახალი საუბარი.',
    en: 'I am sorry, this conversation is outside what this service covers, so I am ending it here. Please start a new conversation for a new question.',
    ru: 'К сожалению, этот разговор выходит за рамки сервиса, поэтому я завершаю его. По новому вопросу начните новый разговор.',
  })[locale]

export const tooFastText = (locale: ContentLang): string =>
  ({
    ka: 'ძალიან სწრაფად მიწერთ. გთხოვთ, ერთი წუთით დაელოდოთ.',
    en: 'You are writing very fast. Please wait a minute.',
    ru: 'Вы пишете слишком быстро. Подождите, пожалуйста, минуту.',
  })[locale]

export const limitText = (locale: ContentLang): string =>
  ({
    ka: 'ამ საუბრის შეტყობინებების ლიმიტი ამოიწურა. დაიწყეთ ახალი საუბარი ან დაგვიკავშირდით ოპერატორის მეშვეობით.',
    en: 'This conversation has reached its message limit. Please start a new one or contact an operator.',
    ru: 'Лимит сообщений в этом разговоре исчерпан. Начните новый разговор или свяжитесь с оператором.',
  })[locale]

export function disclosureFor(mode: BotConfig['settings']['disclosure_mode'], locale: ContentLang, botTurnsSoFar: number): string | null {
  if (mode === 'off') return null
  if (mode === 'first' && botTurnsSoFar > 0) return null
  return DISCLOSURE[locale]
}

/* -------------------------------------------------------------- handoff */

export interface HandoffInfo {
  query: string
  topScore: number
  minScore: number
  title?: string
}

export function buildHandoff(reason: Handoff['reason'], locale: ContentLang, info: HandoffInfo): Handoff {
  const q = info.query.length > 140 ? `${info.query.slice(0, 137)}…` : info.query
  const score = info.topScore.toFixed(2)
  const min = info.minScore.toFixed(2)
  const T: Record<Handoff['reason'], Record<ContentLang, { summary: string; goal: string }>> = {
    low_score: {
      ka: {
        summary: `მომხმარებელი კითხულობს: „${q}“. ცოდნის ბაზაში საკმარისად ზუსტი პასუხი ვერ მოიძებნა (საუკეთესო შესაბამისობა ${score}, ზღვარი ${min}).`,
        goal: 'გასცეთ ზუსტი პასუხი ან დაუკავშირდეთ პროფილურ სპეციალისტს.',
      },
      en: {
        summary: `The customer asks: "${q}". No sufficiently precise answer was found in the knowledge base (best match ${score}, threshold ${min}).`,
        goal: 'Give a precise answer or involve the right specialist.',
      },
      ru: {
        summary: `Клиент спрашивает: «${q}». В базе знаний не найден достаточно точный ответ (лучшее совпадение ${score}, порог ${min}).`,
        goal: 'Дать точный ответ или подключить профильного специалиста.',
      },
    },
    commitment: {
      ka: {
        summary: `მომხმარებელი ითხოვს დაუყოვნებლივ ვალდებულების აღებას: „${q}“. ავტომატურ ასისტენტს ასეთი გადაწყვეტილების უფლება არ აქვს.`,
        goal: 'გადაამოწმეთ მომხმარებლის მონაცემები და შეუთანხმეთ გაფორმების პირობები.',
      },
      en: {
        summary: `The customer asks for an immediate commitment: "${q}". The automated assistant is not allowed to make that decision.`,
        goal: 'Verify the customer’s details and agree the terms before anything is issued.',
      },
      ru: {
        summary: `Клиент требует немедленного обязательства: «${q}». Автоматический помощник не вправе принимать такие решения.`,
        goal: 'Проверить данные клиента и согласовать условия до оформления.',
      },
    },
    risky: {
      ka: {
        summary: `შეტყობინება შიდა ან მგრძნობიარე ინფორმაციას ეხება („${q}“) და ავტომატურ პასუხს არ ექვემდებარება.`,
        goal: 'ადამიანმა უნდა გასცეს პასუხი; შიდა ინფორმაცია არ გაამჟღავნოთ.',
      },
      en: {
        summary: `The message touches internal or sensitive information ("${q}") and must not be answered automatically.`,
        goal: 'A person should reply; do not reveal internal information.',
      },
      ru: {
        summary: `Сообщение касается внутренней или чувствительной информации («${q}») и не подлежит автоматическому ответу.`,
        goal: 'Ответить должен человек; не раскрывать внутреннюю информацию.',
      },
    },
    off_topic: {
      ka: {
        summary: 'საუბარი განმეორებით გადაუხვია სერვისის თემას.',
        goal: 'თავაზიანად დაასრულეთ საუბარი ან დააბრუნეთ თემაზე.',
      },
      en: {
        summary: 'The conversation has repeatedly drifted away from what the service covers.',
        goal: 'Politely end the conversation or steer it back to the topic.',
      },
      ru: {
        summary: 'Разговор неоднократно уходил от тем сервиса.',
        goal: 'Вежливо завершить разговор или вернуть его к теме.',
      },
    },
    requested: {
      ka: { summary: 'მომხმარებელი ადამიან-ოპერატორთან საუბარს ითხოვს.', goal: 'დაუკავშირდით და გააგრძელეთ საუბარი.' },
      en: { summary: 'The customer asked to speak to a person.', goal: 'Join the conversation and continue from here.' },
      ru: { summary: 'Клиент просит соединить его с человеком.', goal: 'Подключиться и продолжить разговор.' },
    },
    out_of_hours: {
      ka: {
        summary: `მომხმარებლის შეტყობინება სამუშაო საათების გარეთ შემოვიდა: „${q}“.`,
        goal: 'უპასუხეთ პირველივე სამუშაო საათებში.',
      },
      en: {
        summary: `The message arrived outside working hours: "${q}".`,
        goal: 'Reply in the first working hours.',
      },
      ru: {
        summary: `Сообщение пришло вне рабочего времени: «${q}».`,
        goal: 'Ответить в ближайшее рабочее время.',
      },
    },
  }
  const entry = T[reason][locale]
  return { reason, summary: entry.summary, goal: entry.goal }
}

/* ---------------------------------------------------------------- hours */

const WEEKDAYS: Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function isWithinHours(hours: BotConfig['settings']['hours'], timezone: string, at: Date = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    const day = WEEKDAYS.find((d) => d === get('weekday').toLowerCase().slice(0, 3)) ?? 'mon'
    const hm = `${get('hour')}:${get('minute')}`
    return (hours[day] ?? []).some((slot) => slot.from <= hm && hm < slot.to)
  } catch {
    return true
  }
}

/** Splits a reply into streamable word chunks that keep their trailing whitespace. */
export const wordChunks = (text: string): string[] => text.match(/\S+\s*/g) ?? []
