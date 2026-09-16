/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_AUTH_BYPASS?: string;
  readonly DEV_AUTH_BYPASS?: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
