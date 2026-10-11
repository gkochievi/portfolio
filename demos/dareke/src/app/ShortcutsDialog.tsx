/** "?" keyboard shortcuts reference. The workspace wires its own keys; this only lists them. */
import { useTranslation } from 'react-i18next'

import { Dialog, Kbd } from '@/components/ui'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl'

const GROUPS: { key: string; items: { keys: string[]; label: string }[] }[] = [
  {
    key: 'general',
    items: [
      { keys: [MOD, 'K'], label: 'palette' },
      { keys: ['?'], label: 'shortcuts' },
      { keys: ['Esc'], label: 'close' },
    ],
  },
  {
    key: 'call',
    items: [
      { keys: ['M'], label: 'mute' },
      { keys: ['H'], label: 'hold' },
      { keys: ['E'], label: 'end' },
      { keys: ['1', '–', '9'], label: 'disposition' },
      { keys: ['Enter'], label: 'submit' },
    ],
  },
]

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation('shell')
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('shortcuts.title')} description={t('shortcuts.description')} size="sm">
      <div className="space-y-5">
        {GROUPS.map((group) => (
          <section key={group.key}>
            <h3 className="mb-2 text-xs font-semibold text-muted">{t(`shortcuts.groups.${group.key}`)}</h3>
            <ul className="divide-y divide-hairline rounded-card border border-hairline">
              {group.items.map((item) => (
                <li key={item.label} className="flex h-10 items-center justify-between gap-3 px-3 text-sm">
                  <span>{t(`shortcuts.items.${item.label}`)}</span>
                  <span className="flex items-center gap-1">
                    {item.keys.map((k, i) => (k === '–' ? <span key={i} className="text-muted">–</span> : <Kbd key={i}>{k}</Kbd>))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
