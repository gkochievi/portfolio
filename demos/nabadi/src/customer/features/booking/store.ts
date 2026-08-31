import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tbilisiYmd } from '@/lib/datetime';

export type WizardStep = 0 | 1 | 2 | 3;

export interface SelectedService {
  id: number;
  name: string;
  /**
   * EN name for localized rendering (KA is primary). Optional because
   * pre-v2 persisted payloads lack it — renderers fall back to `name`.
   */
  name_en?: string;
  duration_minutes: number;
  price: string;
}

export interface SelectedBarber {
  id: number;
  first_name: string;
  last_name: string;
}

/** Transient banner shown on the Date & Time step (not persisted). */
export type WizardNotice = 'slot_taken' | null;

interface WizardData {
  step: WizardStep;
  service: SelectedService | null;
  barber: SelectedBarber | null;
  date: string | null;
  startAt: string | null;
  endAt: string | null;
  notes: string;
  /** Last-interaction timestamp; persisted state older than the TTL is dropped. */
  updatedAt: number;
}

interface BookingWizardState extends WizardData {
  notice: WizardNotice;

  setStep: (step: WizardStep) => void;
  /**
   * Select a service. Changing the service resets the slot; if
   * `offeredByBarberIds` is provided and the currently selected barber does
   * not offer the new service, the barber is cleared too.
   */
  setService: (s: SelectedService, offeredByBarberIds?: number[]) => void;
  /**
   * Select a barber. With no service chosen yet (barber-first entry from the
   * Barbers page or /book?barber=N) the barber is pinned and the wizard lands
   * on the SERVICE step — never a blank Date & Time. If `offeredServices` is
   * provided and the barber does not offer the selected service, the service
   * and slot are dropped and the wizard returns to the service step; if they
   * do offer it, the snapshot is refreshed with the barber's own price and
   * duration, so a service picked before the barber still quotes that
   * barber's overrides. Changing to a different barber always resets the
   * slot.
   */
  setBarber: (b: SelectedBarber, offeredServices?: SelectedService[]) => void;
  /** Unpin/clear the barber (also drops the slot, which belonged to them). */
  clearBarber: () => void;
  /** Change the calendar day. A different day invalidates the picked slot. */
  setDate: (date: string) => void;
  setDateTime: (date: string, startAt: string, endAt: string) => void;
  setNotes: (notes: string) => void;
  /** 409 slot_taken recovery: drop the slot, go back to Date & Time, flag notice. */
  handleSlotTaken: () => void;
  reset: () => void;
}

const EMPTY: WizardData = {
  step: 0,
  service: null,
  barber: null,
  date: null,
  startAt: null,
  endAt: null,
  notes: '',
  updatedAt: 0,
};

export const WIZARD_TTL_MS = 24 * 60 * 60 * 1000;
// v2: SelectedService gained optional `name_en`. Old payloads migrate cleanly
// through sanitizeWizardState — a service without name_en falls back to `name`.
export const WIZARD_PERSIST_VERSION = 2;

/**
 * Validate rehydrated wizard state:
 * - drop everything if the state is older than the TTL (or has no timestamp);
 * - drop a slot whose start time is already in the past;
 * - drop a calendar day before Tbilisi's today;
 * - clamp `step` so the user never resumes past their remaining selections.
 * Exported for unit tests.
 */
export function sanitizeWizardState(persisted: unknown, now = Date.now()): WizardData {
  const p = (persisted && typeof persisted === 'object' ? persisted : {}) as Partial<WizardData>;
  if (!p.updatedAt || now - p.updatedAt > WIZARD_TTL_MS) {
    return { ...EMPTY, updatedAt: now };
  }
  const next: WizardData = { ...EMPTY, ...p };
  if (next.startAt && new Date(next.startAt).getTime() <= now) {
    next.startAt = null;
    next.endAt = null;
  }
  if (next.date && next.date < tbilisiYmd(new Date(now))) {
    next.date = null;
  }
  if (!next.service) next.step = 0;
  else if (!next.barber && next.step > 1) next.step = 1;
  else if (!next.startAt && next.step > 2) next.step = 2;
  return next;
}

export const useBookingWizard = create<BookingWizardState>()(
  persist(
    (set) => ({
      ...EMPTY,
      notice: null,

      setStep: (step) => set({ step, updatedAt: Date.now() }),

      setService: (service, offeredByBarberIds) =>
        set((s) => {
          const now = Date.now();
          if (s.service?.id === service.id) {
            // Re-picking the same service keeps downstream selections.
            return { service, step: 1, updatedAt: now };
          }
          const barberStillOffers =
            !s.barber || !offeredByBarberIds || offeredByBarberIds.includes(s.barber.id);
          return {
            service,
            barber: barberStillOffers ? s.barber : null,
            startAt: null,
            endAt: null,
            step: 1,
            updatedAt: now,
          };
        }),

      setBarber: (barber, offeredServices) =>
        set((s) => {
          const now = Date.now();
          // Barber-first entry: pin the barber, start at the service step.
          if (!s.service) {
            return { barber, step: 0, updatedAt: now };
          }
          const offered = offeredServices?.find((o) => o.id === s.service?.id);
          // Pinned barber doesn't offer the previously chosen service.
          if (offeredServices && !offered) {
            return {
              barber,
              service: null,
              startAt: null,
              endAt: null,
              step: 0,
              updatedAt: now,
            };
          }
          // A service chosen before the barber snapshotted the BASE price and
          // duration; this barber's menu carries their own overrides.
          const service = offered
            ? { ...s.service, price: offered.price, duration_minutes: offered.duration_minutes }
            : s.service;
          if (s.barber?.id === barber.id) {
            return { barber, service, step: 2, updatedAt: now };
          }
          // Different barber → the old barber's slot is meaningless.
          return { barber, service, startAt: null, endAt: null, step: 2, updatedAt: now };
        }),

      clearBarber: () => set({ barber: null, startAt: null, endAt: null, updatedAt: Date.now() }),

      setDate: (date) =>
        set((s) =>
          s.date === date
            ? { updatedAt: Date.now() }
            : { date, startAt: null, endAt: null, updatedAt: Date.now() },
        ),

      setDateTime: (date, startAt, endAt) =>
        set({ date, startAt, endAt, step: 3, notice: null, updatedAt: Date.now() }),

      setNotes: (notes) => set({ notes, updatedAt: Date.now() }),

      handleSlotTaken: () =>
        set({ startAt: null, endAt: null, step: 2, notice: 'slot_taken', updatedAt: Date.now() }),

      reset: () => set({ ...EMPTY, notice: null, updatedAt: Date.now() }),
    }),
    {
      name: 'bookingWizard',
      version: WIZARD_PERSIST_VERSION,
      partialize: (s) => ({
        step: s.step,
        service: s.service,
        barber: s.barber,
        date: s.date,
        startAt: s.startAt,
        endAt: s.endAt,
        notes: s.notes,
        updatedAt: s.updatedAt,
      }),
      // Runs on version bumps (older payloads simply get sanitized away).
      migrate: (persisted) => sanitizeWizardState(persisted),
      // Runs on every rehydrate: expire stale sessions and past slots.
      merge: (persisted, current) => ({ ...current, ...sanitizeWizardState(persisted) }),
    },
  ),
);
