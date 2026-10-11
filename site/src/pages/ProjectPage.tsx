import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import '@/styles/detail.css'

import type { CreativeSolution, Project, StackGroup } from '@/content'
import { getProject, getProjects, projectPath } from '@/content'
import { fill, useLang } from '@/i18n/LanguageContext'
import { HoverMarker } from '@/components/NavPill'
import { ProjectCover } from '@/components/ProjectCover'
import { Reveal } from '@/components/Reveal'
import { RichText } from '@/components/RichText'
import { NotFoundPage } from './NotFoundPage'
import { paragraphs } from '@/lib/prose'
import { demoHref, fromBase } from '@/lib/url'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/**
 * One project, in full — boulder.ge's project page (views/ProjectPage.jsx,
 * DetailShell.jsx) carrying a whole case study.
 *
 * The grid sells by being openable; this page exists because opening the demo
 * first answered the wrong question. A visitor landing straight in someone
 * else's admin console has no idea what the product is for, which parts were
 * hard, or what they are looking at — so the demo is the payoff of a page that
 * says those things, not the thing that happens on a click.
 *
 * The template's frame is kept as drawn: "< back", the wide hero, the title
 * column beside a column of squares. What boulder.ge fills with one paragraph
 * and a gallery, the portal fills with the case study's sections and the
 * project's numbers. Every field the earlier page rendered is still here;
 * `stackGroups` and `creative` fall back to the flat field they refine, so a
 * project that has not been through a verification pass still gets a complete
 * page. Styles: src/styles/detail.css.
 *
 * Bilingual through `useLang()` and the content overlay: `getProject(slug,
 * lang)` is already English wherever Georgian is missing.
 */
export function ProjectPage() {
  const { slug } = useParams()
  const { lang } = useLang()
  const project = getProject(slug, lang)

  // An unknown slug is a 404, not a redirect: bouncing to the grid would tell a
  // visitor with a stale link that the address was fine and the project gone.
  if (!project) return <NotFoundPage />

  // Keyed by slug so a prev/next hop remounts the page: the reveals replay and
  // nothing scrolled-in on the last project carries over as already seen.
  return <ProjectDetail key={project.slug} project={project} />
}

/**
 * Split so the hooks below sit above no conditional return — `ProjectPage`
 * has to bail out before any of them run, and a hook after an early return is
 * the one thing React's rules of hooks actually forbid.
 */
function ProjectDetail({ project }: { project: Project }) {
  const { lang, t, href } = useLang()
  useDocumentTitle(fill(t('meta.project'), { name: project.name }))

  // A plain URL, not a router path: the demo is its own bundle under the
  // deploy base and needs a real document load in the same tab. In Georgian
  // it carries `?lang=ka`, so the demo opens in the reader's language.
  const demo = project.demoUrl ? demoHref(project.demoUrl, lang) : null
  const groups = stackGroupsOf(project, t('detail.stack'))
  const solutions = project.creative ?? []
  const { prev, next } = neighbours(getProjects(lang), project.slug)

  return (
    <div className="detail-page">
      <article className="detail">
        <Link className="detail-back" to={href('/')} aria-label={t('detail.back')}>
          <span aria-hidden="true">&lt; {t('detail.back')}</span>
        </Link>

        <Reveal className="detail-hero card-shape">
          <Cover project={project} eager />
        </Reveal>

        <div className="detail-grid">
          <div className="detail-main">
            <Reveal className="detail-head">
              <p className="detail-eyebrow">{t('detail.eyebrow')}</p>
              <h1 className="detail-title">{project.name}</h1>
              <p className="detail-tagline">{project.tagline}</p>
              <ul className="detail-meta">
                {project.category && (
                  <li>
                    <span className="visually-hidden">{t('detail.category')}: </span>
                    <span className="detail-tag">[{project.category}]</span>
                  </li>
                )}
                <li>
                  [ {t('detail.period')}: {project.period} ]
                </li>
                <li>
                  [ {t('detail.status')}: {t(`status.${project.status}` as const)} ]
                </li>
              </ul>
            </Reveal>

            <Reveal className="detail-body">
              <h2 className="visually-hidden">{t('detail.summary')}</h2>
              <Prose text={project.summary} className="detail-lead" />
              <span className="detail-label">[{t('detail.role')}]</span>
              <Prose text={project.role} />
            </Reveal>

            <Reveal>
              <DemoLinks project={project} demoHref={demo} />
              {project.demoNote && (
                <aside className="detail-note">
                  <span className="detail-label">{t('detail.demoNote')}</span>
                  <p>
                    <RichText text={project.demoNote} />
                  </p>
                </aside>
              )}
            </Reveal>

            <Section title={t('detail.problem')} sub={t('detail.problemSub')}>
              {project.problem.trim() && <Prose text={project.problem} block />}
            </Section>

            <Section title={t('detail.approach')} sub={t('detail.approachSub')}>
              {project.approach.trim() && <Prose text={project.approach} block />}
            </Section>

            <Section
              title={solutions.length > 0 ? t('detail.creative') : t('detail.highlights')}
              sub={solutions.length > 0 ? t('detail.creativeSub') : undefined}
            >
              {solutions.length > 0 ? (
                <Solutions items={solutions} />
              ) : (
                // No verified `creative` block yet, so `highlights` carries the
                // same claims without the reasoning. The shape is deliberately
                // not faked into three beats it does not have.
                project.highlights.length > 0 && (
                  <ul className="detail-list detail-body">
                    {project.highlights.map((highlight, index) => (
                      <li key={index}>
                        <RichText text={highlight} />
                      </li>
                    ))}
                  </ul>
                )
              )}
            </Section>

            <Section title={t('detail.stack')} sub={t('detail.stackSub')}>
              {groups.length > 0 && (
                <div className="detail-stack">
                  {groups.map((group) => (
                    <div key={group.group}>
                      <span className="detail-label">[{group.group}]</span>
                      <ul className="detail-chips" aria-label={group.group}>
                        {group.items.map((item) => (
                          <li key={item} className="detail-chip">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title={t('detail.architecture')} sub={t('detail.architectureSub')}>
              {project.architecture.length > 0 && (
                <dl className="detail-layers detail-body">
                  {project.architecture.map((layer, index) => (
                    <div key={index} className="detail-layer">
                      <dt>{layer.layer}</dt>
                      <dd>
                        <RichText text={layer.detail} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </Section>

            <Section title={t('detail.results')}>
              {project.results.length > 0 && (
                <ul className="detail-list detail-body">
                  {project.results.map((result, index) => (
                    <li key={index}>
                      <RichText text={result} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title={t('detail.demo')} sub={t('detail.demoSub')}>
              {project.screenshots.length > 0 && (
                <>
                  <h3 className="visually-hidden">{t('detail.screens')}</h3>
                  <ul className="detail-screens">
                    {project.screenshots.map((shot, index) => (
                      <li key={index} className="detail-screen">
                        {/* Titles and captions first; a capture only where
                            one exists. A stale PNG of a screen you can open
                            yourself is worth less than a sentence saying
                            what the screen is for. */}
                        {shot.src && (
                          <img
                            className="detail-screen__shot"
                            src={fromBase(shot.src)}
                            alt=""
                            loading="lazy"
                            decoding="async"
                          />
                        )}
                        <h4 className="detail-screen__title">{shot.title}</h4>
                        <p className="detail-body">
                          <RichText text={shot.caption} />
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {/* The page is long enough that a reader who has finished it
                  should not have to scroll back for the button. The note does
                  not repeat: printed twice it reads as a template. */}
              <DemoLinks project={project} demoHref={demo} />
            </Section>
          </div>

          <Numbers project={project} label={t('detail.numbers')} />
        </div>

        <Pager prev={prev} next={next} />
      </article>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The cover as card art: the real capture laid over the frame fill, or the
 * generated mark on the coral-to-indigo tile when there is none or it fails
 * to load (ProjectCover). Decorative either way — the project's name is right
 * beside it.
 */
function Cover({ project, eager = false }: { project: Project; eager?: boolean }) {
  return <ProjectCover cover={project.cover} seed={project.slug} eager={eager} width={1600} height={1000} />
}

/**
 * The page's one filled control and its bracketed companion. "open live demo"
 * is boulder.ge's "poke us" button — the coral swatch at rest — because it is
 * the same promise: the thing to do next. A plain anchor, not a router Link,
 * in the same tab: the demo is its own bundle with its own base path.
 */
function DemoLinks({ project, demoHref }: { project: Project; demoHref: string | null }) {
  const { t } = useLang()
  return (
    <div className="detail-links">
      {demoHref ? (
        <a className="detail-cta" href={demoHref}>
          <span className="detail-cta__wrap">
            <span className="detail-cta__marker detail-cta__marker--bar" aria-hidden="true">
              <HoverMarker />
            </span>
            <span className="detail-cta__marker" aria-hidden="true">
              <HoverMarker />
            </span>
            <span className="detail-cta__label">{t('detail.openDemo')} ↗</span>
          </span>
        </a>
      ) : (
        <p className="detail-cta detail-cta--off">{t('detail.noDemo')}</p>
      )}
      {project.sourceUrl && (
        <a className="detail-textlink" href={project.sourceUrl} target="_blank" rel="noopener noreferrer">
          [ {t('detail.source')} ↗ ]<span className="visually-hidden"> {t('a11y.newTab')}</span>
        </a>
      )}
    </div>
  )
}

/**
 * One case-study section: the heading in the title's voice, the bracketed
 * indigo line under it, then its content. The emptiness check lives here, not
 * in each caller: a project whose `architecture` is still an empty array would
 * otherwise ship a titled section with nothing under it, which reads as a
 * broken page rather than an unwritten one.
 */
function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  if (!hasContent(children)) return null
  return (
    <Reveal as="section" className="detail-section">
      <h2 className="detail-section__title">{title}</h2>
      {sub && <p className="detail-section__sub ka-caps">{sub}</p>}
      {children}
    </Reveal>
  )
}

/** Prose with blank lines between paragraphs, as the content file writes it. */
function Prose({ text, className, block = false }: { text: string; className?: string; block?: boolean }) {
  const body = paragraphs(text).map((paragraph, index) => (
    <p key={index} className={className}>
      <RichText text={paragraph} />
    </p>
  ))
  return block ? <div className="detail-body">{body}</div> : <>{body}</>
}

/**
 * The three-beat items: the claim, the constraint that forced it, what was
 * built. Numbered in the brand's black-weight coral and parted by hairlines —
 * the hero already spends the corner cut, and six notched cards stacked would
 * read as a repeated stamp instead of a motif.
 */
function Solutions({ items }: { items: CreativeSolution[] }) {
  const { t } = useLang()
  return (
    <ol className="detail-solutions">
      {items.map((item, index) => (
        <li key={index} className="detail-solution">
          <span className="detail-solution__index" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <div>
            <h3 className="detail-solution__title">{item.title}</h3>
            <div className="detail-body">
              <span className="detail-label">[{t('detail.constraint')}]</span>
              <p>
                <RichText text={item.constraint} />
              </p>
              <p>
                <RichText text={item.detail} />
              </p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * The template's column of squares, holding the project's metrics. Without
 * any, the two grey squares stay, drawn as the decoration they are.
 */
function Numbers({ project, label }: { project: Project; label: string }) {
  if (project.metrics.length === 0) {
    return (
      <div className="detail-side" aria-hidden="true">
        <span className="detail-side__item card-shape" />
        <span className="detail-side__item card-shape--alt" />
      </div>
    )
  }
  // One reveal for the column rather than one per square: a per-square stagger
  // is an inline transition delay, and it would lag the hover swell too.
  return (
    <Reveal as="section" className="detail-side" aria-label={label}>
      <h2 className="visually-hidden">{label}</h2>
      {project.metrics.map((metric, index) => (
        <div
          key={`${metric.label}-${index}`}
          className={`detail-side__item detail-stat ${index % 2 === 0 ? 'card-shape' : 'card-shape--alt'}`}
        >
          <span className="detail-stat__value">{metric.value}</span>
          <span className="detail-stat__label">[{metric.label}]</span>
        </div>
      ))}
    </Reveal>
  )
}

/**
 * The neighbours at the foot: boulder.ge's "more" row reduced to the two that
 * matter when reading straight through. It wraps, so the last project leads
 * back to the first and the row is never one-sided.
 */
function Pager({ prev, next }: { prev: Project | null; next: Project | null }) {
  const { t, href } = useLang()
  if (!prev && !next) return null
  return (
    <Reveal as="div" className="detail-more">
      <nav aria-label={t('detail.more')}>
        <h2 className="detail-more__heading">{t('detail.more')}</h2>
        <ul className="detail-more__list detail-more__list--pager">
          {prev && (
            <li className="detail-more__prev">
              <PagerLink project={prev} to={href(projectPath(prev.slug))} dir={`< ${t('detail.prev')}`} rel="prev" />
            </li>
          )}
          {next && (
            <li className="detail-more__next">
              <PagerLink project={next} to={href(projectPath(next.slug))} dir={`${t('detail.next')} >`} rel="next" />
            </li>
          )}
        </ul>
      </nav>
    </Reveal>
  )
}

function PagerLink({ project, to, dir, rel }: { project: Project; to: string; dir: string; rel: string }) {
  return (
    <Link className="detail-more__link" to={to} rel={rel}>
      <span className="detail-more__dir">{dir}</span>
      <span className="detail-more__art" aria-hidden="true">
        <Cover project={project} />
      </span>
      <span className="detail-more__caption">
        <span className="detail-more__title">{project.name}</span>
        <span className="detail-more__meta">{project.tagline}</span>
      </span>
    </Link>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * `stackGroups` when it has been written, otherwise the flat `stack` as one
 * group named after the section — it says nothing the list does not already
 * say, which is the point of the fallback.
 */
function stackGroupsOf(project: Project, fallbackName: string): StackGroup[] {
  if (project.stackGroups && project.stackGroups.length > 0) return project.stackGroups
  return project.stack.length > 0 ? [{ group: fallbackName, items: project.stack }] : []
}

/**
 * The projects either side of `slug`, wrapping at the ends. With two projects
 * both sides are the same one, so it is offered once, as "next".
 */
function neighbours(list: Project[], slug: string): { prev: Project | null; next: Project | null } {
  const index = list.findIndex((candidate) => candidate.slug === slug)
  if (index === -1 || list.length < 2) return { prev: null, next: null }
  const next = list[(index + 1) % list.length]
  const prev = list[(index - 1 + list.length) % list.length]
  return { prev: prev.slug === next.slug ? null : prev, next }
}

/**
 * Whether a section has anything to show. The interesting cases render to
 * nothing: a `false` from an `&&` guard, or a fragment of them.
 */
function hasContent(children: ReactNode): boolean {
  return Children.toArray(children).some((node) =>
    isValidElement<{ children?: ReactNode }>(node) && node.type === Fragment
      ? hasContent(node.props.children)
      : true,
  )
}
