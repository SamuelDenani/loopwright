#!/usr/bin/env bash
# Smoke test: vendor loopwright into a create-next-app-like fixture repo and
# assert the gate produces a verdict. Run from the loopwright repo root:
#   bash .loopwright/tests/installer.test.sh
set -euo pipefail
SOURCE=$(pwd)
work=$(mktemp -d); trap 'rm -rf "$work"' EXIT
cd "$work"
git init -q .
mkdir -p app
cat > package.json <<'JSON'
{ "name": "fixture-next-app", "private": true,
  "dependencies": { "next": "15.0.0" },
  "devDependencies": { "typescript": "^5.7.2", "eslint": "^9.17.0" } }
JSON
echo '{"compilerOptions":{"strict":true}}' > tsconfig.json
echo '{}' > package-lock.json
echo 'export const answer: number = 42;' > app/answer.ts

# Pre-existing .gitignore with NO trailing newline — install.sh must not
# concatenate its appended lines onto the last existing line.
printf 'node_modules/' > .gitignore

LOOPWRIGHT_SOURCE="$SOURCE" bash "$SOURCE/install.sh"

[ -f .loopwright/config.json ] || { echo "FAIL: no config.json generated"; exit 1; }
grep -q '"adapter": "unconfigured"' .loopwright/config.json || { echo "FAIL: tests should be unconfigured"; exit 1; }
grep -q 'loopwright:start' CLAUDE.md || { echo "FAIL: CLAUDE.md section missing"; exit 1; }

# Regression: .loopwright/tests must never be vendored into a host repo — a
# host running its own lint over the tree would otherwise trip over the
# engine's fixtures. And the eslint adapter must never traverse .loopwright/
# when it lints the host.
[ ! -d .loopwright/tests ] || { echo "FAIL: .loopwright/tests was vendored into the host"; exit 1; }
grep -q -- "--ignore-pattern '.loopwright/\*\*'" .loopwright/scripts/adapters/eslint.mjs || { echo "FAIL: eslint adapter default command missing --ignore-pattern '.loopwright/**'"; exit 1; }
[ "$(grep -cx '\.loopwright/reports/' .gitignore)" = "1" ] || { echo "FAIL: gitignore reports line missing/duplicated"; exit 1; }
[ "$(grep -cx '\.loopwright/node_modules/' .gitignore)" = "1" ] || { echo "FAIL: gitignore node_modules line missing/duplicated"; exit 1; }
[ "$(grep -c 'node_modules/.loopwright' .gitignore)" = "0" ] || { echo "FAIL: gitignore lines concatenated (no trailing newline bug)"; exit 1; }

node .loopwright/scripts/run-report.mjs --all
node .loopwright/scripts/quality-gate.mjs || true   # verdict may be block; we assert it RAN
[ -f .loopwright/reports/quality-gate.json ] || { echo "FAIL: gate produced no verdict"; exit 1; }

# Idempotency: second run must not duplicate the CLAUDE.md section or gitignore lines
LOOPWRIGHT_SOURCE="$SOURCE" bash "$SOURCE/install.sh"
[ "$(grep -c 'loopwright:start' CLAUDE.md)" = "1" ] || { echo "FAIL: CLAUDE.md section duplicated"; exit 1; }
[ "$(grep -cx '\.loopwright/reports/' .gitignore)" = "1" ] || { echo "FAIL: gitignore duplicated"; exit 1; }
echo "installer smoke test: PASS"
