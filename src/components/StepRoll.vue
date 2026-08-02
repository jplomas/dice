<script setup>
import { computed, inject, nextTick, ref } from 'vue';

const session = inject('diceSession');
const input = ref('');
const inputEl = ref(null);

const sides = computed(() => session.state.sides);
const maxFace = computed(() => session.state.maxFace);
const bitsPer = computed(() => session.state.bitsPer);
const progressPct = computed(() => {
  const needed = session.state.bitsNeeded || 1;
  return Math.min(100, Math.round((session.state.bitsCollected / needed) * 100));
});
const bitsLabel = computed(
  () => `${session.state.bitsCollected} / ${session.state.bitsNeeded} bits`,
);

function appendDigit(d) {
  if (input.value.length >= 3) return;
  input.value += String(d);
}

function backspace() {
  input.value = input.value.slice(0, -1);
}

function clearInput() {
  input.value = '';
}

function commit() {
  const n = Number(input.value);
  if (!Number.isInteger(n) || input.value === '') {
    return;
  }
  session.submitFace(n);
  input.value = '';
  nextTick(() => inputEl.value?.focus());
}

function onKeypad(e) {
  if (e.key >= '0' && e.key <= '9') {
    e.preventDefault();
    appendDigit(e.key);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    backspace();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    commit();
  }
}

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clr', '0', 'ok'];

/**
 * Face-distribution readout. This is deliberately informational: the app
 * cannot know whether a die is fair or whether the numbers were really
 * rolled, and silently rejecting "suspicious" input would itself introduce
 * bias. Showing the user their own distribution lets them judge it.
 */
const faceCounts = computed(() => session.state.faceCounts ?? []);
const peakCount = computed(() => Math.max(1, ...faceCounts.value));
const showDistribution = computed(() => session.state.acceptedCount >= 8);

/** Fires only on patterns no plausible fair sequence produces. */
const runWarning = computed(() => {
  const run = session.state.longestRun;
  return run >= 6
    ? `The same face was entered ${run} times in a row. If those were not real rolls, wipe and start again.`
    : '';
});
</script>

<template>
  <section class="flex flex-1 flex-col gap-6" @keydown="onKeypad">
    <div class="flex flex-col gap-3">
      <p class="kicker">Rolling</p>
      <h1 class="text-balance text-display tracking-tight">Enter each roll</h1>
      <p class="text-pretty text-base/7 text-base-content/70 sm:text-sm/6">
        d{{ sides }} · accepted faces
        <span class="tabular-nums font-medium text-base-content">1–{{ maxFace }}</span>
        · {{ bitsPer }} bits each
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-base/7 font-medium tabular-nums sm:text-sm/6">{{ bitsLabel }}</p>
        <p class="text-base/7 tabular-nums text-base-content/55 sm:text-sm/6">
          {{ progressPct }}%
        </p>
      </div>
      <div
        class="h-2 overflow-hidden rounded-full bg-base-300"
        role="progressbar"
        :aria-valuenow="progressPct"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          class="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          :style="{ width: progressPct + '%' }"
        />
      </div>
      <p class="text-base/7 text-base-content/55 sm:text-sm/6">
        Accepted
        <span class="tabular-nums">{{ session.state.acceptedCount }}</span>
        · rejected
        <span class="tabular-nums">{{ session.state.rejectedCount }}</span>
        <template v-if="showDistribution">
          · <span class="tabular-nums">{{ session.state.distinctFaces }}</span>/{{ maxFace }} faces
          seen
        </template>
      </p>

      <!--
        Your rolls, as the app sees them. The app cannot verify that a die is
        fair — this is here so the user can check their own entropy rather
        than take the result on trust.
      -->
      <figure v-if="showDistribution" class="mt-1 flex flex-col gap-1.5">
        <div
          class="flex h-8 items-end gap-px"
          role="img"
          :aria-label="`Distribution of ${session.state.acceptedCount} accepted rolls across faces 1 to ${maxFace}; ${session.state.distinctFaces} distinct faces seen`"
        >
          <span
            v-for="(count, i) in faceCounts"
            :key="i"
            class="min-h-px flex-1 rounded-t-[1px] bg-secondary/50"
            :style="{ height: `${Math.round((count / peakCount) * 100)}%` }"
            :title="`Face ${i + 1}: ${count}`"
          />
        </div>
        <figcaption class="text-base/6 text-base-content/45 sm:text-xs/5">
          Your roll distribution. It will look uneven until you are most of the way through —
          that is normal.
        </figcaption>
      </figure>
    </div>

    <div class="flex flex-col gap-3">
      <label for="roll" class="sr-only">Dice face value</label>
      <input
        id="roll"
        ref="inputEl"
        v-model="input"
        name="roll"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        class="input input-bordered w-full text-center font-mono text-3xl/10 tabular-nums tracking-widest max-sm:text-3xl/10"
        :placeholder="`1–${maxFace}`"
        maxlength="3"
        @keydown.enter.prevent="commit"
      />

      <div class="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
        <button
          v-for="k in keys"
          :key="k"
          type="button"
          class="roll-key"
          @click="
            k === 'clr' ? clearInput() : k === 'ok' ? commit() : appendDigit(k)
          "
        >
          <span
            class="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
            aria-hidden="true"
          />
          <span v-if="k === 'clr'" class="text-base/6 sm:text-sm/5">Clear</span>
          <span v-else-if="k === 'ok'" class="text-primary">Enter</span>
          <span v-else>{{ k }}</span>
        </button>
      </div>
    </div>

    <p
      v-if="runWarning"
      class="rounded-box border border-warning/25 bg-warning/10 px-3 py-2 text-base/7 text-warning sm:text-sm/6"
      role="status"
    >
      {{ runWarning }}
    </p>
    <p
      v-if="session.state.lastMessage"
      class="rounded-box border border-warning/25 bg-warning/10 px-3 py-2 text-base/7 text-warning sm:text-sm/6"
      role="status"
    >
      {{ session.state.lastMessage }}
    </p>
    <p
      v-if="session.state.lastError"
      class="text-base/7 text-error sm:text-sm/6"
      role="alert"
    >
      {{ session.state.lastError }}
    </p>

    <div class="mt-auto flex flex-col gap-3 pt-2 sm:flex-row">
      <button type="button" class="btn btn-ghost" @click="session.wipeEverything()">
        Cancel and wipe
      </button>
    </div>
  </section>
</template>
