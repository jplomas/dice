import { reactive, readonly } from 'vue';
import { registerSW } from 'virtual:pwa-register';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const state = reactive({
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
  builtAt: typeof __APP_BUILT_AT__ !== 'undefined' ? __APP_BUILT_AT__ : '',
  remoteVersion: null,
  needRefresh: false,
  offlineReady: false,
  checking: false,
  lastCheckedAt: null,
  error: '',
});

let applyUpdateFn = null;
let registrationRef = null;
let started = false;
let checkTimer = null;

function markNeedRefresh(remoteVersion) {
  if (remoteVersion) state.remoteVersion = remoteVersion;
  state.needRefresh = true;
}

async function fetchRemoteVersion() {
  const res = await fetch(`/version.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`version.json ${res.status}`);
  return res.json();
}

/**
 * Compare remote version.json to the running build.
 * Also asks the service worker to check for updates.
 */
export async function checkForAppUpdate() {
  if (typeof window === 'undefined') return false;
  if (!navigator.onLine) return false;

  state.checking = true;
  state.error = '';
  try {
    const remote = await fetchRemoteVersion();
    state.remoteVersion = remote.version ?? null;
    state.lastCheckedAt = new Date().toISOString();

    const versionChanged =
      Boolean(remote.version) && remote.version !== state.version;
    const buildChanged =
      Boolean(remote.builtAt) &&
      Boolean(state.builtAt) &&
      remote.builtAt !== state.builtAt;

    if (versionChanged || buildChanged) {
      markNeedRefresh(remote.version);
    }

    if (registrationRef) {
      await registrationRef.update();
    }

    return state.needRefresh;
  } catch (e) {
    state.error = e?.message || 'Update check failed.';
    return false;
  } finally {
    state.checking = false;
  }
}

/** Activate waiting service worker and reload into the new build. */
export function applyAppUpdate() {
  if (applyUpdateFn) {
    applyUpdateFn(true);
    return;
  }
  // Fallback if SW callback missing: hard reload after unregister attempt.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      await Promise.all(regs.map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      window.location.reload();
    });
  } else {
    window.location.reload();
  }
}

export function startAppUpdateWatcher() {
  if (started || typeof window === 'undefined') return;
  started = true;

  applyUpdateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      markNeedRefresh(state.remoteVersion);
    },
    onOfflineReady() {
      state.offlineReady = true;
    },
    async onRegisteredSW(_url, registration) {
      registrationRef = registration || null;
      await checkForAppUpdate();
      if (checkTimer) clearInterval(checkTimer);
      checkTimer = setInterval(() => {
        if (navigator.onLine) checkForAppUpdate();
      }, CHECK_INTERVAL_MS);
    },
  });

  window.addEventListener('online', () => {
    checkForAppUpdate();
  });

  // Visibility change: re-check when user returns to the tab.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) {
      checkForAppUpdate();
    }
  });
}

export function useAppUpdate() {
  return {
    state: readonly(state),
    checkForAppUpdate,
    applyAppUpdate,
    startAppUpdateWatcher,
  };
}
