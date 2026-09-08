import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { Project } from '@/content'
import { projectPath, STATUS_LABEL } from '@/content'
import { ProjectMark } from './ProjectMark'
import { fromBase } from '@/lib/url'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/cn'

/**
 * One project in the grid.
 *
 * The whole card is a single link, not a div with a button inside it. That is
 * deliberate: nesting an interactive element inside a clickable container gives
 * you two tab stops for one destination and an invalid DOM, and wiring an
 * onClick on the wrapper instead loses middle-click, cmd-click and "copy link
 * address" — all of which a visitor evaluating a portfolio actually uses. A
 * router `<Link>` renders a real anchor with a real href, so all of that still
 * works.
 *
 * It points at `/work/<slug>`, not at the demo. Opening the product on the
 * first click skipped the part that says what the product is, so the demo is a
 * button on the detail page and the card advertises that a demo exists. The
 * side effect is that a project with `demoUrl: null` is now a working card
 * rather than a dead one — the detail page is the destination either way.
 */
export function ProjectCard({ project, index }: { project: Project; index: number }) {
  const [ref, seen] = useInView<HTMLLIElement>()

  return (
    <li
      ref={ref}
      className={cn('reveal', seen && 'reveal--in')}
      style={{ transitionDelay: `${Math.min(index, 5) * 70}ms` }}
    >
      <Link
        to={projectPath(project.slug)}
        className="project-card"
        aria-label={`${project.name} — read the project${project.demoUrl ? ', live demo available' : ''}`}
      >
        <div className={cn('project-card__frame notch', index % 2 === 1 && 'notch--alt')}>
          <div className="project-card__art">
            {/* A real capture of the running product when there is one. The
                generated constellation is the fallback, not the default — a
                screenshot of the actual screen says more in a thumbnail than any
                amount of abstract artwork. Lazy below the fold; the first row is
                the page's LCP candidate, so it loads eagerly. */}
            {project.cover ? (
              <img
                src={fromBase(project.cover)}
                alt={`${project.name} — a screen from the live demo`}
                className="project-card__shot"
                loading={index < 3 ? 'eager' : 'lazy'}
                decoding="async"
                width={1600}
                height={1000}
              />
            ) : (
              <ProjectMark seed={project.slug} />
            )}

            {/* Both badges sit on the cover art, which is the one plane in this
                design with a fixed colour underneath — so black-and-white here
                is theme-safe where it would not be anywhere else on the page. */}
            <span className="absolute left-3 top-3 bg-black/60 px-2 py-1 text-small font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
              {STATUS_LABEL[project.status]}
            </span>
            {project.demoUrl && (
              <span className="absolute right-3 top-3 bg-black/60 px-2 py-1 text-small font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
                Live demo
              </span>
            )}
          </div>

          <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
            <div>
              <h2 className="font-display text-h2 font-bold leading-tight text-ink">{project.name}</h2>
              <p className="mt-1 text-small font-semibold uppercase tracking-[0.12em] text-ink/60">
                {project.period}
              </p>
            </div>

            <p className="text-body leading-relaxed text-ink/70">{project.tagline}</p>

            <ul className="mt-auto flex flex-wrap gap-1.5 pt-2" aria-label="Built with">
              {project.stack.slice(0, 5).map((item) => (
                <li key={item} className="border border-hairline px-2 py-1 text-small text-ink/60">
                  {item}
                </li>
              ))}
              {project.stack.length > 5 && (
                <li className="px-2 py-1 text-small text-ink/60">+{project.stack.length - 5}</li>
              )}
            </ul>

            <span className="project-card__go pt-2">
              Read the project
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </div>
        </div>
      </Link>
    </li>
  )
}
