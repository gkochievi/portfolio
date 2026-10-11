import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Tova is a plain static bundle: no API server, no network at runtime.
 *
 * `VITE_BASE` must match the public path the bundle is served from (the
 * portfolio build passes `<site base>demos/tova/`). `VITE_ROUTER=hash` swaps
 * in the hash router for hosts without SPA fallback; it is read back in
 * `src/main.tsx` through `import.meta.env.VITE_ROUTER`.
 */
const base = process.env.VITE_BASE ?? '/demos/tova/'

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
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
  server: {
    port: 5178,
    strictPort: true,
  },
})
