/**
 * QRL dice → mnemonic entropy helpers.
 *
 * QRL extended seed = 3-byte descriptor + 48-byte seed = 51 bytes = 408 bits
 * → 34 mnemonic words × 12 bits. Descriptor words are derived from XMSS
 * parameters (not dice). Dice supply the remaining 384 bits (32 words).
 *
 * On-wire descriptor bytes use nibble-swapped packing (see QRL address docs).
 * Word 1 / word 2 match that layout so wallets accept the phrase.
 */

export const WORD_BITS = 12;
export const DESCRIPTOR_WORDS = 2;
export const ENTROPY_WORDS = 32;
export const TOTAL_WORDS = DESCRIPTOR_WORDS + ENTROPY_WORDS; // 34
export const ENTROPY_BITS = ENTROPY_WORDS * WORD_BITS; // 384

export const HASH_FUNCTIONS = Object.freeze({
  SHA2_256: { id: 0, label: 'SHA2-256', bits: '0000' },
  SHAKE_128: { id: 1, label: 'SHAKE-128', bits: '0001', recommended: true },
  SHAKE_256: { id: 2, label: 'SHAKE-256', bits: '0010' },
});

/** Common even XMSS heights (signatures = 2^height). */
export const TREE_HEIGHTS = Object.freeze([8, 10, 12, 14, 16, 18]);

const SIG_TYPE_XMSS = '0000';
const ADDRESS_FORMAT_SHA256_2X = '0000';
const PARAMETERS_TWO = '00000000';

/**
 * Unbiased bits extractable per roll via rejection sampling.
 * Largest k such that 2^k <= sides.
 */
export function bitsPerRoll(sides) {
  if (!Number.isInteger(sides) || sides < 2) {
    throw new Error('Dice must have at least 2 sides.');
  }
  return Math.floor(Math.log2(sides));
}

/** Highest face value accepted (1-based). Faces above this are rejected. */
export function maxAcceptedFace(sides) {
  return 2 ** bitsPerRoll(sides);
}

/**
 * Map a physical face (1..sides) to an unbiased integer in [0, 2^k),
 * or null if the roll must be discarded (rejection sampling).
 */
export function faceToValue(face, sides) {
  if (!Number.isInteger(face) || face < 1 || face > sides) {
    throw new Error(`Face must be an integer from 1 to ${sides}.`);
  }
  const max = maxAcceptedFace(sides);
  if (face > max) return null;
  return face - 1;
}

/** Expected accepted rolls for 384 bits (ceil; rejections add more). */
export function expectedAcceptedRolls(sides) {
  const b = bitsPerRoll(sides);
  if (b < 1) throw new Error('Dice must yield at least 1 bit per roll.');
  return Math.ceil(ENTROPY_BITS / b);
}

/**
 * Build the two descriptor mnemonic indices for XMSS parameters.
 * Matches nibble-swapped descriptor packing used by QRL wallets.
 */
export function descriptorWordIndices(hashFunctionBits, treeHeight) {
  if (![8, 10, 12, 14, 16, 18].includes(treeHeight)) {
    throw new Error('Tree height must be an even value from 8 to 18.');
  }
  if (!/^[01]{4}$/.test(hashFunctionBits)) {
    throw new Error('Hash function must be a 4-bit string.');
  }

  const heightNibble = (treeHeight / 2).toString(2).padStart(4, '0');
  // word1 bits = SIG || HF || AF  (first 12 bits of nibble-swapped descriptor)
  const word1 = parseInt(SIG_TYPE_XMSS + hashFunctionBits + ADDRESS_FORMAT_SHA256_2X, 2);
  // word2 bits = P1 || P3
  const word2 = parseInt(heightNibble + PARAMETERS_TWO, 2);
  return [word1, word2];
}

/**
 * Assemble a 12-bit word index from unbiased roll values (0-based).
 *
 * When bitsPer divides 12 evenly, preserves the original dice.py ordering:
 * first roll becomes the low-order bits (rolls are reversed before concat).
 *
 * Otherwise uses MSB-first FIFO of the collected bits (secure & deterministic).
 */
export function rollsToWordIndex(rollValues, bitsPer) {
  if (!Number.isInteger(bitsPer) || bitsPer < 1) {
    throw new Error('bitsPer must be a positive integer.');
  }
  for (const v of rollValues) {
    if (!Number.isInteger(v) || v < 0 || v >= 2 ** bitsPer) {
      throw new Error(`Roll value out of range for ${bitsPer}-bit extraction.`);
    }
  }

  if (WORD_BITS % bitsPer === 0) {
    const needed = WORD_BITS / bitsPer;
    if (rollValues.length !== needed) {
      throw new Error(`Expected ${needed} rolls for a ${WORD_BITS}-bit word.`);
    }
    const reversed = [...rollValues].reverse();
    let bitstr = '';
    for (const r of reversed) {
      bitstr += r.toString(2).padStart(bitsPer, '0');
    }
    return parseInt(bitstr, 2);
  }

  let bitstr = '';
  for (const r of rollValues) {
    bitstr += r.toString(2).padStart(bitsPer, '0');
  }
  if (bitstr.length < WORD_BITS) {
    throw new Error('Not enough bits for a word.');
  }
  return parseInt(bitstr.slice(0, WORD_BITS), 2);
}

/**
 * Incremental collector: feed dice faces until 32 entropy words are ready.
 */
export function createEntropyCollector(sides) {
  const bitsPer = bitsPerRoll(sides);
  if (bitsPer < 1) throw new Error('Dice must yield at least 1 bit per roll.');

  const maxFace = maxAcceptedFace(sides);
  const dividesEvenly = WORD_BITS % bitsPer === 0;
  const rollsPerWord = dividesEvenly ? WORD_BITS / bitsPer : null;

  /** @type {number[]} */
  const wordIndices = [];
  /** @type {number[]} current word roll values (even-division path) */
  let pendingRolls = [];
  /** @type {number[]} bit buffer 0/1 (streaming path) */
  let bitBuffer = [];
  let accepted = 0;
  let rejected = 0;
  let totalAttempts = 0;

  /** Accepted-face histogram, 1-based faces stored at index face-1. */
  const acceptedFaceCounts = new Array(maxFace).fill(0);
  let longestRun = 0;
  let currentRun = 0;
  let lastFace = null;

  function takeWordFromBits() {
    const bits = bitBuffer.splice(0, WORD_BITS);
    const bitstr = bits.join('');
    wordIndices.push(parseInt(bitstr, 2));
  }

  return {
    sides,
    bitsPer,
    maxFace,
    get entropyWordsReady() {
      return wordIndices.length;
    },
    get bitsCollected() {
      if (dividesEvenly) {
        return wordIndices.length * WORD_BITS + pendingRolls.length * bitsPer;
      }
      return wordIndices.length * WORD_BITS + bitBuffer.length;
    },
    get bitsNeeded() {
      return ENTROPY_BITS;
    },
    get progress() {
      return Math.min(1, this.bitsCollected / ENTROPY_BITS);
    },
    get isComplete() {
      return wordIndices.length >= ENTROPY_WORDS;
    },
    get stats() {
      return { accepted, rejected, totalAttempts };
    },
    /**
     * Observed distribution of accepted faces, plus the longest run of
     * identical consecutive faces.
     *
     * This exists so the interface can show the user their own input. The
     * application cannot verify that a physical die is fair or that the
     * numbers typed were actually rolled — the user is the entropy source —
     * but presenting the distribution lets them judge it themselves rather
     * than trusting a claim the software never checks.
     */
    get faceStats() {
      return {
        counts: acceptedFaceCounts.slice(0, maxFace),
        longestRun,
        distinctFaces: acceptedFaceCounts.reduce((n, c) => (c > 0 ? n + 1 : n), 0),
      };
    },
    /** @returns {{ ok: true, rejected?: false } | { ok: false, rejected: true, reason: string } | { ok: false, error: string }} */
    addFace(face) {
      if (this.isComplete) {
        return { ok: false, error: 'Entropy collection already complete.' };
      }
      totalAttempts += 1;
      let value;
      try {
        value = faceToValue(face, sides);
      } catch (e) {
        return { ok: false, error: e.message };
      }
      if (value === null) {
        rejected += 1;
        return {
          ok: false,
          rejected: true,
          reason: `Roll ${face} is outside 1–${maxFace}. Re-roll for unbiased entropy.`,
        };
      }

      accepted += 1;
      acceptedFaceCounts[face - 1] += 1;
      currentRun = face === lastFace ? currentRun + 1 : 1;
      if (currentRun > longestRun) longestRun = currentRun;
      lastFace = face;

      if (dividesEvenly) {
        pendingRolls.push(value);
        if (pendingRolls.length === rollsPerWord) {
          wordIndices.push(rollsToWordIndex(pendingRolls, bitsPer));
          pendingRolls = [];
        }
      } else {
        for (let i = bitsPer - 1; i >= 0; i -= 1) {
          bitBuffer.push((value >> i) & 1);
        }
        while (bitBuffer.length >= WORD_BITS && wordIndices.length < ENTROPY_WORDS) {
          takeWordFromBits();
        }
      }

      return { ok: true };
    },
    /** Copy of completed entropy word indices (length 32). */
    getWordIndices() {
      if (wordIndices.length < ENTROPY_WORDS) {
        throw new Error('Entropy incomplete.');
      }
      return wordIndices.slice(0, ENTROPY_WORDS);
    },
    /** Zero pending buffers (does not clear completed words — use wipeAll). */
    wipePending() {
      pendingRolls = [];
      bitBuffer = [];
    },
    wipeAll() {
      for (let i = 0; i < wordIndices.length; i += 1) wordIndices[i] = 0;
      wordIndices.length = 0;
      pendingRolls = [];
      bitBuffer = [];
      accepted = 0;
      rejected = 0;
      totalAttempts = 0;
      // The face histogram is roll data — wipe it with everything else.
      acceptedFaceCounts.fill(0);
      longestRun = 0;
      currentRun = 0;
      lastFace = null;
    },
  };
}

/**
 * Build full 34-word mnemonic + hex extended seed.
 * @param {string[]} wordlist length 4096
 */
export function buildMnemonic({
  wordlist,
  hashFunctionBits,
  treeHeight,
  entropyIndices,
}) {
  if (!Array.isArray(wordlist) || wordlist.length !== 4096) {
    throw new Error('Wordlist must contain exactly 4096 words.');
  }
  if (!Array.isArray(entropyIndices) || entropyIndices.length !== ENTROPY_WORDS) {
    throw new Error(`Expected ${ENTROPY_WORDS} entropy word indices.`);
  }
  for (const idx of entropyIndices) {
    if (!Number.isInteger(idx) || idx < 0 || idx > 4095) {
      throw new Error('Entropy index out of range.');
    }
  }

  const [d0, d1] = descriptorWordIndices(hashFunctionBits, treeHeight);
  const indices = [d0, d1, ...entropyIndices];
  const words = indices.map((i) => wordlist[i]);
  const phrase = words.join(' ');

  // 51-byte extended seed: reconstruct bytes from 12-bit groups (big-endian bit stream)
  const bits = indices.map((i) => i.toString(2).padStart(WORD_BITS, '0')).join('');
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  const hexseed = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');

  return {
    words,
    phrase,
    indices,
    hexseed,
    descriptorIndices: [d0, d1],
  };
}

/** Overwrite string-bearing objects as best-effort (JS strings are immutable). */
export function wipeMnemonicResult(result) {
  if (!result) return;
  if (Array.isArray(result.words)) {
    for (let i = 0; i < result.words.length; i += 1) result.words[i] = '';
    result.words.length = 0;
  }
  if (Array.isArray(result.indices)) {
    for (let i = 0; i < result.indices.length; i += 1) result.indices[i] = 0;
    result.indices.length = 0;
  }
  result.phrase = '';
  result.hexseed = '';
}
