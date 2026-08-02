/**
 * Drives a complete dice session through the real UI.
 *
 * The first rolls go through the on-screen keypad and the text input so the
 * actual input paths are exercised; the remainder are entered via the input
 * for speed. A test that stubbed the collector directly would pass even if
 * the input handling broke, which is the failure this is meant to catch.
 */
import { expect } from '@playwright/test';

/** Accepted faces for the default d100 are 1..64. */
const MAX_FACE = 64;
const ACCEPTED_ROLLS_NEEDED = 64;

export async function startRolling(page) {
  await page.getByRole('button', { name: 'Configure dice' }).click();
  await expect(page.getByRole('heading', { name: /Dice and XMSS parameters/i })).toBeVisible();
  await page.getByRole('button', { name: 'Start rolling' }).click();
  await expect(page.getByRole('heading', { name: /Enter each roll/i })).toBeVisible();
}

/** Enter one face using the on-screen number pad. */
async function rollViaKeypad(page, face) {
  for (const digit of String(face)) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Enter', exact: true }).click();
}

/** Enter one face using the text field and the keyboard. */
async function rollViaInput(page, face) {
  await page.locator('#roll').fill(String(face));
  await page.locator('#roll').press('Enter');
}

/**
 * Complete a full 384-bit session. Returns the accepted-roll count actually
 * submitted, so callers can assert it matches expectation.
 */
export async function completeSession(page) {
  await startRolling(page);

  // Exercise the keypad path first.
  await rollViaKeypad(page, 7);
  await rollViaKeypad(page, 42);

  // Exercise rejection: a face above the power-of-two bound must be discarded.
  await rollViaInput(page, 88);
  await expect(page.getByText(/Re-roll for unbiased entropy/i)).toBeVisible();
  await expect(page.getByText(/rejected\s*1/i)).toBeVisible();

  // Remainder through the text input.
  for (let i = 2; i < ACCEPTED_ROLLS_NEEDED; i += 1) {
    await rollViaInput(page, (i % MAX_FACE) + 1);
  }

  await expect(page.getByRole('heading', { name: /Your mnemonic is ready/i })).toBeVisible({
    timeout: 15_000,
  });
  return ACCEPTED_ROLLS_NEEDED;
}

/** Reveal and return { phrase, hexseed } from the result screen. */
export async function revealResult(page) {
  await page.getByRole('button', { name: 'Reveal' }).click();
  const phrase = (await page.locator('p.font-mono').first().innerText()).trim();
  const hexseed = (await page.locator('p.break-all').first().innerText()).trim();
  return { phrase, hexseed };
}
