<script setup>
import { inject } from 'vue';

const session = inject('diceSession');
</script>

<template>
  <section class="flex flex-1 flex-col items-start gap-6 py-6">
    <div
      class="anim-pop grid size-14 place-items-center rounded-full bg-success/15 text-success"
      aria-hidden="true"
    >
      <svg class="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <div class="flex flex-col gap-3">
      <h1 class="text-balance text-display tracking-tight">Session wiped</h1>
      <p class="max-w-[42ch] text-pretty text-base/7 text-base-content/70 sm:text-sm/6">
        Rolls, mnemonic, and hexseed were cleared from this page’s memory.
      </p>
      <p
        v-if="session.state.clipboardStatus === 'failed'"
        class="max-w-[42ch] rounded-box border border-warning/25 bg-warning/10 px-3 py-2 text-pretty text-base/7 text-warning sm:text-sm/6"
        role="status"
      >
        The clipboard could not be cleared — the browser only permits this while the page is
        focused. If you copied anything by hand, clear your clipboard manually.
      </p>
      <p
        v-else-if="session.state.clipboardStatus === 'cleared'"
        class="max-w-[42ch] text-pretty text-base/7 text-base-content/70 sm:text-sm/6"
        role="status"
      >
        The clipboard was cleared.
      </p>
    </div>
    <button type="button" class="btn btn-primary btn-lg" @click="session.go('intro')">
      Start over
    </button>
  </section>
</template>
