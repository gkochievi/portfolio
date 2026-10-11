import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { projectPath, type Project } from '@/content'
import { fill, useLang } from '@/i18n/LanguageContext'
import { demoHref } from '@/lib/url'
import { cn } from '@/lib/cn'
import { CardFrame, TagBox, type FrameTone } from './CardFrame'
import { ProjectCover } from './ProjectCover'
import { Reveal } from './Reveal'

/** Stack chips on a card; the rest is one "+n" and the detail page. */
const STACK_SHOWN = 4

/**
 * One project in the works grid, in boulder.ge's card language: the notched
 * frame in the department's colour, the cover laid inside it, the name, the
 * bracketed microcopy, and the category as a tag box.
 *
 * The card opens the case study at `/work/<slug>` in the reader's language.
 * That is a real router link on the name, stretched over the whole card by
 * its `::after` (works.css), not an onClick on a div: middle-click, cmd-click
 * and "copy link address" all still work, and there is one tab stop for the
 * one destination.
 *
 * The demo is the second destination, and it gets its own link rather than a
 * button nested inside the first (an anchor inside an anchor is invalid DOM).
 * It sits above the stretched link, so it takes its own clicks; everywhere
 * else on the card goes to the case study. It is a plain `<a>`: a demo is a
 * separate bundle under the deploy base, not a route of this app, and it is
 * addressed through `demoHref`, which hands a Georgian reader's language over
 * as `?lang=ka`.
 */
export function ProjectCard({
  project,
  index,
  tone = 'tech',
}: {
  project: Project
  index: number
  tone?: FrameTone
}) {
  const { lang, t, href } = useLang()
  const demo = project.demoUrl ? demoHref(project.demoUrl, lang) : null
  const stack = project.stack.slice(0, STACK_SHOWN)
  const hidden = project.stack.length - stack.length
  const category = project.category?.trim()

  return (
    <Reveal as="li" index={index % 3} className={cn('works-tile', index % 2 === 1 && 'works-tile--alt')}>
      <CardFrame tone={tone} alt={index % 2 === 1}>
        <div className="works-tile__art">
          {/* A real capture of the running product when there is one and it
              loads; the generated constellation on the brand gradient
              otherwise. The first row is the page's LCP candidate, so it
              loads eagerly. */}
          <ProjectCover
            cover={project.cover}
            seed={project.slug}
            className="works-tile__shot"
            eager={index < 3}
            width={2000}
            height={1494}
          />

          {/* Both badges sit on the cover, the one plane with a fixed colour
              under it, so their own plates are theme-safe. */}
          <span className="works-tile__badge works-tile__badge--status">[{t(`status.${project.status}`)}]</span>
          {demo && (
            <span className="works-tile__badge works-tile__badge--live">
              <span className="works-tile__pulse" aria-hidden />
              {t('card.demo')}
            </span>
          )}
        </div>

        <div className="works-tile__body">
          <div className="works-tile__meta">
            {category && <TagBox tone={tone}>[{category}]</TagBox>}
            <span className="bracket bracket--ink works-tile__period">[{project.period}]</span>
          </div>

          <h3 className="works-card__name">
            <Link
              to={href(projectPath(project.slug))}
              className="works-tile__link"
              aria-label={fill(t('card.openLabel'), { name: project.name })}
            >
              {project.name}
            </Link>
          </h3>

          <p className="works-tile__tagline">{project.tagline}</p>

          <ul className="works-tile__stack" aria-label={t('detail.stack')}>
            {stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {hidden > 0 && <li className="works-tile__stack-more">{fill(t('card.more'), { n: hidden })}</li>}
          </ul>

          <div className="works-tile__foot">
            {/* The stretched link already says this; the line is what a sighted
                reader is told the card does. */}
            <span className="works-tile__go" aria-hidden>
              [{t('card.open')}]
              <ArrowRight className="works-tile__arrow" aria-hidden />
            </span>
            {demo ? (
              <a
                className="works-tile__demo"
                href={demo}
                aria-label={`${t('detail.openDemo')} — ${project.name}`}
              >
                [{t('detail.openDemo')}]
              </a>
            ) : (
              <span className="works-tile__nodemo">[{t('card.noDemo')}]</span>
            )}
          </div>
        </div>
      </CardFrame>
    </Reveal>
  )
}
