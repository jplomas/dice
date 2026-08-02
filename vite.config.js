import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const appVersion = pkg.version;

/**
 * Build identity, derived from the commit rather than the clock so that the
 * same source produces the same artefact. A timestamp here would make every
 * build unique and defeat any published-hash verification.
 * `COMMIT_REF` is provided by the deploy platform; git is the local fallback.
 */
function resolveCommit() {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

const buildId = `${appVersion}+${resolveCommit()}`;

function writeVersionFile(outDir = 'public') {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, 'version.json'),
    `${JSON.stringify(
      {
        version: appVersion,
        buildId,
      },
      null,
      2,
    )}\n`,
  );
}

export default defineConfig({
  // Relative asset paths so a downloaded copy works over file://, which is
  // the offline workflow the README documents.
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    vue(),
    {
      name: 'dice-version-file',
      buildStart() {
        writeVersionFile('public');
      },
      closeBundle() {
        writeVersionFile('dist');
      },
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // No `includeAssets`: the globPatterns below already match every icon
      // and font, and listing them twice only duplicates precache entries.
      manifest: {
        name: 'QRL Dice Mnemonic',
        short_name: 'QRL Dice',
        description:
          'Generate a QRL mnemonic offline from physical dice rolls.',
        theme_color: '#0a1720',
        background_color: '#0a1720',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        // The wordlist is bundled into the JS chunk, so it needs no entry here.
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        globIgnores: ['**/version.json'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
