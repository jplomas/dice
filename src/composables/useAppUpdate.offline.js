/**
 * Offline-build replacement for `useAppUpdate.js`.
 *
 * The downloadable artefact has no origin to poll and no service worker to
 * register. Rather than ship the real module and rely on a guard to keep it
 * dormant, the offline build aliases it to this file so the network code is
 * not present at all — "this file opens no connections" is then verifiable by
 * grep instead of by reasoning about reachability.
 *
 * The exported surface matches the real module exactly; every function is a
 * no-op.
 */
import { readonly, reactive } from 'vue';

const state = reactive({
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0',
  buildId: typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '',
  remoteVersion: null,
  remoteBuildId: null,
  // Never true: without an update check there is nothing to refresh, so the
  // update banner never renders.
  needRefresh: false,
  offlineReady: true,
  checking: false,
  lastCheckedAt: null,
  error: '',
});

export async function checkForAppUpdate() {
  return false;
}

export function applyAppUpdate() {}

export function startAppUpdateWatcher() {}

export function setUpdateChecksSuspended() {}

export function useAppUpdate() {
  return {
    state: readonly(state),
    checkForAppUpdate,
    applyAppUpdate,
    startAppUpdateWatcher,
    setUpdateChecksSuspended,
  };
}
