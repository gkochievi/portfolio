import type { AzriAccount } from '@/types'

/**
 * The three one-click demo accounts from the brand brief. Order matters:
 * demo-kit's session starts signed in as the FIRST account, and the first
 * load is the public SMS inbox, so the respondent comes first.
 *
 * Owner: seed agent.
 */
export const accounts: AzriAccount[] = [
  {
    id: 'acc_mariam',
    name: 'Mariam Lomidze',
    nameKa: 'მარიამ ლომიძე',
    email: 'mariam@azri.example',
    password: 'azri-demo',
    role: 'respondent',
    roleLabel: 'Respondent',
    description: 'Opens survey links from her SMS inbox',
    avatarColor: '#9EE6C6',
    staffId: null,
    recipientId: 'rcp_mariam',
    home: '/',
  },
  {
    id: 'acc_nino',
    name: 'Nino Gelashvili',
    nameKa: 'ნინო გელაშვილი',
    email: 'nino@azri.example',
    password: 'azri-demo',
    role: 'admin',
    roleLabel: 'CX manager',
    description: 'Every tenant, branch, result and comment',
    avatarColor: '#7A2A68',
    staffId: null,
    recipientId: null,
    home: '/console',
  },
  {
    id: 'acc_levan',
    name: 'Levan Japaridze',
    nameKa: 'ლევან ჯაფარიძე',
    email: 'levan@azri.example',
    password: 'azri-demo',
    role: 'agent',
    roleLabel: 'Branch staff',
    description: 'Sends the survey SMS and sees his own scores',
    avatarColor: '#2A64AD',
    staffId: 'stf_levan',
    recipientId: null,
    home: '/console/me',
  },
]
