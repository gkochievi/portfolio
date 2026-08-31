import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The portfolio shell is a plain static bundle — no backend, same as the demos.
 *
 * `VITE_BASE` is the main deploy-time knob: React Router reads it back through
 * `import.meta.env.BASE_URL` for its basename, and every demo link is resolved
 * against it, so the whole site relocates by changing this one variable.
 *
 * `VITE_ROUTER=hash` is the second: it moves every route behind a `#` so a host
 * that cannot rewrite unmatched paths still serves deep links. build-all.mjs
 * passes it to the demos as well, and both apps have to honour it — a site on
 * the browser router next to a demo on the hash router would 404 on every case
 * study.
 */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  define: {
    __SITE_ROUTER__: JSON.stringify(process.env.VITE_ROUTER ?? 'browser'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
