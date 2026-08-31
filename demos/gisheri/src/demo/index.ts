/**
 * Boot. `src/main.tsx` imports this on its first line, before React is even
 * pulled in, so the database exists and every route is registered by the time the
 * first component asks a question.
 *
 * Importing `./handlers` is what does both: each handler module registers its
 * routes at module scope and reaches `./store`, whose module body clones the four
 * seed JSONs, rebases every timestamp onto today and validates the result. Doing
 * that here rather than lazily inside the first `dispatch()` keeps a few
 * milliseconds of seed work off the critical path of a request whose latency is
 * being measured by a spinner.
 */
import './handlers';
import { registeredRoutes } from './router';
import { store } from './store';

// One line, so a visitor who opens the console can see what they are looking at —
// and that nothing left the tab.
console.info(
  `[demo] Gisheri — in-browser API. ${store.products.length} products, ` +
    `${store.orders.length} orders, ${store.users.length} users, ` +
    `${registeredRoutes().length} routes. No network.`,
);
