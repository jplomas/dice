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

/**
 * Collapses the build into one self-contained HTML file for the offline
 * release: the JS chunk and stylesheet are inlined, icon and manifest links
 * are dropped, and an inline SVG favicon is substituted. Combined with
 * `assetsInlineLimit: Infinity`, fonts and the logo arrive as data URIs, so
 * the result has no external references of any kind.
 *
 * Written here rather than pulled from a plugin because this code assembles
 * the artefact users are told to trust — one fewer third-party maintainer in
 * that path is worth ~40 lines.
 */
function inlineSingleFile() {
  return {
    name: 'dice-inline-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlEntry = Object.values(bundle).find((f) => f.fileName.endsWith('.html'));
      if (!htmlEntry) return;
      let html = htmlEntry.source;

      const drop = [];
      for (const [key, file] of Object.entries(bundle)) {
        if (file === htmlEntry) continue;
        const name = file.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        if (file.type === 'chunk' && file.fileName.endsWith('.js')) {
          const tag = new RegExp(`<script[^>]*src="[^"]*${name}"[^>]*>\\s*</script>`);
          if (!tag.test(html)) continue;
          // Replacer is a function, not a string: minified JS routinely
          // contains $&, $' and $` which a string replacement would expand.
          html = html.replace(tag, () => `<script type="module">\n${file.code}\n</script>`);
          drop.push(key);
        } else if (file.fileName.endsWith('.css')) {
          const tag = new RegExp(`<link[^>]*href="[^"]*${name}"[^>]*>`);
          if (!tag.test(html)) continue;
          html = html.replace(tag, () => `<style>\n${file.source}\n</style>`);
          drop.push(key);
        }
      }

      // Strip references to files that will not exist beside a lone .html,
      // and inline the SVG favicon so the tab icon still works.
      html = html.replace(/<link[^>]*rel="(?:icon|apple-touch-icon|manifest)"[^>]*>\s*/g, '');
      const favicon = readFileSync(resolve('public/favicon.svg'), 'utf8');
      html = html.replace(
        '</head>',
        () =>
          `<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}">\n</head>`,
      );

      for (const key of drop) delete bundle[key];
      htmlEntry.source = html;
    },
  };
}

export default defineConfig(({ mode }) => {
  // `vite build --mode offline` produces the downloadable single-file
  // artefact: no service worker, no update polling, no external references.
  const offline = mode === 'offline';

  return {
    // Relative asset paths so a downloaded copy works over file://, which is
    // the offline workflow the README documents.
    base: './',
    // Public assets are loose files; a single-file artefact cannot use them.
    publicDir: offline ? false : 'public',
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD_ID__: JSON.stringify(buildId),
      __OFFLINE_BUILD__: JSON.stringify(offline),
    },
    build: {
      outDir: offline ? 'dist-offline' : 'dist',
      // Inline every referenced asset (fonts, logo) as a data URI.
      assetsInlineLimit: offline ? Number.MAX_SAFE_INTEGER : 4096,
      cssCodeSplit: !offline,
      // The modulepreload polyfill iterates preload links and fetch()es them.
      // A single file has no such links, so it is dead code — but it is the
      // only `fetch` left in the artefact, and "contains no fetch" should be
      // checkable by grep rather than by reading the loop.
      modulePreload: offline ? false : { polyfill: true },
      // One chunk, so there is a single script tag to inline.
      rollupOptions: offline ? { output: { inlineDynamicImports: true } } : {},
    },
    plugins: [
      vue(),
      ...(offline
        ? [inlineSingleFile()]
        : [
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
              // No `includeAssets`: the globPatterns below already match every
              // icon, and listing them twice only duplicates precache entries.
              manifest: {
                name: 'QRL Dice Mnemonic',
                short_name: 'QRL Dice',
                description: 'Generate a QRL mnemonic offline from physical dice rolls.',
                theme_color: '#0a1720',
                background_color: '#0a1720',
                display: 'standalone',
                start_url: '/',
                icons: [
                  { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
                  { src: 'favicon-32x32.png', sizes: '32x32', type: 'image/png' },
                ],
              },
              workbox: {
                // The wordlist is bundled into the JS chunk, so it needs no
                // entry here.
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
          ]),
    ],
    resolve: {
      // Array form: aliases are matched in order and the first hit wins, so
      // the specific entry must precede the '@' prefix that would swallow it.
      alias: [
        // Swap the update/service-worker module for an inert stub so the
        // offline artefact contains no network code at all.
        ...(offline
          ? [
              {
                find: '@/composables/useAppUpdate.js',
                replacement: fileURLToPath(
                  new URL('./src/composables/useAppUpdate.offline.js', import.meta.url),
                ),
              },
            ]
          : []),
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      ],
    },
  };
});
