<script setup>
import { inject, ref } from 'vue';

const session = inject('diceSession');
const confirmWipe = ref(false);

function toggleReveal() {
  session.toggleRevealed();
}
</script>

<template>
  <section class="flex flex-1 flex-col gap-6">
    <div class="flex flex-col gap-3">
      <p class="kicker">Complete</p>
      <h1 class="text-balance text-display tracking-tight">Your mnemonic is ready</h1>
      <p class="max-w-[48ch] text-pretty text-base/7 text-base-content/70 sm:text-sm/6">
        Write it down offline, on paper or metal. Never photograph it, and never paste it into
        another application — the clipboard is readable by every program on this machine, and
        clipboard history tools keep a copy on disk.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-lg/7 font-semibold tracking-tight sm:text-base/6">Mnemonic (34 words)</h2>
        <button type="button" class="btn btn-ghost btn-sm" @click="toggleReveal">
          {{ session.state.revealed ? 'Hide' : 'Reveal' }}
        </button>
      </div>
      <div
        class="rounded-box border border-base-content/10 bg-base-200/60 p-4"
      >
        <p
          v-if="session.state.revealed"
          class="font-mono text-base/7 break-words text-base-content sm:text-sm/6"
        >
          {{ session.state.result?.phrase }}
        </p>
        <p
          v-else
          class="font-mono text-base/7 text-base-content/40 sm:text-sm/6"
        >
          •••• •••• •••• · tap Reveal when ready to write it down
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-3 border-t border-base-content/10 pt-6">
      <h2 class="text-lg/7 font-semibold tracking-tight sm:text-base/6">Extended hexseed</h2>
      <p
        v-if="session.state.revealed"
        class="rounded-box border border-base-content/10 bg-base-200/40 p-4 font-mono text-base/7 break-all text-base-content/80 sm:text-sm/6"
      >
        {{ session.state.result?.hexseed }}
      </p>
      <p
        v-else
        class="rounded-box border border-base-content/10 bg-base-200/40 p-4 font-mono text-base/7 text-base-content/40 sm:text-sm/6"
      >
        Hidden until revealed
      </p>
    </div>

    <div class="rounded-box border border-error/25 bg-error/5 p-4">
      <p class="text-base/7 text-base-content/80 sm:text-sm/6">
        When you have a durable offline backup, wipe this session. Closing the tab without wiping
        may leave data in memory until the process exits.
      </p>
      <div class="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          v-if="!confirmWipe"
          type="button"
          class="btn btn-error"
          @click="confirmWipe = true"
        >
          Wipe all data
        </button>
        <template v-else>
          <button type="button" class="btn btn-error" @click="session.wipeEverything()">
            Confirm wipe
          </button>
          <button type="button" class="btn btn-ghost" @click="confirmWipe = false">
            Keep for now
          </button>
        </template>
      </div>
    </div>
  </section>
</template>
