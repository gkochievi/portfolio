import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The demo is a plain static bundle — no Django, no API server.
 *
 * `VITE_BASE` is the one knob that matters when deploying: it must match the
 * public path the bundle is served from, because both React Routers read it
 * back through `import.meta.env.BASE_URL` to set their basename. The default
 * suits the portfolio layout (`/demos/nabadi/`); set `VITE_BASE=/` to serve
 * the demo at a domain root, or `VITE_ROUTER=hash` to sidestep server rewrites
 * entirely on a host that cannot do SPA fallback.
 */
const base = process.env.VITE_BASE ?? '/demos/nabadi/';

const src = fileURLToPath(new URL('./src/', import.meta.url));
const customer = `${src}customer/`;
const admin = `${src}admin/`;

/**
 * Upstream is two independent Vite apps, and each resolves `@/` to its own
 * `src/`. Ported side by side into one bundle they would collide: 216 imports
 * in the customer tree and 470 in the console mean the same specifier —
 * `@/lib/api`, `@/components/Button` — has to land in two different files.
 *
 * A single `resolve.alias` entry cannot do that, because it never sees who is
 * asking. A `resolveId` hook does: the importer's own path decides which tree
 * `@/` means. That is what keeps every ported file byte-identical instead of
 * rewriting 686 import statements and making every future diff against the
 * real apps useless.
 */
function scopedAlias(): Plugin {
  return {
    name: 'nabadi-scoped-alias',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.startsWith('@/') || !importer) return null;
      const root = importer.startsWith(admin)
        ? admin
        : importer.startsWith(customer)
          ? customer
          : null;
      if (!root) return null;
      const resolved = await this.resolve(root + source.slice(2), importer, {
        ...options,
        skipSelf: true,
      });
      return resolved ?? null;
    },
  };
}

export default defineConfig({
  base,
  plugins: [scopedAlias(), react(), tailwindcss()],
  resolve: {
    /**
     * This workspace is on React 19; the other two demos are on React 18, so npm
     * hoists 18 to the repo root and nests 19 here. Anything that hoists with it —
     * Radix, react-i18next, TanStack Query — resolves `react` by walking up out of
     * this workspace and lands on the root's copy, and two React runtimes in one
     * page means every hook throws. Deduping pins them all to this workspace's
     * React, which is what the tsconfigs already do for its types.
     */
    dedupe: [
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
      'react-is',
      // Same split, one layer down: `react-i18next` hoists and would hand the
      // console's provider an i18next 24 type for an instance made by 23.
      'i18next',
      'react-i18next',
      '@tanstack/react-query',
    ],
  },
  define: {
    __DEMO_ROUTER__: JSON.stringify(process.env.VITE_ROUTER ?? 'browser'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    /**
     * No `manualChunks`. The other two demos in this repo hand Vite 6 an object
     * here; this workspace is on Vite 8, whose rolldown backend takes only a
     * function — and does not need one. The split that actually matters is
     * already made in `src/main.tsx`: each surface is reached through
     * `import.meta.glob`, so the console's 16k lines and its chart library are
     * their own chunk and never reach a visitor who only books a haircut.
     */
  },
  server: {
    port: 5176,
    strictPort: true,
  },
});
