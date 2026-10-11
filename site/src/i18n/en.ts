/**
 * Every string the portal draws that is not project content, in English.
 *
 * Flat dotted keys rather than boulder-website's nested `UI.en.works.title`, so
 * `t('works.title')` is one typed lookup and `ka.ts` can be checked against
 * this file key for key: it is typed `Record<UiKey, string>`, so a key added
 * here and forgotten there fails `npm run typecheck`.
 *
 * The words are boulder.ge's wherever boulder.ge already says the thing (the
 * nav, the footer, "back to works"), lower-case and bracketed the way it sets
 * them. `{name}`-style holes are filled with `fill()` from LanguageContext.
 */
export const en = {
  // Header — the five words boulder.ge's nav carries.
  'nav.team': 'team',
  'nav.works': 'works',
  'nav.services': 'services',
  'nav.stories': 'stories',
  'nav.connect': 'connect',
  'nav.label': 'Sections',

  'a11y.logo': 'Boulder — main site',
  'a11y.skip': 'Skip to the work',
  'a11y.openMenu': 'Open menu',
  'a11y.closeMenu': 'Close menu',
  'a11y.close': 'Close',
  'a11y.themeToggle': 'Toggle dark mode',
  'a11y.themeToDark': 'Switch to dark mode',
  'a11y.themeToLight': 'Switch to light mode',
  // Said in the language it switches TO, as on boulder.ge.
  'a11y.langSwitch': 'ქართულზე გადართვა',
  'a11y.newTab': '(opens in a new tab)',

  // The language button shows the language you would switch to: "ᲒᲔ" on the
  // English page, "EN" on the Georgian one.
  'lang.switch': 'ᲒᲔ',
  'lang.current': 'EN',
  'lang.name': 'English',

  'meta.title': 'Boulder — works you can click through',
  'meta.description':
    'Boulder builds the software a business actually runs on. Every project here opens as a live demo in your browser — real data, real workflows, no sign-up.',
  'meta.project': '{name} — Boulder',
  'meta.notFound': 'Not found — Boulder',

  'site.company': 'Boulder',
  'site.tagline': 'Operational software for businesses that run on hardware.',
  'site.location': 'Tbilisi, Georgia',

  // boulder.ge's landing headline, in its three pieces around the stamp.
  'hero.headlineBefore': 'Bold',
  'hero.headlineMid': ' choices ',
  'hero.stamp': 'BOULDER',
  'hero.headlineAfter': 'results',
  'hero.cta': 'poke us',

  // The portal page: boulder.ge's Works section, one deck of live products.
  'portal.title': 'works',
  'portal.subtitle': '[browse some of the cases we worked on]',
  'portal.lead':
    'Software we built for businesses that run on real-world operations. Every project here opens as a live demo in your browser — real data, real workflows, no sign-up.',
  'portal.countOne': '[1 live demo]',
  'portal.countMany': '[{n} live demos]',
  'portal.all': 'all',
  'portal.filterLabel': 'Filter works by category',
  'portal.empty': '[no projects here yet]',
  'portal.mainSite': '[more of boulder at boulder.ge]',

  'card.open': 'see the case',
  'card.demo': 'live demo',
  'card.noDemo': 'no demo yet',
  'card.more': '+{n}',
  'card.openLabel': '{name}: open the case study',

  // Category tag boxes: coral, indigo and ink on boulder.ge.
  'tag.development': '[development]',
  'tag.marketing': '[marketing]',
  'tag.branding': '[branding]',

  'status.shipped': 'shipped',
  'status.live': 'live',
  'status.in-progress': 'in progress',
  'status.archived': 'archived',

  // The project page, section by section.
  'detail.back': 'back to works',
  'detail.eyebrow': '[case study]',
  'detail.summary': 'summary',
  'detail.role': 'our role',
  'detail.period': 'year',
  'detail.status': 'status',
  'detail.category': 'category',
  'detail.problem': 'the problem',
  'detail.problemSub': '[what had to change]',
  'detail.approach': 'the approach',
  'detail.approachSub': '[how we went at it]',
  'detail.creative': 'solved creatively',
  'detail.creativeSub': '[the constraint, what we built, and why it matters]',
  'detail.constraint': 'the constraint',
  'detail.highlights': 'highlights',
  'detail.stack': 'what is used',
  'detail.stackSub': '[the stack, by what each part does]',
  'detail.architecture': 'architecture',
  'detail.architectureSub': '[layer by layer]',
  'detail.numbers': 'in numbers',
  'detail.results': 'results',
  'detail.demo': 'the demo',
  'detail.demoSub': '[what you will find inside]',
  'detail.demoNote': '[about this demo]',
  'detail.openDemo': 'open live demo',
  'detail.noDemo': 'no demo yet',
  'detail.source': 'view source',
  'detail.screens': '[screens]',
  'detail.more': 'more works',
  'detail.next': 'next project',
  'detail.prev': 'previous project',

  'notFound.title': 'nothing here',
  'notFound.subtitle': '[404 — this page does not exist]',
  'notFound.body':
    'Nothing on our side matches this link — the page may have moved, or never existed. The works are one click away.',
  'notFound.home': 'back to works',
  'notFound.suggest': '[or open one of these]',

  // Footer — boulder.ge's own.
  'footer.title': 'got a bold idea?',
  'footer.subtitle': '[poke us, or just say hi]',
  'footer.explore': '[explore]',
  'footer.visit': '[drop by]',
  'footer.follow': '[follow us]',
  'footer.write': '[write to us]',
  'footer.navLabel': 'Footer navigation',
  'footer.mainSite': 'boulder.ge',
  'footer.legal': '© {year} Boulder. All rights reserved.',
  'footer.backToTop': 'back to top',
} satisfies Record<string, string>

export type UiKey = keyof typeof en

export type Dictionary = Record<UiKey, string>
