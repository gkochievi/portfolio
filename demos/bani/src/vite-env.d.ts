/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'hash' selects the hash router (hosts without SPA fallback). */
  readonly VITE_ROUTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
