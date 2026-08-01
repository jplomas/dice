<script setup>
import { inject, onMounted, onUnmounted, ref } from 'vue';
import gsap from 'gsap';

const session = inject('diceSession');
const el = ref(null);
let ctx;

onMounted(() => {
  if (!el.value) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  ctx = gsap.context(() => {
    gsap.from('[data-stagger]', {
      opacity: 0,
      y: 12,
      duration: 0.45,
      stagger: 0.07,
      ease: 'power2.out',
      clearProps: 'opacity,transform',
    });
  }, el.value);
});

onUnmounted(() => {
  ctx?.revert();
});
</script>

<template>
  <section ref="el" class="flex flex-1 flex-col gap-8">
    <div class="flex flex-col gap-4">
      <p data-stagger class="kicker">Physical entropy · since 2018</p>
      <h1 data-stagger class="max-w-[18ch] text-balance text-hero tracking-tight text-base-content">
        Roll dice. Build a QRL mnemonic.
      </h1>
      <p data-stagger class="max-w-[42ch] text-pretty text-lead text-base-content/75">
        For anyone who refuses to trust a computer’s RNG. Every entropy bit comes from your dice;
        this page only maps rolls to the QRL wordlist.
      </p>
    </div>

    <aside
      data-stagger
      class="rounded-box border border-secondary/35 bg-secondary/10 px-4 py-4 sm:px-5 sm:py-5"
      aria-label="Project pedigree"
    >
      <p class="font-mono text-base/6 text-secondary sm:text-sm/5">QRL security pedigree</p>
      <p class="mt-2 max-w-[52ch] text-pretty text-base/7 text-base-content sm:text-sm/6">
        Based on
        <a
          class="link link-secondary font-semibold"
          href="https://github.com/surg0r/dice"
          rel="noopener"
          target="_blank"
        >surg0r/dice</a>
        — first committed
        <time datetime="2018-03">March 2018</time>.
        Polyhedral dice entropy for QRL wallets, years before Coldcard-style “roll your own seed”
        went mainstream.
      </p>
    </aside>

    <ul data-stagger class="flex flex-col gap-4" role="list">
      <li class="flex gap-3 border-t border-base-content/10 pt-4">
        <span class="font-mono text-base/7 text-secondary tabular-nums sm:text-sm/6">01</span>
        <div class="min-w-0">
          <h2 class="text-lg/7 font-semibold tracking-tight sm:text-base/6">Stay offline</h2>
          <p class="mt-1 text-base/7 text-base-content/70 sm:text-sm/6">
            Prefer airplane mode, or download this site and open it from disk with no network.
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
            Nothing is written to disk. Use Wipe to clear rolls, mnemonic, and clipboard residue from this session.
          </p>
        </div>
      </li>
    </ul>

    <div data-stagger class="mt-auto flex flex-col gap-3 pt-4 sm:flex-row sm:items-center">
      <button type="button" class="btn btn-primary btn-lg" @click="session.go('setup')">
        Configure dice
      </button>
      <p class="text-base/7 text-base-content/55 sm:text-sm/6">
        34-word QRL phrase · 384 bits from dice · descriptor from your XMSS settings
      </p>
    </div>
  </section>
</template>
