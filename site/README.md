# The portal

Two routes and a 404: a grid of projects, and one page per project.
React 18 + TypeScript strict, Vite 6, React Router 6, Tailwind v4.

There is still no hero journey and no "about" section. What changed is where a
card goes: it used to open the demo bundle directly, which put a visitor inside
someone else's dispatch console with no idea what the product was for or which
parts were hard. A card now opens `/work/<slug>` — the description, what it is
built from, the parts worth naming — and the demo is a button on that page.

So the grid still sells by being openable; the page behind it is what makes the
demo worth opening.

## Brand

The portal wears **Boulder's** brand, taken from `boulder-website`:

| | |
|---|---|
| Main dark | `#111224` |
| Accent (coral) | `#ff3366` |
| Accent 2 (indigo) | `#5c4de8` |
| Main bright (lavender) | `#e0dff7` |
| Display / body type | Montserrat Alternates / Montserrat |
| Motion | 300 ms, `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Motif | the angular corner cut — `.notch` / `.notch--alt` |

Those values live in `src/styles/theme.css`, copied from
`boulder-website/src/index.css`, which took them from the brand PDF and the
Figma variable collection. **If the brand moves, it moves there first** and is
copied across; nothing here re-derives a colour.

The demos deliberately do **not** inherit any of this. Each is a different
client's product with its own identity, and recolouring one in Boulder's
palette would misrepresent what shipped. That is also why this app no longer
imports `@portfolio/brand/tokens.css` — that package belongs to the Printomato
demo.

Light and dark both ship. The choice is stored under `boulder.theme`, an unset
choice follows the OS, and `index.html` applies the same rule inline before
first paint so there is no flash.

## The content model

`content/projects.json` is the catalogue. Order in the file is order on the
page. **Every field is rendered now** — the grid uses the eight below, and the
detail page uses all of them.

| Field | Type | Used for |
|---|---|---|
| `slug` | string | React key, and the seed for the generated card artwork |
| `name` | string | Card title |
| `tagline` | string | The one line of card body |
| `period` | string | Under the title |
| `status` | `shipped \| live \| in-progress \| archived` | The badge on the artwork |
| `stack` | string[] | Tag row; the first five show, the rest collapse to `+N` |
| `demoUrl` | string \| null | Where the card points, resolved against `VITE_BASE`. **Null makes the card non-clickable** and it reads "No demo yet" |
| `cover` | string \| null | The card image, base-relative (`/thumbnails/<slug>.webp`). **Null falls back to the generated `ProjectMark`** |

The detail page at `/work/<slug>` renders the rest:

| Field | Type | Section |
|---|---|---|
| `summary` · `role` | string | The hero, under the project name |
| `demoNote` | string \| null | Directly under the demo button — what the demo is and is not. Never buried, and deliberately shown only once even though the button appears twice |
| `problem` · `approach` | prose | Two bands. Blank lines separate paragraphs; `lib/prose.ts` splits them |
| `creative` | `{title, constraint, detail}[]` \| undefined | **"Solved creatively"** — the numbered list. Falls back to `highlights` when absent |
| `stackGroups` | `{group, items}[]` \| undefined | **"What is used"** — one chip row per group. Falls back to `stack` as one unlabelled row |
| `architecture` | `{layer, detail}[]` | The definition list under the stack |
| `metrics` · `results` | | "In numbers" |
| `screenshots` | | "The demo" — titles and captions only; `src` and `schematic` are still unused |
| `sourceUrl` | string \| null | A secondary link beside the demo button |

`stackGroups` and `creative` are the only **optional** fields, and that is the
point: a project can be added with the eight fields the grid needs and still get
a correct detail page, with the grouping and the reasoning written later.

Prose fields may contain `` `backticked` `` identifiers — the convention the
repo's own READMEs use. `components/RichText.tsx` renders those as `<code>`;
nothing else about the text is markdown, and it is not a markdown parser.

The `as Project[]` cast in `content.ts` validates nothing — the JSON is data
and TypeScript never sees it — so a **dev-only assertion** sits behind it and
throws on the first entry missing a required key. It does not run in a
production build: a hard throw there would take the whole portal down to
protect one page.

## Adding a project

Append an object to `content/projects.json` and drop a bundle under `demos/`.
That is all — no component, route or index lists projects. The eight grid fields
are the ones that have to be right; `stackGroups` and `creative` may be omitted
entirely, and the rest can be stubbed.

`demoUrl` is base-relative (`/demos/<name>/`) and resolved through
`lib/url.ts`, so the whole portal relocates by changing `VITE_BASE`. A project
with `demoUrl: null` is still a working card and a working detail page — the
button reads "No demo yet" instead.

## Layout

```
index.html              fonts, meta, the pre-paint theme script
src/
  App.tsx               two routes: / and *
  config.ts             company name, email, tagline — the only copy in code
  content.ts            the JSON, typed
  pages/
    PortalPage.tsx      the headline and the grid
    ProjectPage.tsx     one project: hero, problem, approach, solved creatively,
                        what is used, in numbers, the demo — /work/:slug
    NotFoundPage.tsx    404, also rendered for an unknown slug
  components/
    Layout.tsx          sticky header (logo · contact · theme) and footer
    Logo.tsx            the Boulder lockup, filled with var(--ink) so it flips
    ProjectCard.tsx     one card — a single link, see the note in the file
    ProjectMark.tsx     the generated constellation artwork, seeded by slug
    RichText.tsx        `backticked` spans in the content, as <code>
    ThemeToggle.tsx     light/dark, persisted
  lib/
    url.ts              base-relative resolution
    prose.ts            blank-line-separated prose into paragraphs
    useInView.ts        the one-shot reveal observer
    cn.ts · random.ts · useDocumentTitle.ts
  styles/theme.css      brand tokens, base layer, composites
```

## Commands

Run from the repo root.

| | |
|---|---|
| `npm run dev:site` | <http://localhost:5173/> |
| `npm run typecheck` | `tsc -b --noEmit`, strict |
| `npm run build` | builds the portal and every demo into `dist/` |
| `npm run preview` | serves `dist/` the way a correct host would |
