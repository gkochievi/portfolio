/**
 * Static reference data for the seed: users, agent
 * statuses, dispositions, campaigns with their bilingual call scripts, and the
 * name / city lists customer leads are drawn from. Everything here is
 * fictional (brand brief "Fictional entities"); timestamps are filled in by
 * `buildSeed(now)` in `./index.ts`.
 */
import type { AgentStatus, Campaign, Disposition, Localized, Role, ScriptStep } from '@/types'

export const L = (en: string, ka: string): Localized => ({ en, ka })

/* -------------------------------------------------------------------- users */

export interface UserDef {
  id: string
  username: string
  name: Localized
  role: Role
  ext: string | null
  active: boolean
  /** Days before now the account was created. */
  createdDaysAgo: number
}

export const USER_DEFS: UserDef[] = [
  { id: 'u_nino', username: 'n.beridze', name: L('Nino Beridze', 'ნინო ბერიძე'), role: 'super_admin', ext: null, active: true, createdDaysAgo: 412 },
  { id: 'u_tamar', username: 't.lomidze', name: L('Tamar Lomidze', 'თამარ ლომიძე'), role: 'admin', ext: null, active: true, createdDaysAgo: 398 },
  { id: 'u_levan', username: 'l.chikovani', name: L('Levan Chikovani', 'ლევან ჩიქოვანი'), role: 'supervisor', ext: '1201', active: true, createdDaysAgo: 365 },
  { id: 'u_zurab', username: 'z.mchedlishvili', name: L('Zurab Mchedlishvili', 'ზურაბ მჭედლიშვილი'), role: 'supervisor', ext: '1202', active: true, createdDaysAgo: 240 },
  { id: 'u_mariam', username: 'm.gelashvili', name: L('Mariam Gelashvili', 'მარიამ გელაშვილი'), role: 'operator', ext: '1101', active: true, createdDaysAgo: 301 },
  { id: 'u_giorgi', username: 'g.kapanadze', name: L('Giorgi Kapanadze', 'გიორგი კაპანაძე'), role: 'operator', ext: '1102', active: true, createdDaysAgo: 296 },
  { id: 'u_salome', username: 's.kavtaradze', name: L('Salome Kavtaradze', 'სალომე ქავთარაძე'), role: 'operator', ext: '1103', active: true, createdDaysAgo: 254 },
  { id: 'u_davit', username: 'd.maisuradze', name: L('Davit Maisuradze', 'დავით მაისურაძე'), role: 'operator', ext: '1104', active: true, createdDaysAgo: 233 },
  { id: 'u_irakli', username: 'i.nozadze', name: L('Irakli Nozadze', 'ირაკლი ნოზაძე'), role: 'operator', ext: '1105', active: true, createdDaysAgo: 187 },
  { id: 'u_ana', username: 'a.tsereteli', name: L('Ana Tsereteli', 'ანა წერეთელი'), role: 'operator', ext: '1106', active: true, createdDaysAgo: 160 },
  { id: 'u_luka', username: 'l.japaridze', name: L('Luka Japaridze', 'ლუკა ჯაფარიძე'), role: 'operator', ext: '1107', active: true, createdDaysAgo: 121 },
  { id: 'u_elene', username: 'e.gogoladze', name: L('Elene Gogoladze', 'ელენე გოგოლაძე'), role: 'operator', ext: null, active: true, createdDaysAgo: 9 },
  { id: 'u_beka', username: 'b.tabidze', name: L('Beka Tabidze', 'ბექა ტაბიძე'), role: 'operator', ext: '1109', active: false, createdDaysAgo: 340 },
]

/* ----------------------------------------------------------- agent statuses */

const status = (
  id: string,
  name: string,
  displayName: Localized,
  type: AgentStatus['type'],
  timeoutSeconds: number,
  autoReturn: boolean,
  color: AgentStatus['color'],
  sortOrder: number,
  flags: { isDefault?: boolean; isSystem?: boolean } = {},
): AgentStatus => ({
  id,
  name,
  displayName,
  type,
  timeoutSeconds,
  autoReturn,
  color,
  sortOrder,
  isDefault: flags.isDefault ?? false,
  isSystem: flags.isSystem ?? false,
  isActive: true,
})

export const AGENT_STATUSES: AgentStatus[] = [
  status('st_available', 'available', L('Available', 'ხელმისაწვდომი'), 'working', 0, false, 'success', 1, { isDefault: true }),
  status('st_on_call', 'on_call', L('On call', 'საუბარშია'), 'working', 0, false, 'lime', 2, { isSystem: true }),
  status('st_wrap_up', 'wrap_up', L('Wrap-up', 'დამუშავება'), 'working', 20, true, 'info', 3),
  status('st_break', 'break', L('Break', 'შესვენება'), 'paused', 900, false, 'warning', 4),
  status('st_lunch', 'lunch', L('Lunch', 'სადილი'), 'paused', 3600, false, 'warning', 5),
  status('st_meeting', 'meeting', L('Meeting', 'შეხვედრა'), 'paused', 0, false, 'muted', 6),
  status('st_training', 'training', L('Training', 'ტრენინგი'), 'paused', 0, false, 'muted', 7),
  status('st_offline', 'offline', L('Offline', 'ოფლაინი'), 'offline', 0, false, 'ink', 8, { isSystem: true }),
]

/* ------------------------------------------------------------- dispositions */

const disposition = (
  sortOrder: number,
  code: string,
  name: Localized,
  description: Localized,
  color: Disposition['color'],
  flags: { isFinal?: boolean; scheduleCallback?: boolean; addToDnc?: boolean },
): Disposition => ({
  id: `disp_${sortOrder}`,
  code,
  name,
  description,
  isFinal: flags.isFinal ?? false,
  scheduleCallback: flags.scheduleCallback ?? false,
  addToDnc: flags.addToDnc ?? false,
  color,
  sortOrder,
  isActive: true,
})

export const DISPOSITIONS: Disposition[] = [
  disposition(1, 'SALE', L('Sale', 'გაყიდვა შედგა'), L('The customer accepted the offer.', 'მომხმარებელმა შეთავაზება მიიღო.'), 'success', { isFinal: true }),
  disposition(2, 'INTERESTED', L('Interested, call back', 'დაინტერესდა - გადარეკვა'), L('Interested; call back at the agreed time.', 'დაინტერესებულია; გადარეკეთ შეთანხმებულ დროს.'), 'info', { scheduleCallback: true }),
  disposition(3, 'CALLBACK_LATER', L('Call back later', 'მოგვიანებით გადარეკვა'), L('Asked to be called at another time.', 'ითხოვა სხვა დროს დარეკვა.'), 'lime', { scheduleCallback: true }),
  disposition(4, 'NOT_INTERESTED', L('Not interested', 'არ არის დაინტერესებული'), L('Declined the offer.', 'უარი თქვა შეთავაზებაზე.'), 'danger', { isFinal: true }),
  disposition(5, 'VOICEMAIL', L('Voicemail', 'ხმოვანი ფოსტა'), L('Reached voicemail; retry later.', 'ხმოვან ფოსტაზე გადავიდა; სცადეთ მოგვიანებით.'), 'muted', {}),
  disposition(6, 'NO_ANSWER', L('No answer', 'არ უპასუხა'), L('No one picked up; retry later.', 'არავინ უპასუხა; სცადეთ მოგვიანებით.'), 'warning', {}),
  disposition(7, 'BUSY', L('Busy', 'დაკავებულია'), L('The line was busy; retry later.', 'ხაზი დაკავებული იყო; სცადეთ მოგვიანებით.'), 'warning', {}),
  disposition(8, 'WRONG_NUMBER', L('Wrong number', 'არასწორი ნომერი'), L('The number does not belong to the customer.', 'ნომერი მომხმარებელს არ ეკუთვნის.'), 'muted', { isFinal: true }),
  disposition(9, 'DNC', L('Do not call', 'არ დაურეკოთ'), L('Do not call this number again.', 'ამ ნომერზე აღარ დარეკოთ.'), 'ink', { isFinal: true, addToDnc: true }),
]

/**
 * Notes operators type after a call. A note is one plain string (the visitor's
 * own text is never translated), so the floor writes in both languages, the way
 * a Georgian contact centre does. Nothing here names a weekday or a time of day:
 * the callback date is stored separately and must never contradict the note.
 */
export const NOTES: Record<string, string[]> = {
  SALE: ['დაეთანხმა, SMS კოდი დაადასტურა', 'Accepted the offer, confirmed by SMS code', 'ყველაფერი შეთანხმდა', 'Agreed on the first call'],
  INTERESTED: ['დაინტერესდა, ოჯახთან უნდა შეათანხმოს', 'Wants the details by SMS', 'ითხოვა დეტალები SMS-ით', 'Comparing with the current provider'],
  CALLBACK_LATER: ['სამსახურშია, მოგვიანებით გადარეკვა', 'Driving, asked for a later call', 'შეხვედრაზე იყო', 'In a meeting, call back'],
  NOT_INTERESTED: ['ფასი არ მოეწონა', 'Happy with the current plan', 'სხვა კომპანიას იყენებს', 'Declined, no reason given'],
  VOICEMAIL: ['ხმოვანი ფოსტა', 'Voicemail, no message left'],
  WRONG_NUMBER: ['ნომერი სხვა პირს ეკუთვნის', 'Number belongs to someone else'],
  DNC: ['ითხოვა, რომ აღარ დავურეკოთ', 'Asked not to be called again'],
}

/* ---------------------------------------------------------------- campaigns */

export interface CampaignDef {
  campaign: Omit<Campaign, 'createdAt' | 'updatedAt' | 'startedAt' | 'completedAt'>
  slug: string
  /** Lead count. */
  leads: number
  agents: string[]
  /** Days before now: created, started (null = never), completed (null = not completed), last updated. */
  createdDaysAgo: number
  startedDaysAgo: number | null
  completedDaysAgo: number | null
  updatedDaysAgo: number
  /** Past call history window [fromDaysAgo, toDaysAgo] (weekdays, 10:00-19:00) and its call count. */
  history: { fromDaysAgo: number; toDaysAgo: number; calls: number } | null
  /** Calls placed today (active campaigns only). */
  todayCalls: number
}

const steps = (prefix: string, items: Array<[Localized, Localized]>): ScriptStep[] =>
  items.map(([title, body], index) => ({ id: `${prefix}_s${index + 1}`, title, body }))

const base = {
  workingHoursStart: '10:00',
  workingHoursEnd: '19:00',
  maxAttempts: 3,
  retryDelayMinutes: 60,
}

export const CAMPAIGN_DEFS: CampaignDef[] = [
  {
    slug: 'mobile_upgrade',
    leads: 180,
    agents: ['u_mariam', 'u_giorgi', 'u_salome', 'u_elene', 'u_ana'],
    createdDaysAgo: 21,
    startedDaysAgo: 20,
    completedDaysAgo: null,
    updatedDaysAgo: 1,
    history: { fromDaysAgo: 20, toDaysAgo: 1, calls: 80 },
    todayCalls: 40,
    campaign: {
      id: 'cmp_1',
      name: L('Mobile plan upgrade', 'მობილური ტარიფის განახლება'),
      clientName: L('Tsitsinatela Telecom', 'ციცინათელა ტელეკომი'),
      description: L(
        'Offer existing subscribers an upgrade to the Unlimited 5G plan before their contract ends.',
        'არსებულ აბონენტებს კონტრაქტის დასრულებამდე შევთავაზოთ ულიმიტო 5G ტარიფზე გადასვლა.',
      ),
      status: 'active',
      dialingMode: 'MANUAL',
      callerId: '+995322000110',
      queueName: 'q_mobile_upgrade',
      ...base,
      dialRatio: 1,
      maxConcurrentCalls: 5,
      dialIntervalMs: 2000,
      createdById: 'u_tamar',
      script: steps('cmp1', [
        [L('Greeting', 'მისალმება'), L('Good afternoon, I am calling from Tsitsinatela Telecom. Am I speaking with the account holder?', 'გამარჯობა, გირეკავთ ციცინათელა ტელეკომიდან. ანგარიშის მფლობელს ვესაუბრები?')],
        [L('Current plan', 'მიმდინარე ტარიფი'), L('Confirm the current plan and monthly spend on the lead card. Ask how much mobile data they use in a typical month.', 'დაადასტურეთ მიმდინარე ტარიფი და ყოველთვიური ხარჯი ლიდის ბარათიდან. ჰკითხეთ, საშუალოდ რამდენ მობილურ ინტერნეტს იყენებს თვეში.')],
        [L('Offer', 'შეთავაზება'), L('Offer Unlimited 5G at 39 ₾ a month, with the first month free and no change of number.', 'შესთავაზეთ ულიმიტო 5G თვეში 39 ₾-ად, პირველი თვე უფასოდ, ნომრის შეუცვლელად.')],
        [L('Objections', 'შეპასუხებები'), L('If price is the concern, mention the 29 ₾ Smart plan. If the contract has not ended yet, note the end date and book a callback.', 'თუ ფასი აწუხებს, ახსენეთ 29-ლარიანი Smart ტარიფი. თუ კონტრაქტი ჯერ არ სრულდება, ჩაინიშნეთ თარიღი და დანიშნეთ გადარეკვა.')],
        [L('Close', 'დასრულება'), L('Confirm the upgrade with the SMS code, thank the customer and choose a disposition.', 'დაადასტურეთ განახლება SMS კოდით, მადლობა გადაუხადეთ მომხმარებელს და აირჩიეთ შედეგი.')],
      ]),
    },
  },
  {
    slug: 'csat_survey',
    leads: 160,
    agents: ['u_mariam', 'u_irakli', 'u_luka', 'u_davit', 'u_giorgi'],
    createdDaysAgo: 16,
    startedDaysAgo: 15,
    completedDaysAgo: null,
    updatedDaysAgo: 2,
    history: { fromDaysAgo: 15, toDaysAgo: 1, calls: 60 },
    todayCalls: 28,
    campaign: {
      id: 'cmp_2',
      name: L('Customer satisfaction survey', 'მომხმარებელთა კმაყოფილების კვლევა'),
      clientName: L('Kvavili Credit', 'ყვავილი კრედიტი'),
      description: L(
        'A three-question satisfaction survey for borrowers who made a payment in the last 60 days.',
        'სამკითხვიანი კმაყოფილების კვლევა მსესხებლებისთვის, ვინც ბოლო 60 დღეში შენატანი გადაიხადა.',
      ),
      status: 'active',
      dialingMode: 'AUTO',
      callerId: '+995322000120',
      queueName: 'q_csat_survey',
      ...base,
      dialRatio: 1.5,
      maxConcurrentCalls: 6,
      dialIntervalMs: 1500,
      createdById: 'u_tamar',
      script: steps('cmp2', [
        [L('Introduction', 'შესავალი'), L('Hello, I am calling from Kvavili Credit with a short two-minute survey about your loan service. Is now a good time?', 'გამარჯობა, გირეკავთ ყვავილი კრედიტიდან. გვაქვს მოკლე, ორწუთიანი გამოკითხვა სესხის მომსახურებაზე. მოსახერხებელია ახლა საუბარი?')],
        [L('Overall score', 'საერთო შეფასება'), L('On a scale of 1 to 10, how satisfied are you with Kvavili Credit overall?', '1-დან 10-მდე სკალაზე, საერთო ჯამში რამდენად კმაყოფილი ხართ ყვავილი კრედიტით?')],
        [L('Payments', 'გადახდები'), L('How easy was it to make your last payment? Note the channel: branch, app or payment terminal.', 'რამდენად მარტივი იყო ბოლო შენატანის გადახდა? ჩაინიშნეთ არხი: ფილიალი, აპლიკაცია თუ გადახდის ტერმინალი.')],
        [L('Recommendation', 'რეკომენდაცია'), L('Would you recommend Kvavili Credit to a friend or family member? Why?', 'ურჩევდით ყვავილი კრედიტს მეგობარს ან ოჯახის წევრს? რატომ?')],
        [L('Thank you', 'მადლობა'), L('Thank the customer, mention that the answers are anonymous, and choose a disposition.', 'მადლობა გადაუხადეთ, აღნიშნეთ, რომ პასუხები ანონიმურია, და აირჩიეთ შედეგი.')],
      ]),
    },
  },
  {
    slug: 'fibre_winback',
    leads: 140,
    agents: ['u_salome', 'u_davit', 'u_irakli', 'u_ana'],
    createdDaysAgo: 12,
    startedDaysAgo: 11,
    completedDaysAgo: null,
    updatedDaysAgo: 1,
    history: { fromDaysAgo: 11, toDaysAgo: 1, calls: 40 },
    todayCalls: 22,
    campaign: {
      id: 'cmp_3',
      name: L('Home fibre win-back', 'სახლის ოპტიკური ინტერნეტის დაბრუნება'),
      clientName: L('Ghrubeli Net', 'ღრუბელი ნეტი'),
      description: L(
        'Win back customers who cancelled home fibre in the last six months with a three-month discount.',
        'დავაბრუნოთ მომხმარებლები, რომლებმაც ბოლო ექვს თვეში გააუქმეს სახლის ოპტიკური ინტერნეტი, სამთვიანი ფასდაკლებით.',
      ),
      status: 'active',
      dialingMode: 'AUTO',
      callerId: '+995322000130',
      queueName: 'q_fibre_winback',
      ...base,
      dialRatio: 1.8,
      maxConcurrentCalls: 8,
      dialIntervalMs: 1500,
      createdById: 'u_tamar',
      script: steps('cmp3', [
        [L('Greeting', 'მისალმება'), L('Hello, this is Ghrubeli Net. We noticed you left us recently and would like to hear why.', 'გამარჯობა, გირეკავთ ღრუბელი ნეტიდან. ვნახეთ, რომ ცოტა ხნის წინ დაგვტოვეთ, და გვაინტერესებს მიზეზი.')],
        [L('Reason for leaving', 'წასვლის მიზეზი'), L('Ask why they left: price, speed, support or moving home. Check the previous plan on the lead card.', 'ჰკითხეთ წასვლის მიზეზი: ფასი, სიჩქარე, მხარდაჭერა თუ საცხოვრებლის შეცვლა. გადაამოწმეთ წინა ტარიფი ლიდის ბარათზე.')],
        [L('Offer', 'შეთავაზება'), L('Offer 500 Mbps fibre at half price for three months, with free installation and router.', 'შესთავაზეთ 500 მბ/წმ ოპტიკა სამი თვით ნახევარ ფასად, უფასო მონტაჟით და როუტერით.')],
        [L('Book installation', 'მონტაჟის დაჯავშნა'), L('If they agree, book an installation slot, confirm the address and choose a disposition.', 'თანხმობის შემთხვევაში დანიშნეთ მონტაჟის დრო, დაადასტურეთ მისამართი და აირჩიეთ შედეგი.')],
      ]),
    },
  },
  {
    slug: 'car_renewal',
    leads: 110,
    agents: ['u_luka', 'u_elene', 'u_ana'],
    createdDaysAgo: 32,
    startedDaysAgo: 30,
    completedDaysAgo: null,
    updatedDaysAgo: 3,
    history: { fromDaysAgo: 30, toDaysAgo: 4, calls: 45 },
    todayCalls: 0,
    campaign: {
      id: 'cmp_4',
      name: L('Car insurance renewal', 'ავტოდაზღვევის პოლისის განახლება'),
      clientName: L('Lomi Insurance', 'ლომი დაზღვევა'),
      description: L(
        'Remind policyholders whose car insurance expires within 30 days and renew by phone.',
        'შევახსენოთ დაზღვეულებს, რომელთა ავტოდაზღვევის პოლისი 30 დღეში იწურება, და განვაახლოთ ტელეფონით.',
      ),
      status: 'paused',
      dialingMode: 'AUTO',
      callerId: '+995322000140',
      queueName: 'q_car_renewal',
      ...base,
      dialRatio: 1.2,
      maxConcurrentCalls: 4,
      dialIntervalMs: 2000,
      createdById: 'u_tamar',
      script: steps('cmp4', [
        [L('Greeting', 'მისალმება'), L('Hello, I am calling from Lomi Insurance about your car insurance policy.', 'გამარჯობა, გირეკავთ ლომი დაზღვევიდან თქვენი ავტოდაზღვევის პოლისთან დაკავშირებით.')],
        [L('Confirm details', 'მონაცემების დადასტურება'), L('Confirm the car model and the policy expiry date shown on the lead card.', 'დაადასტურეთ ავტომობილის მოდელი და პოლისის ვადის გასვლის თარიღი ლიდის ბარათიდან.')],
        [L('Renewal offer', 'განახლების შეთავაზება'), L('Offer renewal at last year\'s premium, with 10% off for paying in full.', 'შესთავაზეთ განახლება შარშანდელი პრემიით და 10% ფასდაკლება სრული თანხის ერთიანად გადახდისას.')],
        [L('Close', 'დასრულება'), L('Send the payment link by SMS and choose a disposition.', 'გაუგზავნეთ გადახდის ბმული SMS-ით და აირჩიეთ შედეგი.')],
      ]),
    },
  },
  {
    slug: 'viewing_appointments',
    leads: 40,
    agents: [],
    createdDaysAgo: 2,
    startedDaysAgo: null,
    completedDaysAgo: null,
    updatedDaysAgo: 2,
    history: null,
    todayCalls: 0,
    campaign: {
      id: 'cmp_5',
      name: L('New-build viewing appointments', 'ახალი კორპუსის დათვალიერებაზე ჩაწერა'),
      clientName: L('Tetri Kva Realty', 'თეთრი ქვა რეალთი'),
      description: L(
        'Invite people who asked about the new Saburtalo building to book a show-flat viewing.',
        'მოვიწვიოთ საბურთალოს ახალი კორპუსით დაინტერესებული პირები სანიმუშო ბინის დასათვალიერებლად.',
      ),
      status: 'draft',
      dialingMode: 'MANUAL',
      callerId: '+995322000150',
      queueName: null,
      ...base,
      dialRatio: 1,
      maxConcurrentCalls: 3,
      dialIntervalMs: 2000,
      createdById: 'u_tamar',
      script: steps('cmp5', [
        [L('Greeting', 'მისალმება'), L('Hello, I am calling from Tetri Kva Realty. You left a request about our new building in Saburtalo.', 'გამარჯობა, გირეკავთ თეთრი ქვა რეალთიდან. თქვენ დატოვეთ მოთხოვნა ჩვენს ახალ კორპუსზე საბურთალოზე.')],
        [L('Needs', 'საჭიროებები'), L('Ask about the number of rooms and the budget. Compare with the interest field on the lead card.', 'ჰკითხეთ ოთახების რაოდენობა და ბიუჯეტი. შეადარეთ ლიდის ბარათზე მითითებულ ინტერესს.')],
        [L('Book a viewing', 'დათვალიერების დაჯავშნა'), L('Offer a viewing this week: weekdays 11:00-18:00 or Saturday morning.', 'შესთავაზეთ დათვალიერება ამ კვირაში: სამუშაო დღეებში 11:00-18:00 ან შაბათს დილით.')],
        [L('Confirm', 'დადასტურება'), L('Confirm the time and tell them the sales office address will arrive by SMS.', 'დაადასტურეთ დრო და უთხარით, რომ გაყიდვების ოფისის მისამართს SMS-ით მიიღებენ.')],
      ]),
    },
  },
  {
    slug: 'wine_club',
    leads: 90,
    agents: ['u_giorgi', 'u_luka', 'u_ana'],
    createdDaysAgo: 34,
    startedDaysAgo: 30,
    completedDaysAgo: 21,
    updatedDaysAgo: 21,
    history: { fromDaysAgo: 30, toDaysAgo: 22, calls: 150 },
    todayCalls: 0,
    campaign: {
      id: 'cmp_6',
      name: L('Wine club membership callback', 'ღვინის კლუბის წევრების გადარეკვა'),
      clientName: L('Ojaleshi Wine Club', 'ოჯალეშის ღვინის კლუბი'),
      description: L(
        'Call back members whose annual membership lapsed and offer the autumn tasting box.',
        'გადავურეკოთ წევრებს, რომელთა წლიური წევრობა ამოიწურა, და შევთავაზოთ შემოდგომის სადეგუსტაციო ყუთი.',
      ),
      status: 'completed',
      dialingMode: 'MANUAL',
      callerId: '+995322000160',
      queueName: 'q_wine_club',
      ...base,
      dialRatio: 1,
      maxConcurrentCalls: 3,
      dialIntervalMs: 2000,
      createdById: 'u_tamar',
      script: steps('cmp6', [
        [L('Greeting', 'მისალმება'), L('Hello, this is Ojaleshi Wine Club. You were one of our members and we have a new season to share.', 'გამარჯობა, გირეკავთ ოჯალეშის ღვინის კლუბიდან. ჩვენი წევრი იყავით და ახალ სეზონზე მინდა გიამბოთ.')],
        [L('Membership', 'წევრობა'), L('Check the membership tier and the last order on the lead card.', 'გადაამოწმეთ წევრობის დონე და ბოლო შეკვეთა ლიდის ბარათზე.')],
        [L('Autumn box', 'შემოდგომის ყუთი'), L('Offer the autumn box: six bottles from Racha and Kakheti with free delivery.', 'შესთავაზეთ შემოდგომის ყუთი: ექვსი ბოთლი რაჭიდან და კახეთიდან, უფასო მიწოდებით.')],
        [L('Renew', 'განახლება'), L('Renew the membership, confirm the delivery address and choose a disposition.', 'განაახლეთ წევრობა, დაადასტურეთ მიწოდების მისამართი და აირჩიეთ შედეგი.')],
      ]),
    },
  },
  {
    slug: 'delivery_confirm',
    leads: 30,
    agents: ['u_davit', 'u_salome'],
    createdDaysAgo: 33,
    startedDaysAgo: 30,
    completedDaysAgo: 25,
    updatedDaysAgo: 10,
    history: { fromDaysAgo: 30, toDaysAgo: 26, calls: 50 },
    todayCalls: 0,
    campaign: {
      id: 'cmp_7',
      name: L('Delivery confirmation', 'მიწოდების დადასტურება'),
      clientName: L('Sakhli Plus', 'სახლი პლუსი'),
      description: L(
        'Confirm furniture delivery dates and floor access with customers before the truck leaves.',
        'მანქანის გასვლამდე დავუდასტუროთ მომხმარებლებს ავეჯის მიწოდების თარიღი და სართულზე ასვლის პირობები.',
      ),
      status: 'archived',
      dialingMode: 'MANUAL',
      callerId: '+995322000170',
      queueName: 'q_delivery_confirm',
      ...base,
      dialRatio: 1,
      maxConcurrentCalls: 3,
      dialIntervalMs: 2000,
      createdById: 'u_nino',
      script: steps('cmp7', [
        [L('Greeting', 'მისალმება'), L('Hello, I am calling from Sakhli Plus about your furniture order.', 'გამარჯობა, გირეკავთ სახლი პლუსიდან თქვენი ავეჯის შეკვეთასთან დაკავშირებით.')],
        [L('Order and date', 'შეკვეთა და თარიღი'), L('Read out the order number and confirm the delivery date.', 'წაიკითხეთ შეკვეთის ნომერი და დაადასტურეთ მიწოდების თარიღი.')],
        [L('Access', 'მისასვლელი'), L('Ask about the floor and whether there is a lift. Note anything the crew should know.', 'ჰკითხეთ სართული და არის თუ არა ლიფტი. ჩაინიშნეთ ყველაფერი, რაც ბრიგადამ უნდა იცოდეს.')],
        [L('Close', 'დასრულება'), L('Thank the customer and choose a disposition.', 'მადლობა გადაუხადეთ მომხმარებელს და აირჩიეთ შედეგი.')],
      ]),
    },
  },
]

/* ------------------------------------------------------- people and places */

export const FIRST_NAMES: Array<[string, string]> = [
  ['Ketevan', 'ქეთევან'], ['Nikoloz', 'ნიკოლოზ'], ['Elene', 'ელენე'], ['Aleksandre', 'ალექსანდრე'], ['Mzia', 'მზია'],
  ['Beka', 'ბექა'], ['Natia', 'ნათია'], ['Tornike', 'თორნიკე'], ['Nino', 'ნინო'], ['Giorgi', 'გიორგი'],
  ['Tamar', 'თამარ'], ['Davit', 'დავით'], ['Mariam', 'მარიამ'], ['Levan', 'ლევან'], ['Salome', 'სალომე'],
  ['Irakli', 'ირაკლი'], ['Ana', 'ანა'], ['Luka', 'ლუკა'], ['Ekaterine', 'ეკატერინე'], ['Zurab', 'ზურაბ'],
  ['Maka', 'მაკა'], ['Vakhtang', 'ვახტანგ'], ['Khatuna', 'ხათუნა'], ['Gela', 'გელა'], ['Nana', 'ნანა'],
  ['Shota', 'შოთა'], ['Tea', 'თეა'], ['Lasha', 'ლაშა'], ['Sopio', 'სოფიო'], ['Badri', 'ბადრი'],
  ['Ia', 'ია'], ['Nika', 'ნიკა'], ['Lika', 'ლიკა'], ['Dato', 'დათო'], ['Kristine', 'ქრისტინე'],
  ['Giga', 'გიგა'], ['Manana', 'მანანა'], ['Otar', 'ოთარ'], ['Eter', 'ეთერ'], ['Revaz', 'რევაზ'],
  ['Lali', 'ლალი'], ['Temur', 'თემურ'], ['Nato', 'ნატო'], ['Mikheil', 'მიხეილ'], ['Tsitsino', 'ციცინო'],
  ['Zviad', 'ზვიად'],
]

export const SURNAMES: Array<[string, string]> = [
  ['Chkheidze', 'ჩხეიძე'], ['Gogoladze', 'გოგოლაძე'], ['Khutsishvili', 'ხუციშვილი'], ['Abashidze', 'აბაშიძე'], ['Tabidze', 'ტაბიძე'],
  ['Beridze', 'ბერიძე'], ['Kapanadze', 'კაპანაძე'], ['Maisuradze', 'მაისურაძე'], ['Nozadze', 'ნოზაძე'], ['Tsereteli', 'წერეთელი'],
  ['Japaridze', 'ჯაფარიძე'], ['Gelashvili', 'გელაშვილი'], ['Lomidze', 'ლომიძე'], ['Kharaishvili', 'ხარაიშვილი'], ['Lortkipanidze', 'ლორთქიფანიძე'],
  ['Meskhi', 'მესხი'], ['Dolidze', 'დოლიძე'], ['Nadiradze', 'ნადირაძე'], ['Gabunia', 'გაბუნია'], ['Chantladze', 'ჩანტლაძე'],
  ['Shengelia', 'შენგელია'], ['Bakradze', 'ბაქრაძე'], ['Tsintsadze', 'ცინცაძე'], ['Mamulashvili', 'მამულაშვილი'], ['Svanidze', 'სვანიძე'],
  ['Kobuladze', 'ქობულაძე'], ['Kipiani', 'კიპიანი'], ['Khvedelidze', 'ხვედელიძე'], ['Guruli', 'გურული'], ['Ghlonti', 'ღლონტი'],
  ['Todua', 'თოდუა'], ['Bolkvadze', 'ბოლქვაძე'], ['Eliava', 'ელიავა'], ['Kiknadze', 'კიკნაძე'], ['Pantsulaia', 'ფანცულაია'],
  ['Zarandia', 'ზარანდია'], ['Akhvlediani', 'ახვლედიანი'], ['Mikaberidze', 'მიქაბერიძე'], ['Chachua', 'ჩაჩუა'], ['Kurdadze', 'ქურდაძე'],
  ['Sulakvelidze', 'სულაყველიძე'], ['Jgharkava', 'ჯღარკავა'], ['Margvelashvili', 'მარგველაშვილი'], ['Kvirikashvili', 'კვირიკაშვილი'],
]

export const CITIES: Localized[] = [
  L('Tbilisi', 'თბილისი'), L('Tbilisi', 'თბილისი'), L('Tbilisi', 'თბილისი'), L('Batumi', 'ბათუმი'), L('Kutaisi', 'ქუთაისი'),
  L('Rustavi', 'რუსთავი'), L('Zugdidi', 'ზუგდიდი'), L('Gori', 'გორი'), L('Telavi', 'თელავი'), L('Poti', 'ფოთი'),
  L('Mtskheta', 'მცხეთა'), L('Zestaponi', 'ზესტაფონი'), L('Khashuri', 'ხაშური'), L('Ozurgeti', 'ოზურგეთი'),
]

export const MOBILE_PLANS: Localized[] = [L('Prepaid Start', 'წინასწარი Start'), L('Smart 15', 'Smart 15'), L('Family 4G', 'ოჯახის 4G'), L('Business Lite', 'ბიზნეს Lite')]
export const LOAN_TYPES: Localized[] = [L('Consumer loan', 'სამომხმარებლო სესხი'), L('Car loan', 'ავტოსესხი'), L('Online micro-loan', 'ონლაინ მიკროსესხი'), L('Home repair loan', 'სარემონტო სესხი')]
export const FIBRE_PLANS: Localized[] = [L('Fibre 100', 'ოპტიკა 100'), L('Fibre 300', 'ოპტიკა 300'), L('Fibre 500 + TV', 'ოპტიკა 500 + TV')]
export const CAR_MODELS: string[] = ['Toyota Prius 2014', 'Hyundai Elantra 2017', 'Ford Fusion 2015', 'Honda Fit 2016', 'Subaru Forester 2018', 'Toyota Camry 2019', 'Opel Astra 2011', 'Kia Sportage 2020', 'Nissan Qashqai 2016', 'Mercedes-Benz C 200 2013']
export const FLAT_INTERESTS: Localized[] = [L('Studio', 'სტუდიო'), L('2 rooms', '2 ოთახიანი'), L('3 rooms', '3 ოთახიანი'), L('Penthouse', 'პენტჰაუსი')]
export const WINE_TIERS: Localized[] = [L('Silver', 'ვერცხლი'), L('Gold', 'ოქრო'), L('Qvevri circle', 'ქვევრის წრე')]

export const DNC_REASONS: string[] = [
  'Customer asked not to be called again',
  'Requested removal during a survey call',
  'Opted out by SMS reply',
  'Imported from the client opt-out list',
  'Complaint escalated by the client',
  'Number belongs to a business line',
  'Customer registered a written objection',
]
