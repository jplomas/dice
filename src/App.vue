<script setup>
import { computed, onMounted, onUnmounted, provide } from 'vue';
import { useDiceSession } from '@/composables/useDiceSession.js';
import { useAppUpdate } from '@/composables/useAppUpdate.js';
import AppHeader from '@/components/AppHeader.vue';
import UpdateBanner from '@/components/UpdateBanner.vue';
import StepIntro from '@/components/StepIntro.vue';
import StepSetup from '@/components/StepSetup.vue';
import StepRoll from '@/components/StepRoll.vue';
import StepResult from '@/components/StepResult.vue';
import StepCleared from '@/components/StepCleared.vue';

const session = useDiceSession();
provide('diceSession', session);

const { state: updateState, checkForAppUpdate } = useAppUpdate();

const stepComponent = computed(() => {
  switch (session.state.step) {
    case 'intro':
      return StepIntro;
    case 'setup':
      return StepSetup;
    case 'roll':
      return StepRoll;
    case 'result':
      return StepResult;
    case 'cleared':
      return StepCleared;
    default:
      return StepIntro;
  }
});

function onOnline() {
  session.setOnline(true);
  checkForAppUpdate();
}
function onOffline() {
  session.setOnline(false);
}

onMounted(() => {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  session.setOnline(navigator.onLine);
});

onUnmounted(() => {
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
});
</script>

<template>
  <div class="dice-atmosphere flex min-h-dvh flex-col">
    <AppHeader class="anim-header" />
    <UpdateBanner />

    <main class="flex flex-1 flex-col py-8 sm:py-10">
      <div class="container-site flex flex-1 flex-col">
        <div
          v-if="session.state.online"
          class="mb-6 rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-base/7 text-warning sm:text-sm/6"
          role="status"
        >
          You appear to be online. The app stops contacting the server once you leave this
          screen, but for maximum safety disconnect from the network before rolling.
        </div>

        <!--
          Keyed on the step so the panel remounts and re-runs its CSS entrance
          animation — the job the GSAP step watcher used to do.
        -->
        <div :key="session.state.step" class="anim-panel flex flex-1 flex-col">
          <component :is="stepComponent" />
        </div>
      </div>
    </main>

    <footer class="border-t border-base-content/10 py-6">
      <div class="container-site flex flex-col gap-2 text-base/7 text-base-content/60 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:text-sm/6">
        <p class="shrink-0">
          <span
            class="font-mono tabular-nums"
            title="Build identity — compare against the published release hash"
            >{{ updateState.buildId || `v${updateState.version}` }}</span
          >
          ·
          <a class="link link-hover" href="https://www.theqrl.org" rel="noopener">theqrl.org</a>
          ·
          <a class="link link-hover" href="https://docs.theqrl.org" rel="noopener">docs</a>
          ·
          <a
            class="link link-hover"
            href="https://github.com/surg0r/dice"
            rel="noopener"
            target="_blank"
          >surg0r/dice · 2018</a>
        </p>
      </div>
    </footer>
  </div>
</template>
