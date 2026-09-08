import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import type { CreativeSolution, Project, StackGroup } from '@/content'
import { projectBySlug, projectPath, projects, STATUS_LABEL } from '@/content'
import { projectTitle } from '@/config'
import { ProjectMark } from '@/components/ProjectMark'
import { RichText } from '@/components/RichText'
import { NotFoundPage } from './NotFoundPage'
import { cn } from '@/lib/cn'
import { fromBase } from '@/lib/url'
import { paragraphs } from '@/lib/prose'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { useInView } from '@/lib/useInView'

/**
 * One project, in full.
 *
 * The grid sells by being openable; this page exists because opening the demo
 * first answered the wrong question. A visitor landing straight in someone
 * else's admin console has no idea what the product is for, which parts were
 * hard, or what they are looking at — so the demo is now the payoff at the end
 * of a page that says those things, not the thing that happens on a click.
 *
 * Every section is content that already existed in `content/projects.json` and
 * had nothing rendering it. Two fields are new and optional (`stackGroups`,
 * `creative`); both fall back to the flat field they refine, so a project that
 * has not been through a verification pass still gets a complete page.
 */
export function ProjectPage() {
  const { slug } = useParams()
  const project = projectBySlug(slug)

  // An unknown slug is a 404, not a redirect: bouncing to the grid would tell a
  // visitor with a stale link that the address was fine and the project gone.
  if (!project) return <NotFoundPage />

  return <ProjectDetail project={project} />
}

/**
 * Split so the hooks below sit above no conditional return — `ProjectPage`
 * has to bail out before any of them run, and a hook after an early return is
 * the one thing React's rules of hooks actually forbid.
 */
function ProjectDetail({ project }: { project: Project }) {
  useDocumentTitle(projectTitle(project.name))

  const demoHref = project.demoUrl ? fromBase(project.demoUrl) : null
  const groups = stackGroupsOf(project)
  const solutions = project.creative ?? []
  const others = projects.filter((candidate) => candidate.slug !== project.slug)

  return (
    <>
      <Hero project={project} demoHref={demoHref} />

      <Band label="What is used" title="Built with">
        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="label-caps">{group.group}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={group.group}>
                {group.items.map((item) => (
                  <li key={item} className="border border-hairline px-2 py-1 text-small text-ink/60">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Band>

      <Band label="The problem" title="What it had to fix">
        <Prose text={project.problem} />
      </Band>

      <Band label="The approach" title="How it was built">
        <Prose text={project.approach} />
      </Band>

      <Band
        label="Solved creatively"
        title="The parts worth naming"
        lead="The decisions that a competent version of this product would not have arrived at by default."
      >
        {solutions.length > 0 ? (
          <Solutions items={solutions} />
        ) : (
          // No verified `creative` block yet, so `highlights` carries the same
          // claims without the reasoning. Rendering it is strictly better than
          // rendering nothing, and the shape is deliberately not faked into
          // three beats it does not have.
          <ul className="mt-8 max-w-[72ch] space-y-5">
            {(project.highlights ?? []).map((highlight, index) => (
              <li key={index} className="border-t border-hairline pt-5 text-body leading-relaxed text-ink/70">
                <RichText text={highlight} />
              </li>
            ))}
          </ul>
        )}
      </Band>

      <Band label="How it fits together" title="The layers">
        {project.architecture.length > 0 && (
          <dl className="mt-12 max-w-[80ch] border-t border-hairline">
            {project.architecture.map((layer, index) => (
              <div key={index} className="border-b border-hairline py-5 sm:grid sm:grid-cols-[minmax(9rem,22%)_1fr] sm:gap-6">
                <dt className="font-display text-body font-bold text-ink">{layer.layer}</dt>
                <dd className="mt-1.5 text-body leading-relaxed text-ink/70 sm:mt-0">
                  <RichText text={layer.detail} />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Band>

      <Band label="What came of it" title="Results">
        {project.results.length > 0 && (
          <ul className="mt-8 max-w-[74ch] space-y-4">
            {project.results.map((result, index) => (
              <li key={index} className="flex gap-3 text-body leading-relaxed text-ink/70">
                <ArrowRight className="mt-1.5 size-4 shrink-0 text-accent-text" aria-hidden />
                <span>
                  <RichText text={result} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {project.metrics.length > 0 && (
          <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {project.metrics.map((metric, index) => (
              <li key={metric.label} className="[filter:var(--drop-card)]">
                <div className={cn('notch h-full bg-surface p-5', index % 2 === 1 && 'notch--alt')}>
                  <p className="font-display text-h2 font-bold leading-none text-ink">{metric.value}</p>
                  <p className="label-caps mt-2 block">{metric.label}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Band>

      <Closing project={project} demoHref={demoHref} others={others} />
    </>
  )
}

/* -------------------------------------------------------------------------- */

function Hero({ project, demoHref }: { project: Project; demoHref: string | null }) {
  return (
    <section className="shell pt-8 pb-10 sm:pt-12 sm:pb-14">
      <Link
        to="/"
        className="label-caps inline-flex items-center gap-2 transition-colors duration-300 ease-bounce hover:text-accent-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Selected work
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start lg:gap-12">
        {/* Text first in the DOM so the heading is the first thing announced and
            the first thing read on a phone; the cover moves alongside it only
            once there is room for two columns. */}
        <div>
          <p className="label-caps">
            {STATUS_LABEL[project.status]} · {project.period}
          </p>
          <h1 className="mt-3 max-w-[16ch] font-display text-h1 font-extrabold leading-[1.06] text-ink">
            {project.name}
          </h1>
          <p className="mt-5 max-w-[54ch] text-body-lg leading-relaxed text-ink/70">
            <RichText text={project.summary} />
          </p>
          <p className="mt-4 max-w-[54ch] text-body leading-relaxed text-ink/65">
            <RichText text={project.role} />
          </p>

          <DemoCta project={project} demoHref={demoHref} note />
        </div>

        {/* The same plane and the same crop as the card, so the page reads as
            the card opened rather than as a different screen. The notch sits on
            the inner frame and the shadow on the unclipped parent — a clip-path
            would clip a box-shadow away with it. */}
        <div className="[filter:var(--drop-card)]">
          <div className="notch project-card__art">
            {project.cover ? (
              <img
                src={fromBase(project.cover)}
                alt={`${project.name} — a screen from the live demo`}
                className="project-card__shot"
                loading="eager"
                decoding="async"
                width={1600}
                height={1000}
              />
            ) : (
              <ProjectMark seed={project.slug} />
            )}
          </div>
        </div>
      </div>

    </section>
  )
}

/**
 * The one filled control on the page.
 *
 * It appears twice — once under the hero and once at the end, because the page
 * is long enough that a reader who has finished it should not have to scroll
 * back for the button. `note` is what does not repeat: `demoNote` is the honest
 * disclosure of what the demo is and is not, it belongs beside the first
 * button, and printing the same paragraph again at the bottom reads as a
 * template rather than as a page someone wrote.
 */
function DemoCta({
  project,
  demoHref,
  note = false,
}: {
  project: Project
  demoHref: string | null
  note?: boolean
}) {
  return (
    <div className="mt-10 border-t border-hairline pt-8">
      <div className="flex flex-wrap items-center gap-4">
        {demoHref ? (
          // A plain anchor, not a router Link: the demo is its own bundle with
          // its own base path and needs a real document load.
          <a
            href={demoHref}
            className="inline-flex min-h-11 items-center gap-2 bg-accent-solid px-5 py-3 font-display text-body font-bold text-white transition-transform duration-300 ease-bounce hover:-translate-y-0.5"
          >
            Open the live demo
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        ) : (
          <p className="inline-flex min-h-11 items-center border border-hairline px-5 py-3 font-display text-body font-bold text-ink/60">
            No demo yet
          </p>
        )}

        {project.sourceUrl && (
          <a
            href={project.sourceUrl}
            className="text-body font-semibold text-ink/60 transition-colors duration-300 ease-bounce hover:text-accent-text"
          >
            Read the source
          </a>
        )}
      </div>

      {note && project.demoNote && (
        <p className="mt-5 max-w-[74ch] text-small leading-relaxed text-ink/60">
          <RichText text={project.demoNote} />
        </p>
      )}
    </div>
  )
}

/**
 * A section. Every band is a sibling `.shell` rather than one wrapper with
 * inner max-widths, so each lines up with the header's logo and the footer.
 */
function Band({
  label,
  title,
  lead,
  children,
}: {
  label: string
  title: string
  lead?: string
  children: React.ReactNode
}) {
  // The emptiness check belongs here, not inside the children: a project whose
  // `architecture` or `results` is still an empty array would otherwise ship a
  // titled, hairline-ruled section with nothing under it, which reads as a
  // broken page rather than as an unwritten one.
  if (!hasContent(children)) return null

  return (
    <section className="shell border-t border-hairline py-12 sm:py-16">
      <p className="label-caps">{label}</p>
      <h2 className="mt-3 max-w-[24ch] font-display text-h2 font-bold leading-tight text-ink">{title}</h2>
      {lead && <p className="mt-4 max-w-[64ch] text-body leading-relaxed text-ink/65">{lead}</p>}
      {children}
    </section>
  )
}

function Prose({ text }: { text: string }) {
  return (
    <div className="mt-6 max-w-[68ch] space-y-4">
      {paragraphs(text).map((paragraph, index) => (
        <p key={index} className="text-body-lg leading-relaxed text-ink/70">
          <RichText text={paragraph} />
        </p>
      ))}
    </div>
  )
}

/**
 * The three-beat items.
 *
 * Separated by hairlines rather than each being its own notched card: the hero
 * already spends the corner cut, and six of them stacked reads as a repeated
 * stamp instead of a motif. The index is the only coral at this size.
 */
function Solutions({ items }: { items: CreativeSolution[] }) {
  return (
    <ol className="mt-8" role="list">
      {items.map((item, index) => (
        <Solution key={index} item={item} index={index} />
      ))}
    </ol>
  )
}

function Solution({ item, index }: { item: CreativeSolution; index: number }) {
  const [ref, seen] = useInView<HTMLLIElement>()

  return (
    <li
      ref={ref}
      className={cn('reveal border-t border-hairline py-7 sm:py-8', seen && 'reveal--in')}
      style={{ transitionDelay: `${Math.min(index, 5) * 70}ms` }}
    >
      <div className="sm:grid sm:grid-cols-[3rem_1fr] sm:gap-6">
        <p className="font-display text-h2 font-bold leading-none text-accent-text" aria-hidden>
          {String(index + 1).padStart(2, '0')}
        </p>
        <div className="mt-3 sm:mt-0">
          <h3 className="font-display text-body-lg font-bold leading-snug text-ink">{item.title}</h3>
          <p className="mt-3 max-w-[68ch] text-body leading-relaxed text-ink/60">
            <RichText text={item.constraint} />
          </p>
          <p className="mt-3 max-w-[68ch] text-body-lg leading-relaxed text-ink/70">
            <RichText text={item.detail} />
          </p>
        </div>
      </div>
    </li>
  )
}

function Closing({
  project,
  demoHref,
  others,
}: {
  project: Project
  demoHref: string | null
  others: Project[]
}) {
  return (
    <section className="shell border-t border-hairline py-12 sm:py-16">
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <p className="label-caps">The demo</p>
          <h2 className="mt-3 max-w-[22ch] font-display text-h2 font-bold leading-tight text-ink">
            {demoHref ? 'Open it and click through' : 'Nothing to open yet'}
          </h2>

          {project.screenshots.length > 0 && (
            <>
              {/* Titles and captions, deliberately without images. `screenshots`
                  carries a `src` that is null for every project and a
                  `schematic` key nothing draws — and a stale PNG of a screen
                  you can open yourself is worth less than a sentence saying
                  what the screen is for. Labelled as a tour so the absence
                  reads as a choice rather than as four missing pictures. */}
              <p className="label-caps mt-8 block">What you will find inside</p>
              <ul className="mt-4 max-w-[62ch] border-t border-hairline">
                {project.screenshots.map((shot, index) => (
                  <li key={index} className="border-b border-hairline py-4">
                    <p className="font-display text-body font-bold text-ink">{shot.title}</p>
                    <p className="mt-1 text-body leading-relaxed text-ink/65">
                      <RichText text={shot.caption} />
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

          <DemoCta project={project} demoHref={demoHref} />
        </div>

        {others.length > 0 && (
          <div>
            <p className="label-caps">Elsewhere</p>
            <ul className="mt-6 border-t border-hairline">
              {others.map((other) => (
                <li key={other.slug}>
                  <Link
                    to={projectPath(other.slug)}
                    className="group flex items-baseline justify-between gap-4 border-b border-hairline py-4 transition-colors duration-300 ease-bounce hover:text-accent-text"
                  >
                    <span>
                      <span className="font-display text-body font-bold">{other.name}</span>
                      <span className="mt-1 block max-w-[40ch] text-small leading-relaxed text-ink/60">
                        {other.tagline}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 transition-transform duration-300 ease-bounce group-hover:translate-x-1" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * `stackGroups` when it has been written, otherwise the flat `stack` as one
 * group. "Built with" as the group name is honest for the fallback: it says
 * nothing the list does not already say, which is the point of the fallback.
 */
function stackGroupsOf(project: Project): StackGroup[] {
  if (project.stackGroups && project.stackGroups.length > 0) return project.stackGroups
  return [{ group: 'Built with', items: project.stack }]
}

/**
 * Whether a band has anything to show. `children` is always a truthy element
 * tree here — the interesting cases are the ones that render to nothing: a
 * `false` from an `&&` guard, or an array of them.
 */
function hasContent(children: React.ReactNode): boolean {
  const nodes = Array.isArray(children) ? children : [children]
  return nodes.some((node) => node !== null && node !== undefined && node !== false && node !== '')
}
