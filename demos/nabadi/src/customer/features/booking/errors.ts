import { ApiError } from '@/lib/api';

/**
 * The "one active booking per (customer, service)" violation.
 *
 * The backend is gaining a distinct `duplicate_active_booking` code; until
 * every environment ships it, older backends misreport the partial-unique
 * violation (`unique_active_booking_per_customer_service`) as `slot_taken`.
 * Keep a fallback that sniffs the constraint out of the error body so the
 * user isn't sent into an unrecoverable "pick another slot" loop.
 */
export function isDuplicateActiveBooking(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.code === 'duplicate_active_booking') return true;
  return (
    error.status === 409 &&
    /duplicate|active_booking_per_customer_service|active booking/i.test(
      `${error.field ?? ''} ${error.message}`,
    )
  );
}

/** A genuine slot race (someone grabbed the slot first) — recoverable. */
export function isSlotTaken(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  return error.status === 409 && error.code === 'slot_taken' && !isDuplicateActiveBooking(error);
}
