/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAY_API: string;
  readonly VITE_RELAY_WS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
