/// <reference types="vite/client" />
/// <reference path="../../../preload/index.d.ts" />

interface ImportMetaEnv {
  readonly VITE_META_APP_ID?: string;
  readonly VITE_META_EMBEDDED_CONFIG_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
