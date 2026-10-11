import { useEffect } from 'react'
import { Link } from 'react-router-dom'

import '@/styles/detail.css'

import { getProjects, projectPath, type Project } from '@/content'
import { useLang } from '@/i18n/LanguageContext'
import { ProjectCover } from '@/components/ProjectCover'
import { Reveal } from '@/components/Reveal'
import { useDocumentTitle } from '@/lib/useDocumentTitle'

/** How many works the missing page offers as a way on — the "more" row's three. */
const SUGGESTED = 3

/**
 * A URL that addresses nothing: a typo, a truncated link, a project that was
 * renamed — boulder.ge's DetailNotFound (views/DetailShell.jsx). A rendered
 * state with a way out, never the blank page an unmatched route gives you for
 * free, which reads exactly like a crash.
 *
 * Rendered for `*`, for `/ka/*` (in Georgian — the language comes from the
 * address like everywhere else), and from inside `ProjectPage` for a slug that
 * matches nothing.
 */
export function NotFoundPage() {
  const { t, href, lang } = useLang()
  useDocumentTitle(t('meta.notFound'))
  useNoIndex()

  // The live demos first: the quickest proof that the rest of the site works.
  const suggestions = [...getProjects(lang)]
    .sort((a, b) => Number(Boolean(b.demoUrl)) - Number(Boolean(a.demoUrl)))
    .slice(0, SUGGESTED)

  return (
    <div className="detail-page">
      <article className="detail">
        <Reveal className="detail-missing">
          <p className="detail-eyebrow detail-eyebrow--missing">404</p>
          <h1 className="detail-title">{t('notFound.title')}</h1>
          <p className="detail-missing__sub">{t('notFound.subtitle')}</p>
          <p className="detail-missing__body">{t('notFound.body')}</p>
          <Link className="detail-back" to={href('/')}>
            &lt; {t('notFound.home')}
          </Link>
        </Reveal>

        {suggestions.length > 0 && (
          <Reveal as="div" className="detail-more">
            <nav aria-label={t('notFound.suggest')}>
              <h2 className="detail-more__heading">{t('notFound.suggest')}</h2>
              <ul className="detail-more__list">
                {suggestions.map((project) => (
                  <li key={project.slug}>
                    <Suggestion project={project} to={href(projectPath(project.slug))} />
                  </li>
                ))}
              </ul>
            </nav>
          </Reveal>
        )}
      </article>
    </div>
  )
}

function Suggestion({ project, to }: { project: Project; to: string }) {
  return (
    <Link className="detail-more__link" to={to}>
      <span className="detail-more__art" aria-hidden="true">
        <ProjectCover cover={project.cover} seed={project.slug} />
      </span>
      <span className="detail-more__caption">
        <span className="detail-more__title">{project.name}</span>
        <span className="detail-more__meta">{project.tagline}</span>
      </span>
    </Link>
  )
}

/**
 * `noindex` while this page is up. The host answers every unknown path with
 * index.html and a 200, so without it a mistyped link is a soft 404 a crawler
 * is entitled to index. It comes off again on unmount, so the next real page
 * is indexable; index.html carries no robots tag for it to fall back to.
 */
function useNoIndex(): void {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
}
