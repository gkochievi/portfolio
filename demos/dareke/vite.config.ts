import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dareke is a plain static bundle: no API server, no network at runtime.
 *
 * `VITE_BASE` must match the public path the bundle is served from (the
 * router derives its basename from `import.meta.env.BASE_URL`).
 * `VITE_ROUTER=hash` switches to the hash router for hosts without SPA
 * fallback; it is forwarded explicitly so a shell variable works too.
 */
const base = process.env.VITE_BASE ?? '/demos/dareke/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VITE_ROUTER': JSON.stringify(process.env.VITE_ROUTER ?? ''),
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
          charts: ['recharts'],
        },
      },
    },
  },
  server: {
    port: 5182,
    strictPort: true,
  },
  preview: {
    port: 5182,
    strictPort: true,
  },
})
