<script setup>
import { computed, inject, onMounted, ref } from 'vue';

const session = inject('diceSession');
const menuOpen = ref(false);
const isLight = ref(false);

function syncTheme() {
  isLight.value = document.documentElement.getAttribute('data-theme') === 'qrl-dawn-light';
}

function toggleTheme() {
  const next = isLight.value ? 'qrl-dawn' : 'qrl-dawn-light';
  document.documentElement.setAttribute('data-theme', next);
  syncTheme();
}

function wipe() {
  menuOpen.value = false;
  if (session.state.result || session.state.collector) {
    session.wipeEverything();
  }
}

const canWipe = computed(
  () => Boolean(session.state.result || session.state.collector),
);

onMounted(syncTheme);
</script>

<template>
  <header class="border-b border-base-content/10">
    <div class="container-site flex h-14 items-center justify-between gap-3 sm:h-16">
      <a href="/" class="flex min-w-0 items-center gap-2.5" aria-label="Homepage">
        <img
          src="/qrl-logo.svg"
          alt=""
          width="96"
          height="32"
          class="h-7 w-auto shrink-0 sm:h-8"
        />
        <span class="min-w-0">
          <span class="block truncate font-display text-base/5 font-semibold tracking-tight sm:text-lg/6">
            Dice Mnemonic
          </span>
          <span class="block truncate font-mono text-base/4 text-base-content/50 sm:text-xs/4">
            dice.theqrl.org
          </span>
        </span>
      </a>

      <div class="flex shrink-0 items-center gap-1">
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square relative"
          :aria-label="isLight ? 'Switch to dark theme' : 'Switch to light theme'"
          :aria-pressed="isLight"
          @click="toggleTheme"
        >
          <span
            class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
            aria-hidden="true"
          />
          <!-- sun = switch to light (shown in dark); moon = switch to dark (shown in light) -->
          <svg
            v-show="!isLight"
            class="size-5 sm:size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
              stroke-linecap="round"
            />
          </svg>
          <svg
            v-show="isLight"
            class="size-5 sm:size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <path
              d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-sm relative text-error"
          :class="canWipe ? '' : 'btn-disabled'"
          :disabled="!canWipe"
          aria-label="Wipe data"
          @click="wipe"
        >
          <span
            class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden lg:hidden"
            aria-hidden="true"
          />
          <svg
            class="size-5 shrink-0 sm:size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <path
              d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="hidden lg:inline">Wipe data</span>
        </button>
      </div>
    </div>
  </header>
</template>
