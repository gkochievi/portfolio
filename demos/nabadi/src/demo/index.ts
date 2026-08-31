/**
 * Boot. `src/main.tsx` imports this for its side effects, before either surface
 * is mounted, so the store exists and every route is registered by the time the
 * first component asks a question.
 *
 * Importing `./store` is what constructs the database: the module body clones
 * the seed, rebases it onto today and runs the stale-booking sweep once. Doing
 * that here rather than lazily inside the first `dispatch()` keeps the work off
 * the critical path of a request whose latency is being measured by a spinner.
 */
import './handlers';
import { store } from './store';

// One line, so a visitor who opens the console can see what they are looking at
// and that nothing left the tab.
console.info(
  `[demo] Nabadi Barbershop — in-browser API. ${store.bookings.length} bookings, ` +
    `${store.services.length} services, ${store.barbers.length} barbers. No network.`,
);
