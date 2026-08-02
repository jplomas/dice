# QRL Dice Mnemonic

Offline dice-to-mnemonic generator for [The Quantum Resistant Ledger](https://www.theqrl.org).

**Production URL:** [https://dice.theqrl.org](https://dice.theqrl.org)

Based on [surg0r/dice](https://github.com/surg0r/dice) (first commit March 2018).

Physical dice supply entropy for a 34-word QRL mnemonic. The first two words encode XMSS parameters (hash function + tree height). The remaining 32 words (384 bits) come from your rolls.

## Security model

What the app guarantees:

- Fully client-side (Vue SPA). Entropy never leaves the browser.
- **No network contact during a session.** Update checks are suspended from the moment you leave the intro screen until the session is wiped. Nothing is requested from the origin while you are configuring, rolling, or viewing a result.
- **The phrase is never written to the clipboard.** There is no copy button, by design: the OS clipboard is readable by every process on the machine, and clipboard-history tools retain a copy on disk. Write the phrase down.
- Rejection sampling: only faces in `1 … 2^⌊log₂(sides)⌋` are accepted (e.g. 1–64 on a d100) so bit extraction stays unbiased.
- No `localStorage` / `sessionStorage` / `indexedDB` / cookies. Nothing is written to disk.
- The wordlist is bundled into the application, not fetched at runtime, so it is covered by the same content hash as the rest of the build.
- Wipe clears in-memory rolls, phrase, and hexseed, and reports honestly whether it was also able to clear the clipboard.
- Service worker caches the app for true offline use after first visit.
- Strict CSP and hardening headers, declared in `netlify.toml`.

What it does **not** guarantee:

- **It cannot tell whether your dice are fair, or whether you actually rolled them.** You are the entropy source. The roll step shows a live distribution of your accepted faces so you can judge your own input, but a made-up sequence will still produce a valid-looking phrase — one that is far easier to guess than it appears. Roll honestly; the strength of the result is the strength of your dice.
- **It cannot prove to you that the code you are running is the code we published.** Compare the build identity in the footer against the release notes. See [Verifying a build](#verifying-a-build).

### Logic fixes vs the legacy Python script

| Issue | Legacy `dice.py` | This app |
| --- | --- | --- |
| `bits_per_roll` not dividing 12 (e.g. d32 → 5 bits) | Python 2 truncating `12/5 → 2` under-collected entropy | Bit-buffer collects a full 384 bits |
| Python 2 only | `raw_input`, integer `/` | Modern JS with tests |
| Roll count docs | README said 64; some docs said 68 | 64 **accepted** d100 rolls for entropy (descriptor words are not rolled) |

## Develop

Requires Node 22 (see `.nvmrc`); `engine-strict` is on, so older versions fail fast
rather than with a confusing syntax error.

```bash
npm ci
npm run dev
npm test              # unit tests
npm run test:properties   # entropy uniformity, descriptor conformance, round-trip
npm run build
```

`npm run test:properties` is the one that guards the entropy path. It checks that
word indices are uniform across every offered die size, that observed rejection
rates match theory, that the index space is not constrained, that the descriptor
bytes match the QRL address format for all 18 parameter combinations, and that
`buildMnemonic` round-trips. Both suites run in CI on every push.

## Offline release

Each tagged release publishes a **single self-contained HTML file** —
`qrl-dice-<version>-offline.html` — on the
[releases page](https://github.com/theQRL/dice/releases/latest). Code, styles,
fonts, the logo and the 4096-word list are all inlined. It loads no external
resources and contains no network code at all: no update checks, no service
worker, no storage. Verified in CI on every push by `npm run check:offline`.

```bash
# 1. Download the file and its hash from the releases page, then:
#    (on macOS without sha256sum, use: shasum -a 256 ...)
sha256sum -c qrl-dice-<version>-offline.html.sha256

# 2. Confirm the same hash against the signed tag — not against the website,
#    which is the thing this artefact exists to avoid trusting.
git verify-tag v<version>
git show v<version>
```

Then copy it to the machine you will generate on, **disconnect that machine**,
and open the file in a browser. No server, no install, no unzip.

Build it yourself — the build is reproducible, so the same commit yields a
byte-identical file:

```bash
git checkout v<version>
npm ci && npm run build:offline
sha256sum dist-offline/index.html   # or: shasum -a 256 dist-offline/index.html
```

## Verifying a build

The footer shows a build identity of the form `<version>+<commit>`. It is derived
from the commit, not a timestamp, so the same source always produces the same
artefact. To check that the deployed app matches the published source:

```bash
git checkout <commit-from-footer>
npm ci && npm run build
find dist -type f -exec sha256sum {} + | sort -k2   # macOS: shasum -a 256
```

Compare against the hashes in the corresponding release notes.

## Deploy (Netlify)

`netlify.toml` is configured for `dice.theqrl.org`:

- Build: `npm run build`
- Publish: `dist`
- SPA fallback + security headers

Point the Netlify site’s custom domain to `dice.theqrl.org` and enable HTTPS.

## Recommended use (paranoid)

1. Visit once online so the PWA caches assets, **or** download the `dist` folder and
   open `index.html` directly — asset paths are relative and the wordlist is bundled,
   so it runs from the filesystem with no server.
2. Disconnect from the network (airplane mode / unplug).
3. Use a high-sided die (d100 recommended).
4. **Actually roll the dice.** Every shortcut you take comes straight off the strength
   of the key. Watch the distribution readout on the roll screen.
5. Record the mnemonic on paper/metal offline. Do not photograph it, and do not paste
   it anywhere — there is no copy button for this reason.
6. Tap **Wipe all data** before reconnecting or closing the session.

## Stack

Vue 3 · Vite 7 · Tailwind CSS 4 · DaisyUI 5 (Quantum Dawn theme from theqrl.org) · GSAP
