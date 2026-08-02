/**
 * The downloadable offline artefact, exercised the way a user runs it:
 * opened straight off the filesystem with no server.
 *
 * `npm run check:offline` already proves the file is *structurally*
 * self-contained. These tests prove it actually runs — a file can contain no
 * external references and still be broken.
 */
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { completeSession, revealResult } from './helpers/session.js';

const ARTEFACT = pathToFileURL(resolve('dist-offline/index.html')).href;

test.describe('offline artefact over file://', () => {
  test('mounts, styles and loads its inlined fonts', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(ARTEFACT);

    // Vue mounted.
    const appLength = await page.evaluate(() => document.querySelector('#app').innerHTML.length);
    expect(appLength).toBeGreaterThan(1000);

    await expect(page.getByRole('heading', { name: /Roll dice\. Build a QRL mnemonic\./ })).toBeVisible();

    // Inlined stylesheet applied.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(10, 23, 32)');

    // All three fonts resolved from data URIs.
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return { size: document.fonts.size, status: document.fonts.status };
    });
    expect(fonts.size).toBe(3);
    expect(fonts.status).toBe('loaded');

    // The inlined logo decoded.
    const logo = await page.evaluate(() => {
      const img = document.querySelector('header img');
      return { isData: img?.src.startsWith('data:') ?? false, width: img?.naturalWidth ?? 0 };
    });
    expect(logo.isData).toBe(true);
    expect(logo.width).toBeGreaterThan(0);

    expect(errors).toEqual([]);
  });

  test('makes no network request, even while generating a mnemonic', async ({ page }) => {
    const offOrigin = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) offOrigin.push(r.url());
    });

    await page.goto(ARTEFACT);
    await completeSession(page);

    expect(offOrigin).toEqual([]);

    // Corroborate from inside the page: no subresource loads at all.
    const resources = await page.evaluate(
      () => performance.getEntriesByType('resource').map((e) => e.name).length,
    );
    expect(resources).toBe(0);
  });

  test('generates a well-formed 34-word mnemonic offline', async ({ page }) => {
    await page.goto(ARTEFACT);
    await completeSession(page);

    const { phrase, hexseed } = await revealResult(page);

    expect(phrase.split(/\s+/)).toHaveLength(34);
    // 51 bytes: 3-byte descriptor + 48-byte seed.
    expect(hexseed).toMatch(/^[0-9a-f]{102}$/);
    // SHAKE-128 (0x01) + height 10 (0x05) + reserved (0x00).
    expect(hexseed.slice(0, 6)).toBe('010500');
  });

  test('registers no service worker and shows no update banner', async ({ page }) => {
    await page.goto(ARTEFACT);

    // On a file:// origin the Service Worker API exists but is unusable and
    // getRegistrations() throws InvalidStateError. Either outcome proves the
    // point: no worker can be registered from the offline artefact.
    const registrations = await page.evaluate(async () => {
      if (!navigator.serviceWorker) return 0;
      try {
        return (await navigator.serviceWorker.getRegistrations()).length;
      } catch {
        return 0;
      }
    });
    expect(registrations).toBe(0);
    await expect(page.getByText(/Update available/i)).toHaveCount(0);
  });

  test('shows the offline guidance, not the hosted download prompt', async ({ page }) => {
    await page.goto(ARTEFACT);
    await expect(page.getByText(/You are running the downloaded offline copy/i)).toBeVisible();
    await expect(page.getByText(/single-file offline release/i)).toHaveCount(0);
  });
});
