import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SearchInput } from '@/components/ui'
import { useUsageParams } from '../params'

/** Debounced search box that writes `q` to the URL (so it survives a reload and a back-navigation). */
export function ListSearch({ placeholder }: { placeholder: string }) {
  const { t } = useTranslation('usage')
  const { tab, setTab } = useUsageParams()
  const [value, setValue] = useState(tab.q)

  useEffect(() => setValue(tab.q), [tab.q])
  useEffect(() => {
    if (value === tab.q) return
    const id = setTimeout(() => setTab({ q: value.trim() ? value : undefined }), 250)
    return () => clearTimeout(id)
  }, [value, tab.q, setTab])

  return (
    <div className="w-full sm:w-[320px]" role="search" aria-label={t('search.label')}>
      <SearchInput value={value} onChange={setValue} placeholder={placeholder} size="sm" />
    </div>
  )
}
