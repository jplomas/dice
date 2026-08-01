<script setup>
import { computed, inject } from 'vue';
import { useAppUpdate } from '@/composables/useAppUpdate.js';

const session = inject('diceSession', null);
const { state, applyAppUpdate } = useAppUpdate();

const sensitive = computed(() => {
  const step = session?.state?.step;
  return step === 'roll' || step === 'result';
});

const versionDiffers = computed(
  () =>
    Boolean(state.remoteVersion) &&
    state.remoteVersion !== state.version,
);

function reloadNow() {
  applyAppUpdate();
}
</script>

<template>
  <div
    v-if="state.needRefresh"
    class="border-b border-secondary/40 bg-secondary/15"
    role="status"
  >
    <div
      class="container-site flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="min-w-0 text-base/7 text-base-content sm:text-sm/6">
        <span class="font-semibold text-secondary">Update available.</span>
        <template v-if="versionDiffers">
          Version
          <span class="font-mono tabular-nums">{{ state.remoteVersion }}</span>
          is ready (you have
          <span class="font-mono tabular-nums">{{ state.version }}</span>).
        </template>
        <template v-else>
          A newer build is ready — refresh to update.
        </template>
        <span v-if="sensitive" class="block text-base-content/70 sm:inline sm:before:content-['_|_']">
          Finish or wipe this session before reloading.
        </span>
      </p>
      <button
        type="button"
        class="btn btn-secondary btn-sm shrink-0"
        :disabled="sensitive"
        :title="sensitive ? 'Wipe or finish first to avoid losing rolls' : 'Reload with the new version'"
        @click="reloadNow"
      >
        Refresh app
      </button>
    </div>
  </div>
</template>
