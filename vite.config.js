import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const appVersion = pkg.version;
// Vite may evaluate this config more than once — reuse one id for the whole build.
process.env.DICE_BUILD_ID ||= `${appVersion}+${Date.now()}`;
const buildId = process.env.DICE_BUILD_ID;

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

writeVersionFile('public');

export default defineConfig({
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
