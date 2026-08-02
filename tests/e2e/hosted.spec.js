/**
 * The hosted build, served under the real production headers parsed out of
 * `netlify.toml`.
 *
 * Two invariants that regress silently:
 *  - the app runs cleanly under the deployed CSP (which no longer allows
 *    'unsafe-inline' styles), and
 *  - it stops contacting the origin once a seed session begins.
 */
import { test, expect } from '@playwright/test';
import { serveWithProductionHeaders } from './helpers/serve.js';
import { startRolling, completeSession } from './helpers/session.js';

let server;

test.beforeAll(async () => {
  server = await serveWithProductionHeaders('dist');
});

test.afterAll(async () => {
  await server?.close();
});

test.describe('hosted build under production headers', () => {
  test('the parsed policy is the strict one we expect', () => {
    const csp = server.headers['Content-Security-Policy'];
    // Guards against the parser silently matching an empty or stale block.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-inline');
    expect(server.headers['Strict-Transport-Security']).toContain('max-age=');
  });

  test('produces zero CSP violations through a full session', async ({ page }) => {
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push(`${e.violatedDirective} :: ${e.blockedURI}`);
      });
    });

    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(server.url);
    await completeSession(page);

    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('stops contacting the origin once the session leaves the intro step', async ({ page }) => {
    const versionPolls = [];
    page.on('request', (r) => {
      if (r.url().includes('version.json')) versionPolls.push(r.url());
    });

    await page.goto(server.url);
    // A poll on load, at the intro step, is expected and permitted.
    await page.waitForLoadState('networkidle');
    const pollsAtIntro = versionPolls.length;

    await startRolling(page);

    // Fire every trigger that would normally cause a check. None may reach
    // the origin now that the session has begun.
    for (let i = 0; i < 5; i += 1) {
      await page.evaluate(() => {
        window.dispatchEvent(new Event('online'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }
    await page.locator('#roll').fill('12');
    await page.locator('#roll').press('Enter');
    await page.waitForTimeout(500);

    expect(versionPolls.length).toBe(pollsAtIntro);
  });

  test('offers no way to copy the phrase to the clipboard', async ({ page }) => {
    await page.goto(server.url);
    await completeSession(page);

    const copyish = await page
      .getByRole('button')
      .filter({ hasText: /copy/i })
      .count();
    expect(copyish).toBe(0);
  });
});
