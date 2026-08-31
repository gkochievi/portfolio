/**
 * Raw seed rows — the tables `store.ts` is built from, not API payloads.
 * Computed fields (paper state, campaign state, counts) belong in `serialize.ts`.
 *
 * Dates are absolute and internally consistent rather than relative: the newest
 * photo is 2026-08-20 and everything else is arranged around it, so the store
 * can rebase the whole set off that one anchor and still get a coherent world.
 * Photo rows carry `file`/`stem` instead of URLs so the seed survives a change
 * of base path.
 */

import type { NotificationStatus, PaymentStatus } from '@/types'

import campaignRows from './campaigns.json'
import deviceRows from './devices.json'
import notificationRows from './notifications.json'
import paymentRows from './payments.json'
import photoRows from './photos.json'
import userRow from './user.json'

/** `device_id` is the kiosk's slug; `campaign_ids` is the m2m to Campaign. */
export interface DeviceRow {
  id: number
  name: string
  device_id: string
  location: string | null
  is_online: boolean
  is_active: boolean
  paper_count: number
  paper_capacity: number
  requires_payment: boolean
  photo_price: string | null
  payment_token: string | null
  keepz_receiver_id: string | null
  campaign_ids: number[]
}

/** Image fields are paths under `public/media/`, or null when unset. */
export interface CampaignRow {
  id: number
  name: string
  sponsor: string
  is_default: boolean
  start_time: string
  end_time: string
  location: string
  line_1: string
  line_2: string
  main_logo: string | null
  secondary_logo: string | null
  icon: string | null
  banner: string | null
  qr_link: string | null
  photo_quantity: number
}

/** `device_id`/`campaign_id` are numeric FKs here, unlike `DeviceRow.device_id`. */
export interface PhotoRow {
  id: number
  file: string
  stem: string
  photo_code: string
  timestamp: string
  device_id: number
  campaign_id: number
}

export interface NotificationRow {
  id: number
  device_id: number
  campaign_id: number
  message: number
  status: NotificationStatus
  timestamp: string
}

export interface PaymentRow {
  id: number
  device_id: number
  payment_id: string
  status: PaymentStatus
  amount: string | null
  created_at: string
  updated_at: string
}

/** `password` is only ever compared against the login form. */
export interface UserRow {
  id: number
  username: string
  password: string
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  is_superuser: boolean
  last_login: string | null
}

export const devices: DeviceRow[] = deviceRows
export const campaigns: CampaignRow[] = campaignRows
export const photos: PhotoRow[] = photoRows
export const user: UserRow = userRow

// JSON widens the two enum columns to number/string; narrow them once here so
// no read site has to.
export const notifications = notificationRows as NotificationRow[]
export const payments = paymentRows as PaymentRow[]

export const seed = { devices, campaigns, photos, notifications, payments, user }

export type Seed = typeof seed
