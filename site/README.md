# The portal

Boulder's "works" showcase: one deck of live products, and one page per
project. English at `/`, Georgian at `/ka`. React 18 + TypeScript strict,
Vite 6, React Router 6, Tailwind v4.

| Route | Page |
|---|---|
| `/` · `/ka` | The works deck (`PortalPage`) |
| `/work/:slug` · `/ka/work/:slug` | One project (`ProjectPage`) |
| anything else · `/ka/…` | 404 (`NotFoundPage`), also rendered for an unknown slug |

A card opens `/work/<slug>` — the description, what it is built from, the parts
worth naming — and the demo is a button on that page. The deck sells by being
openable; the page behind it is what makes the demo worth opening.

## Brand: a port of boulder.ge

The portal is meant to read as a section of <https://boulder.ge>, not as a
look-alike. Its chrome is a **port of `boulder-website`** (Next 16 + React 19,
JSX), the live source of boulder.ge, into TSX for React 18 — the same tokens,
the same components, the same CSS, by the same names:

| boulder-website | here |
|---|---|
| `src/index.css` `:root` tokens | `src/styles/boulder.css` — `--color-*`, `--ink`, `--page-bg`, `--u`, `--space-*`, `--fs-*`, … verbatim |
| `styles/header.css` · `footer.css` · `motion.css` | `src/styles/` under the same names (`controls.css` is the theme toggle and language switch) |
| `components/Header.jsx` · `Footer.jsx` · `NavPill.jsx` · `Logo.jsx` / `LogoArt.jsx` | `src/components/*.tsx` |
| `ThemeToggle.jsx` · `LanguageSwitch.jsx` (+ their `*Art`) | the same, the language button drawing "ᲒᲔ" / "EN" |
| `PageBackground.jsx` · `SparkCanvas.jsx` · `Reveal` | the dot grid with the side boulder, the click burst, the scroll-in |
| `router/lang.js` · `i18n/LanguageContext.jsx` · `georgianCaps.js` | `src/i18n/lang.ts` · `LanguageContext.tsx` · `georgianCaps.ts` |

The values, for orientation — **`boulder.css` is the copy that counts**:

| | |
|---|---|
| Main dark · bright | `--color-dark: #111224` · `--color-bright: #e0dff7` |
| Accent (coral) · accent 2 (indigo) | `--color-accent: #ff3366` · `--color-accent-2: #5c4de8` |
| Ink · page | `--ink` / `--page-bg`: dark on white, bright on dark in the dark theme |
| Page | the dot grid (`--dots-size: 3.5px`, `--dots-gap: 40.6px`) and boulder.ge's pre-rendered side rock |
| Frame unit | `--u` — the 1440 × 1024 design frame scaled to the window, × 0.92 |
| Type | Montserrat Alternates 400 / 700 / 900; Google Sans for Georgian — boulder.ge's own Google Fonts request, in `index.html` |
| Voice | lower-case, bracketed microcopy — `[browse some of the cases we worked on]` |
| Cards | the notched corner (`--card-notch`, `.card-shape` / `.card-shape--alt`) and tag boxes: `[development]` coral, `[marketing]` indigo, `[branding]` ink |
| Motion | hovers `300ms cubic-bezier(0.34, 1.56, 0.64, 1)`; reveals `550ms cubic-bezier(0.16, 1, 0.3, 1)` |

**If the brand moves, it moves in `boulder-website` first** and is copied
across; nothing here re-derives a colour or a curve. The header's words other
than "works" link back to boulder.ge in the current language, and so does the
logo. The images under `public/brand/` (the side rock, the logo's hover art)
are boulder.ge's own files, referenced through `import.meta.env.BASE_URL`.

The demos deliberately do **not** inherit any of this. Each is a different
client's product with its own identity, and recolouring one in Boulder's
palette would misrepresent what shipped. That is also why this app does not
import `@portfolio/brand/tokens.css` — that package belongs to the Printomato
demo.

Light and dark both ship. The choice is stored under `boulder.theme`, an unset
choice follows the OS, and `index.html` applies the same rule inline before
first paint so there is no flash (`lib/theme.ts`, `useTheme()`).

## Languages

The URL is the language, as on boulder.ge: `/ka/…` is Georgian, everything
else English. Switching is a navigation to the same page — path, query and
fragment — under the other prefix, so a shared link opens in the language it
was copied in. An explicit switch is remembered (`boulder.lang`) and takes a
reader who chose Georgian from an un-prefixed address to its `/ka` twin;
arriving on someone's `/ka` link is not remembered. `<html lang>` follows the
page, which repoints the fonts to Google Sans, and Georgian titles are set in
Mtavruli capitals by `georgianCaps.ts` (CSS `uppercase` skips Georgian).
`document.title` and `<meta name="description">` (`meta.description`) follow
the route and the language (`lib/useDocumentTitle.ts`).

The demos are separate bundles with their own language switches, so the
language is handed over in the address: in Georgian every "open live demo"
link carries `?lang=ka` (before any fragment, keeping the `demoUrl`'s own
query and hash); English links stay clean. One helper builds every demo link —
`demoHref(demoUrl, lang)` in `lib/url.ts`.

Both routers carry it. Under the browser router the prefix sits after
`VITE_BASE` (`/portfolio/ka/work/x`); under `VITE_ROUTER=hash` it sits inside
the fragment (`#/ka/work/x`).

Components ask `useLang()` for `{ lang, t, href, switchHref }`:
`t('portal.title')` looks a UI string up, `href('/work/x')` adds the prefix in
Georgian, `switchHref` is this page in the other language.

**UI strings** live in `src/i18n/en.ts` and `src/i18n/ka.ts`, flat dotted keys.
`ka.ts` is typed `Record<keyof typeof en, string>`, so a key added to `en.ts`
and forgotten in `ka.ts` fails `npm run typecheck`. No component carries its
own copy — the header and footer read the same dictionaries
(`components/chromeCopy.ts` only regroups them). Write the Georgian in
ordinary lower-case; the capitals are applied in the DOM.

## The content model

`content/projects.json` is the catalogue and the **English source of truth**.
Order in the file is order in the deck.

| Field | Type | Used for |
|---|---|---|
| `slug` | string | React key, `/work/<slug>`, the seed for the generated card artwork, and the key into the Georgian overlay |
| `name` | string | Card title |
| `tagline` | string | The one line of card body |
| `category` | string \| undefined | **Optional.** The bracketed tag box on the card and the project page — `[fleet management]`. With two or more different categories the deck grows a filter, `?category=<English value>`, which the language switch keeps |
| `period` | string | Under the title |
| `status` | `shipped \| live \| in-progress \| archived` | The badge on the cover |
| `stack` | string[] | Tag row; the first five show, the rest collapse to `+N` |
| `demoUrl` | string \| null | The demo button, resolved against `VITE_BASE` (an absolute URL is used as is), plus `?lang=ka` in Georgian. **Null** reads "no demo yet" |
| `cover` | string \| null | The card image, base-relative: `/thumbnails/<slug>.webp`, a file in `public/thumbnails/`, 4:3. **Null — or a file that is not there yet — falls back to the generated `ProjectMark`** (`ProjectCover`, on the image's `onError`) |

The project page at `/work/<slug>` renders the rest:

| Field | Type | Section |
|---|---|---|
| `summary` · `role` | string | The hero, under the project name |
| `demoNote` | string \| null | Directly under the demo button — what the demo is and is not |
| `problem` · `approach` | prose | Two bands. Blank lines separate paragraphs; `lib/prose.ts` splits them |
| `creative` | `{title, constraint, detail}[]` \| undefined | **"solved creatively"** — the numbered list. Falls back to `highlights` when absent |
| `stackGroups` | `{group, items}[]` \| undefined | **"what is used"** — one chip row per group. Falls back to `stack` as one unlabelled row |
| `architecture` | `{layer, detail}[]` | Layer by layer, under the stack |
| `metrics` · `results` | | "in numbers" |
| `screenshots` | | "the demo" — titles and captions only; `src` and `schematic` are still unused |
| `sourceUrl` | string \| null | A secondary link beside the demo button |

`category`, `stackGroups` and `creative` are the only **optional** fields: a
project can be added with the grid's fields and still get a correct page, with
the grouping and the reasoning written later.

Prose fields may contain `` `backticked` `` identifiers — the convention the
repo's own READMEs use. `components/RichText.tsx` renders those as `<code>`;
nothing else about the text is markdown, and it is not a markdown parser.

The `as Project[]` cast in `content.ts` validates nothing — the JSON is data
and TypeScript never sees it — so a **dev-only assertion** sits behind it and
throws on the first entry missing a required key. It does not run in a
production build: a hard throw there would take the whole portal down to
protect one page.

### The Georgian overlay

`content/projects.ka.json` is **not a second catalogue**. It is
`{ "<slug>": { ...the same text fields } }`, keyed by the English slugs,
partial allowed, and merged over the English entry when the page is Georgian
(`getProjects('ka')`, `getProject(slug, 'ka')`):

- **Per field, falling back to English.** A project with no entry, a field left
  out, an empty string — each shows the English. A project is never missing
  from `/ka` because it is not translated yet.
- **Arrays merge by position** at the English length, objects key by key over
  the English keys, so a Georgian `metrics` may translate only the labels.
- **Only text.** `slug`, `status`, `demoUrl`, `sourceUrl`, `cover`, `stack` and
  a screenshot's `src` / `schematic` always come from `projects.json`.
- A slug in the overlay that is not in `projects.json` makes `npm run dev`
  throw, like a missing key does.

`category` translates like any other text field; the filter stays keyed by the
English value, so `/?category=booking` and `/ka?category=booking` agree.

## Adding a project

Append an object to `content/projects.json`, a Georgian entry to
`content/projects.ka.json`, a cover to `public/thumbnails/`, and drop a bundle
under `demos/`. That is all — no component, route or index lists projects.
`demoUrl` is base-relative (`/demos/<name>/`) and resolved through
`lib/url.ts`, so the whole portal relocates by changing `VITE_BASE`. The full
runbook is [`docs/adding-a-project.md`](../docs/adding-a-project.md).

## Layout

```
index.html              boulder.ge's fonts, meta, the pre-paint theme script
content/
  projects.json         the catalogue, English
  projects.ka.json      the Georgian overlay
public/
  brand/                boulder.ge's side rock (bright / dark, 1x / 2x), logo hover art
  thumbnails/           project covers, 4:3 WebP
src/
  main.tsx              boulder.css first, motion.css last
  App.tsx               the routes, twice: / and /ka
  config.ts             the contact address — the only copy in code
  content.ts            the JSON, typed; getProjects(lang) / getProject(slug, lang)
  i18n/
    lang.ts             the /ka prefix: splitLang, localize
    LanguageContext.tsx useLang(): lang, t, href, switchHref
    en.ts · ka.ts       the UI dictionary
    georgianCaps.ts     Mtavruli titles
  pages/
    PortalPage.tsx      the hero line, the category filter, the works deck
    ProjectPage.tsx     one project: hero, problem, approach, solved creatively,
                        what is used, in numbers, the demo
    NotFoundPage.tsx    404, also rendered for an unknown slug
  components/
    Layout.tsx          boulder.ge's shell: spark canvas, header, main.page, footer
    Header.tsx · Footer.tsx · NavPill.tsx · chromeCopy.ts
    ThemeToggle(Art).tsx · LanguageSwitch(Art).tsx
    Logo.tsx · LogoArt.tsx
    PageBackground.tsx  the dot grid and the side boulder
    SparkCanvas.tsx     the click burst
    WorksDeck.tsx · ProjectCard.tsx · CardFrame.tsx · SectionTitle.tsx · Reveal.tsx
    ProjectCover.tsx    a cover image, or ProjectMark when there is none or it fails to load
    ProjectMark.tsx     the generated constellation artwork, seeded by slug
    RichText.tsx        `backticked` spans in the content, as <code>
  lib/
    theme.ts            useTheme(), the boulder.theme key
    url.ts              base-relative resolution; demoHref(), the demo link in a language
    prose.ts · cn.ts · random.ts · useDocumentTitle.ts
  styles/
    boulder.css         tokens, Tailwind theme, page shell, shared composites
    header.css · controls.css · footer.css · works.css · detail.css · motion.css
```

## Commands

Run from the repo root.

| | |
|---|---|
| `npm run dev:site` | <http://localhost:5173/> and <http://localhost:5173/ka> |
| `npm run typecheck` | `tsc -b --noEmit`, strict |
| `npm run build` | builds the portal and every demo into `dist/` |
| `npm run preview` | serves `dist/` the way a correct host would |
