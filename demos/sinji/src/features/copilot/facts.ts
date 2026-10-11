/**
 * Plain-language facts for the Mtiebi Bank workspace in English and Russian.
 * The knowledge base itself is Georgian, so a draft written for an English or
 * Russian visitor is built from the matching fact (the Georgian passage still
 * supplies the citation). Other workspaces fall back to quoting the passage.
 * OWNED BY: copilot.
 */
export interface Fact {
  /** Document slug (`doc_mtb_<doc>`). */
  doc: string
  /** Lower-case substrings (English and Russian) any of which votes for this fact. */
  kw: string[]
  en: string
  ru: string
}

export const FACTS: Fact[] = [
  {
    doc: 'cards',
    kw: ['gold', 'золот'],
    en: 'The Gold card costs 60 GEL per year and, unlike the Classic card, it does not come with a free first year.',
    ru: 'Годовое обслуживание карты Gold стоит 60 лари, и в отличие от Classic первый год не бесплатный.',
  },
  {
    doc: 'cards',
    kw: ['classic', 'классич'],
    en: 'The Classic debit card costs 12 GEL per year, and the first year is free.',
    ru: 'Дебетовая карта Classic стоит 12 лари в год, первый год бесплатно.',
  },
  {
    doc: 'cards',
    kw: ['reissue', 'replace', 'new card', 'ready', 'готов', 'перевыпуск', 'how long'],
    en: 'Reissuing a card costs 10 GEL, and the new card is ready in 3 business days.',
    ru: 'Перевыпуск карты стоит 10 лари, новая карта будет готова за 3 рабочих дня.',
  },
  {
    doc: 'cards',
    kw: ['deliver', 'courier', 'достав'],
    en: 'Home delivery of a card is free in Tbilisi and costs 5 GEL in the regions.',
    ru: 'Доставка карты на дом бесплатна в Тбилиси и стоит 5 лари в регионах.',
  },
  {
    doc: 'cards',
    kw: ['card', 'annual', 'fee', 'карт'],
    en: 'Debit card service costs 12 GEL per year for Classic (the first year is free) and 60 GEL per year for Gold.',
    ru: 'Обслуживание дебетовой карты стоит 12 лари в год для Classic (первый год бесплатно) и 60 лари для Gold.',
  },
  {
    doc: 'card_security',
    kw: ['block', 'lost', 'stolen', 'freeze', 'потер', 'заблок', 'украд'],
    en: 'You can block the card at any time, 24/7, in the app (Cards, then Block) or by calling the hotline *7070.',
    ru: 'Карту можно заблокировать круглосуточно в приложении (Карты, затем Заблокировать) или по горячей линии *7070.',
  },
  {
    doc: 'card_security',
    kw: ['sms', 'cvv', 'pin', 'code', 'код'],
    en: 'The bank never asks for your SMS code, PIN or CVV. Please do not share them with anyone.',
    ru: 'Банк никогда не спрашивает SMS-код, PIN или CVV. Пожалуйста, никому их не сообщайте.',
  },
  {
    doc: 'transfers',
    kw: ['swift', 'international', 'abroad', 'междунар', 'за границ'],
    en: 'An international SWIFT transfer costs 0.2% of the amount, with a minimum of 15 GEL and a maximum of 150 GEL.',
    ru: 'Международный перевод SWIFT стоит 0,2% от суммы, минимум 15 лари, максимум 150 лари.',
  },
  {
    doc: 'transfers',
    kw: ['cut-off', 'cutoff', 'deadline', 'until', 'how fast', 'how long', 'до скольки', 'быстро', 'срок'],
    en: 'Transfers sent before 17:00 on a business day are processed the same day.',
    ru: 'Переводы, отправленные до 17:00 в рабочий день, обрабатываются в тот же день.',
  },
  {
    doc: 'transfers',
    kw: ['transfer', 'another bank', 'other bank', 'send money', 'перевод', 'перевест'],
    en: 'A transfer to another Georgian bank costs 0.50 GEL in the app or internet bank and 1 GEL at a branch. Transfers inside Mtiebi Bank are free.',
    ru: 'Перевод в другой банк Грузии стоит 0,50 лари в приложении или интернет-банке и 1 лари в отделении. Переводы внутри банка бесплатны.',
  },
  {
    doc: 'loans',
    kw: ['early', 'repay', 'prepay', 'pay off', 'досроч', 'погаш'],
    en: 'If you repay a loan early within the first 12 months, the fee is 1% of the repaid amount. After 12 months there is no fee.',
    ru: 'При досрочном погашении в первые 12 месяцев комиссия составляет 1% от погашаемой суммы, после 12 месяцев комиссии нет.',
  },
  {
    doc: 'loans',
    kw: ['maximum', 'how much can', 'amount', 'сумм', 'до какой'],
    en: 'A consumer loan is available up to 30,000 GEL for 3 to 48 months.',
    ru: 'Потребительский кредит доступен до 30 000 лари на срок от 3 до 48 месяцев.',
  },
  {
    doc: 'loans',
    kw: ['loan', 'credit', 'rate', 'interest', 'кредит', 'ставк'],
    en: 'The annual rate on a consumer loan is 14% to 24% depending on your income and credit history, for up to 30,000 GEL and 3 to 48 months.',
    ru: 'Годовая ставка по потребительскому кредиту составляет от 14% до 24% в зависимости от дохода и кредитной истории, сумма до 30 000 лари, срок от 3 до 48 месяцев.',
  },
  {
    doc: 'mortgage',
    kw: ['pre-approval', 'preapproval', 'pre-qualification', 'prequalification', 'qualif', 'how fast', 'предвар', 'одобр'],
    en: 'A pre-qualification decision is issued within 1 business day, based on your income.',
    ru: 'Предварительное решение выдаётся в течение 1 рабочего дня на основании вашего дохода.',
  },
  {
    doc: 'mortgage',
    kw: ['mortgage', 'down payment', 'ипотек'],
    en: 'Mortgage rates start from 9.5% per year, the down payment is at least 20% of the property value and the term is up to 20 years.',
    ru: 'Ставка по ипотеке начинается от 9,5% годовых, первоначальный взнос не менее 20% стоимости недвижимости, срок до 20 лет.',
  },
  {
    doc: 'deposits',
    kw: ['usd', 'dollar', 'доллар'],
    en: 'The USD deposit pays 2% per year for 12 months, with a minimum of 500 USD.',
    ru: 'Депозит в долларах приносит 2% годовых на 12 месяцев, минимальная сумма 500 долларов.',
  },
  {
    doc: 'deposits',
    kw: ['term deposit', '24 month', 'срочн'],
    en: 'The term deposit in GEL pays 10.5% per year for 24 months, with a minimum of 500 GEL.',
    ru: 'Срочный депозит в лари приносит 10,5% годовых на 24 месяца, минимальная сумма 500 лари.',
  },
  {
    doc: 'deposits',
    kw: ['deposit', 'saving', 'вклад', 'депозит'],
    en: 'The savings deposit in GEL pays 9% per year for 12 months, with a minimum of 500 GEL. The 24-month term deposit pays 10.5%.',
    ru: 'Сберегательный депозит в лари приносит 9% годовых на 12 месяцев, минимум 500 лари. Срочный депозит на 24 месяца приносит 10,5%.',
  },
  {
    doc: 'complaints',
    kw: ['complain', 'жалоб'],
    en: 'You can submit a complaint at a branch, by calling *7070, in the app or by email. The bank answers within 10 business days.',
    ru: 'Жалобу можно подать в отделении, по телефону *7070, в приложении или по электронной почте. Банк отвечает в течение 10 рабочих дней.',
  },
  {
    doc: 'branches_hours',
    kw: ['branch', 'hour', 'open', 'saturday', 'sunday', 'weekend', 'филиал', 'отделен', 'работает'],
    en: 'Branches are open Monday to Friday 10:00-18:00 and Saturday 10:00-15:00. Web chat works every day 09:00-21:00.',
    ru: 'Отделения работают с понедельника по пятницу 10:00-18:00 и в субботу 10:00-15:00. Веб-чат работает ежедневно 09:00-21:00.',
  },
  {
    doc: 'mobile_app',
    kw: ['password', 'login', 'log in', 'forgot', 'парол'],
    en: 'On the login screen choose "Forgot password?" and confirm with an SMS code. After five wrong attempts login is blocked for 30 minutes.',
    ru: 'На экране входа выберите «Забыли пароль?» и подтвердите SMS-кодом. После пяти неверных попыток вход блокируется на 30 минут.',
  },
]

/** The best fact for a query, preferring facts from the documents that were retrieved. */
export function pickFact(query: string, docSlugs: string[], lang: 'en' | 'ru'): string | null {
  const q = query.toLowerCase()
  let best: { fact: Fact; score: number; index: number } | null = null
  FACTS.forEach((fact, index) => {
    const votes = fact.kw.filter((k) => q.includes(k)).length
    if (votes === 0) return
    const score = votes + (docSlugs.includes(fact.doc) ? 0.5 : 0)
    if (!best || score > best.score) best = { fact, score, index }
  })
  const found = best as { fact: Fact } | null
  return found ? found.fact[lang] : null
}
