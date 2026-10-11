/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `'hash'` selects the hash router (set via VITE_ROUTER at build time); anything else the browser router. */
  readonly VITE_ROUTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
