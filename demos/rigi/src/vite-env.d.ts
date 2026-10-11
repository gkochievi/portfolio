/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `hash` selects the hash router; anything else the browser router. */
  readonly VITE_ROUTER?: string
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
