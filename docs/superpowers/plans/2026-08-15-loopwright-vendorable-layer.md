# Loopwright Vendorable Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure loopwright from a GitHub repo template into a vendorable `.loopwright/` layer with tool adapters, a stack detector, and a one-command installer, per the approved spec.

**Architecture:** The gate engine moves under `.loopwright/` with its own `package.json`. Collectors become named adapter modules selected by `config.json`; the gate learns "unconfigured" semantics with an anti-cheat rule recorded in the baseline. An `install.sh` at the repo root vendors the layer into any JS/TS host repo. The loopwright repo dogfoods its own gate over the engine sources.

**Tech Stack:** Node >= 20.11, plain ESM JavaScript (`.mjs`, no TypeScript in the engine), vitest for engine tests, `typescript` package as a library (source analysis), jscpd, bash for installer.

**Spec:** `docs/superpowers/specs/2026-08-15-loopwright-restructure-design.md` — read it before starting any task.

## Global Constraints

- Node `>=20.11`; engine code is ESM `.mjs`, never TypeScript.
- `.loopwright/package.json` dependencies are exactly: `typescript`, `jscpd` (deps) and `vitest`, `@vitest/coverage-v8` (devDeps). No other packages.
- Adapters ALWAYS exit 0; `quality-gate.mjs` is the only script allowed to exit non-zero (0 pass, 1 blocked, 2 could-not-run).
- All engine paths come from `.loopwright/scripts/lib/paths.mjs` — no other file computes `ROOT` on its own.
- The installer never overwrites an existing `config.json`, `baseline.json`, or any pre-existing file outside `.loopwright/scripts/`.
- GitHub username is `SamuelDenani` — use it verbatim in URLs, never a placeholder.
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- The pre-commit hook blocks commits touching the baseline: use `ALLOW_BASELINE=1 git commit ...` where a task says so.
- Mid-plan the repo's own CI gate is red; that is expected. Task 12 turns it green. Engine unit tests (`cd .loopwright && npx vitest run`) must pass at the end of every task from Task 2 on.

## Target file map (final state)

```
loopwright/
├── install.sh                          # Task 9
├── setup.sh                            # Task 9 (moved from scripts/setup.sh, paths updated)
├── package.json                        # Task 1 (slimmed: host-stack devDeps only: eslint kit)
├── eslint.config.js                    # Task 1 (rewritten for .mjs engine sources)
├── .loopwright/
│   ├── package.json                    # Task 1
│   ├── config.json                     # Task 1 (moved), Task 12 (final dogfood values)
│   ├── config.default.json             # Task 8 (template the detector fills in)
│   ├── baseline.json                   # Task 12 (generated)
│   ├── vitest.config.mjs               # Task 2
│   ├── claude-md-section.md            # Task 9
│   ├── scripts/
│   │   ├── quality-gate.mjs            # Task 1 (moved), Task 6 (unconfigured semantics)
│   │   ├── run-report.mjs              # Task 3 (rewritten as dispatcher)
│   │   ├── sticky-comment.mjs          # Task 1 (moved)
│   │   ├── detect-stack.mjs            # Task 8
│   │   ├── adapters/
│   │   │   ├── index.mjs               # Task 3
│   │   │   ├── tsc.mjs                 # Task 4
│   │   │   ├── eslint.mjs              # Task 4
│   │   │   ├── vitest.mjs              # Task 4
│   │   │   ├── npm-audit.mjs           # Task 4
│   │   │   ├── jscpd.mjs               # Task 4
│   │   │   ├── jest.mjs                # Task 5
│   │   │   └── biome.mjs               # Task 5
│   │   └── lib/
│   │       ├── paths.mjs               # Task 1
│   │       ├── collect-metrics.mjs     # Task 1 (moved), Tasks 4+6 (lint schema, unconfigured)
│   │       ├── evaluate.mjs            # Task 1 (moved), Task 6 (collector regression)
│   │       ├── report.mjs              # Task 1 (moved)
│   │       └── analyze-source.mjs      # Task 1 (moved), Task 7 (multi-extension)
│   └── tests/                          # Tasks 2-8 (engine unit tests + fixtures/)
├── .github/workflows/quality-gate.yml  # Task 10 (rewritten)
├── .githooks/pre-commit                # Task 10 (host-agnostic rewrite)
├── docs/loopwright/                    # Task 11 (quality-gate.md, loop-harness.md moved+updated)
└── CLAUDE.md                           # Task 11 (marker-delimited loopwright section)

DELETED: src/, tests/, tsconfig.json, vitest.config.ts, .jscpd.json,
quality-gate.config.json (moved), scripts/ (moved), committed coverage/ and
reports/ trees.
```

---

### Task 1: Scaffold `.loopwright/`, move the engine, centralize paths

**Files:**
- Create: `.loopwright/package.json`, `.loopwright/scripts/lib/paths.mjs`
- Move (git mv): `scripts/quality-gate.mjs`, `scripts/run-report.mjs`, `scripts/sticky-comment.mjs`, `scripts/lib/*.mjs` → `.loopwright/scripts/...`; `quality-gate.config.json` → `.loopwright/config.json`
- Modify: `package.json` (root), `.gitignore`, `eslint.config.js`
- Delete: `src/`, `tests/`, `tsconfig.json`, `vitest.config.ts`, `.jscpd.json`, `quality-baseline.json`, tracked `coverage/` and `reports/` trees

**Interfaces:**
- Produces: `paths.mjs` exporting `HOST_ROOT`, `LOOPWRIGHT_DIR`, `SCRIPTS_DIR`, `REPORTS_DIR`, `CONFIG_PATH`, `BASELINE_PATH` (all absolute strings). Every later task imports paths from here.
- Produces: `.loopwright/config.json` with today's `sources/audit/limits/metrics` plus a `collectors` object (consumed by Task 3).

- [ ] **Step 1: Create `.loopwright/package.json`**

```json
{
  "name": "loopwright-engine",
  "private": true,
  "type": "module",
  "description": "Vendored loopwright quality-gate engine. Managed by install.sh; edit config.json, not this file.",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "test": "vitest run"
  },
  "dependencies": {
    "typescript": "^5.7.2",
    "jscpd": "^4.0.5"
  },
  "devDependencies": {
    "vitest": "^4.1.10",
    "@vitest/coverage-v8": "^4.1.10"
  }
}
```

- [ ] **Step 2: Install engine deps**

Run: `cd .loopwright && npm install && cd ..`
Expected: `.loopwright/package-lock.json` created (commit it), `.loopwright/node_modules/` present.

- [ ] **Step 3: Move engine files and delete template-only files**

```bash
mkdir -p .loopwright/scripts
git mv scripts/quality-gate.mjs scripts/run-report.mjs scripts/sticky-comment.mjs .loopwright/scripts/
git mv scripts/lib .loopwright/scripts/lib
git mv quality-gate.config.json .loopwright/config.json
git rm -r src tests tsconfig.json vitest.config.ts .jscpd.json
git rm -r --cached coverage reports   # tracked build artifacts (bug)
rm -rf coverage reports
git rm quality-baseline.json
```

(`scripts/setup.sh` stays where it is for now; Task 9 moves it.)

- [ ] **Step 4: Write `.loopwright/scripts/lib/paths.mjs`**

```js
/**
 * Single source of truth for engine paths. The engine lives vendored at
 * <host>/.loopwright/, so every location derives from this file's own.
 */
import { resolve } from 'node:path';

export const SCRIPTS_DIR = resolve(import.meta.dirname, '..');
export const LOOPWRIGHT_DIR = resolve(SCRIPTS_DIR, '..');
export const HOST_ROOT = resolve(LOOPWRIGHT_DIR, '..');
export const REPORTS_DIR = resolve(LOOPWRIGHT_DIR, 'reports');
export const CONFIG_PATH = resolve(LOOPWRIGHT_DIR, 'config.json');
export const BASELINE_PATH = resolve(LOOPWRIGHT_DIR, 'baseline.json');
```

- [ ] **Step 5: Repoint the moved scripts at `paths.mjs`**

In `.loopwright/scripts/quality-gate.mjs`:
- Delete `const ROOT = resolve(import.meta.dirname, '..');` and add `import { HOST_ROOT, REPORTS_DIR, CONFIG_PATH, BASELINE_PATH } from './lib/paths.mjs';`
- `git(...)` keeps `cwd: HOST_ROOT`.
- `loadJson` resolves against `HOST_ROOT` only for nothing anymore — replace the two call sites: `loadJson(CONFIG_PATH, null)` and `loadJson(BASELINE_PATH, null)`; change `loadJson(path, fallback)` to take an absolute path (drop the `resolve(ROOT, path)`).
- Drop `const baselinePath = config.baselineFile ?? ...` (the `baselineFile` config key dies); write the baseline to `BASELINE_PATH`.
- `collectMetrics(HOST_ROOT, config)` stays (it analyzes host sources relative to `HOST_ROOT`).
- Report writes go to `resolve(REPORTS_DIR, 'quality-gate.json')` / `'quality-gate.md'`; the `mkdirSync` uses `REPORTS_DIR`.
- Console hints: `npm run quality:baseline` → `node .loopwright/scripts/quality-gate.mjs --update-baseline`; `Reports: reports/...` → `.loopwright/reports/...`; baseline hint names `.loopwright/baseline.json`.

In `.loopwright/scripts/lib/collect-metrics.mjs`: `readJson(root, relativePath)` call sites currently pass `'reports/typecheck.json'` etc. — import `REPORTS_DIR` and change `readJson` to `readJson(dir, relativePath)` where collectors pass `REPORTS_DIR` and coverage passes `resolve(REPORTS_DIR, 'coverage')` (`'coverage-summary.json'`). Leave the rest untouched in this task.

In `.loopwright/scripts/sticky-comment.mjs`: replace `ROOT` computation with `import { REPORTS_DIR } from './lib/paths.mjs';` and default `bodyPath` to `resolve(REPORTS_DIR, 'quality-gate.md')` (argv override still wins, resolved against `process.cwd()`).

In `.loopwright/scripts/run-report.mjs`: only fix `ROOT`/`REPORTS` to come from `paths.mjs` for now (`ROOT` → `HOST_ROOT`); Task 3 rewrites this file.

- [ ] **Step 6: Add `collectors` to `.loopwright/config.json`**

Delete the `"baselineFile"` key. Add after `"sources"` (temporary values; Task 12 sets the final dogfood config):

```json
"collectors": {
  "typecheck":   { "adapter": "unconfigured" },
  "lint":        { "adapter": "eslint" },
  "tests":       { "adapter": "vitest", "command": "npx vitest run --coverage", "cwd": ".loopwright" },
  "audit":       { "adapter": "npm-audit" },
  "duplication": { "adapter": "jscpd" }
}
```

Also set `"sources": { "roots": [".loopwright/scripts", ".loopwright/tests"], "extensions": [".mjs"], "ignore": [] }`.

- [ ] **Step 7: Slim the root `package.json` and rewrite `eslint.config.js`**

Root `package.json` becomes (the loopwright repo acting as its own host, whose stack is just eslint):

```json
{
  "name": "loopwright",
  "version": "0.2.0",
  "description": "Vendorable quality layer for AI-assisted JS/TS repos: RFC-driven issue flow, agentic execution loop, and a CI quality gate that agents cannot cheat.",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.11" },
  "scripts": {
    "quality": "node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "eslint": "^9.17.0",
    "globals": "^15.14.0"
  }
}
```

Run `npm install` at root (regenerates root `package-lock.json` without the old TS stack).

`eslint.config.js` becomes:

```js
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '.loopwright/reports/**', '.loopwright/tests/fixtures/**'] },
  {
    files: ['**/*.mjs', '**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
];
```

- [ ] **Step 8: Update `.gitignore`**

Replace the `coverage/` and `reports/` lines with:

```
.loopwright/reports/
.loopwright/node_modules/
```

(keep `node_modules/`, `dist/`, `*.log`, `.DS_Store`).

- [ ] **Step 9: Verify the moved gate executes**

Run: `node .loopwright/scripts/quality-gate.mjs`
Expected: exits 0 or 1 (NOT 2), console report shows metrics mostly "no data collected" warnings and `No baseline found` hint naming `.loopwright/baseline.json`. Run `npx eslint .` — expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git add -A
ALLOW_BASELINE=1 git commit -m "refactor: move gate engine into vendored .loopwright/ workspace"
```

(`ALLOW_BASELINE=1` because the still-active old pre-commit hook guards the
`quality-baseline.json` filename this commit deletes.)

---

### Task 2: Engine test harness + characterization tests for `evaluate.mjs`

**Files:**
- Create: `.loopwright/vitest.config.mjs`, `.loopwright/tests/evaluate.test.mjs`

**Interfaces:**
- Consumes: `evaluate.mjs` exports `STATUS`, `worstStatus(statuses)`, `evaluateMetrics(config, current, baselineMetrics)`, `evaluateShape(config, analysis, baselineFiles)`, `snapshotFiles(analysis)` — unchanged from today.
- Produces: the test harness every later task adds to. Test files live in `.loopwright/tests/*.test.mjs`; fixtures in `.loopwright/tests/fixtures/`.

- [ ] **Step 1: Write `.loopwright/vitest.config.mjs`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    reporters: ['default'],
    outputFile: { json: 'reports/test-results.json' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'reports/coverage',
      include: ['scripts/**/*.mjs'],
    },
  },
});
```

- [ ] **Step 2: Write failing characterization tests**

`.loopwright/tests/evaluate.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { STATUS, worstStatus, evaluateMetrics } from '../scripts/lib/evaluate.mjs';

const policy = (over = {}) => ({ label: 'm', direction: 'lower-better', tolerance: 0, onRegression: 'block', ...over });

describe('worstStatus', () => {
  it('block outranks warn outranks pass', () => {
    expect(worstStatus(['pass', 'warn', 'block'])).toBe(STATUS.BLOCK);
    expect(worstStatus(['pass', 'improved', 'warn'])).toBe(STATUS.WARN);
    expect(worstStatus([])).toBe(STATUS.PASS);
  });
});

describe('evaluateMetrics', () => {
  const run = (p, current, baseline) =>
    evaluateMetrics({ metrics: { m: p } }, { m: current }, baseline === undefined ? undefined : { m: baseline })[0];

  it('hard limits win even when the baseline was already over', () => {
    expect(run(policy({ hardMax: 0 }), 3, 5).status).toBe(STATUS.BLOCK);
    expect(run(policy({ direction: 'higher-better', hardMin: 80 }), 79, 70).status).toBe(STATUS.BLOCK);
  });

  it('regression beyond tolerance blocks or warns per onRegression', () => {
    expect(run(policy(), 2, 1).status).toBe(STATUS.BLOCK);
    expect(run(policy({ onRegression: 'warn' }), 2, 1).status).toBe(STATUS.WARN);
    expect(run(policy({ tolerance: 1 }), 2, 1).status).toBe(STATUS.PASS);
  });

  it('improvement and no-baseline are reported as such', () => {
    expect(run(policy(), 1, 2).status).toBe(STATUS.IMPROVED);
    expect(run(policy(), 1, undefined).status).toBe(STATUS.NEW);
  });

  it('missing data is a warning', () => {
    expect(run(policy(), undefined, 1).status).toBe(STATUS.WARN);
  });
});
```

- [ ] **Step 3: Run and verify these pass** (characterization of existing behavior — they must pass immediately; if one fails, the harness or an import path is wrong, not the engine)

Run: `cd .loopwright && npx vitest run`
Expected: 5 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add .loopwright/vitest.config.mjs .loopwright/tests/evaluate.test.mjs
git commit -m "test: engine test harness with evaluate characterization tests"
```

---

### Task 3: Adapter framework and `run-report.mjs` dispatcher

**Files:**
- Create: `.loopwright/scripts/adapters/index.mjs`
- Rewrite: `.loopwright/scripts/run-report.mjs`
- Test: `.loopwright/tests/dispatcher.test.mjs`

**Interfaces:**
- Produces (consumed by Tasks 4-6): adapter module shape

  ```js
  export default {
    name: 'tsc',                    // registry key
    collector: 'typecheck',         // which config.collectors slot it serves
    defaultCommand: 'npx tsc --noEmit --pretty false',
    collect(ctx) { /* runs tool, writes report file(s), never throws */ }
  }
  ```

  `ctx = { command /* resolved string */, cwd /* absolute */, hostRoot, reportsDir, config /* full parsed config.json */ }`.
- Produces: `REPORT_FILES` map in `run-report.mjs` — collector name → report paths (relative to `REPORTS_DIR`): `typecheck: ['typecheck.json']`, `lint: ['lint.json']`, `tests: ['test-summary.json', 'test-results.json']`, `audit: ['audit.json']`, `duplication: ['jscpd/jscpd-report.json']`.
- Produces: `runShell(command, cwd)` helper exported from `run-report.mjs` — splits nothing, runs via `spawnSync(cmd, { shell: true, cwd, encoding: 'utf8', maxBuffer: 64MB })`, returns `{ status, stdout, stderr }`. Commands are strings from config, so shell execution is intentional.
- Produces: unconfigured behavior — for `{ "adapter": "unconfigured" }` the dispatcher writes `{ "configured": false }` to every file in `REPORT_FILES[collector]`.

- [ ] **Step 1: Write the failing dispatcher test**

`.loopwright/tests/dispatcher.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADAPTERS } from '../scripts/adapters/index.mjs';
import { REPORT_FILES, writeUnconfigured, resolveCollector } from '../scripts/run-report.mjs';

describe('adapter registry', () => {
  it('covers the collector set from the spec', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['biome', 'eslint', 'jest', 'jscpd', 'npm-audit', 'tsc', 'vitest']);
  });
  it('every adapter declares its collector slot and default command', () => {
    for (const adapter of Object.values(ADAPTERS)) {
      expect(['typecheck', 'lint', 'tests', 'audit', 'duplication']).toContain(adapter.collector);
      expect(typeof adapter.defaultCommand).toBe('string');
      expect(typeof adapter.collect).toBe('function');
    }
  });
});

describe('resolveCollector', () => {
  it('config command and cwd override the adapter defaults', () => {
    const resolved = resolveCollector('tests', { adapter: 'vitest', command: 'npx vitest run', cwd: '.loopwright' }, '/host');
    expect(resolved.adapter.name).toBe('vitest');
    expect(resolved.command).toBe('npx vitest run');
    expect(resolved.cwd).toBe(join('/host', '.loopwright'));
  });
  it('unknown adapter names are an explicit error', () => {
    expect(() => resolveCollector('lint', { adapter: 'nope' }, '/host')).toThrow(/unknown adapter/);
  });
});

describe('writeUnconfigured', () => {
  it('stamps {configured:false} on every report file of the collector', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lw-'));
    writeUnconfigured('tests', dir);
    for (const file of REPORT_FILES.tests) {
      expect(JSON.parse(readFileSync(join(dir, file), 'utf8'))).toEqual({ configured: false });
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd .loopwright && npx vitest run tests/dispatcher.test.mjs`. Expected: FAIL (modules don't exist).

- [ ] **Step 3: Implement `adapters/index.mjs` with placeholder-free stubs**

Until Tasks 4-5 land the real adapters, `index.mjs` must still satisfy the registry test. Implement it as the final registry with the seven imports, and create the seven adapter files now with their real `name`/`collector`/`defaultCommand` and a `collect(ctx)` that only runs the command and dumps raw output — Tasks 4-5 replace the bodies. Registry:

```js
import tsc from './tsc.mjs';
import eslint from './eslint.mjs';
import biome from './biome.mjs';
import vitest from './vitest.mjs';
import jest from './jest.mjs';
import npmAudit from './npm-audit.mjs';
import jscpd from './jscpd.mjs';

export const ADAPTERS = Object.fromEntries(
  [tsc, eslint, biome, vitest, jest, npmAudit, jscpd].map((adapter) => [adapter.name, adapter]),
);
```

Default commands (exact strings — Tasks 4-5 keep them):

| adapter | collector | defaultCommand |
|---|---|---|
| tsc | typecheck | `npx tsc --noEmit --pretty false` |
| eslint | lint | `npx eslint . --format json` |
| biome | lint | `npx biome check --reporter=json .` |
| vitest | tests | `npx vitest run --coverage --coverage.reporter=json-summary --coverage.reportsDirectory=.loopwright/reports/coverage --reporter=default --reporter=json --outputFile.json=.loopwright/reports/test-results.json` |
| jest | tests | `npx jest --ci --json --outputFile=.loopwright/reports/test-results.json --coverage --coverageReporters=json-summary --coverageDirectory=.loopwright/reports/coverage` |
| npm-audit | audit | `npm audit --json` |
| jscpd | duplication | (computed in Task 4 from config — set `defaultCommand: 'jscpd'` marker string) |

- [ ] **Step 4: Rewrite `run-report.mjs`**

Keep the file top comment style. Structure:

```js
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { HOST_ROOT, REPORTS_DIR, CONFIG_PATH } from './lib/paths.mjs';
import { ADAPTERS } from './adapters/index.mjs';

export const REPORT_FILES = {
  typecheck: ['typecheck.json'],
  lint: ['lint.json'],
  tests: ['test-summary.json', 'test-results.json'],
  audit: ['audit.json'],
  duplication: ['jscpd/jscpd-report.json'],
};

export function runShell(command, cwd) {
  const result = spawnSync(command, { shell: true, cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

export function writeReport(reportsDir, relativePath, payload) {
  const target = resolve(reportsDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

export function writeUnconfigured(collector, reportsDir) {
  for (const file of REPORT_FILES[collector]) writeReport(reportsDir, file, { configured: false });
}

export function resolveCollector(collectorName, entry, hostRoot) {
  const adapter = ADAPTERS[entry.adapter];
  if (!adapter) throw new Error(`unknown adapter "${entry.adapter}" for collector "${collectorName}"`);
  if (adapter.collector !== collectorName)
    throw new Error(`adapter "${entry.adapter}" serves "${adapter.collector}", not "${collectorName}"`);
  return { adapter, command: entry.command ?? adapter.defaultCommand, cwd: resolve(hostRoot, entry.cwd ?? '.') };
}

function main() {
  const target = process.argv[2];
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const names = target === '--all' ? Object.keys(config.collectors) : [target];
  for (const name of names) {
    const entry = config.collectors[name];
    if (!entry) { console.error(`no collector "${name}" in config.json`); process.exitCode = 2; return; }
    if (entry.adapter === 'unconfigured') {
      writeUnconfigured(name, REPORTS_DIR);
      console.log(`${name}: unconfigured (skipped)`);
      continue;
    }
    const { adapter, command, cwd } = resolveCollector(name, entry, HOST_ROOT);
    adapter.collect({ command, cwd, hostRoot: HOST_ROOT, reportsDir: REPORTS_DIR, config });
  }
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

(Put the `pathToFileURL` import at the top of the file with the other
imports; it is shown here next to its use for clarity.)

Guard `main()` behind the entry check exactly as shown so tests can import the module without running collectors. Usage line in the header comment: `node .loopwright/scripts/run-report.mjs <typecheck|lint|tests|audit|duplication|--all>`.

- [ ] **Step 5: Run tests** — `cd .loopwright && npx vitest run`. Expected: dispatcher + evaluate tests PASS.

- [ ] **Step 6: Commit**

```bash
git add .loopwright/scripts/adapters .loopwright/scripts/run-report.mjs .loopwright/tests/dispatcher.test.mjs
git commit -m "feat: adapter registry and config-driven collector dispatcher"
```

---

### Task 4: Extract the five existing adapters; neutral lint schema

**Files:**
- Rewrite bodies: `.loopwright/scripts/adapters/{tsc,eslint,vitest,npm-audit,jscpd}.mjs`
- Modify: `.loopwright/scripts/lib/collect-metrics.mjs` (`collectLint` reads the neutral schema; `collectTests` message tweak)
- Test: `.loopwright/tests/adapters.test.mjs`, fixtures under `.loopwright/tests/fixtures/`

**Interfaces:**
- Consumes: `runShell`, `writeReport` from `run-report.mjs`; `ctx` from Task 3.
- Produces — every adapter exposes a pure parser the tests target, alongside `collect`:
  - `tsc.mjs`: `parseTscOutput(text) -> { ok, errorCount, diagnostics: [{file,line,column,severity,code,message}] }` (move the `TS_DIAGNOSTIC` regex + loop from the old `collectTypecheck` in `scripts/run-report.mjs` git history — the logic is identical, `ok` is `errorCount === 0`). Report file: `typecheck.json`.
  - `eslint.mjs`: `parseEslintJson(stdout) -> lint report` in the NEUTRAL schema `{ ok, errors, warnings, messages: [{file,line,severity:'error'|'warning',rule,message}] }` (port the counting loop from old `collectLint` in `collect-metrics.mjs`, making paths relative in `collect` where `ctx.hostRoot` is known). Report file: `lint.json`.
  - `vitest.mjs`: `summarizeTestResults(raw, ok) -> test-summary` — move `extractFailures` + the summary assembly from old `run-report.mjs` `collectTests` verbatim (fields: `ok, ranSuccessfully, total, passed, failed, skipped, suitesFailed, failures[]`). `collect` runs the command, then reads `test-results.json` from `ctx.reportsDir` and writes `test-summary.json`.
  - `npm-audit.mjs`: `collect` runs the command, JSON-parses stdout, writes `audit.json` (raw npm shape, unchanged); on parse failure writes `{ ok: false, error: 'npm audit produced no parseable JSON' }`.
  - `jscpd.mjs`: `jscpdArgs(config) -> string[]` building CLI args from `config.sources`: `['--reporters', 'json', '--output', '<reportsDir>/jscpd', '--min-lines', '5', '--min-tokens', '50', '--gitignore', '--format', <formats>, ...roots]` with formats mapped from extensions: `.ts→typescript, .tsx→tsx, .js→javascript, .mjs→javascript, .jsx→jsx` (deduped, comma-joined). `collect` runs `<LOOPWRIGHT_DIR>/node_modules/.bin/jscpd` with those args via `spawnSync` (array form, no shell), then verifies `jscpd/jscpd-report.json` exists, writing the empty-report fallback from the old code if not.
- Produces: failure contract used by Task 6 — when the underlying tool cannot run or emits unparseable output, the adapter writes `{ ok: false, error: '<one line>' }` as the report. For `tsc`/`eslint`/`vitest`, "tool missing" is detected by `status !== 0` combined with empty parse results AND stderr matching `/not found|command not found|ERR_MODULE_NOT_FOUND|npm error/i` — in that case write the error form instead of a zero-count success.

- [ ] **Step 1: Create fixtures** (small, hand-written, realistic):
  - `fixtures/tsc-output.txt` — two lines: `src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.` and `src/b.ts(10,1): warning TS6133: 'x' is declared but its value is never read.`
  - `fixtures/eslint.json` — array with one file, `errorCount: 1`, `warningCount: 1`, two messages with `ruleId`, `line`, `severity` 2 and 1.
  - `fixtures/vitest-results.json` — `numTotalTests: 3, numPassedTests: 2, numFailedTests: 1, numPendingTests: 0, numTodoTests: 0, numFailedTestSuites: 1`, one `testResults[0].assertionResults` failed entry with `failureMessages`.
  - `fixtures/npm-audit.json` — `metadata.vulnerabilities` totals plus one `vulnerabilities` entry with `severity: 'high'`, `via` object, `fixAvailable: true`.

- [ ] **Step 2: Write failing parser tests**

`.loopwright/tests/adapters.test.mjs` — one `describe` per adapter asserting real values, e.g.:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTscOutput } from '../scripts/adapters/tsc.mjs';
import { parseEslintJson } from '../scripts/adapters/eslint.mjs';
import { summarizeTestResults } from '../scripts/adapters/vitest.mjs';
import { jscpdArgs } from '../scripts/adapters/jscpd.mjs';

const fixture = (name) => readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');

describe('tsc adapter', () => {
  it('parses diagnostics and counts only errors', () => {
    const report = parseTscOutput(fixture('tsc-output.txt'));
    expect(report.errorCount).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.diagnostics[0]).toMatchObject({ file: 'src/a.ts', line: 3, code: 'TS2322', severity: 'error' });
  });
});

describe('eslint adapter', () => {
  it('normalizes to the neutral lint schema', () => {
    const report = parseEslintJson(fixture('eslint.json'));
    expect(report).toMatchObject({ ok: false, errors: 1, warnings: 1 });
    expect(report.messages[0]).toHaveProperty('rule');
    expect(['error', 'warning']).toContain(report.messages[0].severity);
  });
});

describe('vitest adapter', () => {
  it('summarizes counts and failure messages', () => {
    const summary = summarizeTestResults(JSON.parse(fixture('vitest-results.json')), false);
    expect(summary).toMatchObject({ ok: false, total: 3, passed: 2, failed: 1, suitesFailed: 1 });
    expect(summary.failures[0].message.length).toBeGreaterThan(0);
  });
});

describe('jscpd adapter', () => {
  it('derives formats from source extensions', () => {
    const args = jscpdArgs({ sources: { roots: ['src', 'app'], extensions: ['.ts', '.tsx'] } });
    expect(args.join(' ')).toContain('--format typescript,tsx');
    expect(args.slice(-2)).toEqual(['src', 'app']);
  });
});
```

- [ ] **Step 3: Run to verify failures**, then implement the five adapter bodies per the Interfaces block, porting logic from the old `run-report.mjs` (in git history at `.loopwright/scripts/run-report.mjs` pre-Task-3, i.e. `git show <task1-commit>:.loopwright/scripts/run-report.mjs`).

- [ ] **Step 4: Update `collect-metrics.mjs` `collectLint`** to read `lint.json` in the neutral schema:

```js
function collectLint(ctx) {
  const report = readJson(REPORTS_DIR, 'lint.json');
  if (!report) return ctx.missing.push('lint.json');
  ctx.metrics['lint.errors'] = report.errors ?? 0;
  ctx.metrics['lint.warnings'] = report.warnings ?? 0;
  const toEvidence = (m) => ({ file: m.file, line: m.line ?? 0, snippet: `${m.rule ?? 'unknown'}: ${m.message}` });
  ctx.evidence['lint.errors'] = (report.messages ?? []).filter((m) => m.severity === 'error').slice(0, 15).map(toEvidence);
  ctx.evidence['lint.warnings'] = (report.messages ?? []).filter((m) => m.severity === 'warning').slice(0, 15).map(toEvidence);
}
```

Also in `collectTests`, change the stale message `'(vitest produced no JSON)'` to `'(test runner produced no JSON)'`.

- [ ] **Step 5: Run all engine tests** — `cd .loopwright && npx vitest run`. Expected: PASS. Then a live end-to-end check: `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs` from the repo root. Expected: collectors run (typecheck prints `unconfigured (skipped)`), gate prints a verdict, `.loopwright/reports/` contains `typecheck.json` `{configured:false}`, `lint.json`, `test-summary.json`, `audit.json`, `jscpd/jscpd-report.json`.

- [ ] **Step 6: Commit** — `git add -A .loopwright && git commit -m "feat: extract tsc/eslint/vitest/npm-audit/jscpd adapters with neutral lint schema"`

---

### Task 5: New adapters — jest and biome

**Files:**
- Rewrite bodies: `.loopwright/scripts/adapters/jest.mjs`, `.loopwright/scripts/adapters/biome.mjs`
- Test: extend `.loopwright/tests/adapters.test.mjs`; add `fixtures/jest-results.json`, `fixtures/biome.json`

**Interfaces:**
- `jest.mjs`: jest's `--json` output uses the same field names vitest's JSON reporter mimics (`numTotalTests`, `numFailedTests`, `numPendingTests`, `numTodoTests`, `numFailedTestSuites`, `testResults[].assertionResults[]`). Implement `collect` by reusing vitest's summarizer: `import { summarizeTestResults } from './vitest.mjs';` — run command, read `test-results.json`, write `test-summary.json`. Same failure contract as Task 4.
- `biome.mjs`: `parseBiomeJson(stdout) -> neutral lint schema` (same shape as eslint's). Biome `--reporter=json` emits `{ summary: { errors, warnings }, diagnostics: [{ category, severity, description, location: { path: { file } } }] }`. Map: `errors`/`warnings` from `summary`; each diagnostic to `{ file: d.location?.path?.file ?? 'unknown', line: 0, severity: d.severity === 'error' ? 'error' : 'warning', rule: d.category ?? 'biome', message: d.description ?? '' }`. Line stays 0 — biome spans are byte offsets; converting is not worth it (note this in a code comment as a known limitation). Parse defensively: any missing field degrades to the defaults shown, never throws.

- [ ] **Step 1: Write fixtures.** `fixtures/jest-results.json`: same field names as the vitest fixture but different values (`numTotalTests: 5, numFailedTests: 2`, two failed assertionResults). `fixtures/biome.json`: `summary: { errors: 2, warnings: 1 }` and three diagnostics, one missing `location` entirely (exercises the defensive path).

- [ ] **Step 2: Write failing tests**

```js
describe('jest adapter', () => {
  it('reuses the shared summarizer over jest JSON output', () => {
    const summary = summarizeTestResults(JSON.parse(fixture('jest-results.json')), false);
    expect(summary).toMatchObject({ total: 5, failed: 2 });
    expect(summary.failures).toHaveLength(2);
  });
});

describe('biome adapter', () => {
  it('normalizes biome diagnostics to the neutral lint schema', () => {
    const report = parseBiomeJson(fixture('biome.json'));
    expect(report).toMatchObject({ ok: false, errors: 2, warnings: 1 });
    expect(report.messages).toHaveLength(3);
    expect(report.messages.find((m) => m.file === 'unknown')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Verify failure, implement, verify pass** — `cd .loopwright && npx vitest run`.

- [ ] **Step 4: Commit** — `git commit -am "feat: jest and biome adapters"`

---

### Task 6: Unconfigured semantics, failure blocking, and the anti-cheat baseline

**Files:**
- Modify: `.loopwright/scripts/lib/collect-metrics.mjs`, `.loopwright/scripts/lib/evaluate.mjs`, `.loopwright/scripts/quality-gate.mjs`, `.loopwright/scripts/lib/report.mjs`
- Test: `.loopwright/tests/gate-semantics.test.mjs`

**Interfaces:**
- Produces in `collect-metrics.mjs`:

  ```js
  export const COLLECTOR_METRICS = {
    typecheck: ['typecheck.errors'],
    lint: ['lint.errors', 'lint.warnings'],
    tests: ['tests.failed', 'tests.suitesFailed', 'coverage.lines', 'coverage.branches', 'coverage.functions', 'coverage.statements'],
    audit: ['audit.critical', 'audit.high', 'audit.suppressed'],
    duplication: ['duplication.percentage'],
  };
  ```

  `collectMetrics(root, config)` return gains two fields: `unconfigured: string[]` (collector names whose report is `{configured:false}`) and `failed: [{collector, error}]` (report missing, or `{ok:false, error}` form). Each family collector (`collectTypecheck` etc.) starts with a shared guard:

  ```js
  function familyStatus(ctx, collector, relativePath, baseDir = REPORTS_DIR) {
    const report = readJson(baseDir, relativePath);
    if (report === null) { ctx.failed.push({ collector, error: `${relativePath} missing — collector did not run` }); return null; }
    if (report.configured === false) { ctx.unconfigured.push(collector); return null; }
    if (report.ok === false && report.error) { ctx.failed.push({ collector, error: report.error }); return null; }
    return report;
  }
  ```

  Coverage attaches to the `tests` collector: `collectCoverage` only runs when `tests` is neither unconfigured nor failed; a missing `coverage/coverage-summary.json` while tests ran is a `failed` entry for `tests`.
- Produces in `evaluate.mjs`: `evaluateMetric` gains a `context = { unconfiguredMetricIds: Set, failedByMetricId: Map }` threaded from `evaluateMetrics(config, current, baselineMetrics, context)`. The `context` parameter is OPTIONAL and defaults to empty collections — the Task 2 characterization tests call `evaluateMetrics` with three arguments and must keep passing unchanged:
  - metric in `unconfiguredMetricIds` → `{ status: WARN, reason: 'collector not configured — see docs/loopwright/quality-gate.md' , current: null }` (fires BEFORE the hard-limit check, so `hardMin: 80` coverage cannot block a repo with no test runner).
  - metric in `failedByMetricId` → `{ status: BLOCK, reason: 'collector failed: <error>' }` (infrastructure failure must not look like success).
  - otherwise unchanged (missing data with a configured, non-failed collector remains WARN `'no data collected for this metric'`).
- Produces in `quality-gate.mjs`:
  - baseline gains `"collectors": { "typecheck": "unconfigured", "lint": "eslint", ... }` (copied from `config.collectors[*].adapter` at baseline time).
  - anti-cheat: in gate mode, for each collector where `baseline.collectors[name]` exists, is not `'unconfigured'`, and the current run has it in `unconfigured` → push a synthetic violation `{ status: 'block', file: '.loopwright/config.json', line: 0, subject: name, reason: 'collector "<name>" was configured at baseline ("<adapter>") but is now unconfigured — disabling a tool is not a way to pass the gate' }` into the `violations` array before computing `worst`.
  - `--update-baseline` refuses (`exit 2`) when `failed.length > 0`, message listing the failures; unconfigured collectors are ALLOWED in a baseline (that is the create-next-app day-one state).

- [ ] **Step 1: Write failing tests** — `gate-semantics.test.mjs` targets the pure layers (no subprocesses):

```js
import { describe, it, expect } from 'vitest';
import { STATUS, evaluateMetrics } from '../scripts/lib/evaluate.mjs';

const config = { metrics: {
  'coverage.lines': { direction: 'higher-better', hardMin: 80, tolerance: 0.5, onRegression: 'block' },
  'typecheck.errors': { direction: 'lower-better', hardMax: 0, tolerance: 0, onRegression: 'block' },
} };

describe('unconfigured collectors', () => {
  it('suppresses hard floors instead of phantom-blocking', () => {
    const [coverage] = evaluateMetrics(config, {}, undefined, {
      unconfiguredMetricIds: new Set(['coverage.lines']), failedByMetricId: new Map(),
    });
    expect(coverage.status).toBe(STATUS.WARN);
    expect(coverage.reason).toMatch(/not configured/);
  });
});

describe('failed collectors', () => {
  it('blocks — infra failure must not look like success', () => {
    const results = evaluateMetrics(config, {}, undefined, {
      unconfiguredMetricIds: new Set(), failedByMetricId: new Map([['typecheck.errors', 'typecheck.json missing — collector did not run']]),
    });
    const typecheck = results.find((entry) => entry.id === 'typecheck.errors');
    expect(typecheck.status).toBe(STATUS.BLOCK);
    expect(typecheck.reason).toMatch(/collector failed/);
  });
});
```

Plus a test for the anti-cheat helper: extract it as `export function collectorRegressions(baselineCollectors, unconfigured)` in `evaluate.mjs` returning the synthetic violations array, and assert: configured→unconfigured blocks; unconfigured→unconfigured is empty; no baseline is empty.

- [ ] **Step 2: Verify failures, implement across the four files per the Interfaces block.** In `quality-gate.mjs` gate mode: build `unconfiguredMetricIds` / `failedByMetricId` from `COLLECTOR_METRICS` + the `unconfigured`/`failed` arrays, pass to `evaluateMetrics`, concat `collectorRegressions(baseline?.collectors, unconfigured)` into `violations`. In `report.mjs`, render `current: null` metric rows as `n/a` (find the value-formatting call sites and route them through `format`; add `if (value === null) return 'n/a'` at the top of `format` in `evaluate.mjs`).

- [ ] **Step 3: Run all engine tests + live run** — `cd .loopwright && npx vitest run` PASS; then `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs` — expected: typecheck rows show `n/a … collector not configured`, verdict computed, exit 0 or 1.

- [ ] **Step 4: Commit** — `git commit -am "feat: unconfigured collector semantics with anti-cheat baseline rule"`

---

### Task 7: Multi-extension source analysis

**Files:**
- Modify: `.loopwright/scripts/lib/analyze-source.mjs`
- Test: `.loopwright/tests/analyze-source.test.mjs`, fixtures `fixtures/src-sample/{widget.tsx,legacy.jsx,util.mjs}`

**Interfaces:**
- `analyzeFile` currently hardcodes `ts.ScriptKind.TS`. Produce `scriptKindFor(path)`: `.tsx → ts.ScriptKind.TSX`, `.jsx → ts.ScriptKind.JSX`, `.js`/`.mjs`/`.cjs` → `ts.ScriptKind.JS`, else `ts.ScriptKind.TS`. Everything downstream (complexity, integrity scans) already works on any parsed AST.
- Jest test globals: `TEST_CALLEES`/`SUITE_CALLEES` already cover jest's names (`it/test/describe/x*/f*`) — no change needed; the test below proves it.

- [ ] **Step 1: Write fixtures.** `widget.tsx`: a component with JSX and one `it('renders', () => { expect(1).toBe(1) })`-style test call is NOT needed here — keep it a plain component with a ternary (complexity 2). `legacy.jsx`: a function with JSX and an `it.skip('old', () => {})`. `util.mjs`: a function with an empty `catch {}`.

- [ ] **Step 2: Write failing test**

```js
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { analyzeSources } from '../scripts/lib/analyze-source.mjs';

const root = join(import.meta.dirname, 'fixtures', 'src-sample');
const files = ['widget.tsx', 'legacy.jsx', 'util.mjs'].map((f) => join(root, f));

describe('multi-extension analysis', () => {
  const analysis = analyzeSources(files, root);
  it('parses tsx/jsx/mjs without dropping functions', () => {
    expect(analysis.totals.fileCount).toBe(3);
    expect(analysis.totals.functionCount).toBeGreaterThanOrEqual(3);
  });
  it('finds jest-style skipped tests and empty catches in js files', () => {
    expect(analysis.findings.skippedTests).toHaveLength(1);
    expect(analysis.findings.emptyCatches).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Verify failure (JSX parsed as ScriptKind.TS misreads `<` as a type argument, dropping/garbling functions), implement `scriptKindFor`, verify pass.**

- [ ] **Step 4: Commit** — `git commit -am "feat: analyze js/jsx/tsx/mjs sources"`

---

### Task 8: Stack detector + default config

**Files:**
- Create: `.loopwright/scripts/detect-stack.mjs`, `.loopwright/config.default.json`
- Test: `.loopwright/tests/detect-stack.test.mjs`

**Interfaces:**
- `config.default.json`: the full current `limits` + `metrics` + `audit` sections from `.loopwright/config.json`, with `sources` and `collectors` left as `{}` (the detector fills them).
- `detect-stack.mjs` exports `detectStack(hostRoot) -> { sources, collectors, notices: string[] }` (pure-ish: reads fs, no writes) and, when run as a script, merges the detection over `config.default.json` and writes `CONFIG_PATH` — refusing (exit 2, message) if `CONFIG_PATH` already exists.
- Detection rules (exact):
  - deps = merged `dependencies` + `devDependencies` of host `package.json` (missing file → all collectors unconfigured, notice).
  - typecheck: `typescript` in deps AND `tsconfig.json` exists → `tsc`; else unconfigured + notice.
  - lint: `biome.json` or `biome.jsonc` exists → `biome`; else `eslint` in deps or any of `eslint.config.js|mjs|cjs|.eslintrc*` exists → `eslint`; else unconfigured + notice.
  - tests: `vitest` in deps → `vitest`; else `jest` in deps → `jest`; else unconfigured + notice `"tests: no runner configured"`.
  - audit: `package-lock.json` exists → `npm-audit`; else unconfigured + notice naming the lockfile it did find (yarn.lock/pnpm-lock.yaml) or none.
  - duplication: always `jscpd`.
  - `sources.roots`: the subset of `['src', 'app', 'pages', 'lib', 'components', 'server', 'tests', '__tests__', 'test']` that exist as directories (fallback `['.']` never — if none exist, `['src']` + notice). `sources.extensions`: TS detected → `['.ts', '.tsx']`; else `['.js', '.jsx', '.mjs']`.

- [ ] **Step 1: Write failing tests** — build fixture host dirs on the fly with `mkdtempSync`:

```js
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectStack } from '../scripts/detect-stack.mjs';

function host(pkg, files = [], dirs = []) {
  const dir = mkdtempSync(join(tmpdir(), 'lw-host-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
  for (const d of dirs) mkdirSync(join(dir, d), { recursive: true });
  for (const f of files) writeFileSync(join(dir, f), '{}');
  return dir;
}

describe('detectStack', () => {
  it('reads a create-next-app repo: eslint + tsc, no test runner', () => {
    const dir = host(
      { dependencies: { next: '15.0.0', react: '19.0.0' }, devDependencies: { typescript: '^5', eslint: '^9', 'eslint-config-next': '15.0.0' } },
      ['tsconfig.json', 'package-lock.json'], ['app'],
    );
    const result = detectStack(dir);
    expect(result.collectors.typecheck.adapter).toBe('tsc');
    expect(result.collectors.lint.adapter).toBe('eslint');
    expect(result.collectors.tests.adapter).toBe('unconfigured');
    expect(result.collectors.audit.adapter).toBe('npm-audit');
    expect(result.sources).toEqual({ roots: ['app'], extensions: ['.ts', '.tsx'] });
    expect(result.notices.join(' ')).toMatch(/no runner/);
  });

  it('prefers biome config over eslint deps, detects jest', () => {
    const dir = host({ devDependencies: { jest: '^29', eslint: '^9' } }, ['biome.json', 'package-lock.json'], ['src']);
    const result = detectStack(dir);
    expect(result.collectors.lint.adapter).toBe('biome');
    expect(result.collectors.tests.adapter).toBe('jest');
    expect(result.sources.extensions).toEqual(['.js', '.jsx', '.mjs']);
  });

  it('degrades to unconfigured everywhere on a bare repo', () => {
    const dir = host({}, [], []);
    const result = detectStack(dir);
    for (const name of ['typecheck', 'lint', 'tests', 'audit']) {
      expect(result.collectors[name].adapter).toBe('unconfigured');
    }
    expect(result.collectors.duplication.adapter).toBe('jscpd');
  });
});
```

- [ ] **Step 2: Verify failure, implement `detect-stack.mjs` and `config.default.json`, verify pass.** Script mode ends by printing each collector choice and every notice, then `config.json written — review it, then record a baseline.`

- [ ] **Step 3: Commit** — `git add -A .loopwright && git commit -m "feat: stack detector generates config.json from host repo"`

---

### Task 9: Installer, setup.sh move, CLAUDE.md section asset

**Files:**
- Create: `install.sh` (repo root), `.loopwright/claude-md-section.md`
- Move+modify: `scripts/setup.sh` → `setup.sh` (repo root; `git rm -r scripts` after — the dir is then empty)
- Test: `.loopwright/tests/installer.test.sh` (bash, run manually here; wired into CI in Task 10)

**Interfaces:**
- `install.sh` contract (spec §Installer): run from the target repo root. Env override `LOOPWRIGHT_SOURCE=/abs/path` skips the download and copies from that checkout (used by tests/CI). Download default: `curl -fsSL https://codeload.github.com/SamuelDenani/loopwright/tar.gz/refs/heads/main | tar -xz -C "$tmp"`.
- Copy semantics: `.loopwright/scripts/`, `.loopwright/config.default.json`, `.loopwright/package.json`, `.loopwright/package-lock.json`, `.loopwright/vitest.config.mjs`, `.loopwright/tests/`, `.loopwright/claude-md-section.md` are ALWAYS synced (engine). `.claude/`, `.github/`, `.githooks/`, `docs/loopwright/`, `setup.sh` are copied file-by-file ONLY when the destination file does not exist. `config.json` and `baseline.json`: never touched if present.

- [ ] **Step 1: Write `install.sh`**

```bash
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
mkdir -p .loopwright
rm -rf .loopwright/scripts .loopwright/tests
cp -R "$src/.loopwright/scripts" "$src/.loopwright/tests" .loopwright/
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
grep -qx '\.loopwright/reports/' .gitignore || printf '.loopwright/reports/\n.loopwright/node_modules/\n' >> .gitignore
start='<!-- loopwright:start -->'; end='<!-- loopwright:end -->'
touch CLAUDE.md
if grep -qF "$start" CLAUDE.md; then
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
```

Note: the awk marker-splice replaces the section body in place; the section asset must NOT itself contain the markers.

- [ ] **Step 2: Write `.loopwright/claude-md-section.md`** — the host-facing content adapted from today's CLAUDE.md "Working on a PR" + "Do not do these" + commands sections, with paths updated: commands are `node .loopwright/scripts/run-report.mjs --all`, `node .loopwright/scripts/quality-gate.mjs` (and `--update-baseline`); the report is `.loopwright/reports/quality-gate.json`; the baseline is `.loopwright/baseline.json`; the config is `.loopwright/config.json`; docs pointer `docs/loopwright/quality-gate.md` and `docs/loopwright/loop-harness.md`. Keep the "Do not do these" list verbatim (it is stack-agnostic) with `quality-baseline.json` renamed.

- [ ] **Step 3: Move and update `setup.sh`** — `git mv scripts/setup.sh setup.sh`; inside: baseline block becomes

```bash
if [ -f .loopwright/baseline.json ]; then
  echo "baseline ok:    .loopwright/baseline.json exists"
else
  node .loopwright/scripts/run-report.mjs --all
  node .loopwright/scripts/quality-gate.mjs --update-baseline
  echo "baseline created — review and commit it:"
  echo "  ALLOW_BASELINE=1 git commit .loopwright/baseline.json -m 'chore: record initial quality baseline'"
fi
```

and branch protection reads the default branch instead of hardcoding main: `BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)` used in the API path. Drop the `npm install` line (install.sh already ran `npm ci` in `.loopwright/`; host deps are the host's business).

- [ ] **Step 4: Write `.loopwright/tests/installer.test.sh`**

```bash
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

LOOPWRIGHT_SOURCE="$SOURCE" bash "$SOURCE/install.sh"

[ -f .loopwright/config.json ] || { echo "FAIL: no config.json generated"; exit 1; }
grep -q '"adapter": "unconfigured"' .loopwright/config.json || { echo "FAIL: tests should be unconfigured"; exit 1; }
grep -q 'loopwright:start' CLAUDE.md || { echo "FAIL: CLAUDE.md section missing"; exit 1; }

node .loopwright/scripts/run-report.mjs --all
node .loopwright/scripts/quality-gate.mjs || true   # verdict may be block; we assert it RAN
[ -f .loopwright/reports/quality-gate.json ] || { echo "FAIL: gate produced no verdict"; exit 1; }

# Idempotency: second run must not duplicate the CLAUDE.md section or gitignore lines
LOOPWRIGHT_SOURCE="$SOURCE" bash "$SOURCE/install.sh"
[ "$(grep -c 'loopwright:start' CLAUDE.md)" = "1" ] || { echo "FAIL: CLAUDE.md section duplicated"; exit 1; }
[ "$(grep -cx '\.loopwright/reports/' .gitignore)" = "1" ] || { echo "FAIL: gitignore duplicated"; exit 1; }
echo "installer smoke test: PASS"
```

- [ ] **Step 5: Run it** — `chmod +x install.sh setup.sh .loopwright/tests/installer.test.sh && bash .loopwright/tests/installer.test.sh`
Expected: `installer smoke test: PASS`. (The fixture's `npx tsc`/`npx eslint` resolve nothing installed — the tsc/eslint adapters hit the Task 4 failure contract and the gate blocks on `collector failed`; that still asserts the pipeline end-to-end. The verdict content is CI's concern, existence is this test's.)

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: vendoring installer with idempotent host integration"`

---

### Task 10: CI workflows and pre-commit hook

**Files:**
- Rewrite: `.github/workflows/quality-gate.yml`, `.githooks/pre-commit`

**Interfaces:**
- Consumes: `node .loopwright/scripts/run-report.mjs <name|--all>`, `node .loopwright/scripts/quality-gate.mjs` (outputs `verdict`/`blocking` to `GITHUB_OUTPUT` — unchanged), `node .loopwright/scripts/sticky-comment.mjs`, `bash .loopwright/tests/installer.test.sh`.

- [ ] **Step 1: Rewrite `quality-gate.yml`** — keep name, triggers, concurrency, permissions, timeout as-is. Steps become:

```yaml
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            package-lock.json
            .loopwright/package-lock.json

      - name: Install host dependencies
        run: npm ci

      - name: Install engine dependencies
        run: npm ci
        working-directory: .loopwright

      - name: Engine unit tests (loopwright repo only guard is unnecessary — vendored copies ship tests too)
        run: npx vitest run
        working-directory: .loopwright

      # Collectors write reports and exit 0; the gate is the only failing step.
      - name: Collect reports
        run: node .loopwright/scripts/run-report.mjs --all

      - name: Quality gate
        id: gate
        continue-on-error: true
        run: node .loopwright/scripts/quality-gate.mjs

      - name: Installer smoke test
        run: bash .loopwright/tests/installer.test.sh

      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: quality-reports-${{ github.run_id }}-${{ github.run_attempt }}
          path: .loopwright/reports/
          retention-days: 14
          if-no-files-found: warn

      - name: Sticky PR comment
        if: always() && github.event_name == 'pull_request'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: node .loopwright/scripts/sticky-comment.mjs .loopwright/reports/quality-gate.md

      - name: Enforce verdict
        if: steps.gate.outputs.verdict == 'block' || steps.gate.outcome == 'failure'
        run: |
          echo "Quality gate blocked this PR: ${{ steps.gate.outputs.blocking }} blocker(s)."
          exit 1
```

Caveat for vendored hosts: the "Engine unit tests" and "Installer smoke test" steps are loopwright-repo dogfooding; the workflow file that `install.sh` copies must NOT contain them. Solution without maintaining two files: guard both steps with `if: github.repository == 'SamuelDenani/loopwright'`.

- [ ] **Step 2: Rewrite `.githooks/pre-commit`** — host-agnostic version keeps only what needs no host stack:
  - the gated-shortcut greps, with the diff filter widened to `'*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs'`;
  - the baseline guard, path changed to `.loopwright/baseline.json` (same `ALLOW_BASELINE=1` escape);
  - DELETE the `npm run -s typecheck` and staged-eslint sections (they assumed the template's stack; CI is the authority).
  Update the top comment accordingly.

- [ ] **Step 3: Verify** — `bash -n .githooks/pre-commit && bash -n install.sh && bash -n setup.sh` (syntax), then `npx action-validator .github/workflows/quality-gate.yml || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/quality-gate.yml'))"` (YAML parses).

- [ ] **Step 4: Commit** — `git commit -am "ci: drive quality gate through vendored engine; host-agnostic pre-commit"`

---

### Task 11: Docs and agent/skill reference sweep

**Files:**
- Move+modify: `docs/quality-gate.md`, `docs/loop-harness.md` → `docs/loopwright/`
- Modify: `CLAUDE.md`, `README.md`, `.claude/agents/{coder,reviewer}.md`, `.claude/skills/{babysit-pr,execute-issue}/SKILL.md`

**Interfaces:** none — purely textual, but the replacements are exact:

| old | new |
|---|---|
| `quality-baseline.json` | `.loopwright/baseline.json` |
| `quality-gate.config.json` | `.loopwright/config.json` |
| `reports/quality-gate.json` (and `.md`) | `.loopwright/reports/quality-gate.json` (`.md`) |
| `scripts/quality-gate.mjs` | `.loopwright/scripts/quality-gate.mjs` |
| `npm run quality` | `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs` |
| `npm run quality:collect` | `node .loopwright/scripts/run-report.mjs --all` |
| `npm run quality:gate` | `node .loopwright/scripts/quality-gate.mjs` |
| `npm run quality:baseline` | `node .loopwright/scripts/quality-gate.mjs --update-baseline` |
| `docs/quality-gate.md`, `docs/loop-harness.md` | `docs/loopwright/...` |

- [ ] **Step 1:** `mkdir -p docs/loopwright && git mv docs/quality-gate.md docs/loop-harness.md docs/loopwright/`, then apply the table's replacements across the six files (grep each old string afterward to confirm zero hits outside `docs/superpowers/`).

- [ ] **Step 2: Rewrite the repo's own `CLAUDE.md`** as: a short header ("Built from the loopwright project — this repo IS the product; the engine lives in `.loopwright/scripts/`, its tests in `.loopwright/tests/`") followed by the marker-delimited section spliced verbatim from `.loopwright/claude-md-section.md` (run the installer's awk splice or paste by hand — content must be byte-identical to the asset so dogfooding is honest). Add one engine-development line: `cd .loopwright && npx vitest run` runs the engine tests.

- [ ] **Step 3: Update `README.md`** — the adoption section becomes the installer one-liner (`curl -fsSL https://raw.githubusercontent.com/SamuelDenani/loopwright/main/install.sh | bash`) followed by `./setup.sh`; the component table points at `.loopwright/scripts/quality-gate.mjs`, `.loopwright/config.json`, `install.sh`, `docs/loopwright/`.

- [ ] **Step 4: Verify** — `grep -rn "quality-baseline\|quality-gate\.config\|npm run quality\|scripts/quality-gate" README.md CLAUDE.md docs/loopwright .claude .github .githooks` → only `.loopwright/`-prefixed forms appear.

- [ ] **Step 5: Commit** — `git commit -am "docs: point all guidance at the vendored .loopwright layer"`

---

### Task 12: Dogfood config, baseline, green run

**Files:**
- Modify: `.loopwright/config.json` (final dogfood values)
- Create: `.loopwright/baseline.json` (generated)

- [ ] **Step 1: Finalize `.loopwright/config.json`** — confirm the Task 1 values still stand: sources `[".loopwright/scripts", ".loopwright/tests"]` / `[".mjs"]`; collectors typecheck=unconfigured (engine is JS — this deliberately exercises the unconfigured path in production), lint=eslint (default command), tests=vitest with `"command": "npx vitest run --coverage"` and `"cwd": ".loopwright"` (the engine's own vitest config routes outputs to `.loopwright/reports/`), audit=npm-audit, duplication=jscpd. Exclude fixtures from duplication noise: add `"ignore": ["**/fixtures/**"]` to `sources`.

- [ ] **Step 2: Full run** — `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs`
Expected: exit 0 or a small set of real blockers (e.g. engine coverage below 80). Fix real findings the honest way (more tests, smaller functions) — NOT by loosening `config.json`. Iterate until exit 0 with only the typecheck-unconfigured warning (plus acceptable warns).

- [ ] **Step 3: Record the baseline** — `node .loopwright/scripts/quality-gate.mjs --update-baseline`
Then inspect `.loopwright/baseline.json`: it must contain the `collectors` map with `"typecheck": "unconfigured"` and `"tests": "vitest"`.

- [ ] **Step 4: Re-gate against the fresh baseline** — `node .loopwright/scripts/quality-gate.mjs` → exit 0, and `cd .loopwright && npx vitest run` → all green, and `bash .loopwright/tests/installer.test.sh` → PASS.

- [ ] **Step 5: Commit (baseline guard applies)**

```bash
git add -A
ALLOW_BASELINE=1 git commit -m "chore: dogfood config and initial engine baseline"
```

- [ ] **Step 6: Push the branch and confirm the Quality gate workflow goes green in CI before merging.**
