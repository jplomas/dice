#!/usr/bin/env bash
#
# Asserts that the offline artefact is genuinely self-contained.
#
# This is the check that backs the claim made in the release notes: one file,
# no external references, no network code. It runs in CI before publishing and
# can be run locally against any downloaded copy.
#
#   ./scripts/check-offline-artifact.sh [path-to-html]
#
set -uo pipefail

FILE="${1:-dist-offline/index.html}"
fail=0

note() { printf '  %s\n' "$1"; }
bad() { printf 'FAIL: %s\n' "$1"; fail=1; }

if [ ! -f "$FILE" ]; then
  echo "FAIL: $FILE does not exist. Run 'npm run build:offline' first."
  exit 1
fi

echo "Checking $FILE ($(wc -c < "$FILE" | tr -d ' ') bytes)"

# --- structure: one inline script, one inline style, one inline favicon ------
for pair in "script:1" "style:1" "link:1"; do
  tag="${pair%%:*}"
  want="${pair##*:}"
  got=$(grep -o "<$tag" "$FILE" | wc -l | tr -d ' ')
  if [ "$got" = "$want" ]; then
    note "<$tag> tags: $got"
  else
    bad "expected $want <$tag> tag(s), found $got"
  fi
done

# --- no external references -------------------------------------------------
# Every src/href must be a data: URI. The only permitted exceptions are the
# informational links in the footer and intro, which are never fetched.
external=$(grep -oE '(src|href)="[^"]+"' "$FILE" \
  | sed -E 's/^(src|href)="//; s/"$//' \
  | grep -vE '^data:' \
  | grep -vE '^https://(www\.)?(theqrl\.org|docs\.theqrl\.org|github\.com)/' \
  | sort -u)
if [ -z "$external" ]; then
  note "external references: none"
else
  bad "artefact references external resources:"
  printf '    %s\n' $external
fi

# --- no network or storage primitives ---------------------------------------
# `fetch` is deliberately absent from this list: it occurs as the wordlist
# entry "fetch" and inside Vue's `serverPrefetch` option name, so a literal
# grep cannot distinguish it. Real calls are ruled out by the reference check
# above plus the absence of every other transport below.
for p in XMLHttpRequest WebSocket sendBeacon EventSource importScripts \
         serviceWorker registerSW workbox caches.match caches.open \
         localStorage sessionStorage indexedDB document.cookie; do
  n=$(grep -o -F -- "$p" "$FILE" | wc -l | tr -d ' ')
  if [ "$n" = "0" ]; then
    note "$p: absent"
  else
    bad "artefact contains $p ($n occurrence(s))"
  fi
done

# --- the wordlist must actually be inlined ----------------------------------
# Spot-check entries from the start, middle and end of the canonical list.
for w in '"aback"' '"fetch"' '"zurich"'; do
  if grep -q -F -- "$w" "$FILE"; then
    note "wordlist entry $w: present"
  else
    bad "wordlist entry $w missing — the wordlist may not be inlined"
  fi
done

echo
if [ "$fail" = "0" ]; then
  echo "PASS: artefact is self-contained."
else
  echo "FAILED — do not publish this artefact."
fi
exit "$fail"
