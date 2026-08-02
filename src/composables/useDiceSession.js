import { reactive, ref } from 'vue';
// Bundled, not fetched: `fetch` is unavailable on the file: scheme, so a
// runtime fetch would break offline use from a downloaded copy. Bundling also
// brings the wordlist under the same content hash as the rest of the build.
import wordlist from '@/lib/words.json';
import { setUpdateChecksSuspended } from '@/composables/useAppUpdate.js';
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
/** Steps during which the app must not contact the origin. */
const SENSITIVE_STEPS = ['setup', 'roll', 'result'];

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
    // 'unknown' until a wipe attempts a clear; then 'cleared' or 'failed'.
    // Never claim the clipboard is clean without having confirmed it.
    clipboardStatus: 'unknown',
    // Mirrored from collector — plain object mutations aren't Vue-reactive.
    bitsCollected: 0,
    bitsNeeded: 384,
    bitsPer: 6,
    maxFace: 64,
    acceptedCount: 0,
    rejectedCount: 0,
    faceCounts: [],
    longestRun: 0,
    distinctFaces: 0,
  };
}

const state = reactive(blankState());
const wipeToken = ref(0);

let beforeUnloadHandler = null;

function detachBeforeUnload() {
  if (beforeUnloadHandler) {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    beforeUnloadHandler = null;
  }
}

/** True while the session holds anything a reload would destroy. */
function hasUnsavedSession() {
  if (state.step === 'result') return Boolean(state.result);
  if (state.step === 'roll') return state.bitsCollected > 0;
  return false;
}

function attachBeforeUnload() {
  if (beforeUnloadHandler) return;
  beforeUnloadHandler = (e) => {
    if (hasUnsavedSession()) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);
}

export function useDiceSession() {
  function loadWordlist() {
    if (state.wordlist) return state.wordlist;
    // Shape check only. Content integrity comes from the bundle hash, not
    // from anything checkable here — a 4096-entry list of wrong words would
    // pass any test this function could perform.
    if (!Array.isArray(wordlist) || wordlist.length !== 4096) {
      throw new Error(`Wordlist must contain exactly 4096 words, got ${wordlist?.length}.`);
    }
    state.wordlist = Object.freeze(wordlist);
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
    // No origin contact from the moment the user starts configuring a wallet
    // until the session is cleared. `cleared` is safe again — the secrets are
    // already gone by the time that step is reached.
    setUpdateChecksSuspended(SENSITIVE_STEPS.includes(step));
  }

  function syncCollectorProgress() {
    const c = state.collector;
    if (!c) {
      state.bitsCollected = 0;
      state.acceptedCount = 0;
      state.rejectedCount = 0;
      state.faceCounts = [];
      state.longestRun = 0;
      state.distinctFaces = 0;
      return;
    }
    state.bitsCollected = c.bitsCollected;
    state.bitsNeeded = c.bitsNeeded;
    state.bitsPer = c.bitsPer;
    state.maxFace = c.maxFace;
    state.acceptedCount = c.stats.accepted;
    state.rejectedCount = c.stats.rejected;
    const f = c.faceStats;
    state.faceCounts = f.counts;
    state.longestRun = f.longestRun;
    state.distinctFaces = f.distinctFaces;
  }

  function startRolling() {
    state.lastError = '';
    try {
      loadWordlist();
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
    // Guard from the first accepted roll, not from completion — the rolling
    // step is the long one, and losing it silently is what drives users to
    // shortcut the retry.
    if (state.bitsCollected > 0) attachBeforeUnload();
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

  /**
   * Best-effort clipboard clear. The app never writes seed material to the
   * clipboard itself, but the user may have selected and copied it manually.
   *
   * `writeText` requires the document to be focused and rejects with
   * NotAllowedError otherwise, so the outcome is reported rather than
   * assumed — the UI must not claim a clear that did not happen.
   */
  async function clearClipboard() {
    if (!navigator.clipboard?.writeText) {
      state.clipboardStatus = 'failed';
      return false;
    }
    try {
      await navigator.clipboard.writeText('');
      state.clipboardStatus = 'cleared';
      return true;
    } catch {
      state.clipboardStatus = 'failed';
      return false;
    }
  }

  async function wipeEverything() {
    // Wipe in-memory state first and unconditionally; the clipboard attempt
    // must never be able to delay or skip it.
    wipeSessionState();
    await clearClipboard();
  }

  function wipeSessionState() {
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

  async function resetToIntro() {
    await wipeEverything();
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
    clearClipboard,
    wipeEverything,
    resetToIntro,
    setOnline,
    setSides,
    setHashKey,
    setTreeHeight,
    toggleRevealed,
  };
}
