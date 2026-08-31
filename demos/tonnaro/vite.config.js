import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The demo is a plain static bundle — no Django, no API server.
 *
 * `VITE_BASE` is the one knob that matters when deploying: it must match the
 * public path the bundle is served from, because React Router reads it back
 * through `import.meta.env.BASE_URL` to set its basename. The default suits
 * the portfolio layout (`/demos/tonnaro/`); set `VITE_BASE=/` to serve the
 * demo at a domain root, or `VITE_ROUTER=hash` to sidestep server rewrites
 * entirely on a host that cannot do SPA fallback.
 */
const base = process.env.VITE_BASE ?? '/demos/tonnaro/'

export default defineConfig({
  base,

  // Upstream is a Create React App project, so every component lives in a
  // `.js` file with JSX inside it. Teaching Vite to read those is what lets
  // the 70 files be copied across untouched — the alternative was renaming
  // them all to `.jsx`, which would have made every future diff against the
  // real project useless.
  //
  // Two settings are needed; the plugin alone is not enough. Vite's own
  // esbuild pass transforms `.js` with the plain-JS loader before Babel ever
  // sees the file, and chokes on the first tag. `esbuild.include` overrides
  // that for this project's sources only, so node_modules keeps the fast path.
  plugins: [react({ include: /\.(js|jsx)$/ })],

  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },

  optimizeDeps: {
    // Dependency pre-bundling runs esbuild separately and needs telling twice.
    esbuildOptions: { loader: { '.js': 'jsx' } },
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  define: {
    __DEMO_ROUTER__: JSON.stringify(process.env.VITE_ROUTER ?? 'browser'),
    // CRA read these off `process.env` at build time and Vite has no such
    // global. Defining them here keeps `contexts/NotificationContext.js`
    // byte-identical to upstream instead of forking it over one line.
    'process.env.REACT_APP_NOTIFICATION_POLL_MS': JSON.stringify('20000'),
    'process.env.REACT_APP_API_URL': JSON.stringify('/api'),
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
          antd: ['antd', '@ant-design/icons'],
          map: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
        },
      },
    },
  },

  server: {
    port: 5175,
    strictPort: true,
  },
})
