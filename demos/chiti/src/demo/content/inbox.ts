/**
 * Scripted customers for the inbox simulator (owner: inbox).
 *
 * - `SCRIPTS` is keyed by the fixed seeded session ids. `reactive` lines are
 *   what the customer says after each staff message (one line per turn);
 *   `autonomous` is a slow two-sided script that plays on its own so an admin
 *   spectating Mariam's chats sees them move.
 * - `POOL` feeds the spawner: ~20 customers with form fields, an optional FAQ
 *   walk, an opening message and a few follow-ups.
 */
import type { ContentLang } from '@/types'

export interface AutoTurn {
  who: 'u' | 'o'
  text: string
}

export interface Script {
  reactive: string[]
  autonomous?: AutoTurn[]
  /** Delay before the first autonomous turn, ms. */
  autoStartMs?: number
}

export const SCRIPTS: Record<string, Script> = {
  ses_live_web_handoff: {
    reactive: [
      'გასაგებია, მადლობა. თუ 14:00-მდე მოვა, სახლში ვიქნები. კურიერმა მაინც დამირეკოს, გთხოვთ.',
      'კარგი. ამ თვეში მეორედ აგვიანებს, რამე კომპენსაცია ხომ არ შეიძლება?',
      '10% ვაუჩერი ძალიან კარგია, მადლობა! შემდეგ შეკვეთაზე გამოვიყენებ.',
      'მადლობა დახმარებისთვის, ლუკა. კარგ დღეს გისურვებთ 🙂',
    ],
  },
  ses_live_wa_window: {
    reactive: [
      'Hi, sorry for the late reply! Yes please, 6 bottles of the Tavkveri rosé 🙂',
      'Perfect. Will it arrive by Friday evening? The party starts at 7.',
      'Wonderful, thank you so much for the quick help!',
    ],
  },
  ses_live_tiktok_cap: {
    reactive: [
      'მადლობა! 2 ბილეთი მინდა, ჩემთვის და დაქალისთვის.',
      'სახელი: მაკო აბულაძე, ტელეფონი: +995 555 00 41 87.',
      'კარგი, მაშინ შაბათს გნახავთ! 🍷',
    ],
  },
  ses_live_tg_locked: {
    reactive: ['გადავიხადე დღეს, გადარიცხვის ქვითარს გამოგიგზავნით.', 'მადლობა!'],
  },
  ses_live_ig_gift: {
    reactive: ['Sounds good, thank you!', 'Perfect, see you on Wednesday!'],
    autoStartMs: 22_000,
    autonomous: [
      { who: 'o', text: 'Absolutely! We’re open Wednesday 09:00–21:00 at Erekle II Street 14. Shall I reserve the two travel boxes under your name?' },
      { who: 'u', text: 'Yes please, Tom Ellis. I’ll come around 11, is that OK?' },
      { who: 'o', text: '11:00 works perfectly. Payment at pickup is fine, card or cash.' },
      { who: 'u', text: 'Great, thank you Mariam! See you Wednesday 🙂' },
      { who: 'o', text: 'See you then, and safe travels with the bottles! 🍷' },
    ],
  },
  ses_live_fb_intervention: {
    reactive: [
      'კარგი, მადლობა. ბარათზე ჩამერიცხება, ხომ?',
      'გასაგებია. მადლობა სწრაფი რეაგირებისთვის, გიორგი.',
    ],
  },
  ses_inactive_web: {
    reactive: ['Sorry for the delay! My husband agrees, please use Vake Park, near the fountain.', 'Thank you, that’s perfect.'],
  },
  ses_inactive_wa: {
    reactive: ['გადავიხადე, ჩარიცხვის დადასტურება გამომიგზავნეთ, გთხოვთ.', 'კარგი, მადლობა!'],
    autoStartMs: 40_000,
    autonomous: [
      { who: 'u', text: 'ინვოისი მივიღე, ახლავე გადავიხდი. რამდენ ხანში ჩაირიცხება?' },
      { who: 'o', text: 'მადლობა, ბესო! ჩვეულებრივ რამდენიმე წუთში. ჩარიცხვისთანავე შეკვეთას გავგზავნით.' },
      { who: 'u', text: 'კარგი, მადლობა!' },
    ],
  },
  ses_q_web_fresh: {
    reactive: [
      'დილით 11:00-მდე თუ მივიღებ, საუკეთესო იქნება. შეკვეთა 2 ყუთია, თითო 6 ბოთლი.',
      'კარგი, მაშინ ასე გავაფორმოთ. ბარათით გადავიხდი ადგილზე.',
      'მადლობა, ძალიან დამეხმარეთ!',
    ],
  },
  ses_q_wa_amber: {
    reactive: [
      'I like medium body, nothing too tannic. Open to a Georgian red I haven’t tried.',
      'The Saperavi sounds good. Do you have it in stock for delivery tomorrow?',
      'Great, please add two bottles to my order. Thanks!',
    ],
  },
  ses_q_fb_late: {
    reactive: [
      'ბოთლს ძირი აქვს გატეხილი და ყუთი სველი იყო. შეკვეთის ნომერი VZ-24790.',
      'შეცვლა მირჩევნია, ხვალ ბათუმში ვიქნები. შეგიძლიათ მიტანა დილით?',
      'მადლობა გაგებისთვის!',
    ],
  },
  ses_q_bot_web: {
    reactive: ['Thanks. Can I pay by card when the courier arrives?', 'OK, and do you deliver on Sundays?', 'Perfect, thank you.'],
  },
  ses_q_bot_ig: {
    reactive: ['კარგი, ბმული გამომიგზავნეთ, გთხოვთ.', 'მადლობა, გადახდა მოვახერხე 🙂'],
  },
}

export type PoolTopic = 'delivery' | 'order' | 'returns' | 'payment' | 'other'

export interface PoolCustomer {
  name: string
  lang: ContentLang
  topic: PoolTopic
  order?: string
  /** '@handle' for Instagram / Telegram / TikTok chats. */
  handle: string
  opening: string
  /** Optional second line sent right after the first. */
  extra?: string
  replies: string[]
}

export const POOL: PoolCustomer[] = [
  {
    name: 'ნათია გელაშვილი', lang: 'ka', topic: 'delivery', handle: '@natia.gel',
    opening: 'გამარჯობა, დღეს მიტანა თუ შეიძლება ვაკეში? 3 ბოთლი საფერავი მინდა.',
    replies: ['საღამოს 6-სა და 8-ს შორის თუ მოასწრებთ, კარგია.', 'კარგი, ბარათით გადავიხდი კურიერთან.', 'მადლობა!'],
  },
  {
    name: 'James Porter', lang: 'en', topic: 'delivery', handle: '@jamesp_travels',
    opening: 'Hi! Do you deliver to hotels in Old Tbilisi? I’m staying near Sioni.',
    replies: ['Room 214, the hotel is on Sioni Street. Anytime after 5pm works.', 'Can I pay with a foreign card?', 'Great, thanks a lot!'],
  },
  {
    name: 'ზურაბ მაისურაძე', lang: 'ka', topic: 'order', order: 'VZ-24833', handle: '@zura_m',
    opening: 'გამარჯობა, შეკვეთა VZ-24833 გუშინ გავაფორმე, სტატუსს ვერ ვხედავ.',
    replies: ['ტელეფონზე დამირეკეთ, თუ შეიძლება.', 'კარგი, ველოდები. მადლობა!'],
  },
  {
    name: 'Emma Clarke', lang: 'en', topic: 'order', order: 'VZ-24846', handle: '@emma.clarke',
    opening: 'Hello, I placed order VZ-24846 this morning. Can I still add a bottle to it?',
    replies: ['One more bottle of the Kisi 2022, please.', 'Perfect, thank you!'],
  },
  {
    name: 'მარიამ წულაძე', lang: 'ka', topic: 'returns', handle: '@mariam.tsul',
    opening: 'გამარჯობა, ორი ბოთლიდან ერთი გატეხილი მომივიდა. რა ვქნა?',
    extra: 'ფოტოს გამოგიგზავნით, თუ დაგჭირდებათ.',
    replies: ['შეცვლას ვამჯობინებ, ხვალ სახლში ვიქნები.', 'მადლობა, ძალიან დამეხმარეთ!'],
  },
  {
    name: 'Oliver Graf', lang: 'en', topic: 'returns', handle: '@oli_graf',
    opening: 'Hi, one bottle in my box has a damaged cork. Can I swap it?',
    replies: ['Order number is VZ-24811. I can send a photo.', 'Thanks, a replacement tomorrow works well.'],
  },
  {
    name: 'გიგა ხუციშვილი', lang: 'ka', topic: 'payment', handle: '@giga_kh',
    opening: 'გამარჯობა, ბარათით გადახდა ვერ მოვახერხე, ორჯერ შეცდომა გამოვიდა.',
    replies: ['შეკვეთის ნომერია VZ-24852.', 'მიტანისას გადავიხდი, თუ შეიძლება.', 'მადლობა!'],
  },
  {
    name: 'Sara Lindgren', lang: 'en', topic: 'payment', handle: '@saralindgren',
    opening: 'Can I get an invoice for my order? I need it for my company.',
    replies: ['The company name is Nordlys Travel, VAT number 556 000 17.', 'Thank you, that is all I need.'],
  },
  {
    name: 'ლევან ბარამიძე', lang: 'ka', topic: 'other', handle: '@levan.bar',
    opening: 'გამარჯობა, ქვევრის ღვინოებზე ექსკურსია ხომ არ გაქვთ?',
    replies: ['ოთხი კაცი ვიქნებით, შაბათს თუ არის ადგილი.', 'კარგია, 45 ლარი მისაღებია. მადლობა!'],
  },
  {
    name: 'Anna Vogel', lang: 'en', topic: 'other', handle: '@anna.vogel',
    opening: 'Hi! Do you do corporate gift boxes? We need 20 for the end of the month.',
    replies: ['Two bottles per box, with a card in English. Budget is about 90 GEL per box.', 'Please send the offer by email, thank you!'],
  },
  {
    name: 'თამარ ჯაყელი', lang: 'ka', topic: 'delivery', handle: '@tamar_jak',
    opening: 'გამარჯობა, ბათუმში მიტანა რამდენი დღე სჭირდება?',
    replies: ['პარასკევისთვის მჭირდება, შესაძლებელია?', 'კარგი, ახლავე გავაფორმებ შეკვეთას. მადლობა!'],
  },
  {
    name: 'Daniel Foster', lang: 'en', topic: 'other', handle: '@dfoster',
    opening: 'What would you pour with lamb ribs? Something bold but not too expensive.',
    replies: ['Around 40 GEL a bottle would be great.', 'Two bottles of the Saperavi then. Thank you!'],
  },
  {
    name: 'ნინო აფციაური', lang: 'ka', topic: 'order', order: 'VZ-24860', handle: '@nino.afts',
    opening: 'შეკვეთა VZ-24860 გუშინ უნდა მოსულიყო. კურიერი არ გამოჩენილა.',
    replies: ['თბილისში ვარ, სახლში ვიქნები 15:00-მდე.', 'კარგი, ველოდები. მადლობა!'],
  },
  {
    name: 'Maria Rossi', lang: 'en', topic: 'delivery', handle: '@maria.rossi',
    opening: 'Hello! Can the courier deliver on Sunday? It’s a surprise for my husband.',
    replies: ['Anytime in the afternoon. Thank you!', 'Perfect, please also add a gift card.'],
  },
  {
    name: 'დავით კვარაცხელია', lang: 'ka', topic: 'payment', handle: '@dato_kv',
    opening: 'გამარჯობა, Apple Pay-ით გადახდა შესაძლებელია?',
    replies: ['კარგი, მაშინ საიტზე გავაფორმებ.', 'მადლობა, ყველაფერი გასაგებია!'],
  },
  {
    name: 'Chloe Martin', lang: 'en', topic: 'returns', handle: '@chloe.m',
    opening: 'Hi, I received the wrong vintage. I ordered the 2021 Saperavi but got the 2022.',
    replies: ['Order VZ-24829. The 2022 is fine if there is a small discount.', 'That works, thank you for sorting it out!'],
  },
  {
    name: 'ანა მგელაძე', lang: 'ka', topic: 'other', handle: '@ana.mgel',
    opening: 'გამარჯობა, საჩუქრად ბოთლის დაფასოება შეგიძლიათ? ბარათითაც.',
    replies: ['ორი ბოთლი და ხელნაწერი ბარათი, თუ შეიძლება.', 'ძალიან კარგი, მადლობა!'],
  },
  {
    name: 'Thomas Keller', lang: 'en', topic: 'order', order: 'VZ-24871', handle: '@tkeller',
    opening: 'Hi, can I change the delivery address for VZ-24871? I moved flats today.',
    replies: ['New address: Chavchavadze Ave 33, flat 9.', 'Thanks, you’re a star!'],
  },
  {
    name: 'ელისო ჭანტურია', lang: 'ka', topic: 'delivery', handle: '@eliso_ch',
    opening: 'გამარჯობა, სამ ბოთლზე უფასო მიტანა მოქმედებს?',
    replies: ['141 ლარი გამომივიდა, მაშინ უფასოა, არა?', 'მადლობა, ახლავე გავაფორმებ!'],
  },
  {
    name: 'Peter Novak', lang: 'en', topic: 'payment', handle: '@peter.novak',
    opening: 'Hello, I was charged twice for one order. Can you check?',
    replies: ['It is order VZ-24874. Both charges are from this morning.', 'Understood, thank you for the quick answer.'],
  },
]
