/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __OFFLINE_BUILD__: boolean;
declare const __APP_BUILD_ID__: string;

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisteredSW?: (
      swScriptUrl: string,
      registration: ServiceWorkerRegistration | undefined,
    ) => void | Promise<void>;
    onRegisterError?: (error: unknown) => void;
  }

  export function registerSW(
    options?: RegisterSWOptions,
  ): (reloadPage?: boolean) => Promise<void>;
}
