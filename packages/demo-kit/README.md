# @portfolio/demo-kit

The shared seam for the backend-less portfolio demos. Printomato proved the pattern: a seed
compiled into the bundle, an in-browser mock that serves it with real-feeling latency, and a
little chrome that says "this is a demo". This package is that pattern, extracted once, so every
new demo is just product code.

It ships TypeScript source (no build step); each demo's Vite compiles it. The demos own React,
React Router and i18next — the kit only declares them as peers.

## The rules it encodes

| Rule | Where the kit enforces it |
|---|---|
| **No network at runtime** | `createMockApi` is the backend: route matching, 404/405/401, validation errors, latency, abort — all in memory. Requests and responses are structured-cloned, as the wire would, so UI code can never mutate the store by accident. |
| **No persistent storage** | `createStore` and `createSession` live in memory only. A reload restores the pristine seed; `reset()` does the same without the reload. Nothing in the kit touches `localStorage`, `sessionStorage` or IndexedDB — the demo bar's dismiss included. |
| **Seed data never looks stale** | `rebaseDates` shifts every ISO timestamp by *now − anchor*; run it in `createStore`'s `prepare` so each reset rebases too. |
| **Deterministic fake activity** | `createRandom(seed)` instead of `Math.random()` for generators; `every(ms, fn)` pauses while the tab is hidden. |
| **Sub-path + iframe safe** | `createDemoRouter` derives the basename from `BASE_URL`; `portfolioUrl` resolves against the base, not the route; "Back to portfolio" targets `_top`; the bar is portalled and `position: fixed` at `z-index: 2147483000`. |
| **`VITE_ROUTER=hash`** | `createDemoRouter({ mode })` switches to the hash router. A relative base (`./`) falls back to it automatically. |
| **Media through `BASE_URL`** | The kit never builds an absolute asset path; demos keep using `` `${import.meta.env.BASE_URL}media/…` ``. |
| **No merge conflicts in locales** | `buildResources(import.meta.glob(...))` — each feature owns `locales/<lng>/<ns>.json`. |

## Usage

```tsx
// src/demo/index.ts — seed → store → API → handlers → client → session
import { createMockApi, createSession, createStore, DemoApiError, notFound, rebaseDates } from '@portfolio/demo-kit'
import { seed, accounts } from './seed'           // plain JSON-ish data, authored as of SEED_DATE
const SEED_DATE = '2026-09-01T09:00:00Z'

export const store = createStore(seed, { prepare: (copy) => rebaseDates(copy, { anchor: SEED_DATE }) })
export const session = createSession(accounts)                   // starts signed in as accounts[0]
export const api = createMockApi({ prefix: '/api', isAuthenticated: session.isSignedIn })

api.register('GET', '/orders/', ({ params }) =>
  store.data.orders.filter((order) => !params.status || order.status === params.status))
api.register('POST', '/orders/', ({ body }) => {
  const input = body as { item?: string }
  if (!input.item) throw DemoApiError.validation({ item: 'This field is required.' })
  const order = { id: store.nextId('ord_'), item: input.item, status: 'open', createdAt: new Date().toISOString() }
  store.data.orders.unshift(order)
  return order
})
api.register('GET', '/orders/:id/', ({ path }) => {
  const order = store.data.orders.find((o) => o.id === path.id)
  if (!order) throw notFound()
  return order
})

// src/lib/api.ts — the client the UI calls; swap dispatch for fetch and nothing else changes
export const request = <T,>(method: string, path: string, body?: unknown, signal?: AbortSignal) =>
  api.dispatch<T>(method, `/api${path}`, { body, signal })

// src/App.tsx — router + chrome
import { RouterProvider } from 'react-router-dom'
import { createDemoRouter, DemoBar, DEMO_BAR_STRINGS, useSession } from '@portfolio/demo-kit'
import '@portfolio/demo-kit/demo-kit.css'

const router = createDemoRouter(routes, { mode: import.meta.env.VITE_ROUTER, baseUrl: import.meta.env.BASE_URL })

export function App({ lang }: { lang: 'ka' | 'en' }) {
  const me = useSession(session)
  return (
    <>
      <RouterProvider router={router} />
      <DemoBar product="Tonnaro" accounts={session.accounts} currentId={me?.id ?? null}
        onSwitch={(id) => { session.signIn(id); void router.navigate('/') }}
        onSignOut={() => { session.signOut(); void router.navigate('/login') }}
        onReset={() => store.reset()} strings={DEMO_BAR_STRINGS[lang]} baseUrl={import.meta.env.BASE_URL} />
    </>
  )
}
```

`VITE_ROUTER` is whatever the demo's `vite.config.ts` exposes (Printomato uses a `define`, which
works the same way). Handlers throw `DemoApiError`s; they never return them.

## API surface

| Module | Exports |
|---|---|
| `mock/api` | `createMockApi`, `DemoApiError` (+ `.validation()`), `notFound`, `forbidden`, `conflict` |
| `mock/store` | `createStore` → `{ data, version, reset, snapshot, nextId, subscribe, notify }` |
| `mock/events` | `createEventBus<Events>()` → `{ on, off, once, emit, clear }` |
| `mock/clock` | `every(ms, fn)`, `rebaseDates(value, { anchor, now?, keys?, wholeDays? })` |
| `mock/random` | `createRandom(seed)` → `{ next, int, pick, weighted, chance, shuffle, uuid }` |
| `session` | `createSession`, `useSession`, `accountInitial`, `DemoAccount` |
| `router` | `createDemoRouter`, `portfolioUrl` |
| `i18n` | `buildResources`, `Lang` |
| chrome | `<DemoBar>`, `<DemoAccounts>`, `<BoulderMark>`, `DEMO_BAR_STRINGS` |

`api.routes()` lists every registered `{ method, pattern, requiresAuth }`, for a docs script that
prints a demo's API surface.

**The bar and a demo's own bottom UI.** The bar is fixed bottom-left. A demo with its own fixed
bottom chrome (a mobile tab bar, a call-control dock) lifts the bar clear of it with a CSS
variable on `.bdk-root`, no `!important` needed:

```css
@media (max-width: 767px) {
  .bdk-root { --bdk-offset-bottom: 60px; }
}
```

Bani (tab bar) and Dareke (call dock) do this.

## Typecheck

```bash
npm --workspace @portfolio/demo-kit run typecheck
```

The kit's own `tsconfig.json` is stricter than any demo's (`exactOptionalPropertyTypes`,
`noUncheckedIndexedAccess`), so its sources compile cleanly under whatever settings a demo uses.
