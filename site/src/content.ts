import raw from '../content/projects.json'

/**
 * The catalogue is data, not code. Adding a project is an edit to
 * `content/projects.json` plus a folder under `demos/` — no component, route
 * or index touches this file.
 *
 * The portal renders a subset: `slug`, `name`, `tagline`, `period`, `status`,
 * `stack`, `demoUrl` and `cover`. The long-form fields below (`summary`, `role`,
 * `problem`, `approach`, `architecture`, `results`, `highlights`, `metrics`,
 * `screenshots`) fed the case-study pages that the portal replaced. They are
 * kept rather than deleted because they are the expensive part to write and a
 * detail view may well come back — but nothing reads them today, so nothing
 * validates them either.
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

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  shipped: 'Shipped',
  live: 'Live',
  'in-progress': 'In progress',
  archived: 'Archived',
}

