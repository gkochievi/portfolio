import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { NOT_FOUND_TITLE } from '@/config'
import { projects } from '@/content'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { fromBase } from '@/lib/url'

export function NotFoundPage() {
  useDocumentTitle(NOT_FOUND_TITLE)
  const featured = projects.find((project) => project.demoUrl)

  return (
    <section className="shell py-24 sm:py-32">
      {/* The drop-shadow lives outside the notch clip — a box-shadow on the
          clipped element itself would be clipped away with it. */}
      <div className="max-w-2xl [filter:var(--drop-card)]">
        <div className="notch bg-surface p-8 sm:p-12">
          <p className="label-caps">Error 404</p>
          <h1 className="mt-4 font-display text-h1 font-extrabold leading-tight text-ink">
            Nothing is served at this address.
          </h1>
          <p className="mt-4 max-w-[46ch] text-body-lg leading-relaxed text-ink/70">
            The page either moved or never existed. The work is one click away either way.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-accent-solid px-5 py-3 font-display text-body font-bold text-white transition-transform duration-300 ease-bounce hover:-translate-y-0.5"
            >
              <ArrowLeft className="size-4" aria-hidden />
              Back to the work
            </Link>
            {featured?.demoUrl ? (
              <a
                href={fromBase(featured.demoUrl)}
                className="text-body font-semibold text-ink/60 transition-colors duration-300 ease-bounce hover:text-accent-text"
              >
                Or open the {featured.name} demo
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
