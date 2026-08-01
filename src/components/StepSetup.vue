<script setup>
import { computed, inject } from 'vue';
import { bitsPerRoll, maxAcceptedFace, expectedAcceptedRolls } from '@/lib/dice.js';

const session = inject('diceSession');

const sidesOptions = [6, 8, 10, 12, 20, 32, 64, 100];

const preview = computed(() => {
  const sides = session.state.sides;
  try {
    return {
      bits: bitsPerRoll(sides),
      maxFace: maxAcceptedFace(sides),
      rolls: expectedAcceptedRolls(sides),
    };
  } catch {
    return null;
  }
});

async function begin() {
  await session.startRolling();
}
</script>

<template>
  <section class="flex flex-1 flex-col gap-8">
    <div class="flex flex-col gap-3">
      <p class="kicker">Setup</p>
      <h1 class="text-balance text-display tracking-tight">Dice and XMSS parameters</h1>
      <p class="max-w-[48ch] text-pretty text-base/7 text-base-content/70 sm:text-sm/6">
        Choose your die and the wallet parameters encoded in the first two mnemonic words.
      </p>
    </div>

    <form class="flex flex-col gap-6" @submit.prevent="begin">
      <div class="flex flex-col gap-2">
        <label for="sides" class="text-base/7 font-medium sm:text-sm/6">Dice sides</label>
        <div class="inline-grid grid-cols-[1fr_--spacing(8)]">
          <select
            id="sides"
            name="sides"
            class="select select-bordered col-span-full row-start-1 w-full appearance-none pr-8 text-base/7 max-sm:text-base/7 sm:text-sm/6"
            :value="session.state.sides"
            @change="session.setSides(Number($event.target.value))"
          >
            <option v-for="n in sidesOptions" :key="n" :value="n">{{ n }}-sided</option>
          </select>
          <svg
            viewBox="0 0 8 5"
            width="8"
            height="5"
            fill="none"
            class="pointer-events-none col-start-2 row-start-1 place-self-center"
            aria-hidden="true"
          >
            <path d="M.5.5 4 4 7.5.5" stroke="currentColor" />
          </svg>
        </div>
        <p v-if="preview" class="text-base/7 text-base-content/60 sm:text-sm/6">
          {{ preview.bits }} bits per accepted roll · use faces
          <span class="tabular-nums">1–{{ preview.maxFace }}</span>
          · about
          <span class="tabular-nums">{{ preview.rolls }}</span>
          accepted rolls
        </p>
      </div>

      <fieldset class="flex flex-col gap-3">
        <legend class="text-base/7 font-medium sm:text-sm/6">Hash function</legend>
        <div class="flex flex-col gap-2">
          <label
            v-for="(hf, key) in session.HASH_FUNCTIONS"
            :key="key"
            class="flex cursor-pointer items-center gap-3 rounded-box border border-base-content/10 px-3 py-3 has-checked:border-primary/50 has-checked:bg-primary/5"
          >
            <span class="group inline-grid size-5 grid-cols-1 sm:size-4">
              <input
                type="radio"
                class="col-start-1 row-start-1 appearance-none rounded-full border border-base-content/30 bg-base-100 checked:border-primary checked:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                name="hashFunction"
                :value="key"
                :checked="session.state.hashKey === key"
                @change="session.setHashKey(key)"
              />
              <span
                class="pointer-events-none col-start-1 row-start-1 size-[round(down,40%,1px)] self-center justify-self-center rounded-full bg-primary-content group-not-has-checked:opacity-0"
              />
            </span>
            <span class="min-w-0">
              <span class="block text-base/6 font-medium sm:text-sm/5">{{ hf.label }}</span>
              <span v-if="hf.recommended" class="block text-base/6 text-base-content/55 sm:text-sm/5">
                QRL wallet default
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div class="flex flex-col gap-2">
        <label for="height" class="text-base/7 font-medium sm:text-sm/6">XMSS tree height</label>
        <div class="inline-grid grid-cols-[1fr_--spacing(8)]">
          <select
            id="height"
            name="height"
            class="select select-bordered col-span-full row-start-1 w-full appearance-none pr-8 text-base/7 sm:text-sm/6"
            :value="session.state.treeHeight"
            @change="session.setTreeHeight(Number($event.target.value))"
          >
            <option v-for="h in session.TREE_HEIGHTS" :key="h" :value="h">
              Height {{ h }} · {{ (2 ** h).toLocaleString() }} signatures
            </option>
          </select>
          <svg
            viewBox="0 0 8 5"
            width="8"
            height="5"
            fill="none"
            class="pointer-events-none col-start-2 row-start-1 place-self-center"
            aria-hidden="true"
          >
            <path d="M.5.5 4 4 7.5.5" stroke="currentColor" />
          </svg>
        </div>
      </div>

      <p
        v-if="session.state.lastError"
        class="text-base/7 text-error sm:text-sm/6"
        role="alert"
      >
        {{ session.state.lastError }}
      </p>

      <div class="mt-2 flex flex-col gap-3 sm:flex-row">
        <button type="submit" class="btn btn-primary btn-lg">Start rolling</button>
        <button type="button" class="btn btn-ghost btn-lg" @click="session.go('intro')">
          Back
        </button>
      </div>
    </form>
  </section>
</template>
