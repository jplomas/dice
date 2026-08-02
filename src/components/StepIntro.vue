<script setup>
import { inject } from 'vue';

const session = inject('diceSession');

// True in the downloadable single-file artefact, which has no service worker
// and no network code at all — the guidance below differs accordingly.
const isOfflineBuild = __OFFLINE_BUILD__;
const RELEASES_URL = 'https://github.com/theQRL/dice/releases/latest';
</script>

<template>
  <section class="anim-stagger flex flex-1 flex-col gap-8">
    <div class="flex flex-col gap-4">
      <p class="kicker">Physical entropy · since 2018</p>
      <h1 class="max-w-[18ch] text-balance text-hero tracking-tight text-base-content">
        Roll dice. Build a QRL mnemonic.
      </h1>
      <p class="max-w-[42ch] text-pretty text-lead text-base-content/75">
        For anyone who refuses to trust a computer’s RNG. This page generates no randomness of
        its own — it only maps your rolls to the QRL wordlist. The strength of the result is the
        strength of your dice.
      </p>
    </div>

    <aside
      class="min-w-0 rounded-box border border-secondary/35 bg-secondary/10 p-4 sm:p-5"
      aria-label="Project pedigree"
    >
      <div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p class="shrink-0 font-mono text-base/6 text-secondary sm:text-sm/5">
          QRL security pedigree
        </p>
        <p class="min-w-0 text-pretty text-base/7 text-base-content sm:text-right sm:text-sm/6">
          Based on
          <a
            class="link link-secondary break-all font-semibold sm:break-normal"
            href="https://github.com/surg0r/dice"
            rel="noopener"
            target="_blank"
          >surg0r/dice</a>
          — first committed
          <time datetime="2018-03">March 2018</time>.
        </p>
      </div>
    </aside>

    <ul class="flex flex-col gap-4" role="list">
      <li class="flex gap-3 border-t border-base-content/10 pt-4">
        <span class="font-mono text-base/7 text-secondary tabular-nums sm:text-sm/6">01</span>
        <div class="min-w-0">
          <h2 class="text-lg/7 font-semibold tracking-tight sm:text-base/6">Stay offline</h2>
          <p v-if="isOfflineBuild" class="mt-1 text-base/7 text-base-content/70 sm:text-sm/6">
            You are running the downloaded offline copy. It contains no network code at all —
            no updates, no service worker, nothing to phone home. Disconnect and roll.
          </p>
          <p v-else class="mt-1 text-base/7 text-base-content/70 sm:text-sm/6">
            Prefer airplane mode after the first visit (the app caches for offline use). For a
            stronger guarantee, download the
            <a
              class="link link-secondary font-medium"
              :href="RELEASES_URL"
              rel="noopener"
              target="_blank"
              >single-file offline release</a
            >
            — one HTML file with everything inlined, published with a SHA-256 you can verify
            against a signed tag.
          </p>
        </div>
      </li>
      <li class="flex gap-3 border-t border-base-content/10 pt-4">
        <span class="font-mono text-base/7 text-secondary tabular-nums sm:text-sm/6">02</span>
        <div class="min-w-0">
          <h2 class="text-lg/7 font-semibold tracking-tight sm:text-base/6">Reject biased rolls</h2>
          <p class="mt-1 text-base/7 text-base-content/70 sm:text-sm/6">
            Only faces in a power-of-two range are kept (e.g. 1–64 on a d100). Higher faces are discarded so entropy stays uniform.
          </p>
        </div>
      </li>
      <li class="flex gap-3 border-t border-base-content/10 pt-4">
        <span class="font-mono text-base/7 text-secondary tabular-nums sm:text-sm/6">03</span>
        <div class="min-w-0">
          <h2 class="text-lg/7 font-semibold tracking-tight sm:text-base/6">Wipe when finished</h2>
          <p class="mt-1 text-base/7 text-base-content/70 sm:text-sm/6">
            Nothing is written to disk, and the phrase is never copied to your clipboard. Use Wipe
            to clear rolls, mnemonic, and hexseed from this session.
          </p>
        </div>
      </li>
    </ul>

    <div class="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
      <button type="button" class="btn btn-primary btn-lg" @click="session.go('setup')">
        Configure dice
      </button>
      <p class="text-base/7 text-base-content/55 sm:text-sm/6">
        34-word QRL phrase · 384 bits from dice · descriptor from your XMSS settings
      </p>
    </div>
  </section>
</template>
