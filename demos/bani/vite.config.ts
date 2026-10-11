import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A plain static bundle: no API server, the mock lives in the browser.
 *
 * `VITE_BASE` must match the public path the bundle is served from (the router
 * reads it back through `import.meta.env.BASE_URL`). `VITE_ROUTER=hash` switches
 * to the hash router for hosts without SPA fallback; Vite exposes it to the app
 * as `import.meta.env.VITE_ROUTER`.
 */
const base = process.env.VITE_BASE ?? '/demos/bani/'

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
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|@remix-run|scheduler)[\\/]/.test(id)) return 'vendor'
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return 'charts'
          return undefined
        },
      },
    },
  },
  server: {
    port: 5179,
    strictPort: true,
  },
})
