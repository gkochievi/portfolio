import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * The demo is a plain static bundle — no Django, no API server.
 *
 * `VITE_BASE` is the one knob that matters when deploying: it must match the
 * public path the bundle is served from, because React Router reads it back
 * through `import.meta.env.BASE_URL` to set its basename. The default suits
 * the portfolio layout (`/demos/printomato/`); set `VITE_BASE=/` to serve the
 * demo at a domain root, or `VITE_ROUTER=hash` to sidestep server rewrites
 * entirely on a host that cannot do SPA fallback.
 */
const base = process.env.VITE_BASE ?? '/demos/printomato/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
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
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
})
