/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `hash` selects the hash router (set at build time). */
  readonly VITE_ROUTER?: string
  readonly VITE_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
