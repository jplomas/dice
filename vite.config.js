import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const buildTime = new Date().toISOString();
const appVersion = pkg.version;

function writeVersionFile(outDir = 'public') {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    resolve(outDir, 'version.json'),
    `${JSON.stringify(
      {
        version: appVersion,
        builtAt: buildTime,
      },
      null,
      2,
    )}\n`,
  );
}

writeVersionFile('public');

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_BUILT_AT__: JSON.stringify(buildTime),
  },
  plugins: [
    vue(),
    {
      name: 'dice-version-file',
      buildStart() {
        writeVersionFile('public');
      },
      closeBundle() {
        // Ensure dist has a fresh copy even if workbox already ran.
        writeVersionFile('dist');
      },
    },
    VitePWA({
      registerType: 'prompt',
      // Registered manually in useAppUpdate so we can drive reload UI.
      injectRegister: false,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'favicon-16x16.png',
        'favicon-32x32.png',
        'apple-touch-icon.png',
        'fonts/*.woff2',
      ],
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
        // Do not precache version.json — it must be fetched from the network.
        globPatterns: [
          '**/*.{js,css,html,ico,svg,png,woff2}',
          'words.json',
        ],
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
