/**
 * Georgian text for the support mailbox: thread subjects, mail bodies, the
 * senders that are not partner contacts, and the strings the seed builds from
 * parts (`Re: ...`, `Hello,` + request + title, the signature block, the HTML
 * twin of a body, and the one-line `preview`).
 *
 * Mail bodies reach the UI as `bodyText` (body + `\n\n--\nName\nPartner\nPhone`),
 * as `bodyHtml` (the same text as `<p>` blocks) and as `preview` (the first 180
 * characters, whitespace flattened). All three are derived from the same body
 * dictionary below, so a body only has to be translated once.
 */
import { PARTNERS, STAFF } from '@/demo/seed/static'

import { entries as catalog, LICENSE_NAMES_KA } from './catalog'
import type { KaEntries, KaPattern } from './types'
import { entries as work, names, requests, titles } from './work'

const AGENT_BASIC = LICENSE_NAMES_KA['Agent Basic'] ?? 'Agent Basic'
const AGENT_PRO = LICENSE_NAMES_KA['Agent Pro'] ?? 'Agent Pro'

/** Thread / mail subjects. */
const subjects: KaEntries = {
  'VPN tunnel flapping since this morning': 'VPN გვირაბი დილიდან არასტაბილურად მუშაობს',
  "Question about last month's invoice": 'კითხვა გასული თვის ინვოისთან დაკავშირებით',
  'Can we add two supervisors next week?': 'შეგვიძლია მომავალ კვირას ორი ზედამხედველის დამატება?',
  'Contract renewal: draft for review': 'ხელშეკრულების განახლება: პროექტი გადასახედად',
  'Invitation: contact-centre meetup, Thursday 19:00': 'მოწვევა: კონტაქტ-ცენტრების შეხვედრა, ხუთშაბათი, 19:00',
  'Recording storage almost full?': 'ჩანაწერების საცავი თითქმის სავსეა?',
  'Sunday change window confirmation': 'კვირა დღის ცვლილებების ფანჯრის დადასტურება',
  'Summer season staffing forecast': 'საზაფხულო სეზონის კადრების პროგნოზი',
  'Price list for extra seats': 'ფასების სია დამატებითი ადგილებისთვის',
  'Penetration test window next month': 'შეღწევადობის ტესტირების ფანჯარა მომავალ თვეში',
  'This week in telecom: SIP security roundup': 'ამ კვირის ტელეკომის სიახლეები: SIP უსაფრთხოების მიმოხილვა',
  'Delivery Status Notification (Failure)': 'მიწოდების სტატუსის შეტყობინება (შეცდომა)',
  'Automatic reply: Out of office until Monday': 'ავტომატური პასუხი: ოფისში არ ვარ ორშაბათამდე',
  'Save 30% on dedicated servers this month': 'დაზოგეთ 30% გამოყოფილ სერვერებზე ამ თვეში',
  'Your webinar recording is ready': 'თქვენი ვებინარის ჩანაწერი მზადაა',
  'Reception phones ring twice before connecting': 'მისაღების ტელეფონები დაკავშირებამდე ორჯერ რეკავს',
  'Recording search is slow for last week': 'ჩანაწერების ძიება გასული კვირისთვის ნელია',
  'Updated billing contact': 'განახლებული ბილინგის კონტაქტი',
  'Kutaisi office internet outage tonight 23:00-01:00': 'ქუთაისის ოფისში ინტერნეტი დღეს ღამით, 23:00-დან 01:00 საათამდე გაითიშება',
  'Two new numbers for the summer hotline': 'ორი ახალი ნომერი საზაფხულო ცხელი ხაზისთვის',
  'This week in telecom: number portability changes': 'ამ კვირის ტელეკომის სიახლეები: ნომრის გადატანის ცვლილებები',
  'Payment confirmation': 'გადახდის დადასტურება',
  'Agent headsets: recommended models?': 'ოპერატორის ყურსასმენები: რომელ მოდელებს გირჩევთ?',
  'Board visit: wallboard on the 3rd floor': 'დირექტორთა საბჭოს ვიზიტი: wallboard მე-3 სართულზე',
  'Delivery Status Notification (Delay)': 'მიწოდების სტატუსის შეტყობინება (შეფერხება)',
  'Do you support WhatsApp?': 'მხარს უჭერთ WhatsApp-ს?',
}

/** Mail bodies, without the signature. Keys keep the seed's own line breaks. */
const bodies: KaEntries = {
  'Hi team,\n\nThe site-to-site tunnel dropped four times since 08:00. Calls survive, but the wallboard loses data. Can someone look?':
    'გამარჯობა, გუნდო,\n\nsite-to-site გვირაბი 08:00 საათიდან ოთხჯერ გაითიშა. ზარები არ წყდება, მაგრამ wallboard მონაცემებს კარგავს. შეიძლება ვინმემ გადახედოს?',
  'Hello,\n\nCould you explain how the Agent Pro line is calculated? Procurement asks why it is not a round number of seats.':
    `გამარჯობა,\n\nგთხოვთ, განგვიმარტოთ, როგორ ითვლება ინვოისში ლიცენზია „${AGENT_PRO}“. შესყიდვების განყოფილება კითხულობს, რატომ არ არის ადგილების რაოდენობა მთელი რიცხვი.`,
  'გამარჯობა,\n\nNext week two team leads become supervisors. Do we need new seats or can we move them from Agent Basic?':
    `გამარჯობა,\n\nმომავალ კვირას ორი გუნდის ლიდერი ზედამხედველი გახდება. გვჭირდება თუ არა ახალი ადგილები, თუ შეგვიძლია მათი „${AGENT_BASIC}“ ლიცენზიიდან გადმოტანა?`,
  'Dear colleagues,\n\nPlease find our comments on the renewal draft attached. Main point: the notice period.':
    'ძვირფასო კოლეგებო,\n\nგანახლების პროექტზე ჩვენი კომენტარები თან ერთვის. მთავარი საკითხი: გაფრთხილების ვადა.',
  'You are invited to our monthly meetup. Topic: measuring first-call resolution.':
    'გიწვევთ ჩვენს ყოველთვიურ შეხვედრაზე. თემა: პირველივე ზარზე საკითხის გადაჭრის გაზომვა.',
  'We got a warning in the admin panel that recording storage is at 91%. Is that on your side or ours?':
    'ადმინისტრატორის პანელში გაფრთხილება გამოჩნდა, რომ ჩანაწერების საცავი 91%-ით არის შევსებული. ეს თქვენს მხარესაა თუ ჩვენს?',
  'Confirming the Sunday window 10:00-14:00 for the claims line changes.':
    'ვადასტურებთ კვირა დღის ფანჯარას 10:00-14:00 ზარალის ხაზის ცვლილებებისთვის.',
  'Small correction: 10:00-13:00, the assessors start at 13:30.': 'მცირე შესწორება: 10:00-13:00, შემფასებლები 13:30-ზე იწყებენ მუშაობას.',
  'Sharing our forecast: +6 agents from June to September. No action yet, just for planning.':
    'გიზიარებთ ჩვენს პროგნოზს: +6 ოპერატორი ივნისიდან სექტემბრამდე. მოქმედება ჯერ არ არის საჭირო, მხოლოდ დაგეგმვისთვის.',
  'Hello,\n\nWhat would two more Agent Basic seats cost per month?': `გამარჯობა,\n\nრა დაჯდება თვეში ლიცენზიის „${AGENT_BASIC}“ კიდევ ორი ადგილი?`,
  'And is there a minimum term for added seats?': 'და არის თუ არა დამატებული ადგილებისთვის მინიმალური ვადა?',
  'Our security team plans a penetration test of the contact-centre web interface. Please confirm who should be informed.':
    'ჩვენი უსაფრთხოების გუნდი გეგმავს კონტაქტ-ცენტრის ვებ-ინტერფეისის შეღწევადობის ტესტირებას. გთხოვთ, დაადასტუროთ, ვის უნდა ეცნობოს.',
  'Top stories: toll fraud trends, new codec support, and five tips for trunk hardening.':
    'მთავარი თემები: ზარების თაღლითობის (toll fraud) ტენდენციები, კოდეკების ახალი მხარდაჭერა და ხუთი რჩევა ტრანკის დაცვის გასაუმჯობესებლად.',
  'Delivery to the following recipient failed permanently: old-desk@zemo.example':
    'შემდეგ მიმღებთან მიწოდება სამუდამოდ ვერ მოხერხდა: old-desk@zemo.example',
  'I am out of the office until Monday with limited access to e-mail. For urgent matters call the NOC.':
    'ორშაბათამდე ოფისში არ ვიმყოფები და ელფოსტაზე წვდომა შეზღუდული მაქვს. გადაუდებელ საკითხებზე დაუკავშირდით NOC-ს.',
  'Upgrade today and save. Offer ends Friday.': 'გადადით დღესვე და დაზოგეთ. შეთავაზება პარასკევს მთავრდება.',
  'The recording of "Queue strategies that work" is ready to watch.': 'ჩანაწერი „რიგის მართვის ეფექტიანი სტრატეგიები“ ნახვისთვის მზადაა.',
  'Hello,\n\nSince yesterday the reception phones ring twice before the call connects. Patients hang up. Can you check?':
    'გამარჯობა,\n\nგუშინდან მისაღების ტელეფონები ზარის დაკავშირებამდე ორჯერ რეკავს. პაციენტები ყურმილს კიდებენ. შეგიძლიათ გადაამოწმოთ?',
  'Saburtalo couriers still land in the general queue. The other districts look right.':
    'საბურთალოს კურიერები კვლავ საერთო რიგში ხვდებიან. დანარჩენი უბნები სწორად მუშაობს.',
  'Searching recordings for last week takes over a minute. Earlier weeks are fast.':
    'გასული კვირის ჩანაწერების ძიებას ერთ წუთზე მეტი სჭირდება. უფრო ძველი კვირები სწრაფად იძებნება.',
  'Please also add the assessor name as a column. Thank you!': 'გთხოვთ, შემფასებლის სახელიც დაამატოთ ცალკე სვეტად. მადლობა!',
  'From next month please send invoices to billing@zemo.example only.':
    'მომავალი თვიდან გთხოვთ, ინვოისები მხოლოდ billing@zemo.example მისამართზე გამოგვიგზავნოთ.',
  'Our ISP announced maintenance tonight. Calls will fail over to mobile forwarding.':
    'ჩვენმა ინტერნეტ-პროვაიდერმა დღეს ღამით ტექნიკური სამუშაოები გამოაცხადა. ზარები მობილურ ნომრებზე გადამისამართდება.',
  'We bought two numbers for the summer hotline; porting forms attached.':
    'საზაფხულო ცხელი ხაზისთვის ორი ნომერი შევიძინეთ; გადმოტანის განაცხადები თან ერთვის.',
  'Now it shows 94%. Should we delete old recordings ourselves?': 'ახლა 94%-ს აჩვენებს. ძველი ჩანაწერები ჩვენ თვითონ წავშალოთ?',
  'Top stories: new porting rules, codec news and a webinar on queue design.':
    'მთავარი თემები: გადმოტანის ახალი წესები, კოდეკების სიახლეები და ვებინარი რიგების დაგეგმარებაზე.',
  'Payment for last month was sent today; confirmation attached.': 'გასული თვის გადახდა დღეს გაიგზავნა; დადასტურება თან ერთვის.',
  'Which headsets do you recommend for the claims team? Budget is moderate.': 'რომელ ყურსასმენებს გვირჩევთ ზარალის გუნდისთვის? ბიუჯეტი ზომიერია.',
  'The board visits the contact centre on Thursday. Could the 3rd-floor wallboard show the SLA in large font?':
    'დირექტორთა საბჭო ხუთშაბათს კონტაქტ-ცენტრს ესტუმრება. შეიძლება მე-3 სართულის wallboard-ზე SLA მსხვილი შრიფტით გამოჩნდეს?',
  'Delivery to dispatch@lukma.example is delayed. The server will keep trying.':
    'dispatch@lukma.example მისამართზე მიწოდება შეფერხდა. სერვერი ცდას გააგრძელებს.',
  'Stable again after the ISP restarted their router. Leaving it with you to confirm.':
    'ინტერნეტ-პროვაიდერის როუტერის გადატვირთვის შემდეგ ისევ სტაბილურია. დადასტურება თქვენზე რჩება.',
  'Patients ask if they can write to us on WhatsApp. Is that possible with our setup?':
    'პაციენტები გვეკითხებიან, შეუძლიათ თუ არა WhatsApp-ზე მოგვწერონ. ეს ჩვენს კონფიგურაციაში შესაძლებელია?',
  // Replies the seed adds to task threads
  'Adding two more examples from this morning: 09:14 and 09:52, both on the main line.':
    'ვამატებთ დილის კიდევ ორ მაგალითს: 09:14 და 09:52, ორივე მთავარ ხაზზე.',
  'Any news? Our supervisors keep asking.': 'არის რამე სიახლე? ჩვენი ზედამხედველები სულ გვეკითხებიან.',
  'We can stay online until 20:00 today if you need us for a test.': 'თუ ტესტისთვის გვჭირდებით, დღეს 20:00 საათამდე ხელმისაწვდომები ვიქნებით.',
  'Attaching what our team collected so far.': 'თან ვურთავთ იმას, რაც ჩვენმა გუნდმა აქამდე შეაგროვა.',
  'Quick update from our side: it happened again at 11:20, two calls affected.':
    'მოკლე განახლება ჩვენი მხრიდან: 11:20-ზე ისევ განმეორდა, ორ ზარზე იმოქმედა.',
  'Thanks for the call earlier. One more thing: the change should also cover the weekend team.':
    'მადლობა ადრინდელი ზარისთვის. კიდევ ერთი რამ: ცვლილება დასვენების დღეების გუნდსაც უნდა მოიცავდეს.',
  'We tested on two workstations; one is fine, the other still shows the old behaviour.':
    'ორ სამუშაო სადგურზე გავტესტეთ; ერთზე ყველაფერი რიგზეა, მეორეზე ძველი ქცევა კვლავ შენარჩუნებულია.',
  'Could you also send the summary of what was changed? Our auditor asked for it.':
    'შეგიძლიათ ცვლილებების მოკლე აღწერაც გამოგვიგზავნოთ? ჩვენმა აუდიტორმა მოითხოვა.',
  'Thanks for the fix. Small thing: the old message still plays on the backup line.':
    'მადლობა გასწორებისთვის. პატარა საკითხია: ძველი შეტყობინება სარეზერვო ხაზზე კვლავ ისმის.',
}

/** Senders that are not partner contacts (their names go on `fromName` and into the signature). */
const senders: KaEntries = {
  'Mail Delivery System': 'ფოსტის მიწოდების სისტემა',
  'Cloud Hosting Offers': 'Cloud Hosting შეთავაზებები',
  'Webinar Desk': 'ვებინარების სამსახური',
  // "Tbilisi CX Meetup" and "Telecom Weekly" are names of a community and a newsletter: kept as they are.
}

export const entries: KaEntries = { ...subjects, ...bodies, ...senders }

/* --------------------------------------------------------------- helpers */

const own = (dict: KaEntries, key: string): string | undefined => (Object.hasOwn(dict, key) ? dict[key] : undefined)

/** Georgian text for a display string from any dictionary this module can see. */
function tr(text: string): string | undefined {
  return own(entries, text) ?? own(work, text) ?? own(catalog, text)
}

const person = (name: string): string => own(names, name) ?? own(senders, name) ?? own(catalog, name) ?? name

const flatten = (text: string): string => text.replace(/\s+/g, ' ').trim()

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toHtml = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('')
const fromHtml = (html: string) =>
  html
    .slice(3, -4)
    .split('</p><p>')
    .map((para) => para.replace(/<br>/g, '\n').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'))
    .join('\n\n')

/* ---------------------------------------------------------------- bodies */

/** Bodies the seed already wrote in Georgian: nothing to translate, but their signature still is. */
const KEPT_BODIES: readonly string[] = ['გმადლობთ, ველოდებით განახლებას.', 'ახლაც იგივე პრობლემაა, გთხოვთ გადახედოთ.']

const HELLO = /^Hello,\n\n([^\n]+)\n\n([^\n]+)\.$/

/** A known body (no signature) in Georgian, or undefined for text we do not recognise. */
function translateBody(body: string): string | undefined {
  const direct = own(bodies, body)
  if (direct !== undefined) return direct
  if (KEPT_BODIES.includes(body)) return body
  const m = HELLO.exec(body)
  if (m && Object.hasOwn(requests, m[1])) return `გამარჯობა,\n\n${requests[m[1]]}\n\n${tr(m[2]) ?? m[2]}.`
  return undefined
}

const SIGNED = /^([\s\S]+?)\n\n--\n([^\n]+)((?:\n[^\n]+){0,2})$/

/** `body + signature` in Georgian; the text itself when the body is not one of ours. */
function translateMail(text: string): string {
  const m = SIGNED.exec(text)
  if (!m) return text
  const body = translateBody(m[1])
  if (body === undefined) return text
  const rest = m[3]
    .split('\n')
    .slice(1)
    .map((line) => (line.startsWith('+') ? line : (tr(line) ?? line)))
  return `${body}\n\n--\n${[person(m[2]), ...rest].join('\n')}`
}

/* --------------------------------------------------------------- previews */

const PREVIEW_MAX = 180

interface FlatBody {
  flat: string
  ka: string
}
let flatBodies: FlatBody[] | null = null
let flatRequests: Array<{ flat: string; request: string }> | null = null
let nameKeys: string[] | null = null

/** Plain bodies keyed by the way `preview()` flattens them. */
function knownBodies(): FlatBody[] {
  flatBodies ??= [...Object.entries(bodies), ...KEPT_BODIES.map((b): [string, string] => [b, b])].map(([en, ka]) => ({ flat: flatten(en), ka: flatten(ka) }))
  return flatBodies
}

/** The Georgian body behind the part of a preview that comes before the signature, or undefined. */
function previewBody(left: string, truncated: boolean): string | undefined {
  const whole = knownBodies().find((b) => b.flat === left)
  if (whole) return whole.ka
  // "Hello, <request> <title>." - the title may be any task title, English or already Georgian.
  if (left.startsWith('Hello, ')) {
    flatRequests ??= Object.keys(requests).map((request) => ({ flat: flatten(request), request }))
    const after = left.slice('Hello, '.length)
    for (const { flat, request } of flatRequests) {
      if (after.startsWith(`${flat} `)) {
        const rest = after.slice(flat.length + 1)
        const closed = /^(.+)\.$/.exec(rest)
        if (closed) return flatten(translateBody(`Hello,\n\n${request}\n\n${closed[1]}.`) ?? left)
        // The cut fell inside the title: finish it from the title list when it is one we know.
        const full = Object.keys(titles).find((t) => t.startsWith(rest))
        return flatten(`გამარჯობა, ${requests[request]} ${full ? titles[full] : rest}`)
      }
      if (truncated && flat.startsWith(after)) return flatten(`გამარჯობა, ${requests[request]}`)
    }
  }
  // Cut inside a plain body.
  return truncated ? knownBodies().find((b) => b.flat.startsWith(left))?.ka : undefined
}

/** Signature tail of a preview (`Name Partner +995 ...`), keeping only the units that arrived whole. */
function previewSignature(flat: string): string {
  nameKeys ??= [
    ...PARTNERS.flatMap((p) => [...p.admins.map((a) => `${a.first} ${a.last}`), ...p.contacts.map(([first, last]) => `${first} ${last}`)]),
    ...STAFF.map((u) => `${u.first} ${u.last}`),
    ...Object.keys(senders),
  ].sort((a, b) => b.length - a.length)
  const startsWithUnit = (text: string, unit: string) => text.startsWith(unit) && (text.length === unit.length || text[unit.length] === ' ')
  let rest = flat
  const out: string[] = []
  const name = nameKeys.find((n) => startsWithUnit(rest, n))
  if (!name) return ''
  out.push(person(name))
  rest = rest.slice(name.length).trimStart()
  const partner = PARTNERS.map((p) => p.name).find((n) => startsWithUnit(rest, n))
  if (partner) {
    out.push(tr(partner) ?? partner)
    rest = rest.slice(partner.length).trimStart()
  }
  const phone = /^\+995[\d ]*\d/.exec(rest)
  if (phone) out.push(phone[0])
  return out.join(' ')
}

/**
 * The `preview` the mail endpoints derive from a body: whitespace flattened, cut
 * at 180 characters. The English preview is traced back to its body, which is
 * translated and cut the same way. Unknown previews come back unchanged.
 */
export function localizePreview(preview: string): string {
  const truncated = preview.endsWith('…')
  const core = truncated ? preview.slice(0, -1) : preview
  const at = core.indexOf(' -- ')
  const left = at === -1 ? core : core.slice(0, at)
  const body = previewBody(left, truncated)
  if (body === undefined) return preview
  let out = body
  if (at !== -1) {
    const signature = previewSignature(core.slice(at + 4))
    if (signature) out += ` -- ${signature}`
  }
  if (out.length > PREVIEW_MAX) return `${out.slice(0, PREVIEW_MAX - 1).trimEnd()}…`
  return truncated ? `${out}…` : out
}

/* -------------------------------------------------------------- patterns */

export const patterns: KaPattern[] = [
  // Reply subjects keep the Latin "Re:" and translate the rest.
  [/^Re: ([\s\S]+)$/, (m) => `Re: ${tr(m[1]) ?? m[1]}`],
  // bodyText: body + signature block.
  [SIGNED, (m) => translateMail(m[0])],
  // bodyHtml: the same text as <p> blocks.
  [/^<p>[\s\S]*<\/p>$/, (m) => {
    const text = fromHtml(m[0])
    const ka = translateMail(text)
    return ka === text ? m[0] : toHtml(ka)
  }],
]
