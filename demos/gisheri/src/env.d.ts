/// <reference types="vite/client" />

/**
 * Injected by `vite.config.ts`'s `define`. `hash` swaps both routers onto the
 * hash router, which is the escape hatch for a static host that cannot serve
 * `index.html` for an unknown path.
 */
declare const __DEMO_ROUTER__: 'browser' | 'hash';
