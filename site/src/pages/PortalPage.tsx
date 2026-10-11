import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { getProject, getProjects } from '@/content'
import { fill, useLang } from '@/i18n/LanguageContext'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { cn } from '@/lib/cn'
import { FRAME_TONES, type FrameTone } from '@/components/CardFrame'
import { ProjectCard } from '@/components/ProjectCard'
import { Reveal } from '@/components/Reveal'
import { SectionTitle } from '@/components/SectionTitle'
import { WorksDeck } from '@/components/WorksDeck'
import '@/styles/works.css'

/** boulder.ge in the reader's language — its own `/ka` prefix, same scheme as ours. */
const MAIN_SITE = { en: 'https://boulder.ge/', ka: 'https://boulder.ge/ka' } as const

/** The filter's address: `?category=<english category>`, so a filtered view can be shared. */
const FILTER_PARAM = 'category'

interface Category {
  /** The English category: the same key in both languages, so the switch keeps the filter. */
  key: string
  /** As the reader's language writes it. */
  label: string
  tone: FrameTone
}

/**
 * The portal: boulder.ge's hero line, then its Works section as one deck of
 * live products.
 *
 * The headline is boulder.ge's own ("Bold choices BOULDER results", the
 * stamp in indigo over its coral shadow) because the portal is Boulder's
 * showcase, not a product of its own; the lead under it says what this page
 * is for. Then "works" over its bracketed subtitle, flush right, and the
 * cards dealt under a "[development]" deck label.
 *
 * Categories are optional per project. The filter appears only when they
 * name more than one, keyed by the English category so `/` and `/ka` agree
 * on what `?category=` means and the language switch (which keeps the query)
 * keeps the filter. An unknown value in the address is simply no filter.
 */
export function PortalPage() {
  const { lang, t } = useLang()
  useDocumentTitle(t('meta.title'))

  const projects = getProjects(lang)
  const [params, setParams] = useSearchParams()

  const categories = useMemo<Category[]>(() => {
    const found = new Map<string, Category>()
    for (const project of projects) {
      const key = getProject(project.slug, 'en')?.category?.trim()
      if (!key || found.has(key)) continue
      found.set(key, {
        key,
        label: project.category?.trim() || key,
        tone: FRAME_TONES[found.size % FRAME_TONES.length],
      })
    }
    return [...found.values()]
  }, [projects])

  const wanted = params.get(FILTER_PARAM)
  const active = categories.length > 1 ? categories.find((category) => category.key === wanted) : undefined
  const englishCategory = (slug: string) => getProject(slug, 'en')?.category?.trim()
  const visible = active ? projects.filter((project) => englishCategory(project.slug) === active.key) : projects
  const toneOf = (slug: string): FrameTone =>
    categories.find((category) => category.key === englishCategory(slug))?.tone ?? 'tech'

  const choose = (key: string | null) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        if (key) next.set(FILTER_PARAM, key)
        else next.delete(FILTER_PARAM)
        return next
      },
      // A filter is a view of this page, not a page of its own: Back leaves
      // the portal rather than stepping through every chip pressed.
      { replace: true, preventScrollReset: true },
    )
  }

  const demos = projects.filter((project) => project.demoUrl).length
  const count = fill(t(demos === 1 ? 'portal.countOne' : 'portal.countMany'), { n: demos })

  return (
    <>
      <section className="works-hero shell" aria-labelledby="works-hero-title">
        <Reveal as="div" className="works-hero__copy">
          <p className="bracket works-hero__count">{count}</p>
          <h1 id="works-hero-title" className="hero-headline works-hero__headline">
            <span className="hero-headline__strong">{t('hero.headlineBefore')}</span>
            <span className="hero-headline__light">{t('hero.headlineMid')}</span>
            {/* The stamp's coral shadow is drawn from `data-text` (works.css),
                so the word is in the DOM once for a screen reader. */}
            <span className="hero-headline__boulder" data-text={t('hero.stamp')}>
              {t('hero.stamp')}
            </span>{' '}
            <span className="hero-headline__light">{t('hero.headlineAfter')}</span>
          </h1>
          <p className="works-hero__lead">{t('portal.lead')}</p>
          <p className="works-hero__more">
            <a href={MAIN_SITE[lang]} target="_blank" rel="noopener noreferrer">
              {t('portal.mainSite')}
              <span className="visually-hidden"> {t('a11y.newTab')}</span>
            </a>
          </p>
        </Reveal>
      </section>

      <section className="works-section shell" aria-labelledby="works-title">
        <SectionTitle title={t('portal.title')} subtitle={t('portal.subtitle')} id="works-title" index={1}>
          {categories.length > 1 && (
            <div className="works-filter" role="group" aria-label={t('portal.filterLabel')}>
              <button
                type="button"
                className="works-filter__chip"
                aria-pressed={!active}
                onClick={() => choose(null)}
              >
                [{t('portal.all')}]
              </button>
              {categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={cn('works-filter__chip', `works-filter__chip--${category.tone}`)}
                  aria-pressed={active?.key === category.key}
                  onClick={() => choose(category.key)}
                >
                  [{category.label}]
                </button>
              ))}
            </div>
          )}
        </SectionTitle>

        {visible.length > 0 ? (
          <WorksDeck label={t('tag.development')} tone="tech" count={visible.length}>
            {visible.map((project, index) => (
              <ProjectCard key={project.slug} project={project} index={index} tone={toneOf(project.slug)} />
            ))}
          </WorksDeck>
        ) : (
          <p className="bracket bracket--ink works-empty">{t('portal.empty')}</p>
        )}
      </section>
    </>
  )
}
