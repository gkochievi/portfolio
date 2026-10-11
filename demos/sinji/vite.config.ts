import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Sinji is a plain static bundle: the backend is an in-browser mock.
 *
 * `VITE_BASE` must match the public path the bundle is served from (the
 * router reads it back through `import.meta.env.BASE_URL`); `VITE_ROUTER=hash`
 * switches to the hash router for hosts without SPA fallback.
 */
const base = process.env.VITE_BASE ?? '/demos/sinji/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    'import.meta.env.VITE_ROUTER': JSON.stringify(process.env.VITE_ROUTER ?? 'browser'),
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
    port: 5181,
    strictPort: true,
  },
  preview: {
    port: 5181,
    strictPort: true,
  },
})
