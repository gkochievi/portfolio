import { projects } from '@/content'
import { TAGLINE } from '@/config'
import { ProjectCard } from '@/components/ProjectCard'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { SITE_TITLE } from '@/config'

/**
 * The portal. One screen: a short statement of what this is, then the work.
 *
 * There is no hero carousel, no "about", no scroll journey — a visitor here is
 * deciding which project to open, and everything that is not a project card is
 * something between them and that decision. The cards do the selling by being
 * openable.
 */
export function PortalPage() {
  useDocumentTitle(SITE_TITLE)

  const withDemos = projects.filter((project) => project.demoUrl).length

  return (
    <>
      {/* The wordmark is already in the header, so the headline says what the
          page is for rather than repeating the company name back at the
          reader. */}
      <section className="shell pt-10 pb-8 sm:pt-16 sm:pb-10">
        <p className="label-caps">Selected work</p>
        <h1 className="mt-3 max-w-[13ch] font-display text-display font-extrabold leading-[1.04] text-ink">
          Work you can <span className="text-accent">click through</span>
        </h1>
        <p className="mt-5 max-w-[54ch] text-body-lg leading-relaxed text-ink/70">{TAGLINE}</p>
        <p className="mt-3 max-w-[54ch] text-body leading-relaxed text-ink/65">
          {withDemos === projects.length
            ? 'Each card opens the write-up — what the product does, what it is built from, and the parts worth naming — with a button that runs the real thing in your browser. Real data, real workflows, no sign-up.'
            : 'Each card opens the write-up — what the product does, what it is built from, and the parts worth naming. Most of them run in your browser from there: real data, real workflows, no sign-up.'}
        </p>
      </section>

      <section className="shell pb-16 sm:pb-24">
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </ul>
      </section>
    </>
  )
}
