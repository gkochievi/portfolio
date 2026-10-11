/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `'hash'` selects the hash router (set through `VITE_ROUTER` at build time). */
  readonly VITE_ROUTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
