/**
 * Georgian text for the work domain: task titles and descriptions, project
 * names, history notes, chat messages and the people who write them.
 *
 * Keys are the exact English strings of `seed/work.ts`, `seed/static.ts` and
 * the chat simulator in `handlers/tasks.ts`. Numerals take the singular noun
 * ("3 ოპერატორის"); product and tech names (IVR, SLA, CRM, PBX, TLS ...), ids,
 * numbers and addresses stay as they are.
 */
import { accounts } from '@/demo/accounts'
import { FIRST_NAMES, LAST_NAMES, PARTNERS, STAFF } from '@/demo/seed/static'

import type { KaEntries, KaPattern } from './types'

/** `TemplateSeed.request`: the opening paragraph of a partner's task and of the mail that created it. */
export const requests: KaEntries = {
  'Please change our IVR as described below. The new recordings are attached or will follow in this thread.':
    'გთხოვთ, შეცვალოთ ჩვენი IVR ქვემოთ აღწერილი სახით. ახალი ჩანაწერები თან ერთვის ან ამავე მიმოწერაში გამოგიგზავნით.',
  'We need a new queue. Ring strategy: longest idle agent. Wrap-up 15 seconds. Members listed below.':
    'გვჭირდება ახალი რიგი. ზარის განაწილების სტრატეგია: ყველაზე დიდხანს თავისუფალი ოპერატორი. დამუშავების დრო: 15 წამი. წევრები ჩამოთვლილია ქვემოთ.',
  'New agents start on Monday. Names and preferred extensions are below; please give them the same queues as team B.':
    'ახალი ოპერატორები ორშაბათს იწყებენ მუშაობას. სახელები და სასურველი შიდა ნომრები ქვემოთაა; გთხოვთ, მიანიჭოთ იგივე რიგები, რაც B გუნდს აქვს.',
  'Please export the recordings for the calls listed below. We need them for an internal review by Friday.':
    'გთხოვთ, ამოიღოთ ქვემოთ ჩამოთვლილი ზარების ჩანაწერები. ისინი გვჭირდება შიდა შემოწმებისთვის პარასკევამდე.',
  'Since this morning we have problems on the trunk. Example call times and numbers are below.':
    'დილიდან ტრანკზე პრობლემები გვაქვს. ზარების მაგალითები (დრო და ნომრები) ქვემოთაა.',
  'We would like a new report. Columns and filters are described below; delivery every Monday at 09:00.':
    'გვსურს ახალი ანგარიში. სვეტები და ფილტრები აღწერილია ქვემოთ; მიწოდება ყოველ ორშაბათს, 09:00 საათზე.',
  'The CRM integration is misbehaving. Steps to reproduce are below; it started after the last CRM update on our side.':
    'CRM ინტეგრაცია გაუმართავად მუშაობს. პრობლემის გამეორების ნაბიჯები ქვემოთაა; ის ჩვენს მხარეს CRM-ის ბოლო განახლების შემდეგ დაიწყო.',
  'Please port the numbers below. The signed porting form is attached.':
    'გთხოვთ, გადმოიტანოთ ქვემოთ მოცემული ნომრები. ხელმოწერილი განაცხადი თან ერთვის.',
  "We want a wallboard on the big screen. Please show waiting calls, longest wait and today's SLA per queue.":
    'გვინდა wallboard დიდ ეკრანზე. გთხოვთ, თითოეული რიგისთვის აჩვენოთ მოლოდინში მყოფი ზარები, ყველაზე ხანგრძლივი მოლოდინი და დღევანდელი SLA.',
  'Please adjust the routing as below. Current skills export is attached.':
    'გთხოვთ, მარშრუტიზაცია შეცვალოთ ქვემოთ აღწერილი სახით. უნარების მიმდინარე ექსპორტი თან ერთვის.',
  'We have a problem that does not fit the catalogue. Details below.':
    'გვაქვს პრობლემა, რომელიც კატალოგში არ ჯდება. დეტალები ქვემოთაა.',
  // Fallback opening of a mail-created task that has no template.
  'Please have a look at the problem below.': 'გთხოვთ, გადახედოთ ქვემოთ აღწერილ პრობლემას.',
}

/** Task titles: template samples, live queue items, project member tasks. */
export const titles: KaEntries = {
  // IVR change
  'Update the main IVR greeting for holiday hours': 'მთავარი IVR მისალმების განახლება სადღესასწაულო სამუშაო საათებისთვის',
  'IVR: send option 3 to the collections queue': 'IVR: მე-3 პუნქტის გადამისამართება დავალიანების ამოღების რიგზე',
  'Add an English/Georgian language choice to the IVR': 'IVR-ში ინგლისური/ქართული ენის არჩევანის დამატება',
  'IVR: add a callback option after 2 minutes in queue': 'IVR: უკუზარის შეთავაზება რიგში 2 წუთის მოლოდინის შემდეგ',
  // New queue
  'Create a queue for corporate clients': 'რიგის შექმნა კორპორატიული კლიენტებისთვის',
  'New queue for the night shift': 'ახალი რიგი ღამის ცვლისთვის',
  'Separate queue for VIP callbacks': 'ცალკე რიგი VIP უკუზარებისთვის',
  // Agent onboarding
  'Onboard 4 new agents': '4 ახალი ოპერატორის ჩართვა',
  'Accounts for 3 seasonal agents': 'ანგარიშები 3 სეზონური ოპერატორისთვის',
  'Add two supervisors to the morning team': 'ორი ზედამხედველის დამატება დილის გუნდში',
  // Call-recording export
  "Export last month's recordings for the audit": 'გასული თვის ჩანაწერების ექსპორტი აუდიტისთვის',
  'Recordings for complaint case 4471': 'ჩანაწერები საჩივრის საქმისთვის 4471',
  // SIP trunk
  'One-way audio on outbound calls via trunk 2': 'ცალმხრივი ხმა მე-2 ტრანკით გამავალ ზარებზე',
  'Trunk registration drops every night': 'ტრანკის რეგისტრაცია ყოველ ღამე წყდება',
  'Inbound calls fail with 503 since the morning': 'შემომავალი ზარები დილიდან 503 შეცდომით წყდება',
  // Reports
  'Monthly SLA report per queue': 'ყოველთვიური SLA ანგარიში რიგების მიხედვით',
  'Abandoned-call report with callback status': 'მიტოვებული ზარების ანგარიში უკუზარის სტატუსით',
  'Weekly first-call-resolution report': 'ყოველკვირეული ანგარიში პირველივე ზარზე გადაჭრილ საკითხებზე',
  // CRM
  'Screen-pop opens the wrong customer card': 'Screen-pop კლიენტის არასწორ ბარათს ხსნის',
  'Call notes are not saved to the CRM': 'ზარის შენიშვნები CRM-ში არ ინახება',
  'Click-to-call from the CRM times out': 'CRM-დან click-to-call ზარი მოლოდინის ვადის გასვლით წყდება',
  // Number porting
  'Port 4 numbers from the old provider': '4 ნომრის გადმოტანა ძველი ოპერატორიდან',
  'Move the hotline number to the new trunk': 'ცხელი ხაზის ნომრის გადატანა ახალ ტრანკზე',
  // Wallboard
  'Wallboard for the support floor TV': 'Wallboard მხარდაჭერის სივრცის ტელევიზორისთვის',
  'Add a waiting-time widget to the wallboard': 'მოლოდინის დროის ვიჯეტის დამატება wallboard-ზე',
  'Wallboard for the dispatch room': 'Wallboard დისპეტჩერთა ოთახისთვის',
  // Skill routing
  'Route Georgian speakers to senior agents first': 'ქართულენოვანი ზარების მიმართვა ჯერ უფროს ოპერატორებთან',
  'Skill routing for premium clients': 'უნარებზე დაფუძნებული მარშრუტიზაცია პრემიუმ კლიენტებისთვის',
  'Overflow from the claims skill after 60 seconds': 'ზარალის უნარის ჯგუფიდან გადავსება 60 წამის შემდეგ',
  // Other problem
  'Other problem': 'სხვა პრობლემა',
  'Agents cannot log in after a password change': 'ოპერატორები პაროლის შეცვლის შემდეგ სისტემაში ვერ შედიან',
  'Headset echo on some workstations': 'ყურსასმენის ექო ზოგიერთ სამუშაო სადგურზე',
  'Advice on adding a second site': 'კონსულტაცია მეორე ობიექტის დამატებაზე',
  'Supervisor barge-in does not work': 'ზედამხედველის ჩართვა მიმდინარე ზარში (barge-in) არ მუშაობს',

  // Live queue
  'Calls drop after 30 seconds on trunk 2': 'ზარები მე-2 ტრანკზე 30 წამის შემდეგ წყდება',
  'Weekly abandoned-call report for the client desks': 'ყოველკვირეული მიტოვებული ზარების ანგარიში კლიენტთა დესკებისთვის',
  'Agents hear an echo when transferring to supervisors': 'ზედამხედველზე გადამისამართებისას ოპერატორებს ექო ესმით',
  'Weekend-hours IVR greeting for the client desks': 'IVR მისალმება დასვენების დღეების საათებისთვის კლიენტთა დესკებზე',
  'Add 3 agents for the Saburtalo client desk': '3 ოპერატორის დამატება საბურთალოს კლიენტის დესკისთვის',
  'New overflow queue for the evening shift': 'ახალი გადავსების რიგი საღამოს ცვლისთვის',
  'Port the old fax number': 'ძველი ფაქსის ნომრის გადმოტანა',
  'Inbound calls to the card hotline fail with 503 at peak': 'ბარათების ცხელ ხაზზე შემომავალი ზარები პიკის დროს 503 შეცდომით წყდება',
  'Failover cluster: provision the standby PBX node': 'რეზერვული გადართვის კლასტერი: მოლოდინის რეჟიმის PBX კვანძის მომზადება',
  'Failover cluster: replicate IVR and queue configuration': 'რეზერვული გადართვის კლასტერი: IVR-ისა და რიგების კონფიგურაციის რეპლიკაცია',
  'Route courier calls by district skill': 'კურიერების ზარების მარშრუტიზაცია უბნის უნარის მიხედვით',
  'Couriers cannot reach the hotline from one mobile network': 'კურიერები ერთი მობილური ქსელიდან ცხელ ხაზს ვერ უკავშირდებიან',
  'Port four regional numbers to the new trunk': 'ოთხი რეგიონული ნომრის გადატანა ახალ ტრანკზე',
  'Outage announcement must play before the main menu': 'გათიშვის შეტყობინება მთავარ მენიუმდე უნდა ისმოდეს',
  'IVR: add a fibre-outage status option': 'IVR: ოპტიკური ბოჭკოს გათიშვის სტატუსის პუნქტის დამატება',
  'Queue redesign: map the outage-season call flows': 'რიგების გადაპროექტება: გათიშვების სეზონის ზარების ნაკადების აღწერა',
  'Onboard 5 agents for the Kutaisi office': '5 ოპერატორის ჩართვა ქუთაისის ოფისისთვის',
  'Seasonal queue for hotel bookings': 'სეზონური რიგი სასტუმროს ჯავშნებისთვის',
  'Wallboard on the reception screen': 'Wallboard მისაღების ეკრანზე',
  'Claims line: daily callback report': 'ზარალის ხაზი: ყოველდღიური უკუზარების ანგარიში',
  'Choppy audio on calls to the claims line': 'ხმის ჩაჭრა ზარალის ხაზზე განხორციელებულ ზარებში',
  'Route implant consultations to senior staff': 'იმპლანტაციის კონსულტაციების მიმართვა უფროს პერსონალთან',
  'Change the opening-hours message': 'სამუშაო საათების შეტყობინების შეცვლა',
  // Internal
  'Upgrade the PBX cluster to the next minor release': 'PBX კლასტერის განახლება შემდეგ მცირე ვერსიაზე',
  'Renew TLS certificates on the session border controller': 'TLS სერტიფიკატების განახლება სესიის სასაზღვრო კონტროლერზე',
  'Rotate backup storage credentials': 'სარეზერვო საცავის წვდომის მონაცემების განახლება',
  'Write a runbook for trunk failover': 'ტრანკის რეზერვზე გადართვის ინსტრუქციის (runbook) მომზადება',
  'Patch the web servers (monthly)': 'ვებსერვერების პაჩირება (ყოველთვიური)',
  'Clean up stale queues on the shared cluster': 'მოძველებული რიგების გასუფთავება საერთო კლასტერზე',
  'Investigate disk growth on the recording store': 'ჩანაწერების საცავში დისკის ზრდის გამოკვლევა',
  'Prepare a demo tenant for partner training': 'სადემონსტრაციო გარემოს მომზადება პარტნიორების ტრენინგისთვის',
  // Project member tasks
  'Click-to-call: dial button in the courier app': 'Click-to-call: აკრეფის ღილაკი კურიერის აპლიკაციაში',
  'Click-to-call: log calls to the order history': 'Click-to-call: ზარების ჩაწერა შეკვეთების ისტორიაში',
  'Booking widget: embed on the clinic site': 'ჯავშნის ვიჯეტი: ჩაშენება კლინიკის საიტზე',
  'Claims IVR rebuild: new menu tree': 'ზარალის IVR-ის გადაკეთება: მენიუს ახალი სტრუქტურა',
  'Claims IVR rebuild: Georgian and English prompts': 'ზარალის IVR-ის გადაკეთება: ქართული და ინგლისური ხმოვანი შეტყობინებები',
}

const projects: KaEntries = {
  'Courier app click-to-call integration': 'Click-to-call ინტეგრაცია კურიერის აპლიკაციაში',
  'Dial button inside the courier app, calls logged to the order history, supervisor report of courier calls.':
    'აკრეფის ღილაკი კურიერის აპლიკაციაში, ზარების ჩაწერა შეკვეთების ისტორიაში და ზედამხედველის ანგარიში კურიერების ზარებზე.',
  'Final price includes one extra integration day for the order-history API.':
    'საბოლოო ფასი მოიცავს ერთ დამატებით სამუშაო დღეს შეკვეთების ისტორიის API-სთან ინტეგრაციისთვის.',
  'Online booking widget on the clinic site': 'ონლაინ ჯავშნის ვიჯეტი კლინიკის საიტზე',
  'Callback-request widget on the clinic website feeding the booking queue.':
    'უკუზარის მოთხოვნის ვიჯეტი კლინიკის ვებსაიტზე, რომელიც ჯავშნების რიგს ავსებს.',
  'Claims IVR rebuild': 'ზარალის IVR-ის გადაკეთება',
  'New claims menu tree, bilingual prompts and a direct route to the assessors team.':
    'ზარალის მენიუს ახალი სტრუქტურა, ორენოვანი ხმოვანი შეტყობინებები და პირდაპირი მარშრუტი შემფასებლების გუნდთან.',
  'Second-site failover cluster': 'მეორე ობიექტზე რეზერვული გადართვის კლასტერი',
  'Standby PBX node at the second data centre with replicated IVR and queue configuration; quarterly failover drill.':
    'მოლოდინის რეჟიმის PBX კვანძი მეორე მონაცემთა ცენტრში, IVR-ისა და რიგების რეპლიცირებული კონფიგურაციით; კვარტალური სარეზერვო გადართვის სწავლება.',
  'Queue redesign for the outage season': 'რიგების გადაპროექტება გათიშვების სეზონისთვის',
  'Separate outage queues per region, an announcement before the menu and callback during mass outages.':
    'ცალკე რიგები გათიშვებისთვის თითოეულ რეგიონში, შეტყობინება მენიუმდე და უკუზარი მასობრივი გათიშვების დროს.',
  'Omnichannel web chat for client desks': 'მრავალარხიანი ვებჩატი კლიენტთა დესკებისთვის',
  'We would like web chat for two of our client desks, routed to the same agents as calls. Please send a quote.':
    'გვსურს ვებჩატი ჩვენი ორი კლიენტის დესკისთვის, იმავე ოპერატორებზე მიმართვით, რომლებიც ზარებს ემსახურებიან. გთხოვთ, გამოგვიგზავნოთ ფასის შეთავაზება.',
}

/** Task-history notes and the ledger notes the work seed writes. */
const notes: KaEntries = {
  'Created from mail': 'შექმნილია წერილიდან',
  'Waiting for the partner to confirm a test window': 'ველოდებით პარტნიორისგან ტესტირების დროის დადასტურებას',
  'No longer needed': 'აღარ არის საჭირო',
  'Duplicate of another task; closing': 'სხვა ამოცანის დუბლიკატია; იხურება',
  'Still happening on queue 2, see the call at 10:42.': 'პრობლემა მე-2 რიგში კვლავ არსებობს, იხილეთ 10:42-ის ზარი.',
  'The greeting plays twice, please check.': 'მისალმება ორჯერ ისმის, გთხოვთ გადაამოწმოთ.',
  'The report misses the abandoned calls column.': 'ანგარიშში მიტოვებული ზარების სვეტი აკლია.',
  'Goodwill credit for the trunk outage on the 14th': 'კეთილი ნების კრედიტი ტრანკის 14 რიცხვის გათიშვის გამო',
  'Weekend on-call support during the Saturday cutover': 'მორიგე მხარდაჭერა დასვენების დღეებში, შაბათის გადართვის დროს',
}

/** Chat: partner and staff messages, internal notes, and the simulator's staff replies. */
const chat: KaEntries = {
  // Partner
  'Any update on this one?': 'არის რამე სიახლე ამასთან დაკავშირებით?',
  'We can give you a test window tonight after 21:00.': 'ტესტირებისთვის დრო შეგვიძლია დაგითმოთ დღეს საღამოს, 21:00 საათის შემდეგ.',
  'Thanks, confirmed on our side.': 'გმადლობთ, ჩვენს მხარეს დადასტურებულია.',
  'The call ids from this morning are in the mail thread.': 'დილის ზარების ID-ები წერილების მიმოწერაშია.',
  'Our supervisors will check it during the morning shift and come back to you.': 'ჩვენი ზედამხედველები დილის ცვლაში გადაამოწმებენ და თქვენ დაგიბრუნდებიან.',
  'Please do the change after 22:00, the hotline is busy before that.': 'გთხოვთ, ცვლილება 22:00 საათის შემდეგ შეიტანოთ, მანამდე ცხელი ხაზი დატვირთულია.',
  // Staff
  'Picked up. Checking the trunk logs now.': 'აღებულია მუშაობაში. ახლა ტრანკის ლოგებს ვამოწმებ.',
  'The change is ready on staging; please test with extension 2001.': 'ცვლილება მზადაა სატესტო გარემოში; გთხოვთ, გატესტოთ შიდა ნომრით 2001.',
  'Deployed. Please verify and close the task when you are happy.': 'დანერგილია. გთხოვთ, გადაამოწმოთ და, თუ ყველაფერი რიგზეა, დაადასტუროთ ამოცანის შესრულება.',
  'Could you send two example call times? We cannot reproduce it yet.': 'შეგიძლიათ ზარის ორი მაგალითის დრო გამოგვიგზავნოთ? ჯერ პრობლემის გამეორება ვერ მოვახერხეთ.',
  'Waiting on the carrier; they promised an answer by tomorrow noon.': 'ტელეკომ ოპერატორის პასუხს ველოდებით; დაგვპირდნენ, რომ ხვალ შუადღემდე გვიპასუხებენ.',
  'Scheduled for the Sunday change window.': 'დაგეგმილია კვირა დღეს, ცვლილებებისთვის განკუთვნილ დროში.',
  // Internal notes
  'Carrier ticket opened, waiting on their NOC.': 'ტელეკომ ოპერატორთან ბილეთი გახსნილია, მათი NOC-ის პასუხს ველოდებით.',
  'Partner admin confirmed by phone, go ahead.': 'პარტნიორის ადმინისტრატორმა ტელეფონით დაადასტურა, შეიძლება გაგრძელება.',
  'Root cause was our config change last week; keep the points as is but mention it in the reply.':
    'მიზეზი გასულ კვირას ჩვენ მიერ შეტანილი კონფიგურაციის ცვლილება იყო; ქულები უცვლელად დარჩეს, მაგრამ პასუხში ეს აღინიშნოს.',
  'Needs a second pair of eyes on the dial plan before deploy.': 'დანერგვამდე dial plan-ს მეორე ადამიანმაც უნდა გადახედოს.',
  'Same issue as the one we fixed for another tenant in spring; reuse that patch.':
    'იგივე პრობლემაა, რაც გაზაფხულზე სხვა კლიენტთან გავასწორეთ; გამოიყენეთ იგივე პაჩი.',
  // Chat simulator (handlers/tasks.ts STAFF_REPLIES_EN, paired with STAFF_REPLIES_KA)
  'Thanks for the update. I have your message and I am looking into it now. I will come back to you shortly.':
    'მადლობა ინფორმაციისთვის. შეტყობინება მივიღე და ახლა ვამოწმებ. მალე დაგიბრუნდებით პასუხით.',
  'Got it, thank you. I am checking this on our side and will confirm here as soon as I have an answer.':
    'გასაგებია, გმადლობთ. ვამოწმებ ჩვენს მხარეს და პასუხს აქვე დაგიდასტურებთ.',
  'Understood. I have noted it on the task and will pick it up next. Please let me know if anything changes.':
    'გასაგებია. ამოცანაზე აღვნიშნე და მომდევნო ეტაპად ავიღებ. თუ რამე შეიცვლება, გთხოვთ შემატყობინოთ.',
  'Thank you for the details, they help a lot. I will update the task once the change is in place.':
    'გმადლობთ დეტალებისთვის, ძალიან გამოდგება. ცვლილების შეტანისთანავე განვაახლებ ამოცანას.',
}

/**
 * People who author chat messages, history rows and mails: Latin spelling ->
 * the Georgian form the seed already carries (`fullNameKa`, FIRST/LAST name pools).
 */
export const names: KaEntries = (() => {
  const first = new Map(FIRST_NAMES)
  const last = new Map(LAST_NAMES)
  const out: Record<string, string> = {}
  const add = (given: string, family: string) => {
    const g = first.get(given)
    const f = last.get(family)
    if (g && f) out[`${given} ${family}`] = `${g} ${f}`
  }
  for (const s of STAFF) out[`${s.first} ${s.last}`] = s.fullNameKa
  for (const a of accounts) out[a.name] = a.nameKa
  for (const p of PARTNERS) {
    for (const a of p.admins) add(a.first, a.last)
    for (const [given, family] of p.contacts) add(given, family)
  }
  return out
})()

export const entries: KaEntries = { ...requests, ...titles, ...projects, ...notes, ...chat, ...names }

/* ------------------------------------------------------------- patterns */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const title = (s: string) => (Object.hasOwn(titles, s) ? titles[s] : s)

const REQUEST_ALTERNATIVES = Object.keys(requests).map(escapeRe).join('|')

/**
 * Task descriptions the seed composes: `${request}\n\n${title}.` for catalogue
 * work, and two fixed trailers for project member tasks and internal work.
 */
export const patterns: KaPattern[] = [
  [new RegExp(`^(${REQUEST_ALTERNATIVES})\\n\\n([^\\n]+)\\.$`), (m) => `${requests[m[1]]}\n\n${title(m[2])}.`],
  [
    /^([^\n]+)\.\n\nInternal maintenance\. No partner impact expected; announce in the ops channel before starting\.$/,
    (m) => `${title(m[1])}.\n\nშიდა ტექნიკური სამუშაო. პარტნიორებზე გავლენა არ არის მოსალოდნელი; დაწყებამდე შეატყობინეთ ოპერაციების არხში.`,
  ],
  [/^([^\n]+)\.\n\nPart of the project scope agreed with the partner\.$/, (m) => `${title(m[1])}.\n\nპარტნიორთან შეთანხმებული პროექტის ფარგლების ნაწილი.`],
]
