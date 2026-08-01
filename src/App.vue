<script setup>
import { computed, onMounted, onUnmounted, provide, ref, watch, nextTick } from 'vue';
import gsap from 'gsap';
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

const root = ref(null);
const panel = ref(null);
let ctx;

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

  if (!root.value) return;
  ctx = gsap.context(() => {
    gsap.from('[data-anim="header"]', {
      autoAlpha: 0,
      y: -12,
      duration: 0.55,
      ease: 'power2.out',
    });
  }, root.value);
});

onUnmounted(() => {
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  ctx?.revert();
});

watch(
  () => session.state.step,
  async () => {
    await nextTick();
    if (!panel.value) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      gsap.set(panel.value, { clearProps: 'all' });
      return;
    }
    gsap.fromTo(
      panel.value,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
        overwrite: 'auto',
        onComplete: () => {
          gsap.set(panel.value, { clearProps: 'opacity,transform' });
        },
      },
    );
  },
);
</script>

<template>
  <div ref="root" class="dice-atmosphere flex min-h-dvh flex-col">
    <AppHeader data-anim="header" />
    <UpdateBanner />

    <main class="flex flex-1 flex-col py-8 sm:py-10">
      <div class="container-site flex flex-1 flex-col">
        <div
          v-if="session.state.online"
          class="mb-6 rounded-box border border-warning/30 bg-warning/10 px-4 py-3 text-base/7 text-warning sm:text-sm/6"
          role="status"
        >
          You appear to be online. For maximum safety, disconnect from the network
          (or open a downloaded copy) before rolling.
        </div>

        <div ref="panel" class="flex flex-1 flex-col">
          <component :is="stepComponent" />
        </div>
      </div>
    </main>

    <footer class="border-t border-base-content/10 py-6">
      <div class="container-site flex flex-col gap-2 text-base/7 text-base-content/60 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:text-sm/6">
        <p class="shrink-0">
          <span class="font-mono tabular-nums" title="App version">v{{ updateState.version }}</span>
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
