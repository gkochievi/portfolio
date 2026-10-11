import { useState } from 'react'
import { Sparkles, UserRound, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { BirdBadge } from '@/components/brand'
import { IconButton, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import type { CopilotRef } from '@/types'

import { useCopilot } from './api'
import { CopilotTab } from './components/CopilotTab'
import { CustomerTab } from './components/CustomerTab'

/**
 * The 340px right drawer of the conversation pane: tabs Customer (fields, IP,
 * FAQ path, previous chats, notes) and Copilot (handoff card, knowledge, drafts,
 * transforms). `onInsert` puts text into the inbox composer.
 */
export interface OperatorDrawerProps {
  sessionId: string
  onInsert: (text: string, ref?: Omit<CopilotRef, 'action'>) => void
  onClose?: () => void
}

export function OperatorDrawer({ sessionId, onInsert, onClose }: OperatorDrawerProps) {
  const { t } = useTranslation('operatorTools')
  const { t: tc } = useTranslation()
  const [tab, setTab] = useState<'customer' | 'copilot'>('customer')
  const copilot = useCopilot(sessionId)
  const ready = copilot.data?.draft?.state === 'ready' ? copilot.data.draft.suggestions.length : 0

  return (
    <aside aria-label={t('drawer.label')} className="relative flex h-full w-full flex-col border-l border-line bg-panel sm:w-[340px] sm:shrink-0">
      {/* The copilot bird perches on the drawer edge and opens the Copilot tab. */}
      <button
        type="button"
        onClick={() => setTab('copilot')}
        aria-label={t('drawer.openCopilot')}
        title={t('drawer.openCopilot')}
        className="absolute -left-[18px] top-[52px] z-10 hidden size-9 place-items-center rounded-full border border-line bg-panel shadow-pop transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:grid"
      >
        <BirdBadge size={22} />
      </button>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'customer' | 'copilot')} className="min-h-0 flex-1">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <TabsList className="flex-1 border-b-0">
            <TabsTrigger value="customer" icon={<UserRound />}>
              {t('drawer.customer')}
            </TabsTrigger>
            <TabsTrigger value="copilot" icon={<Sparkles />} {...(tab !== 'copilot' && ready > 0 ? { count: ready } : {})}>
              {t('drawer.copilot')}
            </TabsTrigger>
          </TabsList>
          {onClose ? <IconButton size="sm" variant="muted" label={tc('actions.close')} icon={<X />} onClick={onClose} /> : null}
        </div>
        <TabsContent value="customer" className="min-h-0 flex-1 overflow-y-auto">
          <CustomerTab sessionId={sessionId} />
        </TabsContent>
        <TabsContent value="copilot" className="min-h-0 flex-1 overflow-y-auto">
          <CopilotTab sessionId={sessionId} onInsert={onInsert} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
