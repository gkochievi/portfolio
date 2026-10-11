/**
 * Vazi's conversations: 13 hand-written live chats (fixed ids the feature
 * simulators key on), ~350 generated history chats over 60 days, their
 * customers, assignments, notes, feedback and the one ready copilot draft.
 */
import { createRandom } from '@portfolio/demo-kit'

import type {
  AiHandoff,
  AiState,
  AssignedVia,
  Channel,
  ChatNote,
  ChatSession,
  ContentLang,
  CopilotDraft,
  Customer,
  DeliveryStatus,
  EndedBy,
  EndReason,
  ExternalContact,
  FailureKind,
  FaqStep,
  FaqTree,
  Feedback,
  HandoffReason,
  Message,
  MessageLocation,
  MessageSender,
  Operator,
  ReleaseReason,
  SessionAssignment,
  SessionFieldValue,
  SessionStatus,
  SessionTopic,
  TenantSettings,
} from '@/types'

import { BOT_HANDOVER_LINE, BOT_NAME, buildTranscript, endSummaryFor, handoffBrief, orderNumberFor, RU_TOPICS } from './scripts'
import { ANCHOR_MS, at, DAY, digits, fakePhone, hashString, HOUR, localDayStartMs, mediaFile, MIN, pad, SEC, TBILISI_OFFSET_MS, type MediaKey } from './util'

const TENANT = 'ten_vazi'

export interface ConversationSeed {
  customers: Customer[]
  sessions: ChatSession[]
  messages: Message[]
  assignments: SessionAssignment[]
  notes: ChatNote[]
  feedback: Feedback[]
  copilotDrafts: CopilotDraft[]
}

interface Ctx {
  operators: Operator[]
  settings: TenantSettings
  tree: FaqTree
}

/* ------------------------------------------------------------------ shared */

const FIELD_LABEL = {
  cf_name: { en: 'Your name', ka: 'თქვენი სახელი', ru: 'Ваше имя' },
  cf_phone: { en: 'Phone number', ka: 'ტელეფონის ნომერი', ru: 'Номер телефона' },
  cf_order: { en: 'Order number', ka: 'შეკვეთის ნომერი', ru: 'Номер заказа' },
  cf_topic: { en: 'Topic', ka: 'თემა', ru: 'Тема' },
} as const

const TOPIC_FIELD: Record<SessionTopic, string> = {
  delivery: 'delivery', order_status: 'order', returns: 'returns', payment: 'payment',
  pairing: 'other', gift: 'other', corporate: 'other', other: 'other',
}

function fieldValues(values: Partial<Record<keyof typeof FIELD_LABEL, string>>): SessionFieldValue[] {
  return (Object.keys(FIELD_LABEL) as (keyof typeof FIELD_LABEL)[])
    .filter((key) => values[key])
    .map((key) => ({ fieldId: key, label: { ...FIELD_LABEL[key] }, value: values[key] as string }))
}

function pick(text: { en: string; ka: string; ru?: string }, lang: ContentLang): string {
  return lang === 'ru' ? (text.ru ?? text.en) : text[lang]
}

/** FAQ walk as stored on the session: [nodeId, optionId] pairs → steps. */
function faqSteps(tree: FaqTree, lang: ContentLang, walk: [string, string][]): FaqStep[] {
  return walk.flatMap(([nodeId, optionId]) => {
    const node = tree.nodes[nodeId]
    const option = node?.options.find((candidate) => candidate.id === optionId)
    return node && option ? [{ nodeId, question: pick(node.text, lang), answer: pick(option.label, lang) }] : []
  })
}

const TOPIC_WALK: Record<SessionTopic, [string, string][]> = {
  delivery: [['faq_root', 'faq_o_delivery'], ['faq_delivery', 'faq_o_tbilisi']],
  order_status: [['faq_root', 'faq_o_order'], ['faq_order', 'faq_o_late']],
  returns: [['faq_root', 'faq_o_returns']],
  payment: [['faq_root', 'faq_o_payment']],
  gift: [['faq_root', 'faq_o_gift']],
  corporate: [['faq_root', 'faq_o_gift']],
  pairing: [['faq_root', 'faq_o_person']],
  other: [['faq_root', 'faq_o_person']],
}

function handoffSource(reason: HandoffReason): AiHandoff['source'] {
  if (reason === 'customer_request') return 'customer'
  if (reason === 'operator_claim') return 'operator'
  if (reason === 'circuit_open' || reason === 'bot_paused' || reason === 'delivery_failed') return 'system'
  return 'bot'
}

const NUMBER_PREFIX: Record<Exclude<Channel, 'web_widget'>, string> = {
  facebook_messenger: 'fb', instagram: 'ig', whatsapp: 'wa', telegram: 'tg', tiktok: 'tt',
}

/* -------------------------------------------------------------- live chats */

type Who = 'u' | 'o' | 'a' | 'b' | 'g'
interface LiveMsg {
  min: number
  who: Who
  text: string
  media?: MediaKey
  citations?: string[]
  status?: DeliveryStatus
  failure?: FailureKind
  location?: MessageLocation
}
const M = (min: number, who: Who, text: string, extra: Omit<LiveMsg, 'min' | 'who' | 'text'> = {}): LiveMsg => ({ min, who, text, ...extra })

interface LiveDef {
  id: string
  customerId: string
  name: string
  channel: Channel
  lang: ContentLang
  topic: SessionTopic
  status: SessionStatus
  operatorId: string | null
  startedMin: number
  claimedMin?: number
  claimVia?: AssignedVia
  phone?: string
  order?: string
  walk?: [string, string][]
  contact?: Omit<ExternalContact, 'id' | 'channel' | 'externalUserId'>
  ai?: { state: AiState; reason: HandoffReason; atMin: number }
  inactiveMin?: number
  interventionBy?: string
  unread?: number
  ip?: string
  messages: LiveMsg[]
}

const H = 60 // minutes in an hour, for readable offsets

function liveDefs(greeting: (lang: ContentLang) => string): LiveDef[] {
  return [
    {
      id: 'ses_live_web_handoff', customerId: 'cus_live_elene', name: 'ელენე ყიფიანი', channel: 'web_widget', lang: 'ka', topic: 'order_status',
      status: 'active', operatorId: 'op_luka', startedMin: 14.2, claimedMin: 9, phone: fakePhone(3142), order: 'VZ-24817', ip: '198.51.100.31',
      walk: [['faq_root', 'faq_o_order'], ['faq_order', 'faq_o_late']],
      ai: { state: 'handed_off', reason: 'customer_request', atMin: 11.1 }, unread: 1,
      messages: [
        M(13.5, 'b', 'გამარჯობა, ელენე! მე ვარ ჩიტი ასისტენტი, ვაზის ვირტუალური დამხმარე. თბილისში შეკვეთები ჩვეულებრივ 24 საათში მიდის. შეკვეთის ნომერს მომწერთ?', { citations: ['Delivery times & zones'] }),
        M(12.6, 'u', 'VZ-24817. გუშინ უნდა მოსულიყო და არავინ დამირეკა.'),
        M(12.4, 'b', 'შეკვეთა VZ-24817 კურიერთანაა. სად იმყოფება, დადასტურების SMS-ის ბმულით ნახავთ. გსურთ, ოპერატორს დაგაკავშიროთ?', { citations: ['Order tracking'] }),
        M(11.2, 'u', 'კი, ოპერატორთან დამაკავშირეთ, გთხოვთ.'),
        M(9, 'g', greeting('ka')),
        M(8.4, 'o', 'ელენე, ბოდიში დაგვიანებისთვის. კურიერთან ვამოწმებ, ერთი წუთით.'),
        M(2.1, 'u', 'კარგი. დღეს მაინც მოვა? საღამოს სახლში არ ვიქნები.'),
      ],
    },
    {
      id: 'ses_live_wa_window', customerId: 'cus_live_hannah', name: 'Hannah Weber', channel: 'whatsapp', lang: 'en', topic: 'delivery',
      status: 'active', operatorId: 'op_luka', startedMin: 31 * H + 12, claimedMin: 30 * H + 55, phone: fakePhone(4471),
      contact: { displayName: 'Hannah Weber', username: null, avatarId: 'nest-08', locale: 'en_GB' },
      messages: [
        M(31 * H + 12, 'u', 'Hello! Can you deliver 6 bottles to Batumi by Saturday? We’re having a small wedding party 🥂'),
        M(30 * H + 50, 'o', 'Hi Hannah, congratulations! Batumi takes 1–2 working days, so an order today arrives by Friday.'),
        M(30 * H + 5, 'u', 'Wonderful. Which rosé do you have? Something dry.'),
        M(29 * H + 40, 'o', 'Our dry rosé is the Tavkveri 2023, 34 ₾ a bottle. I can reserve 6 for you.'),
        M(29 * H + 38, 'o', 'Just reply “yes” and I’ll send the payment link 🙂'),
      ],
    },
    {
      id: 'ses_live_tiktok_cap', customerId: 'cus_live_mako', name: 'მაკო აბულაძე', channel: 'tiktok', lang: 'ka', topic: 'other',
      status: 'active', operatorId: 'op_luka', startedMin: 51.5, claimedMin: 48,
      contact: { displayName: 'Mako Abuladze', username: '@mako.sips', avatarId: 'nest-15', locale: 'ka_GE' },
      messages: [
        M(51, 'u', 'გამარჯობა! ვიდეოში ნახსენები შემოდგომის დეგუსტაცია როდისაა?'),
        M(49, 'u', 'ბილეთს სად ვიყიდი?'),
        M(47, 'o', 'გამარჯობა, მაკო! დეგუსტაცია 18 ოქტომბერს, შაბათს, 18:00-ზეა.'),
        M(46, 'o', 'ადგილი: ჩვენი სადეგუსტაციო დარბაზი, ერეკლე II-ის ქუჩა 14.'),
        M(44, 'o', 'ბილეთი 45 ₾ ღირს და ექვსი ღვინის დაგემოვნებას მოიცავს.'),
        M(41, 'o', 'ბილეთს საიტზე, „ღონისძიებების“ გვერდზე იყიდით.'),
        M(38, 'o', 'ან აქვე მომწერეთ სახელი და ტელეფონი და ადგილს დაგიჯავშნით.'),
        M(33, 'o', 'მენიუში იქნება ქვევრის რქაწითელი, საფერავი და ოჯალეში.'),
        M(27, 'o', 'ადგილები შეზღუდულია, სულ 30 სტუმარი.'),
        M(19, 'o', 'მეგობრებთან ერთად თუ მოხვალთ, ოთხ ბილეთზე მეოთხე უფასოა 🙂'),
        M(12, 'o', 'სხვა კითხვაც თუ გაქვთ, მომწერეთ!'),
        M(6, 'o', 'გასული დეგუსტაციის ფოტო', { media: 'tasting', status: 'failed', failure: 'network' }),
      ],
    },
    {
      id: 'ses_live_tg_locked', customerId: 'cus_live_davit', name: 'დავით მელიქიშვილი', channel: 'telegram', lang: 'ka', topic: 'corporate',
      status: 'active', operatorId: 'op_mariam', startedMin: 27 * H + 10, claimedMin: 27 * H,
      contact: { displayName: 'Davit Melikishvili', username: '@davit_mel', avatarId: null, locale: 'ka' },
      messages: [
        M(27 * H + 10, 'u', 'გამარჯობა, კორპორატიული შეკვეთისთვის ინვოისი მჭირდება.'),
        M(26 * H + 55, 'o', 'გამარჯობა, დავით! მომწერეთ კომპანიის სახელი და საიდენტიფიკაციო კოდი.'),
        M(26 * H + 5, 'u', 'შპს „ფერდობი“, ს/კ 400 000 017. 24 ბოთლი საფერავი გვინდა.'),
        M(25 * H + 50, 'o', 'მადლობა! ინვოისს დღესვე მოგიმზადებთ.'),
        M(25 * H + 20, 'o', 'აი ინვოისი. გადახდის შემდეგ მიტანას დავგეგმავთ.', { media: 'invoice' }),
      ],
    },
    {
      id: 'ses_live_ig_gift', customerId: 'cus_live_tom', name: 'Tom Ellis', channel: 'instagram', lang: 'en', topic: 'gift',
      status: 'active', operatorId: 'op_mariam', startedMin: 22, claimedMin: 19,
      contact: { displayName: 'Tom Ellis', username: '@tom.ellis.travels', avatarId: 'nest-04', locale: 'en_GB' },
      ai: { state: 'handed_off', reason: 'ai_recommended', atMin: 21.3 }, unread: 1,
      messages: [
        M(22, 'u', 'Hey! I’m flying home on Thursday and want to bring Georgian wine as gifts. Can you pack bottles for a suitcase?'),
        M(21.4, 'b', 'Hi Tom! I’m Chiti Assistant, Vazi’s virtual helper. We sell padded travel boxes for 2 or 3 bottles (12 ₾ each). For custom packing I’ll pass you to a colleague.', { citations: ['Gift boxes', 'Packaging for travel'] }),
        M(19, 'g', greeting('en')),
        M(18.5, 'o', 'Hi Tom, Mariam here! Happy to help. How many bottles are you thinking of?'),
        M(15, 'u', 'Maybe 6. Two Saperavi, two Kisi and two Khvanchkara for my mum.'),
        M(12, 'o', 'Great picks! Two 3-bottle travel boxes will fit those. The total with boxes is 312 ₾.'),
        M(11.5, 'o', 'This is the travel box:', { media: 'travel' }),
        M(3, 'u', 'Looks good! Can I pick it up at the shop on Wednesday?'),
      ],
    },
    {
      id: 'ses_live_fb_intervention', customerId: 'cus_live_natia', name: 'ნათია ბოლქვაძე', channel: 'facebook_messenger', lang: 'ka', topic: 'returns',
      status: 'active', operatorId: 'op_mariam', startedMin: 36, claimedMin: 34, phone: fakePhone(5820), interventionBy: 'adm_giorgi',
      contact: { displayName: 'Natia Bolkvadze', username: null, avatarId: null, locale: 'ka_GE' },
      messages: [
        M(36, 'u', 'გამარჯობა, ორი ბოთლი გატეხილი მომივიდა და თანხის დაბრუნება მინდა.'),
        M(34, 'g', greeting('ka')),
        M(33.5, 'o', 'გამარჯობა, ნათია! ძალიან ვწუხვართ. ფოტოს გამომიგზავნით?'),
        M(30, 'u', '', { media: 'broken' }),
        M(28, 'o', 'მადლობა. ხვალვე შეგიცვლით, უფასოდ.'),
        M(25, 'u', 'შეცვლა არ მინდა, თანხა დამიბრუნეთ. ეს უკვე მესამედ ხდება.'),
        M(20, 'a', 'ნათია, გამარჯობა, გიორგი ვარ, ვაზის მენეჯერი. თანხას სრულად დაგიბრუნებთ 3 სამუშაო დღეში. ბოდიშს გიხდით შეფერხებისთვის.'),
        M(15, 'u', 'მადლობა, ეს მინდოდა.'),
      ],
    },
    {
      id: 'ses_q_web_fresh', customerId: 'cus_live_irma', name: 'ირმა ხარაბაძე', channel: 'web_widget', lang: 'ka', topic: 'delivery',
      status: 'waiting', operatorId: null, startedMin: 0.5, phone: fakePhone(2648), ip: '198.51.100.47',
      walk: [['faq_root', 'faq_o_delivery'], ['faq_delivery', 'faq_o_regions']],
      messages: [M(0.3, 'u', 'გამარჯობა, ქუთაისში ხვალ ორი ყუთის მოტანა შეიძლება?')],
    },
    {
      id: 'ses_q_wa_amber', customerId: 'cus_live_lukas', name: 'Lukas Brandt', channel: 'whatsapp', lang: 'en', topic: 'pairing',
      status: 'waiting', operatorId: null, startedMin: 3.4, phone: fakePhone(7391),
      contact: { displayName: 'Lukas Brandt', username: null, avatarId: null, locale: 'de_DE' },
      ai: { state: 'handed_off', reason: 'no_answer', atMin: 3.05 },
      messages: [
        M(3.4, 'u', 'Hi there! What red would go with duck breast? Budget around 50 GEL.'),
        M(3.3, 'b', 'I’m Chiti Assistant, Vazi’s virtual helper. I couldn’t find a pairing for duck in our guides. How is it cooked?'),
        M(3.15, 'u', 'Pan-fried, with a cherry sauce.'),
        M(3.1, 'b', BOT_HANDOVER_LINE.en),
      ],
    },
    {
      id: 'ses_q_fb_late', customerId: 'cus_live_tamuna', name: 'თამუნა ჩიქოვანი', channel: 'facebook_messenger', lang: 'ka', topic: 'returns',
      status: 'waiting', operatorId: null, startedMin: 7.3,
      contact: { displayName: 'Tamuna Chikovani', username: null, avatarId: 'nest-13', locale: 'ka_GE' },
      ai: { state: 'handed_off', reason: 'unsupported_content', atMin: 7.1 },
      messages: [
        M(7.3, 'u', '', { media: 'broken' }),
        M(7.25, 'u', 'ეს მივიღე დღეს 😞 რა ვქნა?'),
        M(7.15, 'b', 'მე ვარ ჩიტი ასისტენტი. ფოტოს ვერ ვამუშავებ, ამიტომ კოლეგას გადაგაბარებთ, ის მალე გიპასუხებთ.'),
      ],
    },
    {
      id: 'ses_q_bot_web', customerId: 'cus_live_marta', name: 'Marta Novak', channel: 'web_widget', lang: 'en', topic: 'delivery',
      status: 'waiting', operatorId: null, startedMin: 2.4, phone: fakePhone(9025), ip: '198.51.100.58',
      walk: [['faq_root', 'faq_o_delivery'], ['faq_delivery', 'faq_o_regions']],
      ai: { state: 'bot', reason: 'customer_request', atMin: 0 },
      messages: [
        M(2.0, 'u', 'Do you ship to Batumi? How long does it take?'),
        M(1.9, 'b', 'Yes! Batumi takes 1–2 working days by courier and costs 8 ₾. Free delivery from 120 ₾ applies in Tbilisi only.', { citations: ['Delivery times & zones'] }),
        M(1.0, 'u', 'And is there a minimum order?'),
        M(0.9, 'b', 'There’s no minimum order. Anything else I can help with?', { citations: ['Ordering FAQ'] }),
      ],
    },
    {
      id: 'ses_q_bot_ig', customerId: 'cus_live_nini', name: 'ნინი ღლონტი', channel: 'instagram', lang: 'ka', topic: 'payment',
      status: 'waiting', operatorId: null, startedMin: 4.5,
      contact: { displayName: 'Nini Ghlonti', username: '@nini.gh', avatarId: 'nest-01', locale: 'ka_GE' },
      ai: { state: 'bot', reason: 'customer_request', atMin: 0 },
      messages: [
        M(4.5, 'u', 'გამარჯობა, განვადებით ყიდვა შეიძლება?'),
        M(4.4, 'b', 'გამარჯობა! მე ვარ ჩიტი ასისტენტი. განვადება ჯერ არ გვაქვს, მაგრამ ვიღებთ ბარათს, Apple Pay-ს და ნაღდ ანგარიშსწორებას მიტანისას.', { citations: ['Payment methods'] }),
        M(3.0, 'u', 'Apple Pay-ით ინსტაგრამიდანაც შემიძლია გადახდა?'),
        M(2.9, 'b', 'შეკვეთას საიტზე გააფორმებთ და იქვე გადაიხდით Apple Pay-ით. ბმული გამოგიგზავნოთ?', { citations: ['Payment methods'] }),
      ],
    },
    {
      id: 'ses_inactive_web', customerId: 'cus_live_sofia', name: 'Sofia Lindqvist', channel: 'web_widget', lang: 'en', topic: 'order_status',
      status: 'inactive', operatorId: 'op_lasha', startedMin: 26, claimedMin: 23, phone: fakePhone(6082), order: 'VZ-24702', ip: '198.51.100.63', inactiveMin: 4,
      messages: [
        M(25.5, 'u', 'Hi, I’d like to change the delivery address for order VZ-24702.'),
        M(23, 'g', greeting('en')),
        M(22, 'o', 'Hi Sofia! Sure, what’s the new address?'),
        M(20, 'u', 'It’s here, near the park:', { location: { lat: 41.7105, lng: 44.7509, label: 'Vake Park, Tbilisi' } }),
        M(19, 'u', 'Actually, let me check with my husband first.'),
        M(9.5, 'o', 'No problem, I’ll keep the chat open for a few minutes.'),
      ],
    },
    {
      id: 'ses_inactive_wa', customerId: 'cus_live_beso', name: 'ბესო ნოზაძე', channel: 'whatsapp', lang: 'ka', topic: 'payment',
      status: 'inactive', operatorId: 'op_mariam', startedMin: 40, claimedMin: 37, phone: fakePhone(8317), inactiveMin: 6,
      contact: { displayName: 'Beso Nozadze', username: null, avatarId: null, locale: 'ka_GE' },
      messages: [
        M(40, 'u', 'გამარჯობა, შეკვეთის თანხა ინტერნეტ ბანკით როგორ გადავიხადო?'),
        M(37, 'g', greeting('ka')),
        M(36, 'o', 'გამარჯობა, ბესო! ინვოისს გამოგიგზავნით და მასზე მითითებულ ანგარიშზე გადაიხდით.'),
        M(33, 'u', '', { media: 'voice1' }),
        M(30, 'o', 'ხმოვანი შეტყობინება მოვისმინე: კი, ნებისმიერი ბანკიდან შეიძლება. ინვოისს ახლავე გამოგიგზავნით.'),
        M(29.5, 'o', 'ინვოისი', { media: 'invoice' }),
        M(13, 'o', 'ბესო, ინვოისი ხომ მიიღეთ?'),
      ],
    },
  ]
}

function externalNumber(channel: Channel, phone: string | undefined, seed: string): string {
  if (channel === 'web_widget') return `anon-${(hashString(seed) & 0xffffff).toString(16).padStart(6, '0')}`
  if (channel === 'whatsapp' && phone) return `wa:${digits(phone)}`
  let n = 0
  for (const char of seed) n = (n * 31 + char.charCodeAt(0)) % 1_000_000_007
  const width = channel === 'telegram' ? 9 : channel === 'tiktok' ? 19 : 16
  return `${NUMBER_PREFIX[channel]}:${String(n).padStart(width, '7').slice(0, width)}`
}

function buildLive(ctx: Ctx, out: ConversationSeed): void {
  const op = (id: string) => ctx.operators.find((candidate) => candidate.id === id)
  const greeting = (lang: ContentLang) => pick(ctx.settings.autoGreeting, lang)

  for (const def of liveDefs(greeting)) {
    const startedMs = ANCHOR_MS - def.startedMin * MIN
    const faq = def.walk ? faqSteps(ctx.tree, def.lang, def.walk) : []
    const operator = def.operatorId ? op(def.operatorId) : undefined
    const fields: Record<string, string> = {}
    if (def.channel === 'web_widget' || def.phone) fields.cf_name = def.name
    if (def.phone) fields.cf_phone = def.phone
    if (def.order) fields.cf_order = def.order
    if (def.channel === 'web_widget') fields.cf_topic = TOPIC_FIELD[def.topic]

    const contact: ExternalContact | null = def.contact && def.channel !== 'web_widget'
      ? { id: `ext_${def.customerId.slice(9)}`, channel: def.channel, externalUserId: externalNumber(def.channel, def.phone, def.id).split(':')[1] ?? def.id, ...def.contact }
      : null

    const drafts: { ts: number; sender: MessageSender; text: string; msg?: LiveMsg; isPreChat: boolean }[] = []
    faq.forEach((step, index) => {
      drafts.push({ ts: startedMs + index * 8 * SEC, sender: 'bot', text: step.question, isPreChat: true })
      drafts.push({ ts: startedMs + index * 8 * SEC + 4 * SEC, sender: 'user', text: step.answer, isPreChat: true })
    })
    const senderOf: Record<Who, MessageSender> = { u: 'user', o: 'operator', g: 'operator', a: 'admin', b: 'bot' }
    for (const msg of def.messages) drafts.push({ ts: ANCHOR_MS - msg.min * MIN, sender: senderOf[msg.who], text: msg.text, msg, isPreChat: false })

    const lastUserTs = Math.max(...drafts.filter((draft) => draft.sender === 'user').map((draft) => draft.ts))
    const lastStaffTs = Math.max(0, ...drafts.filter((draft) => draft.sender === 'operator' || draft.sender === 'admin').map((draft) => draft.ts))

    const messages: Message[] = drafts.map((draft, index) => {
      const staff = draft.sender !== 'user'
      const status: DeliveryStatus = draft.msg?.status ?? (staff ? (draft.ts < lastUserTs || def.channel === 'web_widget' ? 'read' : 'delivered') : 'delivered')
      const userSeen = !staff && (draft.ts < lastStaffTs || !def.unread)
      const file = draft.msg?.media ? mediaFile(draft.msg.media) : null
      const location = draft.msg?.location ?? null
      return {
        id: `${def.id}_m${index + 1}`,
        tenantId: TENANT,
        sessionId: def.id,
        sender: draft.sender,
        senderId: draft.sender === 'user' ? def.customerId : draft.sender === 'operator' ? (operator?.id ?? null) : draft.sender === 'admin' ? 'adm_giorgi' : null,
        senderName: draft.sender === 'user' ? def.name : draft.sender === 'operator' ? (operator?.nickname ?? null) : draft.sender === 'admin' ? 'Giorgi' : BOT_NAME,
        type: location ? 'location' : file ? (file.mimeType.startsWith('image/') ? 'image' : file.mimeType.startsWith('audio/') ? 'audio' : 'file') : 'text',
        content: draft.text,
        file,
        location,
        sentByAdmin: draft.sender === 'admin',
        timestamp: new Date(draft.ts).toISOString(),
        deliveryStatus: status,
        failureKind: draft.msg?.failure ?? null,
        seenAt: status === 'read' ? new Date(draft.ts + 20 * SEC).toISOString() : userSeen ? new Date(Math.min(draft.ts + 30 * SEC, ANCHOR_MS)).toISOString() : null,
        reactionEmoji: null,
        channel: def.channel,
        isPreChat: draft.isPreChat,
        isAutoGreeting: draft.msg?.who === 'g',
        citations: draft.msg?.citations ?? [],
        copilotRef: null,
        template: null,
      }
    })

    // Business messages since the customer last wrote (failed sends don't count).
    const consecutive = messages.filter((message) =>
      (message.sender === 'operator' || message.sender === 'admin') && Date.parse(message.timestamp) > lastUserTs && message.deliveryStatus !== 'failed').length
    const firstReply = messages.find((message) => message.sender === 'operator' && !message.isAutoGreeting)
    const lastTs = Math.max(...drafts.map((draft) => draft.ts))
    const brief = handoffBrief({ id: def.id, topic: def.topic, clientLanguage: def.lang })
    const aiHandoff: AiHandoff | null = def.ai && def.ai.state !== 'bot'
      ? { at: at(-def.ai.atMin * MIN), reason: def.ai.reason, summary: def.order ? brief.summary.replace(orderNumberFor(def.id), def.order) : brief.summary, goal: brief.goal, source: handoffSource(def.ai.reason) }
      : null

    const customer: Customer = {
      id: def.customerId,
      tenantId: TENANT,
      name: def.name,
      number: externalNumber(def.channel, def.phone, def.id),
      channel: def.channel,
      status: def.status === 'waiting' ? 'waiting' : 'connected',
      activeSessionId: def.id,
      fields,
      externalContact: contact,
      language: def.lang,
      createdAt: new Date(startedMs - (def.id === 'ses_live_web_handoff' || def.id === 'ses_live_fb_intervention' ? 45 * DAY : 0)).toISOString(),
    }

    out.customers.push(customer)
    out.messages.push(...messages)
    out.sessions.push({
      id: def.id,
      tenantId: TENANT,
      customerId: def.customerId,
      customerName: def.name,
      customerNumber: customer.number,
      channel: def.channel,
      status: def.status,
      origin: 'seed',
      topic: def.topic,
      startedAt: new Date(startedMs).toISOString(),
      lastActivity: new Date(lastTs).toISOString(),
      endedAt: null,
      endedBy: null,
      endReason: null,
      endSummary: null,
      warningIssuedAt: def.inactiveMin ? at(-def.inactiveMin * MIN) : null,
      inactiveSince: def.inactiveMin ? at(-def.inactiveMin * MIN) : null,
      operatorId: def.operatorId,
      excludedOperatorIds: [],
      clientIp: def.ip ?? null,
      clientLanguage: def.lang,
      faqPath: faq,
      customFields: fieldValues({ cf_name: fields.cf_name, cf_phone: fields.cf_phone, cf_order: fields.cf_order, cf_topic: fields.cf_topic }),
      firstStaffReplyAt: firstReply?.timestamp ?? null,
      lastInboundAt: def.channel === 'web_widget' ? null : new Date(lastUserTs).toISOString(),
      consecutiveBusinessMessages: consecutive,
      externalThreadId: def.channel === 'web_widget' ? null : `thr_${def.id.slice(4)}`,
      adminInterventionActive: !!def.interventionBy,
      interventionAdminId: def.interventionBy ?? null,
      aiState: def.ai?.state ?? null,
      aiHandoff,
      unreadCount: def.unread ?? 0,
      messageCount: messages.length,
      transcript: 'full',
    })

    if (operator && def.claimedMin !== undefined) {
      out.assignments.push({
        id: `asg_${def.id.slice(4)}`,
        sessionId: def.id,
        operatorId: operator.id,
        operatorName: { ...operator.name },
        assignedVia: def.claimVia ?? 'claim',
        assignedAt: at(-def.claimedMin * MIN),
        releasedAt: null,
        releaseReason: null,
      })
    }
  }
}

/* ----------------------------------------------------------------- history */

const GE_FIRST: [string, string][] = [
  ['ელენე', 'Elene'], ['ირმა', 'Irma'], ['თამუნა', 'Tamuna'], ['ნინი', 'Nini'], ['დავით', 'Davit'], ['ნათია', 'Natia'],
  ['მაკო', 'Mako'], ['ლევან', 'Levan'], ['ბესო', 'Beso'], ['ქეთევან', 'Ketevan'], ['სოფიკო', 'Sopiko'], ['ზვიად', 'Zviad'],
  ['ხატია', 'Khatia'], ['გოგა', 'Goga'], ['ია', 'Ia'], ['მზია', 'Mzia'], ['ოთარ', 'Otar'], ['ლია', 'Lia'], ['ვახო', 'Vakho'],
  ['ეკატერინე', 'Ekaterine'], ['შოთა', 'Shota'], ['ნანუკა', 'Nanuka'], ['ტატო', 'Tato'], ['მარიკა', 'Marika'],
  ['ალექსანდრე', 'Aleksandre'], ['თეონა', 'Teona'], ['გიგა', 'Giga'], ['ანანო', 'Anano'], ['რეზო', 'Rezo'], ['ლალი', 'Lali'],
]
const GE_LAST: [string, string][] = [
  ['წულაია', 'Tsulaia'], ['ნოზაძე', 'Nozadze'], ['ჯავახიშვილი', 'Javakhishvili'], ['სხირტლაძე', 'Skhirtladze'], ['ფხაკაძე', 'Pkhakadze'],
  ['ქავთარაძე', 'Kavtaradze'], ['მამალაძე', 'Mamaladze'], ['გაბუნია', 'Gabunia'], ['ბაქრაძე', 'Bakradze'], ['ცომაია', 'Tsomaia'],
  ['ლორთქიფანიძე', 'Lortkipanidze'], ['ჭანტურია', 'Chanturia'], ['ტაბატაძე', 'Tabatadze'], ['ხუციშვილი', 'Khutsishvili'], ['მესხი', 'Meskhi'],
  ['ბერუაშვილი', 'Beruashvili'], ['გოგიჩაიშვილი', 'Gogichaishvili'], ['ართმელაძე', 'Artmeladze'], ['ჩხაიძე', 'Chkhaidze'], ['სულაბერიძე', 'Sulaberidze'],
]
const EN_NAMES = [
  'Emma Fischer', 'Oliver Grant', 'Chloe Martin', 'Daniel Kowalski', 'Ines Moreau', 'Ethan Brooks', 'Lea Hoffmann', 'Noah Bennett',
  'Clara Jensen', 'Ryan Doyle', 'Mia Schulz', 'Aaron Fields', 'Nora Lindgren', 'Victor Haas', 'Grace Whitman', 'Felix Bauer',
  'Alice Duval', 'Henry Shaw', 'Julia Romano', 'Lucas Meyer', 'Zoe Carter', 'Peter Novak', 'Ella Brandt', 'Simon Keller',
  'Laura Costa', 'Max Ritter', 'Hanna Berg', 'Owen Price',
]
const RU_NAMES: [string, string][] = [
  ['Анна Смирнова', 'Anna Smirnova'], ['Илья Петров', 'Ilya Petrov'], ['Ольга Кузнецова', 'Olga Kuznetsova'],
  ['Дмитрий Орлов', 'Dmitry Orlov'], ['Мария Волкова', 'Maria Volkova'], ['Сергей Белов', 'Sergey Belov'],
]

const CHANNEL_WEIGHTS: [Channel, number][] = [
  ['web_widget', 40], ['whatsapp', 20], ['facebook_messenger', 12], ['instagram', 12], ['telegram', 8], ['tiktok', 8],
]
const TOPIC_WEIGHTS: [SessionTopic, number][] = [
  ['delivery', 22], ['order_status', 20], ['returns', 10], ['payment', 12], ['pairing', 12], ['gift', 10], ['corporate', 5], ['other', 9],
]
const HOUR_WEIGHTS: [number, number][] = [
  [9, 2], [10, 4], [11, 8], [12, 9], [13, 9], [14, 7], [15, 5], [16, 5], [17, 5], [18, 6], [19, 8], [20, 8], [21, 2],
]
const OPERATOR_WEIGHTS: [string, number][] = [
  ['op_luka', 26], ['op_mariam', 26], ['op_lasha', 16], ['op_salome', 14], ['op_irakli', 10], ['op_keti', 8],
]
type Outcome = 'operator' | 'customer' | 'silent' | 'admin' | 'missed'
const OUTCOME_WEIGHTS: [Outcome, number][] = [['operator', 55], ['customer', 28], ['silent', 9], ['admin', 3], ['missed', 5]]
const RELEASE_WEIGHTS: [ReleaseReason, number][] = [['response_timeout', 50], ['reassigned', 25], ['logout_grace', 20], ['operator_removed', 5]]
const HANDOFF_WEIGHTS: [HandoffReason, number][] = [['customer_request', 50], ['ai_recommended', 25], ['no_answer', 15], ['unsupported_content', 10]]
const BOT_CHANNELS: Channel[] = ['web_widget', 'facebook_messenger', 'instagram', 'whatsapp']

const FEEDBACK_COMMENTS: Record<ContentLang, string[]> = {
  en: ['Very quick, thank you!', 'Mariam was lovely, the gift box was perfect.', 'The courier was late but the chat sorted it out.', 'Great wine advice.', 'Easy and friendly.'],
  ka: ['ძალიან სწრაფად მიპასუხეთ, მადლობა!', 'საუკეთესო მომსახურება.', 'კურიერმა დააგვიანა, მაგრამ ჩატში მალე მოგვარდა.', 'კარგი რჩევა მომცეს ღვინოზე.', 'მადლობა, ყველაფერი გასაგებად ამიხსენით.'],
  ru: ['Спасибо, очень быстро!', 'Вежливо и по делу.'],
}

interface PoolCustomer {
  customer: Customer
  phone: string | null
  weight: number
}

function buildHistory(ctx: Ctx, out: ConversationSeed): void {
  const rnd = createRandom(20261005)
  const operators = new Map(ctx.operators.map((operator) => [operator.id, operator]))
  const reserved = new Set([1234, 6666, 7713, 1010, 2020, 3030, 3142, 4471, 5820, 2648, 7391, 9025, 6082, 8317])
  let phoneCursor = 4100
  const nextPhone = () => {
    do phoneCursor = (phoneCursor + 37) % 10_000
    while (reserved.has(phoneCursor))
    reserved.add(phoneCursor)
    return fakePhone(phoneCursor)
  }

  /* customers */
  const pool: PoolCustomer[] = []
  for (let index = 0; index < 104; index += 1) {
    const lang: ContentLang = index < 70 ? 'ka' : index < 98 ? 'en' : 'ru'
    const channel = rnd.weighted(CHANNEL_WEIGHTS)
    let name: string
    let latin: string
    if (lang === 'ka') {
      const first = GE_FIRST[index % GE_FIRST.length] as [string, string]
      const last = GE_LAST[(index * 7 + 3) % GE_LAST.length] as [string, string]
      name = `${first[0]} ${last[0]}`
      latin = `${first[1]} ${last[1]}`
    } else if (lang === 'en') {
      name = EN_NAMES[index - 70] ?? 'Guest'
      latin = name
    } else {
      const ru = RU_NAMES[index - 98] as [string, string]
      name = ru[0]
      latin = ru[1]
    }
    const phone = channel === 'web_widget' || channel === 'whatsapp' ? nextPhone() : null
    const id = `cus_${pad(index + 1)}`
    const handle = latin.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')
    const contact: ExternalContact | null = channel === 'web_widget' ? null : {
      id: `ext_${pad(index + 1)}`,
      channel,
      externalUserId: externalNumber(channel, phone ?? undefined, id).split(':')[1] ?? id,
      displayName: channel === 'telegram' || channel === 'whatsapp' ? name : latin,
      username: channel === 'instagram' || channel === 'tiktok' || channel === 'telegram' ? `@${handle}` : null,
      avatarId: rnd.chance(0.5) ? `nest-${pad(rnd.int(1, 16), 2)}` : null,
      locale: lang === 'ka' ? 'ka_GE' : lang === 'ru' ? 'ru_RU' : rnd.pick(['en_GB', 'en_US', 'de_DE', 'pl_PL']),
    }
    const fields: Record<string, string> = { cf_name: name }
    if (phone) fields.cf_phone = phone
    pool.push({
      customer: {
        id, tenantId: TENANT, name, number: externalNumber(channel, phone ?? undefined, id), channel, status: 'disconnected',
        activeSessionId: null, fields, externalContact: contact, language: lang, createdAt: at(0),
      },
      phone,
      weight: index % 7 === 0 ? 5 : index % 3 === 0 ? 2 : 1,
    })
  }

  /* sessions (ids are assigned after sorting by start) */
  interface Plan {
    pc: PoolCustomer
    startMs: number
    endMs: number
    outcome: Outcome
    operatorId: string | null
    transfer: { from: string; reason: ReleaseReason; atMs: number } | null
    claimMs: number
    via: AssignedVia
    topic: SessionTopic
    bot: HandoffReason | null
    faq: boolean
    full: boolean
  }
  const plans: Plan[] = []
  const weightedPool = pool.map((pc, index) => [index, pc.weight] as [number, number])
  for (let k = 0; k < 350; k += 1) {
    let daysAgo = rnd.int(0, 59)
    const weekday = new Date(localDayStartMs(daysAgo) + TBILISI_OFFSET_MS + 12 * HOUR).getUTCDay()
    if (weekday === 0 && rnd.chance(0.85)) daysAgo += 1 // the shop is closed on Sundays
    const hour = daysAgo === 0 ? rnd.int(9, 13) : rnd.weighted(HOUR_WEIGHTS)
    let startMs = localDayStartMs(daysAgo) + hour * HOUR + rnd.int(0, 59) * MIN + rnd.int(0, 59) * SEC
    if (startMs > ANCHOR_MS - 70 * MIN) startMs = ANCHOR_MS - rnd.int(70, 300) * MIN
    const pc = pool[rnd.weighted(weightedPool)] as PoolCustomer
    const lang = pc.customer.language
    const outcome = rnd.weighted(OUTCOME_WEIGHTS)
    const duration = outcome === 'missed' ? rnd.int(15, 125) : rnd.weighted([[rnd.int(4, 9), 3], [rnd.int(9, 20), 5], [rnd.int(20, 42), 2]] as [number, number][])
    const operatorId = outcome === 'missed' ? null : rnd.weighted(OPERATOR_WEIGHTS)
    const topic = lang === 'ru' ? rnd.pick(RU_TOPICS) : rnd.weighted(TOPIC_WEIGHTS)
    const channel = pc.customer.channel
    const bot = BOT_CHANNELS.includes(channel) && rnd.chance(0.45) ? rnd.weighted(HANDOFF_WEIGHTS) : null
    const claimMs = startMs + (bot ? 2 * MIN : 0) + rnd.int(20, 150) * SEC
    const endMs = startMs + duration * MIN
    let transfer: Plan['transfer'] = null
    if (operatorId && duration >= 10 && rnd.chance(0.3)) {
      const others = OPERATOR_WEIGHTS.map(([id]) => id).filter((id) => id !== operatorId)
      transfer = { from: rnd.pick(others), reason: rnd.weighted(RELEASE_WEIGHTS), atMs: claimMs + rnd.int(3, 7) * MIN }
    }
    plans.push({
      pc, startMs, endMs, outcome, operatorId, transfer, claimMs, via: rnd.chance(0.7) ? 'claim' : 'auto_assign', topic, bot,
      faq: channel === 'web_widget' && rnd.chance(0.5), full: false,
    })
  }
  plans.sort((left, right) => left.startMs - right.startMs)
  plans.forEach((plan, index) => { plan.full = index % 9 === 4 || plan.startMs > ANCHOR_MS - 2 * DAY })

  const greetingFor = (lang: ContentLang) => (ctx.settings.autoGreetingEnabled ? pick(ctx.settings.autoGreeting, lang) : null)

  const emit = (id: string, plan: Plan): ChatSession => {
    const { pc } = plan
    const lang = pc.customer.language
    const channel = pc.customer.channel
    const endedBy: EndedBy = plan.outcome === 'operator' ? 'operator' : plan.outcome === 'customer' ? 'customer' : plan.outcome === 'admin' ? 'admin' : 'system'
    const endReason: EndReason = plan.outcome === 'silent' ? 'inactivity' : plan.outcome === 'missed' ? (hashString(id) % 2 === 0 ? 'stale_waiting' : 'queue_cleared') : 'manual'
    const order = orderNumberFor(id)
    const brief = handoffBrief({ id, topic: plan.topic, clientLanguage: lang })
    const fields = fieldValues({
      cf_name: pc.customer.fields.cf_name,
      cf_phone: pc.phone ?? undefined,
      cf_order: plan.topic === 'order_status' || plan.topic === 'payment' ? order : undefined,
      cf_topic: channel === 'web_widget' ? TOPIC_FIELD[plan.topic] : undefined,
    })
    const session: ChatSession = {
      id,
      tenantId: TENANT,
      customerId: pc.customer.id,
      customerName: pc.customer.name,
      customerNumber: pc.customer.number,
      channel,
      status: 'ended',
      origin: 'seed',
      topic: plan.topic,
      startedAt: new Date(plan.startMs).toISOString(),
      lastActivity: new Date(plan.endMs).toISOString(),
      endedAt: new Date(plan.endMs).toISOString(),
      endedBy,
      endReason,
      endSummary: endSummaryFor(plan.topic, lang, plan.outcome === 'missed' ? 'missed' : plan.outcome === 'silent' ? 'silent' : 'done'),
      warningIssuedAt: plan.outcome === 'silent' ? new Date(plan.endMs - 5 * MIN).toISOString() : null,
      inactiveSince: plan.outcome === 'silent' ? new Date(plan.endMs - 5 * MIN).toISOString() : null,
      operatorId: plan.operatorId,
      excludedOperatorIds: plan.transfer?.reason === 'response_timeout' ? [plan.transfer.from] : [],
      clientIp: channel === 'web_widget' ? `198.51.100.${10 + (Math.floor(plan.startMs / 1000) % 200)}` : null,
      clientLanguage: lang,
      faqPath: plan.faq ? faqSteps(ctx.tree, lang, TOPIC_WALK[plan.topic]) : [],
      customFields: fields,
      firstStaffReplyAt: null,
      lastInboundAt: null,
      consecutiveBusinessMessages: 0,
      externalThreadId: channel === 'web_widget' ? null : `thr_${id.slice(4)}`,
      adminInterventionActive: false,
      interventionAdminId: null,
      aiState: plan.bot ? 'closed' : null,
      aiHandoff: plan.bot ? { at: new Date(plan.startMs + 90 * SEC).toISOString(), reason: plan.bot, summary: brief.summary, goal: brief.goal, source: handoffSource(plan.bot) } : null,
      unreadCount: 0,
      messageCount: 0,
      transcript: plan.full ? 'full' : 'summary',
    }
    const operator = plan.operatorId ? operators.get(plan.operatorId) : undefined
    const messages = buildTranscript(session, operator ? { id: operator.id, nickname: operator.nickname } : null, greetingFor(lang))
    session.messageCount = messages.length
    session.firstStaffReplyAt = messages.find((message) => message.sender === 'operator' && !message.isAutoGreeting)?.timestamp ?? null
    session.lastInboundAt = [...messages].reverse().find((message) => message.sender === 'user')?.timestamp ?? null
    if (plan.full) out.messages.push(...messages)

    if (plan.operatorId && operator) {
      if (plan.transfer) {
        const from = operators.get(plan.transfer.from)
        if (from) {
          out.assignments.push({
            id: `asg_${id.slice(4)}_1`, sessionId: id, operatorId: from.id, operatorName: { ...from.name }, assignedVia: plan.via,
            assignedAt: new Date(plan.claimMs).toISOString(), releasedAt: new Date(plan.transfer.atMs).toISOString(), releaseReason: plan.transfer.reason,
          })
        }
        out.assignments.push({
          id: `asg_${id.slice(4)}_2`, sessionId: id, operatorId: operator.id, operatorName: { ...operator.name }, assignedVia: 'claim',
          assignedAt: new Date(plan.transfer.atMs + 70 * SEC).toISOString(), releasedAt: null, releaseReason: null,
        })
      } else {
        out.assignments.push({
          id: `asg_${id.slice(4)}_1`, sessionId: id, operatorId: operator.id, operatorName: { ...operator.name }, assignedVia: plan.via,
          assignedAt: new Date(plan.claimMs).toISOString(), releasedAt: null, releaseReason: null,
        })
      }
    }

    if (channel === 'web_widget' && plan.operatorId && plan.outcome !== 'silent' && hashString(`${id}:rated`) % 10 < 6) {
      const roll = hashString(`${id}:rating`) % 100
      const rating = (roll < 66 ? 5 : roll < 88 ? 4 : roll < 96 ? 3 : roll < 98 ? 2 : 1) as Feedback['rating']
      const comments = FEEDBACK_COMMENTS[lang]
      out.feedback.push({
        id: `fb_${id.slice(4)}`, tenantId: TENANT, sessionId: id, customerId: pc.customer.id, operatorId: plan.operatorId, rating,
        comment: roll % 3 === 0 ? (comments[roll % comments.length] ?? null) : null, submittedAt: new Date(plan.endMs + 40 * SEC).toISOString(),
      })
    }

    if (Date.parse(pc.customer.createdAt) > plan.startMs) pc.customer.createdAt = new Date(plan.startMs - 30 * SEC).toISOString()
    return session
  }

  const historySessions = plans.map((plan, index) => emit(`ses_h${pad(index + 1)}`, plan))

  /* Previous chats of the live customers (same phone), so the context panel has history. */
  const live = (id: string) => out.customers.find((customer) => customer.id === id)
  const extras: [string, number, SessionTopic, string, Outcome][] = [
    ['cus_live_elene', 18, 'delivery', 'op_luka', 'operator'],
    ['cus_live_elene', 41, 'gift', 'op_mariam', 'customer'],
    ['cus_live_hannah', 12, 'pairing', 'op_mariam', 'operator'],
    ['cus_live_natia', 9, 'returns', 'op_lasha', 'operator'],
    ['cus_live_natia', 23, 'returns', 'op_salome', 'operator'],
    ['cus_live_beso', 30, 'payment', 'op_luka', 'customer'],
  ]
  extras.forEach(([customerId, daysAgo, topic, operatorId, outcome], index) => {
    const customer = live(customerId)
    if (!customer) return
    const startMs = localDayStartMs(daysAgo) + (12 + (index % 6)) * HOUR + 17 * MIN
    const plan: Plan = {
      pc: { customer, phone: customer.fields.cf_phone ?? null, weight: 0 },
      startMs, endMs: startMs + 16 * MIN, outcome, operatorId, transfer: null, claimMs: startMs + 50 * SEC, via: 'claim', topic, bot: null,
      faq: false, full: true,
    }
    historySessions.push(emit(`ses_prev_${pad(index + 1, 2)}`, plan))
  })

  historySessions.sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
  out.sessions.unshift(...historySessions)
  out.customers.push(...pool.map((pc) => pc.customer))
}

/* ------------------------------------------------------- template messages */

/**
 * Two ended WhatsApp chats close with an approved template (a delivery update
 * the operator sent after the chat), so transcripts show the template card.
 * The template's `preview` is stored with the {{n}} slots already filled in.
 */
function addTemplateMessages(out: ConversationSeed): void {
  const candidates = out.sessions.filter(
    (session) =>
      session.channel === 'whatsapp' && session.status === 'ended' && session.transcript === 'full' && session.endedBy !== 'customer'
      && session.operatorId !== null && session.clientLanguage === 'en' && (session.topic === 'delivery' || session.topic === 'order_status'),
  )
  const chosen = [candidates[0], candidates[1]].filter((session): session is ChatSession => session !== undefined)
  const forms = [
    {
      templateId: 'wat_order_update', name: 'order_update', header: 'Order update', footer: 'Vazi Wine Cellar', buttons: ['Track order'],
      body: (first: string, order: string) => `Hi ${first}, an update on your order ${order}: it has been delivered. Reply to this message if you have any questions.`,
    },
    {
      templateId: 'wat_delivery_reschedule', name: 'delivery_reschedule', header: 'Delivery update', footer: 'Vazi Wine Cellar', buttons: ['Yes, that works', 'Choose another time'],
      body: (first: string, _order: string) => `Hello ${first}, we could not deliver your order on Friday. Would Saturday 11:00–14:00 suit you instead?`,
    },
  ]
  chosen.forEach((session, index) => {
    const form = forms[index % forms.length] as (typeof forms)[number]
    const messages = out.messages.filter((message) => message.sessionId === session.id)
    const last = messages[messages.length - 1]
    const operatorMessage = messages.find((message) => message.sender === 'operator')
    if (!last || !operatorMessage) return
    const lastMs = Date.parse(last.timestamp)
    const sentMs = Math.max(lastMs + 1_000, Math.min(Date.parse(session.endedAt ?? session.lastActivity), lastMs + 25 * SEC))
    const first = session.customerName.split(' ')[0] ?? session.customerName
    const body = form.body(first, orderNumberFor(session.id))
    out.messages.push({
      id: `${session.id}_m${messages.length + 1}`,
      tenantId: TENANT,
      sessionId: session.id,
      sender: 'operator',
      senderId: operatorMessage.senderId,
      senderName: operatorMessage.senderName,
      type: 'template',
      content: body,
      file: null,
      location: null,
      sentByAdmin: false,
      timestamp: new Date(sentMs).toISOString(),
      deliveryStatus: 'read',
      failureKind: null,
      seenAt: new Date(sentMs + 9 * SEC).toISOString(),
      reactionEmoji: null,
      channel: 'whatsapp',
      isPreChat: false,
      isAutoGreeting: false,
      citations: [],
      copilotRef: null,
      template: { templateId: form.templateId, name: form.name, preview: { header: form.header, body, footer: form.footer, buttons: [...form.buttons] } },
    })
    session.messageCount += 1
  })
}

/* ------------------------------------------------------- notes and copilot */

const NOTE_TEXTS: [string, string][] = [
  ['op_luka', 'Regular customer, prefers delivery after 19:00.'],
  ['op_mariam', 'Asked for an English invoice, sent by email.'],
  ['op_lasha', 'Courier confirmed the broken box was dropped at the depot.'],
  ['op_salome', 'Promised a callback tomorrow morning about the gift card.'],
  ['op_luka', 'მისამართი შეცვალა: ვაჟა-ფშაველას 21, მე-3 სადარბაზო.'],
  ['op_mariam', 'მეორე შეკვეთა აქვს გზაში, ერთად მიუტანეთ.'],
  ['adm_giorgi', 'Gave a 10% voucher for the delay (code issued manually).'],
  ['op_irakli', 'Wants to be told when the 2019 Saperavi is back in stock.'],
  ['op_keti', 'Corporate client, invoices go to the accountant, not to him.'],
  ['op_lasha', 'კლიენტი უკმაყოფილოა კურიერით, ვთხოვე ბოდიში.'],
]

function buildNotes(ctx: Ctx, out: ConversationSeed): void {
  const name = (id: string) => {
    const operator = ctx.operators.find((candidate) => candidate.id === id)
    return operator ? operator.name.en : id === 'adm_giorgi' ? 'Giorgi Abashidze' : id
  }
  const note = (id: string, sessionId: string, authorId: string, content: string, createdAt: string): ChatNote => ({
    id, tenantId: TENANT, sessionId, authorRole: authorId.startsWith('adm_') ? 'admin' : 'operator', authorId, authorName: name(authorId), content, createdAt,
  })
  out.notes.push(
    note('note_1', 'ses_live_web_handoff', 'op_luka', 'Called the courier: VZ-24817 is in his van, he can be in Saburtalo by 13:30.', at(-7 * MIN)),
    note('note_2', 'ses_live_web_handoff', 'adm_giorgi', 'Second late delivery for her this month. Offer the 10% voucher.', at(-5 * MIN)),
    note('note_3', 'ses_live_fb_intervention', 'op_mariam', 'Third broken delivery this month for this customer. Asked Giorgi to step in.', at(-24 * MIN)),
  )
  const full = out.sessions.filter((session) => session.transcript === 'full' && session.status === 'ended' && session.operatorId)
  for (let index = 0; index < 17 && full.length > 0; index += 1) {
    const session = full[(index * 11 + 5) % full.length] as ChatSession
    const [authorId, content] = NOTE_TEXTS[index % NOTE_TEXTS.length] as [string, string]
    const createdMs = Date.parse(session.startedAt) + 6 * MIN
    out.notes.push(note(`note_${index + 4}`, session.id, authorId.startsWith('op_') ? (session.operatorId ?? authorId) : authorId, content, new Date(createdMs).toISOString()))
  }
}

function buildCopilot(out: ConversationSeed): void {
  const turn = [...out.messages].reverse().find((message) => message.sessionId === 'ses_live_web_handoff' && message.sender === 'user')
  const session = out.sessions.find((candidate) => candidate.id === 'ses_live_web_handoff')
  out.copilotDrafts.push({
    id: 'cop_1',
    tenantId: TENANT,
    sessionId: 'ses_live_web_handoff',
    turnMessageId: turn?.id ?? null,
    state: 'ready',
    retryAfterMs: null,
    knowledge: [
      { n: 1, title: 'Delivery times & zones', snippet: 'Tbilisi orders placed before 16:00 are delivered the same day; later orders the next morning. Couriers call 15 minutes before arriving.', documentId: 'kb_delivery', score: 0.82 },
      { n: 2, title: 'Late or missed deliveries', snippet: 'If a courier misses the slot, offer a priority delivery the same day or the next morning, and a 10% voucher on the next order.', documentId: 'kb_late', score: 0.77 },
    ],
    suggestions: [
      { index: 0, kind: 'answer', text: 'ელენე, კიდევ ერთხელ ბოდიშს გიხდით. შეკვეთა VZ-24817 დღესვე, 13:00–15:00-ზე მოგიტანთ, საღამომდე [2]. კომპენსაციად შემდეგ შეკვეთაზე 10% ფასდაკლებას გიგზავნით.', citations: [2] },
      { index: 1, kind: 'clarify', text: 'რომელ საათამდე იქნებით დღეს სახლში? კურიერს თქვენს დროს მოვარგებ [1].', citations: [1] },
      { index: 2, kind: 'answer', text: 'თუ დღეს არ გაწყობთ, ხვალ დილით, 10:00–12:00-ზე უფასოდ მოგიტანთ და კურიერი წინასწარ დაგირეკავთ [1][2].', citations: [1, 2] },
    ],
    handoff: { recommended: false, reason: 'customer_request', summary: session?.aiHandoff?.summary ?? '', goal: session?.aiHandoff?.goal ?? '' },
    grounded: true,
    commitmentWarning: true,
    transform: null,
    createdAt: turn ? new Date(Date.parse(turn.timestamp) + 2 * SEC).toISOString() : at(-2 * MIN),
  })
}

export function buildConversations(ctx: Ctx): ConversationSeed {
  const out: ConversationSeed = { customers: [], sessions: [], messages: [], assignments: [], notes: [], feedback: [], copilotDrafts: [] }
  buildLive(ctx, out)
  buildHistory(ctx, out)
  addTemplateMessages(out)
  buildNotes(ctx, out)
  buildCopilot(out)
  out.messages.sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  return out
}
