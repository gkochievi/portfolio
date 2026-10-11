/**
 * Router construction that honours the two deployment knobs every demo
 * shares: the base path (`import.meta.env.BASE_URL`, from `VITE_BASE`) and the
 * router mode (`VITE_ROUTER=hash`, for hosts that cannot do SPA fallback).
 *
 * The kit never reads `import.meta.env` itself — each demo passes both values
 * in, so the kit stays bundler-agnostic and the demo's own `define`s win.
 */
import { createBrowserRouter, createHashRouter, type RouteObject } from 'react-router-dom'

/** The router instance `<RouterProvider router={…}>` takes. */
export type DemoRouter = ReturnType<typeof createBrowserRouter>

type RouterInit = NonNullable<Parameters<typeof createBrowserRouter>[1]>

/** Options for `createDemoRouter()`. */
export interface DemoRouterOptions {
  /** `'hash'` selects the hash router; anything else (or nothing) the browser router. Pass `VITE_ROUTER`. */
  mode?: string | undefined
  /** The build's base path. Pass `import.meta.env.BASE_URL`. */
  baseUrl: string
  /** React Router v7 future flags, passed straight through. */
  future?: RouterInit['future'] | undefined
}

/**
 * Create the demo's data router.
 *
 * - `mode === 'hash'` → `createHashRouter`: routes live after `#`, so a deep
 *   link reloads on any static host and the base path is irrelevant.
 * - otherwise → `createBrowserRouter` with `basename` = `baseUrl` minus its
 *   trailing slash (`/demos/x/` → `/demos/x`; `/` → no basename).
 *
 * A relative base (`./`, Vite's "deploy anywhere" setting) cannot anchor a
 * browser router — the basename would shift with every deep link — so it
 * falls back to the hash router rather than 404ing on the first reload.
 */
export function createDemoRouter(routes: RouteObject[], options: DemoRouterOptions): DemoRouter {
  const init: RouterInit = {}
  if (options.future) init.future = options.future

  if (options.mode === 'hash' || !options.baseUrl.startsWith('/')) {
    return createHashRouter(routes, init)
  }

  const basename = options.baseUrl.replace(/\/+$/, '')
  if (basename) init.basename = basename
  return createBrowserRouter(routes, init)
}

/**
 * The portfolio's root, resolved against the build's base path rather than
 * the current route — so it is the same from `/orders` and `/orders/3/edit`.
 * Demos deploy at `<site>/demos/<name>/`, two levels below the site. A demo
 * served at a domain root has no portfolio above it and lands on itself,
 * which is the honest answer for that deployment.
 */
export function portfolioUrl(baseUrl: string): string {
  return new URL('../../', new URL(baseUrl, window.location.href)).href
}
