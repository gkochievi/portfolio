import type { Dictionary } from './en'

/**
 * The same dictionary in Georgian. Typed `Dictionary`, so it has to carry every
 * key `en.ts` has and no other.
 *
 * Written, not transliterated: informal "შენ" like boulder.ge (დაათვალიერე,
 * გვიბიძგე), and boulder.ge's own words wherever it already has them — the
 * nav, the footer, "უკან ნამუშევრებში", and "ტექი" for the development
 * direction, as the Georgian site names it everywhere.
 *
 * Titles are written in ordinary lower-case Georgian. The capitals (Mtavruli)
 * are applied in the DOM by georgianCaps.ts, so the same string can still sit
 * in body copy.
 */
export const ka: Dictionary = {
  'nav.team': 'გუნდი',
  'nav.works': 'ნამუშევრები',
  'nav.services': 'სერვისები',
  'nav.stories': 'ისტორიები',
  'nav.connect': 'კონტაქტი',
  'nav.label': 'სექციები',

  'a11y.logo': 'Boulder — მთავარი საიტი',
  'a11y.skip': 'ნამუშევრებზე გადასვლა',
  'a11y.openMenu': 'მენიუს გახსნა',
  'a11y.closeMenu': 'მენიუს დახურვა',
  'a11y.close': 'დახურვა',
  'a11y.themeToggle': 'მუქი რეჟიმის გადართვა',
  'a11y.themeToDark': 'მუქ რეჟიმზე გადართვა',
  'a11y.themeToLight': 'ღია რეჟიმზე გადართვა',
  'a11y.langSwitch': 'Switch to English',
  'a11y.newTab': '(იხსნება ახალ ჩანართში)',

  'lang.switch': 'EN',
  'lang.current': 'ᲒᲔ',
  'lang.name': 'ქართული',

  'meta.title': 'Boulder — ნამუშევრები, რომლებსაც თავად მოსინჯავ',
  'meta.description':
    'Boulder ქმნის პროგრამებს, რომლებზეც ბიზნესი რეალურად მუშაობს. აქ ყველა პროექტი ბრაუზერში ცოცხალ დემოდ იხსნება — ნამდვილი მონაცემებით, ნამდვილი პროცესებით და რეგისტრაციის გარეშე.',
  'meta.project': '{name} — Boulder',
  'meta.notFound': 'ვერ მოიძებნა — Boulder',

  'site.company': 'Boulder',
  'site.tagline': 'ოპერაციული პროგრამები ბიზნესისთვის, რომელიც ტექნიკაზე მუშაობს.',
  'site.location': 'თბილისი, საქართველო',

  'hero.headlineBefore': 'თამამი',
  'hero.headlineMid': ' არჩევანი — ',
  'hero.stamp': 'BOULDER',
  'hero.headlineAfter': 'შედეგები',
  'hero.cta': 'გვიბიძგე',

  'portal.title': 'ნამუშევრები',
  'portal.subtitle': '[დაათვალიერე ჩვენი ნამუშევრები]',
  'portal.lead':
    'პროგრამები, რომლებიც რეალურ საქმეზე მომუშავე ბიზნესებისთვის შევქმენით. აქ ყველა პროექტი ბრაუზერში ცოცხალ დემოდ იხსნება — ნამდვილი მონაცემებით, ნამდვილი პროცესებით, რეგისტრაციის გარეშე.',
  // Georgian counts take the singular after a number, so one form serves both.
  'portal.countOne': '[1 ცოცხალი დემო]',
  'portal.countMany': '[{n} ცოცხალი დემო]',
  'portal.all': 'ყველა',
  'portal.filterLabel': 'გაფილტრე კატეგორიით',
  'portal.empty': '[აქ ჯერ პროექტები არ არის]',
  'portal.mainSite': '[მეტი ჩვენს შესახებ — boulder.ge]',

  'card.open': 'ქეისის ნახვა',
  'card.demo': 'ცოცხალი დემო',
  'card.noDemo': 'დემო ჯერ არ არის',
  'card.more': '+{n}',
  'card.openLabel': '{name}: ქეისის გახსნა',

  'tag.development': '[ტექი]',
  'tag.marketing': '[მარკეტინგი]',
  'tag.branding': '[ბრენდინგი]',

  'status.shipped': 'გაშვებული',
  'status.live': 'მოქმედი',
  'status.in-progress': 'მიმდინარე',
  'status.archived': 'არქივში',

  'detail.back': 'უკან ნამუშევრებში',
  'detail.eyebrow': '[ქეისი]',
  'detail.summary': 'შეჯამება',
  'detail.role': 'ჩვენი როლი',
  'detail.period': 'წელი',
  'detail.status': 'სტატუსი',
  'detail.category': 'კატეგორია',
  'detail.problem': 'პრობლემა',
  'detail.problemSub': '[რა უნდა შეცვლილიყო]',
  'detail.approach': 'მიდგომა',
  'detail.approachSub': '[როგორ მივუდექით საქმეს]',
  'detail.creative': 'კრეატიული გადაწყვეტები',
  'detail.creativeSub': '[შეზღუდვა, რა შევქმენით და რატომ აქვს ამას მნიშვნელობა]',
  'detail.constraint': 'შეზღუდვა',
  'detail.highlights': 'მთავარი მომენტები',
  'detail.stack': 'რა გამოვიყენეთ',
  'detail.stackSub': '[ტექნოლოგიები — რომელი ნაწილი რას აკეთებს]',
  'detail.architecture': 'არქიტექტურა',
  'detail.architectureSub': '[ფენა-ფენა]',
  'detail.numbers': 'ციფრებში',
  'detail.results': 'შედეგები',
  'detail.demo': 'დემო',
  'detail.demoSub': '[რას ნახავ შიგნით]',
  'detail.demoNote': '[დემოს შესახებ]',
  'detail.openDemo': 'ცოცხალი დემოს გახსნა',
  'detail.noDemo': 'დემო ჯერ არ არის',
  'detail.source': 'კოდის ნახვა',
  'detail.screens': '[ეკრანები]',
  'detail.more': 'სხვა პროექტები',
  'detail.next': 'შემდეგი პროექტი',
  'detail.prev': 'წინა პროექტი',

  'notFound.title': 'აქ არაფერია',
  'notFound.subtitle': '[404 — ასეთი გვერდი არ არსებობს]',
  'notFound.body':
    'ამ ბმულს ჩვენთან ვერაფერი შეესაბამება — შესაძლოა გვერდი გადავიტანეთ, ან საერთოდ არასდროს არსებულა. ნამუშევრებამდე ერთი დაწკაპუნებაა.',
  'notFound.home': 'უკან ნამუშევრებში',
  'notFound.suggest': '[ან გახსენი ამათგან ერთ-ერთი]',

  'footer.title': 'თამამი იდეა გაქვს?',
  'footer.subtitle': '[გვიბიძგე ან უბრალოდ მოგვწერე]',
  'footer.explore': '[დაათვალიერე]',
  'footer.visit': '[გვეწვიე]',
  'footer.follow': '[გამოგვყევი]',
  'footer.write': '[მოგვწერე]',
  'footer.navLabel': 'ქვედა ნავიგაცია',
  'footer.mainSite': 'boulder.ge',
  'footer.legal': '© {year} Boulder. ყველა უფლება დაცულია.',
  'footer.backToTop': 'ზემოთ დაბრუნება',
}
