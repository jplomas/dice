import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bitsPerRoll,
  maxAcceptedFace,
  faceToValue,
  expectedAcceptedRolls,
  descriptorWordIndices,
  rollsToWordIndex,
  createEntropyCollector,
  buildMnemonic,
  HASH_FUNCTIONS,
  ENTROPY_BITS,
  ENTROPY_WORDS,
} from './dice.js';

describe('bitsPerRoll / rejection bounds', () => {
  it('matches dice.py for common polyhedral dice', () => {
    assert.equal(bitsPerRoll(2), 1);
    assert.equal(bitsPerRoll(6), 2);
    assert.equal(bitsPerRoll(8), 3);
    assert.equal(bitsPerRoll(10), 3);
    assert.equal(bitsPerRoll(12), 3);
    assert.equal(bitsPerRoll(20), 4);
    assert.equal(bitsPerRoll(32), 5);
    assert.equal(bitsPerRoll(64), 6);
    assert.equal(bitsPerRoll(100), 6);
  });

  it('sets max accepted face to largest power of two <= sides', () => {
    assert.equal(maxAcceptedFace(100), 64);
    assert.equal(maxAcceptedFace(6), 4);
    assert.equal(maxAcceptedFace(20), 16);
    assert.equal(maxAcceptedFace(64), 64);
  });

  it('rejects faces above the power-of-two bound', () => {
    assert.equal(faceToValue(64, 100), 63);
    assert.equal(faceToValue(65, 100), null);
    assert.equal(faceToValue(1, 100), 0);
  });

  it('expects 64 accepted rolls for a d100 (6 bits × 64 = 384)', () => {
    assert.equal(expectedAcceptedRolls(100), 64);
    assert.equal(expectedAcceptedRolls(100) * bitsPerRoll(100), ENTROPY_BITS);
  });
});

describe('descriptor words (nibble-swapped XMSS layout)', () => {
  it('encodes SHAKE-128 + height 10 as indices 16 and 1280', () => {
    const [w1, w2] = descriptorWordIndices(HASH_FUNCTIONS.SHAKE_128.bits, 10);
    assert.equal(w1, 16);
    assert.equal(w2, 1280);
  });

  it('encodes SHA2-256 + height 10 as indices 0 and 1280', () => {
    const [w1, w2] = descriptorWordIndices(HASH_FUNCTIONS.SHA2_256.bits, 10);
    assert.equal(w1, 0);
    assert.equal(w2, 1280);
  });

  it('encodes SHAKE-128 + height 14 as indices 16 and 1792', () => {
    const [w1, w2] = descriptorWordIndices(HASH_FUNCTIONS.SHAKE_128.bits, 14);
    assert.equal(w1, 16);
    assert.equal(w2, 1792);
  });
});

describe('rollsToWordIndex (dice.py-compatible ordering)', () => {
  it('places the first roll in the low-order bits when bits divide 12', () => {
    // 6-bit rolls: values 1 and 2 → after reverse concat = bits(2)||bits(1)
    // = 000010 000001 = 129
    assert.equal(rollsToWordIndex([1, 2], 6), 0b000010000001);
    assert.equal(rollsToWordIndex([0, 0], 6), 0);
    assert.equal(rollsToWordIndex([63, 63], 6), 4095);
  });
});

describe('entropy collector', () => {
  it('completes 32 words from 64 accepted d100 rolls', () => {
    const c = createEntropyCollector(100);
    for (let i = 0; i < 64; i += 1) {
      const r = c.addFace((i % 64) + 1);
      assert.equal(r.ok, true);
    }
    assert.equal(c.isComplete, true);
    assert.equal(c.getWordIndices().length, ENTROPY_WORDS);
  });

  it('rejects out-of-range faces without advancing entropy', () => {
    const c = createEntropyCollector(100);
    const before = c.bitsCollected;
    const r = c.addFace(100);
    assert.equal(r.ok, false);
    assert.equal(r.rejected, true);
    assert.equal(c.bitsCollected, before);
  });

  it('collects full entropy when bitsPer does not divide 12 (d32)', () => {
    // 5 bits/roll → 384/5 = 76.8 → 77 accepted rolls
    const c = createEntropyCollector(32);
    let i = 0;
    while (!c.isComplete) {
      const face = (i % 32) + 1;
      c.addFace(face);
      i += 1;
      assert.ok(i < 200, 'collector should finish');
    }
    assert.equal(c.getWordIndices().length, ENTROPY_WORDS);
    assert.equal(expectedAcceptedRolls(32), 77);
  });
});

describe('buildMnemonic', () => {
  it('produces 34 words and a 102-char hexseed', () => {
    const wordlist = Array.from({ length: 4096 }, (_, i) => `w${i}`);
    const entropyIndices = Array.from({ length: 32 }, (_, i) => i);
    const result = buildMnemonic({
      wordlist,
      hashFunctionBits: HASH_FUNCTIONS.SHAKE_128.bits,
      treeHeight: 10,
      entropyIndices,
    });
    assert.equal(result.words.length, 34);
    assert.equal(result.words[0], 'w16');
    assert.equal(result.words[1], 'w1280');
    assert.equal(result.hexseed.length, 102);
    assert.match(result.hexseed, /^[0-9a-f]+$/);
  });
});
