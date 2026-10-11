/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'hash' selects the hash router (forwarded by vite.config.ts). */
  readonly VITE_ROUTER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
