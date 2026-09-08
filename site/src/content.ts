import raw from '../content/projects.json'

/**
 * The catalogue is data, not code. Adding a project is an edit to
 * `content/projects.json` plus a folder under `demos/` — no component, route
 * or index touches this file.
 *
 * The grid renders a subset: `slug`, `name`, `tagline`, `period`, `status`,
 * `stack`, `demoUrl` and `cover`. Everything else is the detail page at
 * `/work/<slug>` — `summary`, `role`, `problem`, `approach`, `architecture`,
 * `results`, `highlights`, `metrics`, `screenshots` and `demoNote`. Those
 * fields were written for the case-study pages an earlier portal replaced, kept
 * on the grounds that they were the expensive part and a detail view might come
 * back. It came back.
 *
 * Nothing validates this file: the assertion at the bottom is the only check,
 * so a missing key survives `npm run typecheck` and shows up as a blank section
 * instead. Two fields are therefore deliberately optional rather than required
 * — see `stackGroups` and `creative`.
 */

export interface Metric {
  label: string
  value: string
}

export interface ArchitectureLayer {
  layer: string
  detail: string
}

/** Retained with the case-study data; no component draws these now. */
export type SchematicKey = 'dashboard' | 'fleet' | 'gallery' | 'ledger'

export interface Screenshot {
  title: string
  caption: string
  schematic: SchematicKey
  /**
   * A real capture, resolved against the deploy base. Null on purpose for
   * Printomato: the running demo is one click away, and a stale PNG of a
   * screen you can open yourself is worth less than the schematic plus
   * the caption that says what the screen does.
   */
  src: string | null
}

/**
 * The flat `stack` array read out in groups, so the detail page can say what
 * each dependency is *for* rather than listing twelve names in a row.
 *
 * Optional: a project without it falls back to `stack` as one unlabelled row,
 * which is what the card shows anyway. That fallback is the point — a project
 * can be added with the eight fields the grid needs and still get a correct
 * detail page, and the grouping can be written later.
 */
export interface StackGroup {
  group: string
  items: string[]
}

/**
 * One inventive decision, in the three beats that make it read as engineering
 * rather than a feature list: the constraint that forced it, what was built,
 * and what a naive version would get wrong.
 *
 * Optional for the same reason as `stackGroups`. A project without it falls
 * back to `highlights`, which is the same claim without the reasoning.
 */
export interface CreativeSolution {
  /** The claim, as a short line. No trailing full stop. */
  title: string
  /** The real-world limit that made the obvious answer unavailable. */
  constraint: string
  /** What was actually built, and why it matters that it was built that way. */
  detail: string
}

export type ProjectStatus = 'shipped' | 'live' | 'in-progress' | 'archived'

export interface Project {
  slug: string
  name: string
  tagline: string
  summary: string
  role: string
  period: string
  status: ProjectStatus
  stack: string[]
  /** `stack`, grouped by what each part does. Falls back to `stack`. */
  stackGroups?: StackGroup[]
  /** The reasoned version of `highlights`. Falls back to `highlights`. */
  creative?: CreativeSolution[]
  highlights: string[]
  metrics: Metric[]
  /** Prose; blank lines separate paragraphs. */
  problem: string
  approach: string
  architecture: ArchitectureLayer[]
  results: string[]
  /** Base-relative path to the demo bundle, or null when there is nothing to launch. */
  demoUrl: string | null
  /** What the demo actually is and is not. Shown prominently, never buried. */
  demoNote: string | null
  sourceUrl: string | null
  /** Base-relative image. Null falls back to the generated `ProjectMark`. */
  cover: string | null
  screenshots: Screenshot[]
}

export const projects = raw as Project[]

/**
 * The `as Project[]` above is the file's only check, and it is not one: the
 * JSON is data, TypeScript never sees it, and a missing key survives
 * `npm run typecheck`. It used to cost nothing, because nothing rendered these
 * fields. Now a missing `problem` is `undefined.split()` inside the detail
 * page's first paragraph — a white screen on `/work/<slug>`, not a blank
 * section.
 *
 * So the cast gets an assertion behind it. Dev only: in production the check is
 * dead weight over content that shipped, and a hard throw there would take the
 * whole portal down to protect one page. `npm run dev` fails loudly on the
 * entry that is wrong, which is when it is cheap to fix.
 */
if (import.meta.env.DEV) {
  const REQUIRED: (keyof Project)[] = [
    'slug',
    'name',
    'tagline',
    'summary',
    'role',
    'period',
    'status',
    'stack',
    'highlights',
    'metrics',
    'problem',
    'approach',
    'architecture',
    'results',
    'screenshots',
  ]

  for (const [index, project] of projects.entries()) {
    const where = project?.slug ? `"${project.slug}"` : `at index ${index}`
    const missing = REQUIRED.filter((key) => project?.[key] === undefined)
    if (missing.length > 0) {
      throw new Error(
        `content/projects.json: project ${where} is missing ${missing.join(', ')}. ` +
          'Only `stackGroups` and `creative` are optional — see site/README.md.',
      )
    }
  }
}

/** Undefined for an unknown slug, which the route renders as the 404 page. */
export function projectBySlug(slug: string | undefined): Project | undefined {
  return slug ? projects.find((project) => project.slug === slug) : undefined
}

/** The path a card points at. One definition, so the card and the route agree. */
export function projectPath(slug: string): string {
  return `/work/${slug}`
}

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  shipped: 'Shipped',
  live: 'Live',
  'in-progress': 'In progress',
  archived: 'Archived',
}

