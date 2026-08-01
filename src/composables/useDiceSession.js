import { reactive, ref } from 'vue';
import {
  HASH_FUNCTIONS,
  TREE_HEIGHTS,
  bitsPerRoll,
  maxAcceptedFace,
  expectedAcceptedRolls,
  createEntropyCollector,
  buildMnemonic,
  wipeMnemonicResult,
} from '@/lib/dice.js';

const STEPS = ['intro', 'setup', 'roll', 'result', 'cleared'];

function blankState() {
  return {
    step: 'intro',
    sides: 100,
    hashKey: 'SHAKE_128',
    treeHeight: 10,
    wordlist: null,
    collector: null,
    result: null,
    lastMessage: '',
    lastError: '',
    revealed: false,
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    // Mirrored from collector — plain object mutations aren't Vue-reactive.
    bitsCollected: 0,
    bitsNeeded: 384,
    bitsPer: 6,
    maxFace: 64,
    acceptedCount: 0,
    rejectedCount: 0,
  };
}

const state = reactive(blankState());
const wipeToken = ref(0);

let clipboardClearTimer = null;
let beforeUnloadHandler = null;

function detachBeforeUnload() {
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
}

function attachBeforeUnload() {
  detachBeforeUnload();
  beforeUnloadHandler = (e) => {
    if (state.result && state.step === 'result') {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);
}

export function useDiceSession() {
  async function loadWordlist() {
    if (state.wordlist) return state.wordlist;
    const res = await fetch('/words.json', { cache: 'force-cache' });
    if (!res.ok) throw new Error('Failed to load wordlist.');
    const words = await res.json();
    if (!Array.isArray(words) || words.length !== 4096) {
      throw new Error('Wordlist integrity check failed.');
    }
    state.wordlist = Object.freeze(words);
    return state.wordlist;
  }

  function setupSummary() {
    const sides = state.sides;
    return {
      sides,
      bitsPer: bitsPerRoll(sides),
      maxFace: maxAcceptedFace(sides),
      expectedRolls: expectedAcceptedRolls(sides),
      hashLabel: HASH_FUNCTIONS[state.hashKey].label,
      treeHeight: state.treeHeight,
      signatures: 2 ** state.treeHeight,
    };
  }

  function go(step) {
    if (!STEPS.includes(step)) return;
    state.step = step;
    state.lastError = '';
    state.lastMessage = '';
  }

  function syncCollectorProgress() {
    const c = state.collector;
    if (!c) {
      state.bitsCollected = 0;
      state.acceptedCount = 0;
      state.rejectedCount = 0;
      return;
    }
    state.bitsCollected = c.bitsCollected;
    state.bitsNeeded = c.bitsNeeded;
    state.bitsPer = c.bitsPer;
    state.maxFace = c.maxFace;
    state.acceptedCount = c.stats.accepted;
    state.rejectedCount = c.stats.rejected;
  }

  async function startRolling() {
    state.lastError = '';
    try {
      await loadWordlist();
    } catch (e) {
      state.lastError = e.message;
      return false;
    }
    if (state.collector) state.collector.wipeAll();
    state.collector = createEntropyCollector(state.sides);
    wipeMnemonicResult(state.result);
    state.result = null;
    state.revealed = false;
    syncCollectorProgress();
    go('roll');
    return true;
  }

  function submitFace(face) {
    if (!state.collector || state.step !== 'roll') return;
    state.lastError = '';
    state.lastMessage = '';
    const outcome = state.collector.addFace(face);
    syncCollectorProgress();
    if (!outcome.ok) {
      if (outcome.rejected) {
        state.lastMessage = outcome.reason;
      } else {
        state.lastError = outcome.error || 'Invalid roll.';
      }
      return outcome;
    }
    if (state.collector.isComplete) {
      finishMnemonic();
    }
    return outcome;
  }

  function finishMnemonic() {
    const hashBits = HASH_FUNCTIONS[state.hashKey].bits;
    const entropyIndices = state.collector.getWordIndices();
    const built = buildMnemonic({
      wordlist: state.wordlist,
      hashFunctionBits: hashBits,
      treeHeight: state.treeHeight,
      entropyIndices,
    });
    state.result = built;
    state.revealed = false;
    attachBeforeUnload();
    go('result');
  }

  function clearClipboardSoon() {
    if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
    clipboardClearTimer = setTimeout(async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText('');
        }
      } catch {
        /* ignore — permission or insecure context */
      }
    }, 60_000);
  }

  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    clearClipboardSoon();
  }

  function wipeEverything() {
    if (clipboardClearTimer) {
      clearTimeout(clipboardClearTimer);
      clipboardClearTimer = null;
    }
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText('');
    } catch {
      /* ignore */
    }
    if (state.collector) {
      state.collector.wipeAll();
      state.collector = null;
    }
    wipeMnemonicResult(state.result);
    state.result = null;
    state.revealed = false;
    state.lastMessage = '';
    state.lastError = '';
    state.bitsCollected = 0;
    state.acceptedCount = 0;
    state.rejectedCount = 0;
    detachBeforeUnload();
    wipeToken.value += 1;
    go('cleared');
  }

  function resetToIntro() {
    wipeEverything();
    go('intro');
  }

  function setOnline(v) {
    state.online = v;
  }

  function setSides(sides) {
    state.sides = sides;
  }

  function setHashKey(hashKey) {
    state.hashKey = hashKey;
  }

  function setTreeHeight(treeHeight) {
    state.treeHeight = treeHeight;
  }

  function toggleRevealed() {
    state.revealed = !state.revealed;
  }

  return {
    state,
    wipeToken,
    HASH_FUNCTIONS,
    TREE_HEIGHTS,
    STEPS,
    loadWordlist,
    setupSummary,
    go,
    startRolling,
    submitFace,
    copyText,
    wipeEverything,
    resetToIntro,
    setOnline,
    setSides,
    setHashKey,
    setTreeHeight,
    toggleRevealed,
  };
}
