# The portal

One page: a grid of projects, each card opening a live demo. Plus a 404.
React 18 + TypeScript strict, Vite 6, React Router 6, Tailwind v4.

There is no case study, no hero journey and no "about" section. A visitor here
is choosing which product to open, and everything that is not a project card
sits between them and that choice. The cards sell by being openable.

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
page. The portal renders these fields:

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

Every other field in the JSON — `summary`, `role`, `problem`, `approach`,
`architecture`, `results`, `highlights`, `metrics`, `screenshots`,
`sourceUrl`, `demoNote` — is **kept but unrendered**. It fed the case-study
pages the portal replaced, it is the expensive part to write, and a detail view
may well come back. Nothing reads it today, so nothing validates it either.

## Adding a project

Append an object to `content/projects.json` and drop a bundle under `demos/`.
That is all — no component, route or index lists projects. The eight fields
above are the ones that have to be right; the rest can be stubbed.

`demoUrl` is base-relative (`/demos/<name>/`) and resolved through
`lib/url.ts`, so the whole portal relocates by changing `VITE_BASE`.

## Layout

```
index.html              fonts, meta, the pre-paint theme script
src/
  App.tsx               two routes: / and *
  config.ts             company name, email, tagline — the only copy in code
  content.ts            the JSON, typed
  pages/
    PortalPage.tsx      the headline and the grid
    NotFoundPage.tsx    404
  components/
    Layout.tsx          sticky header (logo · contact · theme) and footer
    Logo.tsx            the Boulder lockup, filled with var(--ink) so it flips
    ProjectCard.tsx     one card — a single <a>, see the note in the file
    ProjectMark.tsx     the generated constellation artwork, seeded by slug
    ThemeToggle.tsx     light/dark, persisted
  lib/
    url.ts              base-relative resolution
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
