import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The demo is a plain static bundle — no Django, no API server.
 *
 * `VITE_BASE` is the one knob that matters when deploying: it must match the
 * public path the bundle is served from, because the router reads it back
 * through `import.meta.env.BASE_URL` to set its basename, and the mock reads
 * it to strip the `/api` prefix off a request path. The default suits the
 * portfolio layout (`/demos/gisheri/`); set `VITE_BASE=/` to serve the demo at
 * a domain root, or `VITE_ROUTER=hash` to sidestep server rewrites entirely on
 * a host that cannot do SPA fallback.
 */
const base = process.env.VITE_BASE ?? '/demos/gisheri/';

export default defineConfig({
  base,
  // One app tree, so one `@/` — none of nabadi's scoped-alias machinery is needed.
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    /**
     * MANDATORY. The repo root hoists React 18.3.1 for the other three demos;
     * this workspace is on React 19, so npm nests it here. Anything that hoists
     * — Radix, TanStack Query, react-i18next, react-hook-form, cmdk, sonner —
     * would resolve `react` by walking up out of this workspace and land on 18.
     * Two React runtimes in one page means every hook throws "Invalid hook
     * call". Deduping pins them all to this workspace's copy, which is what the
     * tsconfigs already do for its types.
     */
    dedupe: [
      'react',
      'react-dom',
      'react-is',
      'scheduler',
      'react-router',
      'react-router-dom',
      'i18next',
      'react-i18next',
      '@tanstack/react-query',
      'tailwind-merge',
      'lucide-react',
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
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom'] },
      },
    },
  },
  server: {
    port: 5177,
    strictPort: true,
  },
});
