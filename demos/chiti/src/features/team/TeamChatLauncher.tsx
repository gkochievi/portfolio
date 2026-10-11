/**
 * Header button with the total unread badge that opens the team chat as a
 * slide-over. Mounted by the shell's OperatorLayout.
 */
import { useState } from 'react'
import { MessagesSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Drawer, IconButton } from '@/components/ui'
import { useAccount } from '@/lib/account'

import { totalUnread, useConversations } from './api'
import { TeamChatPanel } from './TeamChatPanel'

export function TeamChatLauncher() {
  const { t } = useTranslation('team')
  const account = useAccount()
  const [open, setOpen] = useState(false)
  const staff = !!account && account.role !== 'customer' && account.role !== 'superadmin'
  const conversations = useConversations(staff)
  if (!staff) return null
  const unread = totalUnread(conversations.data)
  return (
    <>
      <IconButton
        label={unread > 0 ? t('launcher.withUnread', { count: unread }) : t('launcher.label')}
        icon={<MessagesSquare size={20} strokeWidth={1.75} />}
        variant="ghost"
        badge={unread}
        onClick={() => setOpen(true)}
      />
      <Drawer open={open} onOpenChange={setOpen} title={t('title')} width={460} bodyClassName="overflow-hidden p-0">
        <TeamChatPanel variant="overlay" onClose={() => setOpen(false)} />
      </Drawer>
    </>
  )
}
