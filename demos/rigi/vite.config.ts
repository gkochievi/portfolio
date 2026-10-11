import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Rigi is a plain static bundle: no API server, no database. Every request is
 * answered by the in-browser mock in `src/demo`.
 *
 * `VITE_BASE` must match the public path the bundle is served from; the router
 * reads it back through `import.meta.env.BASE_URL`. `VITE_ROUTER=hash` selects
 * the hash router for hosts that cannot rewrite deep links to index.html.
 */
const base = process.env.VITE_BASE ?? '/demos/rigi/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
          i18n: ['i18next', 'react-i18next'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 5180,
  },
})
