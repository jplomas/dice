# QRL Dice Mnemonic

Offline dice-to-mnemonic generator for [The Quantum Resistant Ledger](https://www.theqrl.org).

**Production URL:** [https://dice.theqrl.org](https://dice.theqrl.org)

Based on [surg0r/dice](https://github.com/surg0r/dice) (first commit March 2018) — polyhedral dice entropy for QRL mnemonics, well before Coldcard-style “roll your own seed” became mainstream.

Physical dice supply entropy for a 34-word QRL mnemonic. The first two words encode XMSS parameters (hash function + tree height). The remaining 32 words (384 bits) come from your rolls.

## Security model

- Fully client-side (Vue SPA). Entropy never leaves the browser.
- Rejection sampling: only faces in `1 … 2^⌊log₂(sides)⌋` are accepted (e.g. 1–64 on a d100) so bit extraction stays unbiased.
- No `localStorage` / `sessionStorage` for seeds or mnemonics.
- Wipe clears in-memory rolls, phrase, hexseed, and attempts to clear the clipboard.
- Service worker caches the app for true offline use after first visit.
- Netlify ships strict CSP and hardening headers.

### Logic fixes vs the legacy Python script

| Issue | Legacy `dice.py` | This app |
| --- | --- | --- |
| `bits_per_roll` not dividing 12 (e.g. d32 → 5 bits) | Python 2 truncating `12/5 → 2` under-collected entropy | Bit-buffer collects a full 384 bits |
| Python 2 only | `raw_input`, integer `/` | Modern JS with tests |
| Roll count docs | README said 64; some docs said 68 | 64 **accepted** d100 rolls for entropy (descriptor words are not rolled) |

## Develop

```bash
npm install
npm run dev
npm test
npm run build
```

## Deploy (Netlify)

`netlify.toml` is configured for `dice.theqrl.org`:

- Build: `npm run build`
- Publish: `dist`
- SPA fallback + security headers

Point the Netlify site’s custom domain to `dice.theqrl.org` and enable HTTPS.

## Recommended use (paranoid)

1. Visit once online so the PWA caches assets, **or** download the `dist` folder.
2. Disconnect from the network (airplane mode / unplug).
3. Use a high-sided die (d100 recommended).
4. Record the mnemonic on paper/metal offline.
5. Tap **Wipe all data** before reconnecting or closing the session.

## Stack

Vue 3 · Vite 7 · Tailwind CSS 4 · DaisyUI 5 (Quantum Dawn theme from theqrl.org) · GSAP
