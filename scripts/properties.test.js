/**
 * Property tests for the entropy pipeline.
 *
 * The unit suite in `src/lib/dice.test.js` asserts known values at known
 * inputs. These assert the properties that actually define correctness for a
 * seed generator, and which an example-based test cannot see:
 *
 *   1. Word indices are uniform over [0, 4095] for every offered die size.
 *   2. Rejection rates match the theoretical (sides - 2^k) / sides.
 *   3. Every word index is reachable.
 *   4. The descriptor bytes match the QRL address format for all 18
 *      hash-function x tree-height combinations.
 *   5. buildMnemonic round-trips: indices -> hexseed -> indices.
 *   6. A completed collector always yields exactly 32 indices.
 *
 * Run with `npm run test:properties`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createEntropyCollector,
  buildMnemonic,
  descriptorWordIndices,
  bitsPerRoll,
  maxAcceptedFace,
  expectedAcceptedRolls,
  HASH_FUNCTIONS,
  TREE_HEIGHTS,
  ENTROPY_WORDS,
  ENTROPY_BITS,
  WORD_BITS,
} from '../src/lib/dice.js';

const wordlist = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/lib/words.json', import.meta.url)), 'utf8'),
);

const DIE_SIZES = [6, 8, 10, 12, 20, 32, 64, 100];
/** Sessions per die size. 1000 x 32 words = 32k samples over 4096 bins. */
const TRIALS = 1000;

/** Unbiased uniform draw in 1..n, so the harness introduces no bias itself. */
function rollDie(n) {
  const max = Math.floor(65536 / n) * n;
  for (;;) {
    const v = crypto.randomBytes(2).readUInt16BE(0);
    if (v < max) return (v % n) + 1;
  }
}

function runSessions(sides, trials) {
  const counts = new Uint32Array(4096);
  let words = 0;
  let accepted = 0;
  let rejected = 0;

  for (let t = 0; t < trials; t += 1) {
    const c = createEntropyCollector(sides);
    let acceptedThisSession = 0;
    while (!c.isComplete) {
      const r = c.addFace(rollDie(sides));
      if (r.ok) {
        accepted += 1;
        acceptedThisSession += 1;
      } else if (r.rejected) {
        rejected += 1;
      }
    }
    const indices = c.getWordIndices();
    assert.equal(indices.length, ENTROPY_WORDS, `d${sides}: expected 32 word indices`);
    assert.equal(
      acceptedThisSession,
      expectedAcceptedRolls(sides),
      `d${sides}: accepted-roll count must match expectedAcceptedRolls`,
    );
    for (const w of indices) {
      counts[w] += 1;
      words += 1;
    }
  }
  return { counts, words, accepted, rejected };
}

describe('entropy uniformity across every offered die size', () => {
  for (const sides of DIE_SIZES) {
    it(`d${sides} produces uniformly distributed word indices`, () => {
      const { counts, words, accepted, rejected } = runSessions(sides, TRIALS);

      // Chi-square against uniform over 4096 bins, normal-approximated.
      // |z| < 5 is ~1-in-3.5-million under the null, so this is a bias
      // detector, not a flaky threshold.
      const expected = words / 4096;
      let chi = 0;
      for (let i = 0; i < 4096; i += 1) {
        const d = counts[i] - expected;
        chi += (d * d) / expected;
      }
      const df = 4095;
      const z = (chi - df) / Math.sqrt(2 * df);
      assert.ok(
        Math.abs(z) < 5,
        `d${sides}: chi-square z=${z.toFixed(2)} indicates non-uniform word indices`,
      );

      // Coverage of the index space. Some bins are empty purely by chance:
      // with `words` samples over 4096 bins the expected count is
      // 4096 * e^(-words/4096) (~1.7 at 32k samples), so this cannot assert
      // zero. What it must catch is a path that constrains output to a
      // subrange — the defect in the legacy Python generator, where only 1024
      // of 4096 indices were reachable and 3072 bins would be empty.
      const emptyBins = counts.reduce((n, c) => (c === 0 ? n + 1 : n), 0);
      const expectedEmpty = 4096 * Math.exp(-words / 4096);
      const limit = Math.max(20, expectedEmpty * 4);
      assert.ok(
        emptyBins < limit,
        `d${sides}: ${emptyBins} unreachable word indices (expected ~${expectedEmpty.toFixed(1)}, ` +
          `limit ${limit.toFixed(0)}) — suggests the index space is constrained`,
      );

      // Observed rejection rate must match theory.
      const observed = rejected / (accepted + rejected);
      const theory = (sides - maxAcceptedFace(sides)) / sides;
      assert.ok(
        Math.abs(observed - theory) < 0.02,
        `d${sides}: rejection rate ${observed.toFixed(4)} != theory ${theory.toFixed(4)}`,
      );
    });
  }
});

describe('collector invariants', () => {
  it('collects exactly 384 bits regardless of die size', () => {
    for (const sides of DIE_SIZES) {
      const c = createEntropyCollector(sides);
      while (!c.isComplete) c.addFace(rollDie(sides));
      assert.equal(c.getWordIndices().length * WORD_BITS, ENTROPY_BITS, `d${sides}`);
    }
  });

  it('never advances entropy on a rejected face', () => {
    for (const sides of DIE_SIZES) {
      const maxFace = maxAcceptedFace(sides);
      if (maxFace === sides) continue; // nothing to reject on a power-of-two die
      const c = createEntropyCollector(sides);
      const before = c.bitsCollected;
      const r = c.addFace(maxFace + 1);
      assert.equal(r.ok, false, `d${sides}: face above the bound must be rejected`);
      assert.equal(c.bitsCollected, before, `d${sides}: rejected face advanced entropy`);
    }
  });

  it('rejects out-of-range and non-integer faces without advancing entropy', () => {
    const c = createEntropyCollector(100);
    for (const bad of [0, -1, 101, 1.5, Number.NaN]) {
      const before = c.bitsCollected;
      const r = c.addFace(bad);
      assert.equal(r.ok, false, `face ${bad} must not be accepted`);
      assert.equal(c.bitsCollected, before, `face ${bad} advanced entropy`);
    }
  });

  it('yields the full unbiased range for each die size', () => {
    for (const sides of DIE_SIZES) {
      const bits = bitsPerRoll(sides);
      assert.equal(maxAcceptedFace(sides), 2 ** bits, `d${sides}`);
      assert.ok(2 ** bits <= sides, `d${sides}: accepted bound exceeds the die`);
      assert.ok(2 ** (bits + 1) > sides, `d${sides}: a larger power of two would fit`);
    }
  });
});

describe('descriptor conformance to the QRL address format', () => {
  it('matches the descriptor byte layout for all 18 parameter combinations', () => {
    const entropyIndices = Array.from({ length: ENTROPY_WORDS }, () => 0);
    for (const hf of Object.values(HASH_FUNCTIONS)) {
      for (const height of TREE_HEIGHTS) {
        const built = buildMnemonic({
          wordlist,
          hashFunctionBits: hf.bits,
          treeHeight: height,
          entropyIndices,
        });
        // byte0 = sigType<<4 | hashFunction  (XMSS sigType = 0)
        // byte1 = addrFormat<<4 | height/2   (SHA256_2X addrFormat = 0)
        // byte2 = reserved, 0
        const expected =
          ((0 << 4) | hf.id).toString(16).padStart(2, '0') +
          ((0 << 4) | (height / 2)).toString(16).padStart(2, '0') +
          '00';
        assert.equal(
          built.hexseed.slice(0, 6),
          expected,
          `${hf.label} height ${height}: descriptor mismatch`,
        );
      }
    }
  });

  it('rejects unsupported tree heights and malformed hash-function bits', () => {
    for (const bad of [9, 11, 7, 20, 0, -2]) {
      assert.throws(() => descriptorWordIndices('0001', bad), /Tree height/);
    }
    for (const bad of ['', '1', '00012', 'abcd', '000x']) {
      assert.throws(() => descriptorWordIndices(bad, 10), /Hash function/);
    }
  });
});

describe('buildMnemonic round-trip', () => {
  it('hexseed decodes back to the exact word indices it was built from', () => {
    for (let t = 0; t < 200; t += 1) {
      const entropyIndices = Array.from(
        { length: ENTROPY_WORDS },
        () => crypto.randomBytes(2).readUInt16BE(0) & 0x0fff,
      );
      const built = buildMnemonic({
        wordlist,
        hashFunctionBits: HASH_FUNCTIONS.SHAKE_128.bits,
        treeHeight: 10,
        entropyIndices,
      });

      assert.equal(built.hexseed.length, 102, '51-byte extended seed');
      assert.equal(built.words.length, 34);

      // hexseed -> bit string -> 12-bit groups -> indices
      const bits = built.hexseed
        .match(/../g)
        .map((h) => parseInt(h, 16).toString(2).padStart(8, '0'))
        .join('');
      const decoded = [];
      for (let i = 0; i < bits.length; i += WORD_BITS) {
        decoded.push(parseInt(bits.slice(i, i + WORD_BITS), 2));
      }
      assert.deepEqual(decoded, built.indices, 'round-trip lost or altered an index');
      assert.deepEqual(decoded.slice(2), entropyIndices, 'entropy indices did not survive');

      // Every rendered word must be the wordlist entry for its index.
      built.indices.forEach((idx, i) => {
        assert.equal(built.words[i], wordlist[idx], `word ${i} does not match its index`);
      });
    }
  });
});

describe('bundled wordlist', () => {
  it('is exactly 4096 unique lowercase words', () => {
    assert.equal(wordlist.length, 4096);
    assert.equal(new Set(wordlist).size, 4096, 'wordlist contains duplicates');
    assert.ok(
      wordlist.every((w) => /^[a-z]+$/.test(w)),
      'wordlist contains a non-lowercase-alphabetic entry',
    );
  });
});
