/**
 * Georgian text for the hand-authored catalogue facts (`seed/static.ts`,
 * `seed/people.ts`, `seed/licensing.ts`): partners, documents, API keys, seat
 * notes, licence names and the task catalogue (template names and
 * descriptions). Task titles, request texts, chat pools and project names are
 * in `work.ts`, which owns the task workspace.
 *
 * Vocabulary follows the UI chrome: დავალება (task), ქულა (points), ადგილი
 * (seat), ადგილების ფონდი (seat pool), ოპერატორი (agent), რიგი (queue),
 * მონახაზი (draft), პარტნიორი, ინვოისი.
 */
import type { KaEntries, KaPattern } from './types'

/* ------------------------------------------------------------- licences */

/**
 * Licence display names by English name. The codes (AGENT_BASIC ...) never
 * change. Exported so the money dictionary can name licences inside invoice
 * lines ("Agent Basic (AGENT_BASIC): 12 user-days / 31").
 */
export const LICENSE_NAMES_KA: Readonly<Record<string, string>> = {
  'Agent Basic': 'აგენტი Basic',
  'Agent Pro': 'აგენტი Pro',
  Supervisor: 'ზედამხედველი',
  'Quality Analyst': 'ხარისხის ანალიტიკოსი',
  'Call Recording': 'ზარების ჩაწერა',
  'Legacy Seat': 'ძველი ტიპის ადგილი',
}

/* ------------------------------------------------------------- partners */

const PARTNERS: KaEntries = {
  'Reseller. Runs Rigi-managed contact centres for small clients in Tbilisi; first-line support stays with Zemo.':
    'რესელერი. თბილისში მცირე კლიენტებისთვის მართავს Rigi-ს მიერ ადმინისტრირებულ კონტაქტ-ცენტრებს; პირველი ხაზის მხარდაჭერას Zemo თავად უზრუნველყოფს.',
  'Reseller for western Georgia. Contract renewal in negotiation; keep the current price list until signed.':
    'რესელერი დასავლეთ საქართველოსთვის. ხელშეკრულების განახლებაზე მოლაპარაკება მიმდინარეობს; ხელმოწერამდე მოქმედებს მიმდინარე ფასების სია.',
  'Integrator. On-prem PBX at the client site; Rigi manages it over VPN. Seasonal peaks June to September.':
    'ინტეგრატორი. PBX დამონტაჟებულია კლიენტის ობიექტზე (on-prem); Rigi მას VPN-ით მართავს. სეზონური პიკი ივნისიდან სექტემბრამდეა.',
  'Retail bank contact centre, 120 seats. Procurement needs the invoice in their own format (partner template).':
    'საცალო ბანკის კონტაქტ-ცენტრი, 120 ადგილი. შესყიდვების სამსახურს ინვოისი სჭირდება საკუთარ ფორმატში (პარტნიორის შაბლონი).',
  'Food-delivery hotline, 45 seats. Peak hours 12:00-15:00 and 19:00-22:00; schedule changes outside those windows.':
    'საკვების მიწოდების ცხელი ხაზი, 45 ადგილი. პიკის საათებია 12:00–15:00 და 19:00–22:00; გრაფიკის ცვლილებები ამ შუალედების გარეთ ხდება.',
  'Regional ISP support desk, 80 seats. Contract expired; renewal draft sent. Four agents still on legacy seats.':
    'რეგიონული ინტერნეტ-პროვაიდერის მხარდაჭერის ცენტრი, 80 ადგილი. ხელშეკრულების ვადა გასულია; განახლების მონახაზი გაგზავნილია. ოთხი ოპერატორი ჯერ კიდევ ძველი ტიპის ადგილებზეა.',
  'Claims line, 30 seats. On-prem; change windows only on Sundays.':
    'ზარალის მოწესრიგების ხაზი, 30 ადგილი. On-prem სისტემა; ცვლილებების შეტანა შესაძლებელია მხოლოდ კვირაობით.',
  'Clinic booking desk, 12 seats. Onboarded this year; set-up fee invoiced separately.':
    'კლინიკის ჯავშნის სამსახური, 12 ადგილი. პლატფორმას ამ წელს შეუერთდა; გამართვის საფასური ცალკე ინვოისით დაირიცხა.',
  'Outage hotline, 25 seats. Suspended: the tenant moved to an in-house PBX; the account stays for history.':
    'ავარიების ცხელი ხაზი, 25 ადგილი. შეჩერებულია: კლიენტი საკუთარ PBX-ზე გადავიდა; ანგარიში ისტორიისთვის რჩება.',
  // VPN type (technical names such as "IPsec (IKEv2)" stay as they are)
  'IPsec (IKEv2), dual tunnel': 'IPsec (IKEv2), ორმაგი ტუნელი',
  'None (cloud only)': 'არ არის (მხოლოდ Cloud)',
  'IPsec (IKEv1, legacy)': 'IPsec (IKEv1, მოძველებული)',
}

/* ------------------------------------------------------------- documents */

const DOCUMENTS: KaEntries = {
  'Master service agreement': 'მომსახურების ძირითადი ხელშეკრულება',
  'Network diagram': 'ქსელის სქემა',
  'IVR call flow': 'IVR-ის ზარის სქემა',
  'Signed copy': 'ხელმოწერილი ეგზემპლარი',
  'Annex 2: updated seat prices': 'დანართი 2: ადგილების განახლებული ფასები',
  'Renewal addendum': 'განახლების დამატებითი შეთანხმება',
  'Initial topology': 'საწყისი ტოპოლოგია',
  'Second VPN tunnel added': 'დაემატა მეორე VPN ტუნელი',
  'Exported from the IVR designer': 'ექსპორტირებულია IVR-ის რედაქტორიდან',
}

/* -------------------------------------------------------------- API keys */

const API_KEYS: KaEntries = {
  'PBX user sync': 'PBX მომხმარებლების სინქრონიზაცია',
  'Staging sync (old)': 'სატესტო სინქრონიზაცია (ძველი)',
  'Kutaisi PBX sync': 'ქუთაისის PBX-ის სინქრონიზაცია',
  'On-prem connector': 'On-prem კონექტორი',
  'Primary site sync': 'ძირითადი ობიექტის სინქრონიზაცია',
  'Standby site sync': 'სარეზერვო ობიექტის სინქრონიზაცია',
  'Cloud tenant sync': 'Cloud-გარემოს სინქრონიზაცია',
  'Rustavi PBX sync': 'რუსთავის PBX-ის სინქრონიზაცია',
  'Clinic tenant sync': 'კლინიკის გარემოს სინქრონიზაცია',
  'Outage desk sync': 'ავარიების სამსახურის სინქრონიზაცია',
}

/* ------------------------------------------------------------ seat notes */

const SEAT_NOTES: KaEntries = {
  'Initial allocation': 'საწყისი განაწილება',
  'Cutover from user tags': 'გადმოტანა მომხმარებლების ტეგებიდან',
}

/* ---------------------------------------------------- task catalogue: names */

const TEMPLATE_NAMES: KaEntries = {
  'IVR change': 'IVR-ის ცვლილება',
  'New queue': 'ახალი რიგი',
  'Agent onboarding': 'ოპერატორის ჩართვა',
  'Call-recording export': 'ზარების ჩანაწერების ექსპორტი',
  'SIP trunk issue': 'SIP ტრანკის პრობლემა',
  'Report build': 'ანგარიშის აგება',
  'CRM integration fix': 'CRM ინტეგრაციის გასწორება',
  'Number porting': 'ნომრების გადატანა',
  'Wallboard setup': 'Wallboard-ის გამართვა',
  'Skill routing change': 'უნარების მიხედვით მარშრუტიზაციის ცვლილება',
  // partner override (Lukma)
  'Hotline agent onboarding': 'ცხელი ხაზის ოპერატორის ჩართვა',
}

const TEMPLATE_DESCRIPTIONS: KaEntries = {
  'Change menu options, greetings or opening-hours logic in an existing IVR. Includes one round of revisions.':
    'არსებულ IVR-ში მენიუს პუნქტების, მისალმებების ან სამუშაო საათების ლოგიკის შეცვლა. მოიცავს ცვლილებების ერთ ციკლს.',
  'Create a new call queue with its strategy, music on hold, wrap-up time and agent membership.':
    'ახალი ზარის რიგის შექმნა: განაწილების სტრატეგიით, მოლოდინის მუსიკით, შემდგომი დამუშავების დროით და ოპერატორების შემადგენლობით.',
  'Create extensions and accounts for new agents, assign queues and skills, test login on their workstation.':
    'ახალი ოპერატორებისთვის შიდა ნომრებისა და ანგარიშების შექმნა, რიგებისა და უნარების მინიჭება, სამუშაო ადგილზე შესვლის შემოწმება.',
  'Export call recordings for a date range or a list of call ids, delivered as an encrypted archive.':
    'ზარის ჩანაწერების ექსპორტი თარიღების დიაპაზონის ან ზარების id-ების სიის მიხედვით; იგზავნება დაშიფრული არქივის სახით.',
  'Diagnose and fix registration, audio or call-setup problems on a SIP trunk, including carrier follow-up.':
    'SIP ტრანკზე რეგისტრაციის, ხმის ან ზარის დამყარების პრობლემების დიაგნოსტიკა და გასწორება, ტელეკომ ოპერატორთან კომუნიკაციის ჩათვლით.',
  'Build a new scheduled report from contact-centre data (CSV or e-mailed PDF).':
    'კონტაქტ-ცენტრის მონაცემებზე დაფუძნებული ახალი დაგეგმილი ანგარიშის აგება (CSV ან ელფოსტით გაგზავნილი PDF).',
  'Fix screen-pop, click-to-call or call-logging between the contact centre and the partner CRM.':
    'კონტაქტ-ცენტრსა და პარტნიორის CRM-ს შორის screen-pop-ის, click-to-call-ისა თუ ზარების აღრიცხვის გასწორება.',
  'Coordinate porting of numbers from another operator, update routing on the cut-over day.':
    'სხვა ტელეკომ ოპერატორიდან ნომრების გადატანის კოორდინაცია, გადართვის დღეს მარშრუტიზაციის განახლება.',
  'Configure a live wallboard (queues, waiting calls, SLA) for a TV or browser screen.':
    'რეალურ დროში მომუშავე wallboard-ის (რიგები, მოლოდინში მყოფი ზარები, SLA) გამართვა ტელევიზორის ან ბრაუზერის ეკრანისთვის.',
  'Change skill-based routing rules: skills, levels and overflow between skill groups.':
    'უნარებზე დაფუძნებული მარშრუტიზაციის წესების შეცვლა: უნარები, დონეები და უნარების ჯგუფებს შორის ზარების გადავსება.',
  'Anything not in the catalogue. Our team reviews it and sets the points before work starts.':
    'ყველაფერი, რაც კატალოგში არ არის. ჩვენი გუნდი განიხილავს და სამუშაოს დაწყებამდე ქულებს განსაზღვრავს.',
  // partner override (Lukma)
  'New hotline agents with courier-app access and the dispatch queues preset.':
    'ახალი ოპერატორები კურიერის აპლიკაციაზე წვდომითა და წინასწარ მორგებული დისპეტჩერული რიგებით.',
}

/**
 * Partner contacts and portal admins whose Latin spelling has no Georgian form
 * in the first/last name pools (`seed/static.ts` FIRST_NAMES / LAST_NAMES), so
 * the generic name mapping cannot build them.
 */
const PEOPLE: KaEntries = {
  'Tamar Gogua': 'თამარ გოგუა',
  'Irma Svanidze': 'ირმა სვანიძე',
  'Eliso Sharashidze': 'ელისო შარაშიძე',
}

/* ------------------------------------------------------- settings (bank) */

const BILLING_DETAILS: KaEntries = {
  'Rigi LLC': 'შპს Rigi',
  'Demo Bank': 'დემო ბანკი',
  '12 Demo St, Tbilisi 0100': 'დემო ქუჩა 12, თბილისი 0100',
}

/**
 * ONE-WORD KEYS. The localizer matches whole strings anywhere in a response,
 * so these are the only single-word keys in the dictionary. Each was checked
 * against every string the seed and the handlers produce: the exact value
 * occurs only in the field named next to it. Delete this block to drop them.
 */
const SINGLE_WORD_LABELS: KaEntries = {
  // partners.city
  Tbilisi: 'თბილისი',
  Kutaisi: 'ქუთაისი',
  Batumi: 'ბათუმი',
  Rustavi: 'რუსთავი',
  Gori: 'გორი',
  // synced-user presence label (`status`, next to `statusCode`)
  Available: 'თავისუფალია',
  'In call': 'ზარზეა',
  'Wrap-up': 'ზარის შემდგომი დამუშავება',
  'On break': 'შესვენებაზეა',
  Offline: 'ხაზგარეშეა',
  Deleted: 'წაშლილია',
  // licence name
  Supervisor: LICENSE_NAMES_KA.Supervisor,
}

/* ------------------------------------------------------------- exports */

/** Exact English seed string -> Georgian. */
export const entries: KaEntries = {
  ...PARTNERS,
  ...DOCUMENTS,
  ...API_KEYS,
  ...PEOPLE,
  ...SEAT_NOTES,
  ...BILLING_DETAILS,
  ...TEMPLATE_NAMES,
  ...TEMPLATE_DESCRIPTIONS,
  ...SINGLE_WORD_LABELS,
  // licence names except the single word above
  'Agent Basic': LICENSE_NAMES_KA['Agent Basic'],
  'Agent Pro': LICENSE_NAMES_KA['Agent Pro'],
  'Quality Analyst': LICENSE_NAMES_KA['Quality Analyst'],
  'Call Recording': LICENSE_NAMES_KA['Call Recording'],
  'Legacy Seat': LICENSE_NAMES_KA['Legacy Seat'],
}

/** Template rules for strings the seed builds from parts. */
export const patterns: KaPattern[] = [
  // Seat batch notes: "Raised by 3 for new agents", "Pool lowered by 4 seats"
  [/^Raised by (\d+) for new agents$/, (m) => `გაზრდილია ${m[1]}-ით ახალი ოპერატორებისთვის`],
  [/^Pool lowered by (\d+) seats?$/, (m) => `ადგილების ფონდი შემცირებულია ${m[1]}-ით`],
]
