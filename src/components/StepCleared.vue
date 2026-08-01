<script setup>
import { inject, onMounted, ref } from 'vue';
import gsap from 'gsap';

const session = inject('diceSession');
const el = ref(null);

onMounted(() => {
  if (!el.value) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.from(el.value.querySelector('[data-check]'), {
    scale: 0.6,
    autoAlpha: 0,
    duration: 0.5,
    ease: 'back.out(1.6)',
  });
});
</script>

<template>
  <section ref="el" class="flex flex-1 flex-col items-start gap-6 py-6">
    <div
      data-check
      class="grid size-14 place-items-center rounded-full bg-success/15 text-success"
      aria-hidden="true"
    >
      <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="flex flex-col gap-3">
      <h1 class="text-balance text-display tracking-tight">Session wiped</h1>
      <p class="max-w-[42ch] text-pretty text-base/7 text-base-content/70 sm:text-sm/6">
        Rolls, mnemonic, and hexseed were cleared from this page’s memory. Clipboard was cleared when permitted.
      </p>
    </div>
    <button type="button" class="btn btn-primary btn-lg" @click="session.go('intro')">
      Start over
    </button>
  </section>
</template>
