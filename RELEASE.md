# Releasing

There are **two independent release paths**, and they are triggered by
different things:

| | Trigger | Produces | Gated by |
|---|---|---|---|
| **Online** (hosted app) | push/merge to `master` | a deploy of `dist/` to dice.theqrl.org | Netlify build command (`npm run build:verified`) |
| **Offline** (downloadable) | pushing a **signed** `v*` tag | `qrl-dice-<version>-offline.html` + SHA-256 on GitHub Releases | `.github/workflows/release.yml` |

They are deliberately decoupled: you can deploy the site without cutting an
offline release, and you can re-cut an offline release without redeploying.

**Order matters.** Merge and deploy first, then tag the commit that is live.
Tagging before merging publishes an offline artefact that does not correspond
to what users get from the website, which defeats the point of publishing a
hash for it.

---

## Prerequisites

One-time setup, already in place on the maintainer's machine:

- Node 22 (`.nvmrc`). `engine-strict` is on, so older versions fail fast.
- Commit and tag signing:
  ```bash
  git config --get gpg.format          # ssh
  git config --get user.signingkey     # key::ssh-ed25519 AAAA...
  git config --get gpg.ssh.allowedSignersFile   # ~/.ssh/allowed_signers
  ```
  The last one is what lets `git verify-tag` resolve an SSH signature
  locally. Without it, signing still works but verification reports
  "no principal matched".
- `commit.gpgsign=true` covers **commits only**. It does *not* sign tags —
  see the pitfall below.

---

## Cutting a release

### 1. Bump the version

```bash
npm version <new-version> --no-git-tag-version
```

This updates `package.json` and `package-lock.json` and leaves them
uncommitted. It deliberately does **not** commit or tag — those are manual so
the commit message and signature are yours.

### 2. Commit the bump

The version bump must be **in the commit you tag**. The artefact filename and
the release-notes heading come from `package.json`, not from the tag name, so
a tag pointing at a commit with the old version publishes a mis-named file.
`release.yml` now refuses this, but it is easier to get right than to undo.

### 3. Merge to `master` and let the online deploy run

Netlify runs `npm ci && npm run build:verified` and publishes only if it
succeeds. Confirm the site is live and the footer shows the expected build
identity (`<version>+<commit>`) before continuing.

### 4. Tag the deployed commit

```bash
git tag -s v<new-version> -m "QRL Dice Mnemonic <new-version> — single-file offline release"
```

`-s` is required. It creates an *annotated* tag and signs it. A plain
`git tag v1.0.2` creates a lightweight tag — a bare pointer with no object to
carry a signature — and the release workflow rejects it.

### 5. Verify locally before pushing

Cheaper than discovering it in CI:

```bash
git verify-tag v<new-version> && git cat-file tag v<new-version> | grep -q "BEGIN SSH SIGNATURE" && node -e 'const t=process.argv[1].replace(/^v/,"");const p=require("./package.json").version;if(t!==p){console.error(`tag ${t} != package.json ${p}`);process.exit(1)}console.log("tag, signature and version all agree")' v<new-version>
```

### 6. Push the tag

```bash
git push upstream v<new-version>
```

`release.yml` then verifies the tag is annotated and signed, verifies it
matches `package.json`, runs both test suites, builds the offline artefact,
asserts it is self-contained, and publishes it with its SHA-256.

---

## What the gates check

**Netlify (`build:verified`, blocks the deploy)** — unit tests, entropy and
descriptor property tests, the production build, the offline build, and the
self-containment assertion. No browser, ~5s.

**GitHub Actions CI (blocks the merge)** — the same `build:verified` script,
plus the Playwright suite: that the offline artefact mounts and completes a
session from `file://`, and that the hosted build produces zero CSP
violations under the policy parsed from `netlify.toml`.

**Release workflow (blocks publishing)** — tag is annotated, tag is signed,
tag matches `package.json`, tests pass, artefact is self-contained.

---

## Verifying a published artefact

What to tell users, and what to check yourself after publishing:

```bash
sha256sum qrl-dice-<version>-offline.html || shasum -a 256 qrl-dice-<version>-offline.html
```

`sha256sum` is standard on Linux and present on recent macOS; older macOS
ships only `shasum`. The published `.sha256` sidecar can be checked directly
with either:

```bash
sha256sum -c qrl-dice-<version>-offline.html.sha256 || shasum -a 256 -c qrl-dice-<version>-offline.html.sha256
```

Compare against the hash in the release notes, then confirm the release notes
themselves against the signed tag — not against the website, which is the
thing the offline artefact exists to avoid trusting:

```bash
git verify-tag v<version> && git show v<version>
```

Rebuild it yourself; the build is reproducible, so the same commit yields a
byte-identical file:

```bash
git checkout v<version> && npm ci && npm run build:offline && (sha256sum dist-offline/index.html || shasum -a 256 dist-offline/index.html)
```

---

## Pitfalls

**A lightweight tag cannot be signed.** `commit.gpgsign=true` applies to
commits, not tags. Always use `git tag -s`. Symptom:

```
Error: v1.0.2 is a lightweight tag. Release tags must be annotated and signed (git tag -s).
```

**The tag name is not the version.** The artefact name and release notes come
from `package.json` at the tagged commit. Symptom:

```
Error: Tag v1.0.2 implies version 1.0.2 but package.json says 1.0.1.
```

Fix: commit the bump, then re-tag the new commit (see below).

**The offline artefact cannot update itself.** It ships no service worker and
no update code by design, so users on an old copy stay on it until they
download a new one. Say so in the release notes.

---

## Re-cutting a release

If a release published with the wrong contents, delete it and start again.
Check `downloadCount` first — if it is non-zero, people have the bad file and
you should publish a new version rather than silently replace this one:

```bash
gh release view v<version> --repo theQRL/dice --json assets --jq '.assets[] | {name, downloadCount}'
```

If nothing has been downloaded, remove the release and both copies of the tag:

```bash
gh release delete v<version> --repo theQRL/dice --yes && git push upstream :refs/tags/v<version> && git tag -d v<version>
```

Then fix the underlying problem, commit, and repeat from step 4.
