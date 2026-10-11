import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'

import { Button, PageHeader } from '@/components/ui'
import { canSeeExtensionActivity } from '@/lib/rbac'
import { useMe } from '@/shell/useMe'
import type { Extension } from '@/types'
import { useExtensionsLive } from '../api'
import { DirectoryTable } from '../components/DirectoryTable'
import { ProvisionCard } from '../components/ProvisionCard'

export default function ExtensionsPage() {
  const { t } = useTranslation('extensions')
  const { role } = useMe()
  useExtensionsLive()

  const [highlight, setHighlight] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onCreated = (extension: Extension) => {
    setHighlight(extension.number)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHighlight(null), 6000)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          canSeeExtensionActivity(role) ? (
            <Link to="/extensions/activity" className="inline-flex">
              <Button variant="secondary" icon={ScrollText} tabIndex={-1}>
                {t('activityLink')}
              </Button>
            </Link>
          ) : undefined
        }
      />
      <ProvisionCard onCreated={onCreated} />
      <DirectoryTable highlight={highlight} />
    </div>
  )
}
