/// <reference types="vite/client" />

/**
 * Injected by `define` in vite.config.ts. `hash` swaps both surfaces onto
 * HashRouter for hosts that cannot serve an SPA fallback.
 */
declare const __DEMO_ROUTER__: 'browser' | 'hash';
