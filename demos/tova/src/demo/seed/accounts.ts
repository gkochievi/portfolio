/**
 * Owner: data agent. The four one-click demo accounts (brand brief, with the
 * player renamed: the brief's player name is on the client denylist).
 * Each `id` is the seeded User id in `seed/index.ts`.
 */
import type { TovaAccount } from '@/types'

export const DEMO_PASSWORD = 'tova-demo'
export const DEMO_OTP = '123456'

export const DEMO_ACCOUNTS: readonly TovaAccount[] = [
  { id: 'usr_saba', name: 'Saba Metreveli', nameKa: 'საბა მეტრეველი', email: 'saba@tova.example', password: DEMO_PASSWORD, role: 'PLAYER', avatarColor: '#FF6B3D' },
  { id: 'usr_mariam', name: 'Mariam Abashidze', nameKa: 'მარიამ აბაშიძე', email: 'mariam@tova.example', password: DEMO_PASSWORD, role: 'SUPERVISOR', avatarColor: '#4A666C' },
  { id: 'usr_davit', name: 'Davit Lomidze', nameKa: 'დავით ლომიძე', email: 'davit@tova.example', password: DEMO_PASSWORD, role: 'ADMIN', avatarColor: '#0A6F94' },
  { id: 'usr_tamar', name: 'Tamar Beridze', nameKa: 'თამარ ბერიძე', email: 'tamar@tova.example', password: DEMO_PASSWORD, role: 'SUPERADMIN', avatarColor: '#0B2A31' },
]
