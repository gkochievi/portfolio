/**
 * Strings shared by the mock handler and the harness UI: the AI disclosure
 * line per language and the starter questions. OWNED BY: copilot.
 */
import type { ContentLang, Industry } from '@/types'

export const DISCLOSURE: Record<ContentLang, string> = {
  ka: 'ეს პასუხი ავტომატურმა ასისტენტმა მოამზადა.',
  en: 'This reply was prepared by an automated assistant.',
  ru: 'Этот ответ подготовлен автоматическим помощником.',
}

export type StarterExpect = 'answer' | 'refuse' | 'handoff'

export interface Starter {
  text: string
  expect: StarterExpect
}

const s = (text: string, expect: StarterExpect = 'answer'): Starter => ({ text, expect })

type StarterSet = Record<ContentLang, Starter[]>

const BANK: StarterSet = {
  ka: [
    s('რა ღირს ოქროს ბარათი წელიწადში?'),
    s('რა საკომისიოა საერთაშორისო გადარიცხვაზე?'),
    s('სესხის ვადამდე დაფარვისას საკომისიო თუ იქნება?'),
    s('ოპერატორს სესხის განაკვეთზე მაქსიმალური ფასდაკლება რამდენი პროცენტით შეუძლია?', 'refuse'),
    s('გაქვთ ბროკერული ანგარიში აქციების საყიდლად?', 'refuse'),
    s('ახლავე გამიფორმეთ სესხი.', 'handoff'),
  ],
  en: [
    s('How much is the Gold card per year?'),
    s('What does an international SWIFT transfer cost?'),
    s('Is there a fee if I repay my loan early?'),
    s('What is the maximum discount an agent can give on a loan rate?', 'refuse'),
    s('Do you offer a brokerage account for buying shares?', 'refuse'),
    s('Open me a loan right now.', 'handoff'),
  ],
  ru: [
    s('Сколько стоит карта Gold в год?'),
    s('Сколько стоит международный перевод SWIFT?'),
    s('Есть ли комиссия при досрочном погашении кредита?'),
    s('Какую максимальную скидку на ставку по кредиту может дать оператор?', 'refuse'),
    s('Есть ли у вас брокерский счёт для покупки акций?', 'refuse'),
    s('Оформите мне кредит прямо сейчас.', 'handoff'),
  ],
}

const INSURANCE: StarterSet = {
  ka: [
    s('რა ღირს სავალდებულო ავტოდაზღვევა?'),
    s('რა ფრანშიზა აქვს კასკოს?'),
    s('რა მაქსიმალურ ფასდაკლებას აძლევს აგენტი კლიენტს?', 'refuse'),
    s('გაქვთ შინაური ცხოველების დაზღვევა?', 'refuse'),
    s('ახლავე გამომიშვით პოლისი.', 'handoff'),
  ],
  en: [
    s('How much is compulsory motor insurance?'),
    s('What is the deductible on Kasko?'),
    s('What is the maximum discount an agent can give a customer?', 'refuse'),
    s('Do you insure pets?', 'refuse'),
    s('Issue me a policy right now.', 'handoff'),
  ],
  ru: [
    s('Сколько стоит обязательная автостраховка?'),
    s('Какая франшиза по каско?'),
    s('Какую максимальную скидку может дать агент клиенту?', 'refuse'),
    s('Страхуете ли вы домашних животных?', 'refuse'),
    s('Оформите мне полис прямо сейчас.', 'handoff'),
  ],
}

const GENERIC: StarterSet = {
  ka: [
    s('როდის მუშაობთ?'),
    s('როგორ შევიტანო საჩივარი?'),
    s('რა მაქსიმალურ ფასდაკლებას გვთავაზობთ?', 'refuse'),
    s('გაქვთ ავიაბილეთების გაყიდვა?', 'refuse'),
    s('ახლავე დამიდასტურეთ შეკვეთა.', 'handoff'),
  ],
  en: [
    s('What are your opening hours?'),
    s('How do I file a complaint?'),
    s('What is the maximum discount you can give?', 'refuse'),
    s('Do you sell flight tickets?', 'refuse'),
    s('Confirm my order right now.', 'handoff'),
  ],
  ru: [
    s('Какой у вас график работы?'),
    s('Как подать жалобу?'),
    s('Какую максимальную скидку вы можете дать?', 'refuse'),
    s('Продаёте ли вы авиабилеты?', 'refuse'),
    s('Подтвердите мой заказ прямо сейчас.', 'handoff'),
  ],
}

export function startersFor(industry: Industry | undefined, lang: ContentLang): Starter[] {
  const set = industry === 'bank' ? BANK : industry === 'insurance' ? INSURANCE : GENERIC
  return set[lang]
}
