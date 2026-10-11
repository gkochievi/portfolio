import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAccount } from '@/lib/account'
import { NestIllustration } from '@/components/brand'
import { Button } from '@/components/ui'

/** 404: the bird flew away. */
export default function NotFoundPage() {
  return <SystemMessage code={404} />
}

/** Shared 404/403 body; feature pages can render <SystemMessage code={403} /> inline. */
export function SystemMessage({ code }: { code: 403 | 404 }) {
  const { t } = useTranslation('shell')
  const account = useAccount()
  const home = account?.homeRoute ?? '/'
  return (
    <main className="grid min-h-[70dvh] place-items-center px-4 py-16">
      <div className="flex max-w-md flex-col items-center text-center">
        <NestIllustration withBird={code === 403} className="w-48" />
        <p className="mt-6 font-mono text-xs text-muted">{t('system.code', { code })}</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
          {code === 404 ? t('system.notFoundTitle') : t('system.forbiddenTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted">{code === 404 ? t('system.notFoundBody') : t('system.forbiddenBody')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="primary">
            <Link to={home}>{t('system.home')}</Link>
          </Button>
          {!account || account.role === 'customer' ? (
            <Button asChild variant="secondary">
              <Link to="/login">{t('system.login')}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </main>
  )
}
