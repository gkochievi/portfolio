/**
 * The raw seed rows — the tables `store.ts` is built from, not API payloads.
 * Computed fields (media URLs, effective prices, `can_cancel`) belong in
 * `serialize.ts`, which is why the JSON below carries nothing but columns.
 *
 * Split three ways because three people write it in parallel, along the only
 * seam that keeps the cross-file references pointing one direction:
 *
 * ```
 *   people.json   →  who works here and when
 *   catalog.json  →  what the shop sells and how it is configured   (needs people)
 *   activity.json →  everything that has happened                   (needs both)
 * ```
 *
 * Dates are absolute and internally consistent rather than relative: the newest
 * `bookings.created_at` is 2026-08-29T11:00+04:00 and everything else is
 * arranged around it, so `store.ts` can rebase the whole set off that one
 * anchor and still get a coherent shop. Media fields hold a bare relative key
 * (`services/classic-haircut.svg`), never a URL, so the seed survives a change
 * of deploy base.
 *
 * JSON widens every enum column to `string` and every literal to `number`, so
 * each table is narrowed exactly once, here, and no read site has to.
 */

import activityRows from './activity.json';
import catalogRows from './catalog.json';
import peopleRows from './people.json';
import type {
  AuditLogRow,
  BarberRow,
  BarberServiceRow,
  BookingRow,
  LandingContentRow,
  NotificationLogRow,
  NotificationTemplateRow,
  PasswordResetOtpRow,
  PromotionRow,
  ReviewRow,
  Seed,
  ServiceCategoryRow,
  ServiceRow,
  ShopHoursRow,
  SiteSettingRow,
  SpecialtyRow,
  TimeOffRow,
  UserRow,
  WorkingHoursRow,
} from '../types';

export const seed: Seed = {
  users: peopleRows.users as UserRow[],
  password_reset_otps: peopleRows.password_reset_otps as PasswordResetOtpRow[],
  specialties: peopleRows.specialties as SpecialtyRow[],
  barbers: peopleRows.barbers as BarberRow[],
  working_hours: peopleRows.working_hours as unknown as WorkingHoursRow[],
  shop_hours: peopleRows.shop_hours as unknown as ShopHoursRow[],
  time_off: peopleRows.time_off as TimeOffRow[],

  service_categories: catalogRows.service_categories as ServiceCategoryRow[],
  services: catalogRows.services as ServiceRow[],
  barber_services: catalogRows.barber_services as BarberServiceRow[],
  promotions: catalogRows.promotions as PromotionRow[],
  notification_templates: catalogRows.notification_templates as unknown as NotificationTemplateRow[],
  site_settings: catalogRows.site_settings as SiteSettingRow[],
  landing_content: catalogRows.landing_content as unknown as LandingContentRow,

  bookings: activityRows.bookings as unknown as BookingRow[],
  reviews: activityRows.reviews as ReviewRow[],
  notification_logs: activityRows.notification_logs as unknown as NotificationLogRow[],
  audit_logs: activityRows.audit_logs as AuditLogRow[],
};
