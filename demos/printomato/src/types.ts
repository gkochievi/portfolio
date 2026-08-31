/** Shapes returned by /api/admin/ — mirrors core/admin_api/serializers.py. */

export interface SessionUser {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  initials: string
  is_staff: boolean
  is_superuser: boolean
  last_login: string | null
}

export interface DeviceRef {
  id: number
  name: string
  device_id: string
  location: string | null
  is_online: boolean
}

export interface CampaignRef {
  id: number
  name: string
  sponsor: string
  location: string
}

export type PaperState = 'healthy' | 'warning' | 'critical'

export interface Device {
  id: number
  name: string
  device_id: string
  location: string | null
  is_online: boolean
  is_active: boolean
  paper_count: number
  paper_capacity: number
  paper_percentage: number
  paper_state: PaperState
  requires_payment: boolean
  photo_price: string | null
  payment_token: string | null
  keepz_receiver_id: string | null
  campaigns: CampaignRef[]
  has_notifications: boolean
  total_printed: number
  printed_today: number
}

export type CampaignState = 'active' | 'upcoming' | 'expired'

export interface Campaign {
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
  devices: DeviceRef[]
  online_devices: number
  total_devices: number
  total_printed: number
  state: CampaignState
  days_gone: string
  days_gone_percentage: number
}

export interface Photo {
  id: number
  photo_url: string | null
  thumbnail_url: string | null
  photo_code: string | null
  timestamp: string
  device: DeviceRef | null
  campaign: CampaignRef | null
}

export type NotificationStatus = 1 | 2 | 3

export interface AppNotification {
  id: number
  device: DeviceRef | null
  campaign: CampaignRef | null
  message: number
  message_display: string
  status: NotificationStatus
  status_display: string
  timestamp: string
}

export type PaymentStatus = 'started' | 'success' | 'rejected'

export interface PaymentSession {
  id: number
  device: DeviceRef | null
  payment_id: string
  status: PaymentStatus
  amount: string | null
  created_at: string
  updated_at: string
}

export interface PaymentSummary {
  total: number
  succeeded: number
  rejected: number
  started: number
  revenue: string | number
  success_rate: number
}

export interface Analytics {
  online_devices: number
  total_devices: number
  active_devices: number
  total_printed: number
  printed_today: number
  printed_yesterday: number
  paper_remaining: number
  paper_capacity: number
  active_campaigns: number
  upcoming_campaigns: number
  unread_notifications: number
  open_notifications: number
  low_paper_devices: number
  revenue_total: string | number
  revenue_today: string | number
  payments_today: number
}

export interface ActivityPoint {
  date: string
  count: number
}

export interface Dashboard {
  analytics: Analytics
  print_activity: ActivityPoint[]
  devices: Device[]
  campaigns: Campaign[]
  notifications: AppNotification[]
}

export interface Choice {
  value: string
  label: string
}

export interface Options {
  devices: DeviceRef[]
  campaigns: CampaignRef[]
  notification_statuses: Choice[]
  notification_messages: Choice[]
  payment_statuses: Choice[]
}

export interface Page<T> {
  count: number
  num_pages: number
  page: number
  page_size: number
  has_next: boolean
  has_previous: boolean
  results: T[]
}

/** Configuration derived from the build's base path — see lib/bootstrap.ts. */
export interface BootstrapPayload {
  apiBase: string
  appBase: string
  mediaUrl: string
  logoUrl: string
  timeZone: string
}
