/**
 * Tenants, their configuration and staff. Vazi Wine Cellar is the rich
 * tenant; the other five exist for the super-admin views.
 */
import type {
  Admin,
  AiLinkStatus,
  BannedClient,
  ChannelFeatures,
  ChitiAccount,
  CustomField,
  DaySchedule,
  FaqNode,
  FaqTree,
  Operator,
  OperatorStatus,
  PlatformSettings,
  QuickReply,
  QuickReplyCategory,
  Role,
  SuperAdmin,
  Supervisor,
  Tenant,
  TenantIntegrations,
  TenantSettings,
  ThemePreset,
  WhatsAppTemplate,
  WorkingHours,
  ContentLang,
  PersonName,
  LocalizedText,
} from '@/types'

import { ago, DAY, DEMO_PASSWORD, HOUR, L, MIN } from './util'

/* ----------------------------------------------------------------- tenants */

const ALL_ON: ChannelFeatures = { facebook_messenger: true, instagram: true, whatsapp: true, telegram: true, tiktok: true }
const META_ONLY: ChannelFeatures = { facebook_messenger: true, instagram: true, whatsapp: true, telegram: false, tiktok: false }

interface TenantDef {
  id: string
  slug: string
  name: LocalizedText
  industry: LocalizedText
  features: ChannelFeatures
  createdDaysAgo: number
  state: 'active' | 'disabled' | 'deleted'
  counts: Tenant['counts']
}

const TENANT_DEFS: TenantDef[] = [
  {
    id: 'ten_vazi', slug: 'vazi', name: L('Vazi Wine Cellar', 'ვაზი', 'Винный погреб Вази'),
    industry: L('Online wine shop', 'ღვინის ონლაინ მაღაზია', 'Интернет-магазин вина'),
    features: ALL_ON, createdDaysAgo: 412, state: 'active', counts: { operators: 6, admins: 2, supervisors: 1, customers: 0, sessions: 0 },
  },
  {
    id: 'ten_bostani', slug: 'bostani', name: L('Bostani Market', 'ბოსტანი', 'Бостани Маркет'),
    industry: L('Grocery delivery', 'პროდუქტების მიტანა', 'Доставка продуктов'),
    features: META_ONLY, createdDaysAgo: 365, state: 'active', counts: { operators: 3, admins: 1, supervisors: 0, customers: 2140, sessions: 5318 },
  },
  {
    id: 'ten_mtvare', slug: 'mtvare', name: L('Mtvare Net', 'მთვარე ნეტი', 'Мтваре Нет'),
    industry: L('Home internet provider', 'სახლის ინტერნეტის პროვაიდერი', 'Домашний интернет'),
    features: { facebook_messenger: true, instagram: false, whatsapp: true, telegram: true, tiktok: false },
    createdDaysAgo: 298, state: 'active', counts: { operators: 3, admins: 1, supervisors: 0, customers: 3872, sessions: 9014 },
  },
  {
    id: 'ten_kvali', slug: 'kvali', name: L('Kvali Tours', 'კვალი ტურსი', 'Квали Турс'),
    industry: L('Kazbegi and Svaneti tours', 'ტურები ყაზბეგსა და სვანეთში', 'Туры в Казбеги и Сванети'),
    features: { facebook_messenger: true, instagram: true, whatsapp: true, telegram: false, tiktok: true },
    createdDaysAgo: 141, state: 'active', counts: { operators: 2, admins: 1, supervisors: 0, customers: 614, sessions: 1391 },
  },
  {
    id: 'ten_aivani', slug: 'aivani', name: L('Aivani Home', 'აივანი ჰოუმი', 'Айвани Хоум'),
    industry: L('Furniture and decor e-shop', 'ავეჯისა და დეკორის ონლაინ მაღაზია', 'Мебель и декор онлайн'),
    features: META_ONLY, createdDaysAgo: 230, state: 'deleted', counts: { operators: 2, admins: 1, supervisors: 0, customers: 433, sessions: 952 },
  },
  {
    id: 'ten_gza', slug: 'gza', name: L('Gza Rides', 'გზა', 'Гза Райдс'),
    industry: L('E-scooter rental', 'ელექტროსკუტერების გაქირავება', 'Аренда электросамокатов'),
    features: { facebook_messenger: true, instagram: true, whatsapp: true, telegram: true, tiktok: false },
    createdDaysAgo: 176, state: 'disabled', counts: { operators: 2, admins: 1, supervisors: 0, customers: 1207, sessions: 2606 },
  },
]

export function buildTenants(): Tenant[] {
  return TENANT_DEFS.map((def) => ({
    id: def.id,
    slug: def.slug,
    name: def.name,
    industry: def.industry,
    allowedOrigins: [`https://${def.slug}.example`, `https://www.${def.slug}.example`],
    disabled: def.state === 'disabled',
    disabledAt: def.state === 'disabled' ? ago(5 * DAY + 3 * HOUR) : null,
    deletedAt: def.state === 'deleted' ? ago(12 * DAY + 6 * HOUR) : null,
    createdAt: ago(def.createdDaysAgo * DAY),
    features: { ...def.features },
    counts: { ...def.counts },
  }))
}

/* ---------------------------------------------------------------- FAQ tree */

function q(id: string, text: LocalizedText, x: number, y: number, options: FaqNode['options']): FaqNode {
  return { id, type: 'question', text, position: { x, y }, options }
}
function a(id: string, text: LocalizedText, x: number, y: number): FaqNode {
  return { id, type: 'answer', text, position: { x, y }, options: [] }
}
function opt(id: string, label: LocalizedText, nextId: string | null, transferToOperator = false) {
  return { id, label, nextId, transferToOperator }
}

export function buildVaziFaq(): FaqTree {
  const nodes: FaqNode[] = [
    q('faq_root', L('What can we help with?', 'რით შეგვიძლია დაგეხმაროთ?', 'Чем мы можем помочь?'), 0, 240, [
      opt('faq_o_delivery', L('Delivery zones & times', 'მიტანის ზონები და დრო', 'Зоны и сроки доставки'), 'faq_delivery'),
      opt('faq_o_order', L('Order status', 'შეკვეთის სტატუსი', 'Статус заказа'), 'faq_order'),
      opt('faq_o_returns', L('Returns & broken bottles', 'დაბრუნება და გატეხილი ბოთლი', 'Возврат и разбитые бутылки'), 'faq_returns'),
      opt('faq_o_payment', L('Payment', 'გადახდა', 'Оплата'), 'faq_payment'),
      opt('faq_o_gift', L('Gifts & corporate orders', 'საჩუქრები და კორპორატიული შეკვეთა', 'Подарки и корпоративные заказы'), 'faq_gift'),
      opt('faq_o_person', L('Talk to a person', 'ადამიანთან საუბარი', 'Связаться с человеком'), null, true),
    ]),
    q('faq_delivery', L('Where should we deliver?', 'სად მოგიტანოთ?', 'Куда доставить?'), 360, 0, [
      opt('faq_o_tbilisi', L('Tbilisi', 'თბილისი', 'Тбилиси'), 'faq_del_tbilisi'),
      opt('faq_o_regions', L('Other cities', 'სხვა ქალაქები', 'Другие города'), 'faq_del_regions'),
    ]),
    a('faq_del_tbilisi', L(
      'In Tbilisi we deliver the same day for orders placed before 16:00, and the next morning after that. Delivery is free from 120 ₾.',
      'თბილისში 16:00-მდე გაფორმებულ შეკვეთას იმავე დღეს მოგიტანთ, უფრო გვიან გაფორმებულს — მეორე დილით. მიტანა 120 ₾-დან უფასოა.',
      'По Тбилиси заказы до 16:00 доставляем в тот же день, позже — на следующее утро. Доставка бесплатна от 120 ₾.',
    ), 720, -60),
    a('faq_del_regions', L(
      'Batumi, Kutaisi and Telavi: 1–2 working days by courier, 8 ₾. Other towns: 2–3 working days.',
      'ბათუმი, ქუთაისი და თელავი: 1–2 სამუშაო დღე კურიერით, 8 ₾. სხვა ქალაქები: 2–3 სამუშაო დღე.',
      'Батуми, Кутаиси и Телави: 1–2 рабочих дня курьером, 8 ₾. Другие города: 2–3 рабочих дня.',
    ), 720, 80),
    q('faq_order', L('Has your order arrived?', 'შეკვეთა უკვე მიიღეთ?', 'Ваш заказ уже доставлен?'), 360, 200, [
      opt('faq_o_late', L('Not yet, it’s late', 'ჯერ არა, აგვიანებს', 'Ещё нет, опаздывает'), 'faq_order_late'),
      opt('faq_o_change', L('I want to change it', 'შეცვლა მინდა', 'Хочу изменить заказ'), null, true),
    ]),
    a('faq_order_late', L(
      'Sorry for the wait! The link in your confirmation SMS shows where the courier is. If it’s more than a day late, share your order number with us.',
      'ბოდიში ლოდინისთვის! დადასტურების SMS-ში მიღებული ბმულით ნახავთ, სადაა კურიერი. თუ ერთ დღეზე მეტით აგვიანებს, მოგვწერეთ შეკვეთის ნომერი.',
      'Извините за ожидание! Ссылка в SMS с подтверждением показывает, где курьер. Если заказ опаздывает больше чем на день, пришлите нам номер заказа.',
    ), 720, 220),
    a('faq_returns', L(
      'A bottle arrived broken? Send us a photo within 48 hours and we’ll replace it free. Unopened wine can be returned within 14 days.',
      'ბოთლი გატეხილი მოვიდა? 48 საათში გამოგვიგზავნეთ ფოტო და უფასოდ შეგიცვლით. გაუხსნელი ღვინის დაბრუნება 14 დღის განმავლობაში შეიძლება.',
      'Бутылка пришла разбитой? Пришлите фото в течение 48 часов, и мы бесплатно её заменим. Неоткрытое вино можно вернуть в течение 14 дней.',
    ), 360, 360),
    a('faq_payment', L(
      'We accept cards, Apple Pay and cash on delivery in Tbilisi. Companies can pay by invoice.',
      'ვიღებთ ბარათს, Apple Pay-ს და თბილისში ნაღდ ანგარიშსწორებას მიტანისას. კომპანიებს ინვოისით გადახდაც შეუძლიათ.',
      'Принимаем карты, Apple Pay и наличные при доставке по Тбилиси. Компании могут оплатить по счёту.',
    ), 360, 480),
    a('faq_gift', L(
      'Gift boxes for 1–3 bottles start at 12 ₾, with a free handwritten card. From 24 bottles companies get 12% off.',
      'საჩუქრის ყუთები 1–3 ბოთლისთვის 12 ₾-დან, ხელით დაწერილი ბარათი უფასოა. 24 ბოთლიდან კომპანიებს 12% ფასდაკლება აქვთ.',
      'Подарочные коробки на 1–3 бутылки от 12 ₾, открытка от руки бесплатно. От 24 бутылок компаниям скидка 12%.',
    ), 360, 600),
  ]
  return { rootIds: ['faq_root'], nodes: Object.fromEntries(nodes.map((node) => [node.id, node])) }
}

/* ---------------------------------------------------------------- settings */

const THEMES: Record<string, [ThemePreset, ThemePreset, ThemePreset]> = {
  ten_vazi: ['canary', 'paper', 'olive'],
  ten_bostani: ['moss', 'paper', 'moss'],
  ten_mtvare: ['night', 'slate', 'slate'],
  ten_kvali: ['clay', 'paper', 'clay'],
  ten_aivani: ['plum', 'paper', 'plum'],
  ten_gza: ['olive', 'slate', 'olive'],
}

export function buildSettings(tenants: Tenant[]): TenantSettings[] {
  return tenants.map((tenant) => {
    const rich = tenant.id === 'ten_vazi'
    const [clientTheme, operatorTheme, adminTheme] = THEMES[tenant.id] ?? ['canary', 'paper', 'olive']
    return {
      tenantId: tenant.id,
      chatTitle: rich
        ? L('Vazi Wine Cellar · Chat', 'ვაზი · ჩატი', 'Вази · Чат')
        : L(`${tenant.name.en} · Support`, `${tenant.name.ka} · მხარდაჭერა`, `${tenant.name.ru ?? tenant.name.en} · Поддержка`),
      clientTheme,
      operatorTheme,
      adminTheme,
      operatorEnterDirectly: tenant.id === 'ten_bostani',
      chatDistributionStrategy: tenant.id === 'ten_bostani' ? 'least_busy' : 'round_robin',
      operatorChatLimit: rich ? 4 : 5,
      typingTransparency: rich,
      requestFeedback: true,
      inactiveWarningMinutes: 5,
      inactiveDisconnectMinutes: 10,
      operatorResponseMinutes: 0,
      operatorLogoutGraceMinutes: 0,
      chatRetentionDays: rich ? 180 : 365,
      faqEnabled: rich,
      faqShowOperatorButton: true,
      faqTree: rich ? buildVaziFaq() : { rootIds: [], nodes: {} },
      messageNotesEnabled: true,
      clientIpEnabled: rich,
      autoGreetingEnabled: rich,
      autoGreeting: rich
        ? L('Hi! Thanks for writing to Vazi Wine Cellar. I’ll help you right away.', 'გამარჯობა! მადლობა, რომ ვაზს მოგვწერეთ. ახლავე დაგეხმარებით.', 'Здравствуйте! Спасибо, что написали в Вази. Сейчас помогу.')
        : L('Hi! An operator will be with you shortly.', 'გამარჯობა! ოპერატორი მალე გიპასუხებთ.', 'Здравствуйте! Оператор скоро ответит.'),
      bannedMessage: L(
        'This chat is not available to you. If you think this is a mistake, please call the shop.',
        'ეს ჩატი თქვენთვის მიუწვდომელია. თუ ფიქრობთ, რომ ეს შეცდომაა, დაგვირეკეთ.',
        'Этот чат для вас недоступен. Если это ошибка, позвоните нам.',
      ),
      aiBotEnabled: rich || tenant.id === 'ten_mtvare',
      widgetPosition: 'right',
    }
  })
}

export function buildWorkingHours(tenants: Tenant[]): WorkingHours[] {
  return tenants.map((tenant) => {
    const weeklySchedule: DaySchedule[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day,
      enabled: day !== 0,
      start: tenant.id === 'ten_mtvare' ? '08:00' : '09:00',
      end: tenant.id === 'ten_mtvare' ? '23:00' : '21:00',
    }))
    return {
      tenantId: tenant.id,
      timezone: 'Asia/Tbilisi',
      weeklySchedule,
      isTemporarilyClosed: false,
      temporaryClosedFrom: null,
      temporaryClosedUntil: null,
      temporaryClosedMessage: L(
        'We are closed for a stock-take today. Back tomorrow at 09:00!',
        'დღეს ინვენტარიზაციის გამო დაკეტილები ვართ. ხვალ 09:00-დან გელოდებით!',
        'Сегодня мы закрыты на инвентаризацию. Ждём вас завтра с 09:00!',
      ),
      nextAvailableMessage: L(
        'We are offline right now. Leave your number and we’ll call you back when we open.',
        'ახლა ხაზზე არ ვართ. დაგვიტოვეთ ნომერი და გახსნისთანავე დაგირეკავთ.',
        'Сейчас мы не в сети. Оставьте номер, и мы перезвоним, когда откроемся.',
      ),
      demoOverride: tenant.id === 'ten_vazi' ? 'open' : 'auto',
    }
  })
}

/* ------------------------------------------------------------------- staff */

interface PersonDef {
  id: string
  tenantId: string
  en: string
  ka: string
  nick: string
  username: string
  email: string
  number: string
  language: ContentLang
  createdDaysAgo: number
}
interface OperatorDef extends PersonDef {
  status: OperatorStatus
  avatarId: string | null
  external: boolean
  lastSeenMinAgo: number
}

const op = (
  id: string, tenantId: string, en: string, ka: string, nick: string, username: string, email: string, number: string,
  status: OperatorStatus, avatarId: string | null, createdDaysAgo: number, extra: Partial<OperatorDef> = {},
): OperatorDef => ({ id, tenantId, en, ka, nick, username, email, number, status, avatarId, createdDaysAgo, language: 'ka', external: false, lastSeenMinAgo: status === 'offline' ? 60 * 19 : 1, ...extra })

const OPERATOR_DEFS: OperatorDef[] = [
  op('op_luka', 'ten_vazi', 'Luka Beridze', 'ლუკა ბერიძე', 'Luka', 'luka', 'luka@chiti.example', '1205', 'online', 'nest-03', 398),
  op('op_mariam', 'ten_vazi', 'Mariam Kvaratskhelia', 'მარიამ კვარაცხელია', 'Mariam', 'mariam', 'mariam@chiti.example', '1206', 'online', 'nest-07', 371, { language: 'en' }),
  op('op_lasha', 'ten_vazi', 'Lasha Kapanadze', 'ლაშა კაპანაძე', 'Lasha', 'lasha', 'lasha@chiti.example', '1207', 'away', 'nest-12', 302, { lastSeenMinAgo: 6 }),
  op('op_salome', 'ten_vazi', 'Salome Gogua', 'სალომე გოგუა', 'Salo', 'salome', 'salome@chiti.example', '1208', 'away', null, 214, { lastSeenMinAgo: 14 }),
  op('op_irakli', 'ten_vazi', 'Irakli Janelidze', 'ირაკლი ჯანელიძე', 'Irakli', 'irakli', 'irakli@chiti.example', '1209', 'offline', 'nest-05', 160),
  op('op_keti', 'ten_vazi', 'Keti Dolidze', 'ქეთი დოლიძე', 'Keti', 'keti', 'keti@chiti.example', '1210', 'offline', null, 47, { external: true, lastSeenMinAgo: 60 * 26 }),
  op('op_dato', 'ten_bostani', 'Davit Kiknadze', 'დავით კიკნაძე', 'Dato', 'dato.bostani', 'dato.bostani@chiti.example', '2101', 'online', 'nest-09', 350),
  op('op_tako', 'ten_bostani', 'Tako Mchedlishvili', 'თაკო მჭედლიშვილი', 'Tako', 'tako.bostani', 'tako.bostani@chiti.example', '2102', 'online', null, 340),
  op('op_levan', 'ten_bostani', 'Levan Tsiklauri', 'ლევან წიკლაური', 'Levan', 'levan.bostani', 'levan.bostani@chiti.example', '2103', 'offline', null, 120),
  op('op_sandro', 'ten_mtvare', 'Sandro Mikadze', 'სანდრო მიქაძე', 'Sandro', 'sandro.mtvare', 'sandro.mtvare@chiti.example', '3101', 'online', 'nest-14', 290),
  op('op_natia', 'ten_mtvare', 'Natia Shengelia', 'ნათია შენგელია', 'Natia', 'natia.mtvare', 'natia.mtvare@chiti.example', '3102', 'away', null, 280),
  op('op_beka', 'ten_mtvare', 'Beka Tsertsvadze', 'ბექა ცერცვაძე', 'Beka', 'beka.mtvare', 'beka.mtvare@chiti.example', '3103', 'offline', null, 99),
  op('op_tekla', 'ten_kvali', 'Tekla Maisuradze', 'თეკლა მაისურაძე', 'Tekla', 'tekla.kvali', 'tekla.kvali@chiti.example', '4101', 'online', 'nest-02', 138, { language: 'en' }),
  op('op_vakho', 'ten_kvali', 'Vakhtang Lezhava', 'ვახტანგ ლეჟავა', 'Vakho', 'vakho.kvali', 'vakho.kvali@chiti.example', '4102', 'offline', null, 130),
  op('op_eliso', 'ten_aivani', 'Eliso Kurtanidze', 'ელისო კურტანიძე', 'Eliso', 'eliso.aivani', 'eliso.aivani@chiti.example', '5101', 'offline', null, 228),
  op('op_guram', 'ten_aivani', 'Guram Lomtadze', 'გურამ ლომთაძე', 'Guram', 'guram.aivani', 'guram.aivani@chiti.example', '5102', 'offline', null, 200),
  op('op_temo', 'ten_gza', 'Temur Chachua', 'თემურ ჭაჭუა', 'Temo', 'temo.gza', 'temo.gza@chiti.example', '6101', 'offline', null, 170),
  op('op_lika', 'ten_gza', 'Lika Gvenetadze', 'ლიკა გვენეტაძე', 'Lika', 'lika.gza', 'lika.gza@chiti.example', '6102', 'offline', 'nest-10', 160),
]

const person = (
  id: string, tenantId: string, en: string, ka: string, nick: string, username: string, email: string, number: string, createdDaysAgo: number,
): PersonDef => ({ id, tenantId, en, ka, nick, username, email, number, createdDaysAgo, language: 'ka' })

const ADMIN_DEFS: PersonDef[] = [
  person('adm_giorgi', 'ten_vazi', 'Giorgi Abashidze', 'გიორგი აბაშიძე', 'Giorgi', 'giorgi', 'giorgi@chiti.example', '1001', 412),
  person('adm_eka', 'ten_vazi', 'Eka Chkheidze', 'ეკა ჩხეიძე', 'Eka', 'eka', 'eka@chiti.example', '1002', 388),
  person('adm_maka', 'ten_bostani', 'Maka Bregvadze', 'მაკა ბრეგვაძე', 'Maka', 'maka.bostani', 'maka.bostani@chiti.example', '2001', 365),
  person('adm_zura', 'ten_mtvare', 'Zurab Sharashidze', 'ზურაბ შარაშიძე', 'Zura', 'zura.mtvare', 'zura.mtvare@chiti.example', '3001', 298),
  person('adm_sopo', 'ten_kvali', 'Sopho Tsintsadze', 'სოფო ცინცაძე', 'Sopo', 'sopo.kvali', 'sopo.kvali@chiti.example', '4001', 141),
  person('adm_nana', 'ten_aivani', 'Nana Kvirikashvili', 'ნანა კვირიკაშვილი', 'Nana', 'nana.aivani', 'nana.aivani@chiti.example', '5001', 230),
  person('adm_rati', 'ten_gza', 'Rati Nadiradze', 'რატი ნადირაძე', 'Rati', 'rati.gza', 'rati.gza@chiti.example', '6001', 176),
]

const SUPERVISOR_DEFS: PersonDef[] = [
  person('sup_nino', 'ten_vazi', 'Nino Lomidze', 'ნინო ლომიძე', 'Nino', 'nino', 'nino@chiti.example', '4521', 260),
]

export function buildOperators(): Operator[] {
  return OPERATOR_DEFS.map((def) => ({
    id: def.id,
    tenantId: def.tenantId,
    name: { en: def.en, ka: def.ka },
    nickname: def.nick,
    username: def.username,
    email: def.email,
    operatorNumber: def.number,
    isExternal: def.external,
    avatarId: def.avatarId,
    avatarUrl: null,
    status: def.status,
    pausedAt: def.status === 'away' ? ago(def.lastSeenMinAgo * MIN) : null,
    pausedBy: def.status === 'away' ? 'self' : null,
    activeChatCount: 0,
    language: def.language,
    pushEnabled: def.status !== 'offline',
    lastSeen: ago(def.lastSeenMinAgo * MIN),
    createdAt: ago(def.createdDaysAgo * DAY),
  }))
}

export function buildAdmins(): Admin[] {
  return ADMIN_DEFS.map((def) => ({
    id: def.id, tenantId: def.tenantId, name: { en: def.en, ka: def.ka }, nickname: def.nick, username: def.username,
    email: def.email, adminNumber: def.number, isExternal: false, language: def.language, operatorId: null, createdAt: ago(def.createdDaysAgo * DAY),
  }))
}

export function buildSupervisors(): Supervisor[] {
  return SUPERVISOR_DEFS.map((def) => ({
    id: def.id, tenantId: def.tenantId, name: { en: def.en, ka: def.ka }, nickname: def.nick, username: def.username,
    email: def.email, supervisorNumber: def.number, isExternal: false, language: def.language, createdAt: ago(def.createdDaysAgo * DAY),
  }))
}

export function buildSuperAdmins(): SuperAdmin[] {
  return [{ id: 'sa_tamar', name: { en: 'Tamar Tsereteli', ka: 'თამარ წერეთელი' }, username: 'tamar', email: 'tamar@chiti.example', language: 'en' }]
}

/* ----------------------------------------------------------------- accounts */

export const ROLE_HOME: Record<Role, string> = {
  customer: '/',
  operator: '/operator',
  admin: '/admin',
  supervisor: '/admin',
  superadmin: '/superadmin',
}

const ROLE_LABEL: Record<Role, string> = {
  customer: 'Customer',
  operator: 'Operator',
  admin: 'Admin',
  supervisor: 'Supervisor',
  superadmin: 'Super admin',
}

const ROLE_COLOR: Record<Role, string> = {
  customer: '#F2C12E',
  operator: '#4E5C17',
  admin: '#A65400',
  supervisor: '#4D5866',
  superadmin: '#1E1B12',
}

const HEADLINE_DESCRIPTION: Record<string, string> = {
  cus_ana: 'Visits the Vazi shop and opens the chat widget.',
  op_luka: 'Vazi operator: claims chats and answers every channel.',
  adm_giorgi: 'Vazi admin: watches live chats, staff and settings.',
  sup_nino: 'Vazi supervisor: read-only dashboard and operator controls.',
  sa_tamar: 'Runs the platform: tenants, channels, health, AI key.',
}

/** Build one sign-in-able account from a staff record. */
export function staffAccount(
  role: Exclude<Role, 'customer'>,
  record: { id: string; tenantId?: string | null; name: PersonName; email: string; username: string },
  tenantName?: string,
): ChitiAccount {
  return {
    id: record.id,
    name: record.name.en,
    nameKa: record.name.ka,
    email: record.email,
    password: DEMO_PASSWORD,
    role,
    roleLabel: tenantName ? `${ROLE_LABEL[role]} · ${tenantName}` : ROLE_LABEL[role],
    description: HEADLINE_DESCRIPTION[record.id],
    avatarColor: ROLE_COLOR[role],
    username: record.username,
    staffId: record.id,
    tenantId: record.tenantId ?? null,
    homeRoute: ROLE_HOME[role],
    headline: record.id in HEADLINE_DESCRIPTION,
  }
}

export function buildAccounts(input: {
  tenants: Tenant[]
  operators: Operator[]
  admins: Admin[]
  supervisors: Supervisor[]
  superAdmins: SuperAdmin[]
}): ChitiAccount[] {
  const tenantName = (id: string) => input.tenants.find((tenant) => tenant.id === id)?.name.en ?? ''
  const customer: ChitiAccount = {
    id: 'cus_ana',
    name: 'Ana Japaridze',
    nameKa: 'ანა ჯაფარიძე',
    email: 'ana@chiti.example',
    password: DEMO_PASSWORD,
    role: 'customer',
    roleLabel: ROLE_LABEL.customer,
    description: HEADLINE_DESCRIPTION.cus_ana,
    avatarColor: ROLE_COLOR.customer,
    username: 'ana',
    staffId: 'cus_ana',
    tenantId: 'ten_vazi',
    homeRoute: ROLE_HOME.customer,
    headline: true,
  }
  const staff: ChitiAccount[] = [
    ...input.operators.map((record) => staffAccount('operator', record, tenantName(record.tenantId))),
    ...input.admins.map((record) => staffAccount('admin', record, tenantName(record.tenantId))),
    ...input.supervisors.map((record) => staffAccount('supervisor', record, tenantName(record.tenantId))),
    ...input.superAdmins.map((record) => staffAccount('superadmin', { ...record, tenantId: null })),
  ]
  // Headline accounts first, in the DemoBar order: customer, operator, admin, supervisor, superadmin.
  const order = ['op_luka', 'adm_giorgi', 'sup_nino', 'sa_tamar']
  const headline = order.map((id) => staff.find((account) => account.id === id)).filter((account): account is ChitiAccount => !!account)
  return [customer, ...headline, ...staff.filter((account) => !order.includes(account.id))]
}

/* ----------------------------------------------------------- tenant content */

export const VAZI_PERSONA = {
  name: 'Ana Japaridze',
  nameKa: 'ანა ჯაფარიძე',
  phone: '+995 555 00 12 34',
  email: 'ana@chiti.example',
}

export function buildCustomFields(): CustomField[] {
  const vazi: CustomField[] = [
    {
      id: 'cf_name', tenantId: 'ten_vazi', label: L('Your name', 'თქვენი სახელი', 'Ваше имя'), type: 'text', required: true,
      placeholder: L('e.g. Ana', 'მაგ. ანა', 'напр. Анна'), options: [], sortOrder: 1, enabled: true, groupBy: false,
    },
    {
      id: 'cf_phone', tenantId: 'ten_vazi', label: L('Phone number', 'ტელეფონის ნომერი', 'Номер телефона'), type: 'phone', required: true,
      placeholder: L('+995 5XX XX XX XX', '+995 5XX XX XX XX', '+995 5XX XX XX XX'), options: [], sortOrder: 2, enabled: true, groupBy: true,
    },
    {
      id: 'cf_order', tenantId: 'ten_vazi', label: L('Order number', 'შეკვეთის ნომერი', 'Номер заказа'), type: 'text', required: false,
      placeholder: L('e.g. VZ-24817', 'მაგ. VZ-24817', 'напр. VZ-24817'), options: [], sortOrder: 3, enabled: true, groupBy: false,
    },
    {
      id: 'cf_topic', tenantId: 'ten_vazi', label: L('Topic', 'თემა', 'Тема'), type: 'select', required: false,
      placeholder: L('Choose a topic', 'აირჩიეთ თემა', 'Выберите тему'),
      options: [
        { value: 'delivery', label: L('Delivery', 'მიტანა', 'Доставка') },
        { value: 'order', label: L('My order', 'ჩემი შეკვეთა', 'Мой заказ') },
        { value: 'returns', label: L('Returns', 'დაბრუნება', 'Возврат') },
        { value: 'payment', label: L('Payment', 'გადახდა', 'Оплата') },
        { value: 'other', label: L('Something else', 'სხვა', 'Другое') },
      ],
      sortOrder: 4, enabled: true, groupBy: false,
    },
  ]
  const others = ['ten_bostani', 'ten_mtvare', 'ten_kvali', 'ten_aivani', 'ten_gza'].flatMap((tenantId): CustomField[] => [
    { ...vazi[0]!, id: `cf_${tenantId.slice(4)}_name`, tenantId },
    { ...vazi[1]!, id: `cf_${tenantId.slice(4)}_phone`, tenantId },
  ])
  return [...vazi, ...others]
}

const QR: [QuickReplyCategory, LocalizedText, LocalizedText][] = [
  ['greetings', L('Welcome', 'მისალმება', 'Приветствие'), L('Hi! Thanks for writing to Vazi Wine Cellar. How can I help?', 'გამარჯობა! მადლობა, რომ ვაზს მოგვწერეთ. რით შემიძლია დაგეხმაროთ?', 'Здравствуйте! Спасибо, что написали в Вази. Чем могу помочь?')],
  ['greetings', L('One moment', 'ერთი წუთით', 'Минутку'), L('Let me check that for you, one moment please.', 'ერთი წუთით, ახლავე გადავამოწმებ.', 'Сейчас проверю, одну минуту.')],
  ['greetings', L('Order number?', 'შეკვეთის ნომერი?', 'Номер заказа?'), L('Could you share your order number? It starts with VZ-.', 'შეკვეთის ნომერს მომწერთ? VZ-ით იწყება.', 'Подскажите номер заказа? Он начинается с VZ-.')],
  ['delivery', L('Same-day Tbilisi', 'იმავე დღეს თბილისში', 'В тот же день по Тбилиси'), L('In Tbilisi, orders placed before 16:00 are delivered the same day, usually between 18:00 and 21:00.', 'თბილისში 16:00-მდე გაფორმებულ შეკვეთას იმავე დღეს, ჩვეულებრივ 18:00–21:00-ზე მოგიტანთ.', 'По Тбилиси заказы до 16:00 доставляем в тот же день, обычно с 18:00 до 21:00.')],
  ['delivery', L('Regions', 'რეგიონები', 'Регионы'), L('Batumi, Kutaisi and Telavi take 1–2 working days by courier (8 ₾). Other towns take 2–3 days.', 'ბათუმში, ქუთაისსა და თელავში კურიერით 1–2 სამუშაო დღეში მიდის (8 ₾). სხვა ქალაქებში — 2–3 დღეში.', 'Батуми, Кутаиси и Телави — 1–2 рабочих дня курьером (8 ₾). Другие города — 2–3 дня.')],
  ['delivery', L('Courier will call', 'კურიერი დაგირეკავთ', 'Курьер позвонит'), L('The courier will call you 15 minutes before arriving.', 'კურიერი მისვლამდე 15 წუთით ადრე დაგირეკავთ.', 'Курьер позвонит за 15 минут до приезда.')],
  ['payment', L('Payment methods', 'გადახდის მეთოდები', 'Способы оплаты'), L('We accept cards, Apple Pay and cash on delivery in Tbilisi.', 'ვიღებთ ბარათს, Apple Pay-ს და თბილისში ნაღდ ანგარიშსწორებას მიტანისას.', 'Принимаем карты, Apple Pay и наличные при доставке по Тбилиси.')],
  ['payment', L('Pending charge', 'დაბლოკილი თანხა', 'Блокировка средств'), L('A failed payment can show as pending. It is not captured, and your bank releases it within 3 working days.', 'წარუმატებელი გადახდა შეიძლება დაბლოკილად ჩანდეს. თანხა არ ჩამოიჭრება და ბანკი 3 სამუშაო დღეში გაგიხსნით.', 'Неудачный платёж может отображаться как блокировка. Деньги не списаны, банк вернёт их в течение 3 рабочих дней.')],
  ['payment', L('Invoice for companies', 'ინვოისი კომპანიებისთვის', 'Счёт для компаний'), L('Send me the company name and ID code and I’ll email the invoice today.', 'მომწერეთ კომპანიის სახელი და საიდენტიფიკაციო კოდი და ინვოისს დღესვე გამოგიგზავნით.', 'Пришлите название компании и идентификационный код, и я сегодня же отправлю счёт.')],
  ['closing', L('Anything else?', 'კიდევ რამე?', 'Что-то ещё?'), L('Is there anything else I can help with?', 'კიდევ რამეში ხომ არ გჭირდებათ დახმარება?', 'Могу ли я помочь чем-то ещё?')],
  ['closing', L('Thanks & goodbye', 'მადლობა და ნახვამდის', 'Спасибо и до свидания'), L('Thank you for choosing Vazi! Have a lovely evening. 🍷', 'მადლობა, რომ ვაზს ირჩევთ! სასიამოვნო საღამოს გისურვებთ. 🍷', 'Спасибо, что выбрали Вази! Хорошего вечера. 🍷')],
  ['closing', L('Rate the chat', 'შეაფასეთ ჩატი', 'Оцените чат'), L('If you have a second, please rate this chat when it closes. It really helps us.', 'თუ წამი გაქვთ, დახურვისას შეაფასეთ ჩატი. ძალიან დაგვეხმარება.', 'Если есть минутка, оцените чат после закрытия. Это нам очень помогает.')],
]

export function buildQuickReplies(): QuickReply[] {
  return QR.map(([category, title, content], index) => ({
    id: `qr_${index + 1}`, tenantId: 'ten_vazi', title, content, category, sortOrder: index + 1, enabled: index !== 11,
  }))
}

export function buildBans(): BannedClient[] {
  return [
    { id: 'ban_1', tenantId: 'ten_vazi', type: 'customField', value: '+995 555 00 66 66', fieldId: 'cf_phone', fieldLabel: 'Phone number', reason: 'Abusive messages to staff', createdBy: 'Giorgi Abashidze', createdAt: ago(21 * DAY) },
    { id: 'ban_2', tenantId: 'ten_vazi', type: 'ip', value: '203.0.113.66', fieldId: null, fieldLabel: null, reason: 'Dozens of fake orders from one address', createdBy: 'Giorgi Abashidze', createdAt: ago(9 * DAY) },
    { id: 'ban_3', tenantId: 'ten_vazi', type: 'customField', value: '+995 555 00 77 13', fieldId: 'cf_phone', fieldLabel: 'Phone number', reason: 'Repeated orders refused at the door', createdBy: 'Eka Chkheidze', createdAt: ago(3 * DAY) },
  ]
}

export function buildTemplates(): WhatsAppTemplate[] {
  const synced = ago(2 * DAY + 4 * HOUR)
  return [
    {
      id: 'wat_order_update', tenantId: 'ten_vazi', externalId: '1000000000000101', name: 'order_update', language: 'en', category: 'UTILITY', status: 'APPROVED',
      qualityScore: 'GREEN', sendable: true, unsendableReasons: [], recommendedForReengagement: true,
      slots: [
        { key: 'body_1', component: 'body', kind: 'text', position: 1, label: 'Customer name', example: 'Hannah', buttonIndex: null, mediaFormat: null },
        { key: 'body_2', component: 'body', kind: 'text', position: 2, label: 'Order number', example: 'VZ-24790', buttonIndex: null, mediaFormat: null },
        { key: 'body_3', component: 'body', kind: 'text', position: 3, label: 'Update', example: 'it is packed and ready to ship', buttonIndex: null, mediaFormat: null },
        { key: 'button_0_url', component: 'button', kind: 'url_suffix', position: 1, label: 'Tracking code', example: 'VZ-24790', buttonIndex: 0, mediaFormat: null },
      ],
      preview: { header: 'Order update', body: 'Hi {{1}}, an update on your order {{2}}: {{3}}. Reply to this message if you have any questions.', footer: 'Vazi Wine Cellar', buttons: ['Track order'] },
      syncedAt: synced,
    },
    {
      id: 'wat_delivery_reschedule', tenantId: 'ten_vazi', externalId: '1000000000000102', name: 'delivery_reschedule', language: 'en', category: 'UTILITY', status: 'APPROVED',
      qualityScore: 'GREEN', sendable: true, unsendableReasons: [], recommendedForReengagement: true,
      slots: [
        { key: 'body_1', component: 'body', kind: 'text', position: 1, label: 'Customer name', example: 'Hannah', buttonIndex: null, mediaFormat: null },
        { key: 'body_2', component: 'body', kind: 'text', position: 2, label: 'Missed date', example: 'Friday', buttonIndex: null, mediaFormat: null },
        { key: 'body_3', component: 'body', kind: 'text', position: 3, label: 'New slot', example: 'Saturday 11:00–14:00', buttonIndex: null, mediaFormat: null },
      ],
      preview: { header: 'Delivery update', body: 'Hello {{1}}, we could not deliver your order on {{2}}. Would {{3}} suit you instead?', footer: 'Vazi Wine Cellar', buttons: ['Yes, that works', 'Choose another time'] },
      syncedAt: synced,
    },
    {
      id: 'wat_autumn_tasting', tenantId: 'ten_vazi', externalId: '1000000000000103', name: 'autumn_tasting', language: 'ka', category: 'MARKETING', status: 'APPROVED',
      qualityScore: 'YELLOW', sendable: true, unsendableReasons: [], recommendedForReengagement: false,
      slots: [
        { key: 'header_media', component: 'header', kind: 'media', position: 1, label: 'Header image', example: 'tasting-table.svg', buttonIndex: null, mediaFormat: 'image' },
        { key: 'body_1', component: 'body', kind: 'text', position: 1, label: 'Customer name', example: 'ანა', buttonIndex: null, mediaFormat: null },
        { key: 'body_2', component: 'body', kind: 'text', position: 2, label: 'Date', example: '18 ოქტომბერს', buttonIndex: null, mediaFormat: null },
      ],
      preview: { header: null, body: '{{1}}, გეპატიჟებით შემოდგომის დეგუსტაციაზე {{2}}, 18:00-ზე. ადგილები შეზღუდულია.', footer: 'ვაზი', buttons: ['დავჯავშნი'] },
      syncedAt: synced,
    },
    {
      id: 'wat_pickup_ready', tenantId: 'ten_vazi', externalId: '1000000000000104', name: 'pickup_ready', language: 'ka', category: 'UTILITY', status: 'PENDING',
      qualityScore: 'UNKNOWN', sendable: false, unsendableReasons: ['Waiting for review by the channel.'], recommendedForReengagement: false,
      slots: [
        { key: 'body_1', component: 'body', kind: 'text', position: 1, label: 'Customer name', example: 'ანა', buttonIndex: null, mediaFormat: null },
        { key: 'body_2', component: 'body', kind: 'text', position: 2, label: 'Order number', example: 'VZ-24790', buttonIndex: null, mediaFormat: null },
      ],
      preview: { header: null, body: 'გამარჯობა, {{1}}! შეკვეთა {{2}} მზადაა. შეგიძლიათ წაიღოთ ერეკლე II-ის ქუჩა 14-დან.', footer: 'ვაზი', buttons: [] },
      syncedAt: synced,
    },
    {
      id: 'wat_promo_discount', tenantId: 'ten_vazi', externalId: '1000000000000105', name: 'promo_discount', language: 'en', category: 'MARKETING', status: 'REJECTED',
      qualityScore: 'UNKNOWN', sendable: false, unsendableReasons: ['Rejected by the channel: the coupon text breaks the promotional content policy.'], recommendedForReengagement: false,
      slots: [
        { key: 'body_1', component: 'body', kind: 'text', position: 1, label: 'Discount', example: '15%', buttonIndex: null, mediaFormat: null },
        { key: 'button_0_coupon', component: 'button', kind: 'coupon', position: 1, label: 'Coupon code', example: 'AUTUMN15', buttonIndex: 0, mediaFormat: null },
      ],
      preview: { header: 'Autumn offer', body: 'Get {{1}} off your next case of wine this week only!', footer: 'Vazi Wine Cellar', buttons: ['Copy code'] },
      syncedAt: synced,
    },
  ]
}

/* ------------------------------------------------------------ integrations */

const WEBHOOK = 'https://app.chiti.example/api/webhooks'

export function buildIntegrations(tenants: Tenant[]): TenantIntegrations[] {
  return tenants.map((tenant): TenantIntegrations => {
    const slug = tenant.slug
    const connected = (channel: 'facebook_messenger' | 'instagram' | 'whatsapp', displayName: string, routingId: string, preview: string) => ({
      channel, enabled: true, displayName, routingId, accessTokenPreview: preview, hasAppSecret: true, verifyToken: `chiti-${slug}-${routingId.slice(-4)}`,
      webhookUrl: `${WEBHOOK}/meta`, authStatus: 'connected' as const, lastTestedAt: ago(3 * DAY + 2 * HOUR), lastTestError: null,
    })
    const empty = (channel: 'facebook_messenger' | 'instagram' | 'whatsapp') => ({
      channel, enabled: false, displayName: null, routingId: null, accessTokenPreview: null, hasAppSecret: false, verifyToken: null,
      webhookUrl: `${WEBHOOK}/meta`, authStatus: 'not_configured' as const, lastTestedAt: null, lastTestError: null,
    })
    if (tenant.id === 'ten_vazi') {
      return {
        tenantId: tenant.id,
        meta: [
          connected('facebook_messenger', 'Vazi Wine Cellar', '100000000000417', 'EAA••••Zk4Q'),
          connected('instagram', '@vazi.cellar', '170000000000522', 'IGQ••••7mRe'),
          connected('whatsapp', '+995 555 00 10 10', '110000000000638', 'EAA••••p2Wd'),
        ],
        telegram: { state: 'connected', botUsername: '@vazi_cellar_bot', businessAccount: 'Vazi Wine Cellar', connectedAt: ago(64 * DAY) },
        tiktok: { state: 'needs_reauth', account: { name: 'Vazi Wine Cellar', username: '@vazi.cellar', avatarId: 'nest-11' }, euInboundDropped: 3, connectedAt: ago(88 * DAY) },
      }
    }
    if (tenant.id === 'ten_bostani') {
      return {
        tenantId: tenant.id,
        meta: [connected('facebook_messenger', 'Bostani Market', '100000000000903', 'EAA••••b8Lo'), empty('instagram'), connected('whatsapp', '+995 555 00 20 20', '110000000000911', 'EAA••••x1Qa')],
        telegram: { state: 'not_configured', botUsername: null, businessAccount: null, connectedAt: null },
        tiktok: { state: 'not_configured', account: null, euInboundDropped: 0, connectedAt: null },
      }
    }
    if (tenant.id === 'ten_mtvare') {
      return {
        tenantId: tenant.id,
        meta: [connected('facebook_messenger', 'Mtvare Net', '100000000000744', 'EAA••••Tt0v'), empty('instagram'), connected('whatsapp', '+995 555 00 30 30', '110000000000750', 'EAA••••Rr5n')],
        telegram: { state: 'connected', botUsername: '@mtvare_help_bot', businessAccount: 'Mtvare Net', connectedAt: ago(120 * DAY) },
        tiktok: { state: 'not_configured', account: null, euInboundDropped: 0, connectedAt: null },
      }
    }
    if (tenant.id === 'ten_kvali') {
      return {
        tenantId: tenant.id,
        meta: [empty('facebook_messenger'), connected('instagram', '@kvali.tours', '170000000000815', 'IGQ••••4cVb'), empty('whatsapp')],
        telegram: { state: 'not_configured', botUsername: null, businessAccount: null, connectedAt: null },
        tiktok: { state: 'connected', account: { name: 'Kvali Tours', username: '@kvali.tours', avatarId: 'nest-06' }, euInboundDropped: 0, connectedAt: ago(40 * DAY) },
      }
    }
    return {
      tenantId: tenant.id,
      meta: [empty('facebook_messenger'), empty('instagram'), empty('whatsapp')],
      telegram: { state: 'not_configured', botUsername: null, businessAccount: null, connectedAt: null },
      tiktok: { state: 'not_configured', account: null, euInboundDropped: 0, connectedAt: null },
    }
  })
}

export function buildAiLinks(tenants: Tenant[]): AiLinkStatus[] {
  const ids: Record<string, string | null> = {
    ten_vazi: '7c2e4f1a-3b8d-4e6a-9f21-5d0c8a4b7e13',
    ten_bostani: '2a9b6c4d-1e7f-4a3b-8c5d-6e0f9a1b2c34',
    ten_mtvare: '5f3e2d1c-9b8a-4c7d-a6e5-f4d3c2b1a098',
  }
  return tenants.map((tenant) => {
    const aiClientId = ids[tenant.id] ?? null
    const botOn = tenant.id === 'ten_vazi' || tenant.id === 'ten_mtvare'
    return {
      tenantId: tenant.id,
      serverConfigured: true,
      aiClientId,
      aiBotEnabled: botOn,
      autopilotEnabled: aiClientId !== null,
      circuit: { state: 'closed', failures: 0, lastReason: null, openUntil: null },
      botPause: null,
      lastTestAt: aiClientId ? ago((tenant.id === 'ten_vazi' ? 2 : 11) * DAY) : null,
      lastTestOk: aiClientId ? true : null,
    }
  })
}

export function buildPlatform(): PlatformSettings {
  return {
    metaAppId: 'app_••••4821',
    metaOAuthRedirectBase: 'https://app.chiti.example',
    hasMetaAppSecret: true,
    metaAppSecretPreview: 'sec_••••93af',
    metaLoginConfigId: 'cfg_••••1150',
    metaWhatsappConfigId: 'cfg_••••2287',
    tiktokAppId: 'tta_••••5502',
    tiktokAppSecretPreview: 'tts_••••0c1d',
    tiktokWebhookExpectedUrl: `${WEBHOOK}/tiktok`,
    tiktokWebhookRegisteredUrl: `${WEBHOOK}/tiktok`,
    tiktokWebhookRegisteredAt: ago(41 * DAY),
    systemHealthRetentionMonths: 6,
    ai: {
      source: 'db',
      keyId: 'key_7f3a',
      keyPreview: 'chk_••••a91c',
      baseUrl: 'https://ai.chiti.example/v1',
      suggestedBaseUrl: 'https://ai.chiti.example/v1',
    },
  }
}
