#!/usr/bin/env bash
# Vendors the loopwright layer into the current repo. Idempotent:
# re-running updates the engine and never overwrites your config, baseline,
# or any integration file you already have. Docs: docs/loopwright/ after install.
set -euo pipefail

[ -d .git ] || { echo "install.sh: run this from the root of a git repo."; exit 1; }
[ -f package.json ] || { echo "install.sh: no package.json — loopwright targets JS/TS repos."; exit 1; }

# --- fetch source ------------------------------------------------------------
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if [ -n "${LOOPWRIGHT_SOURCE:-}" ]; then
  src="$LOOPWRIGHT_SOURCE"
  echo "source:      $src (local override)"
else
  curl -fsSL https://codeload.github.com/SamuelDenani/loopwright/tar.gz/refs/heads/main | tar -xz -C "$tmp"
  src="$tmp/loopwright-main"
  echo "source:      github.com/SamuelDenani/loopwright@main"
fi

# --- engine: always synced ---------------------------------------------------
# .loopwright/tests is deliberately NOT vendored: hosts don't run engine
# tests (the CI steps that do are repo-guarded to SamuelDenani/loopwright),
# and shipping them here would put fixture files under the host's own lint
# root.
mkdir -p .loopwright
rm -rf .loopwright/scripts
cp -R "$src/.loopwright/scripts" .loopwright/
for f in package.json package-lock.json config.default.json vitest.config.mjs claude-md-section.md; do
  cp "$src/.loopwright/$f" ".loopwright/$f"
done
echo "engine:      synced .loopwright/scripts (never edits config.json/baseline.json)"

# --- integration files: copy only when absent --------------------------------
copied=0 skipped=0
while IFS= read -r rel; do
  if [ -e "$rel" ]; then skipped=$((skipped+1)); else
    mkdir -p "$(dirname "$rel")"
    cp "$src/$rel" "$rel"
    copied=$((copied+1))
  fi
done < <(cd "$src" && find .claude .github .githooks docs/loopwright setup.sh -type f)
echo "integration: $copied file(s) copied, $skipped left untouched"

# --- host touches ------------------------------------------------------------
touch .gitignore
if [ -s .gitignore ] && [ "$(tail -c1 .gitignore)" != "" ]; then
  echo >> .gitignore
fi
grep -qx '\.loopwright/reports/' .gitignore || echo '.loopwright/reports/' >> .gitignore
grep -qx '\.loopwright/node_modules/' .gitignore || echo '.loopwright/node_modules/' >> .gitignore
start='<!-- loopwright:start -->'; end='<!-- loopwright:end -->'
touch CLAUDE.md
if grep -qF "$start" CLAUDE.md; then
  grep -qF "$end" CLAUDE.md || { echo "install.sh: CLAUDE.md has a loopwright:start marker but no end marker — fix the file manually"; exit 1; }
  awk -v s="$start" -v e="$end" -v f=".loopwright/claude-md-section.md" '
    $0==s {print; while ((getline line < f) > 0) print line; skip=1; next}
    $0==e {print; skip=0; next}
    !skip {print}' CLAUDE.md > CLAUDE.md.tmp && mv CLAUDE.md.tmp CLAUDE.md
else
  { echo ""; echo "$start"; cat .loopwright/claude-md-section.md; echo "$end"; } >> CLAUDE.md
fi
echo "host:        .gitignore + CLAUDE.md section updated"

# --- config + deps -----------------------------------------------------------
if [ -f .loopwright/config.json ]; then
  echo "config:      .loopwright/config.json exists — left as is"
else
  node .loopwright/scripts/detect-stack.mjs
fi
(cd .loopwright && npm ci)
git config core.hooksPath .githooks
echo
echo "Done. Next: review .loopwright/config.json, then run ./setup.sh (needs gh auth)"
echo "to configure labels, branch protection and record the initial baseline."
