<script setup>
import { inject, ref } from 'vue';

const session = inject('diceSession');
const copied = ref('');
const confirmWipe = ref(false);

async function copy(kind) {
  const result = session.state.result;
  if (!result) return;
  const text = kind === 'mnemonic' ? result.phrase : result.hexseed;
  try {
    await session.copyText(text);
    copied.value = kind;
    setTimeout(() => {
      if (copied.value === kind) copied.value = '';
    }, 2500);
  } catch {
    copied.value = '';
  }
}

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
        Write it down offline. Never photograph it. Clipboard copies are cleared after 60 seconds when the browser allows.
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
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="!session.state.revealed"
          @click="copy('mnemonic')"
        >
          {{ copied === 'mnemonic' ? 'Copied' : 'Copy mnemonic' }}
        </button>
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
      <button
        type="button"
        class="btn btn-ghost btn-sm self-start"
        :disabled="!session.state.revealed"
        @click="copy('hexseed')"
      >
        {{ copied === 'hexseed' ? 'Copied' : 'Copy hexseed' }}
      </button>
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
