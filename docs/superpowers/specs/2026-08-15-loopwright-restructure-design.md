# Loopwright restructure: from repo template to vendorable layer

**Date:** 2026-08-15
**Status:** Approved design, pending implementation plan

## Problem

Loopwright today is a GitHub repo template: adopting it means being born
from it. That conflicts with basically every real repo structure — the
template owns the root `package.json`, `tsconfig.json`, `eslint.config.js`,
`vitest.config.ts`, `src/`, `tests/`, `CLAUDE.md` and `.gitignore`, all of
which a host repo (existing or freshly scaffolded, e.g. by
`create-next-app`) already owns. It also hard-codes the template's stack
(vitest + eslint + tsc), so a repo using jest or biome cannot adopt it at
all. Finally, `coverage/` and `reports/` are committed build artifacts —
a bug regardless of this redesign.

## Goal

Loopwright stops being a starting point and becomes a **layer applied onto
any JS/TS repo**, new or existing. One installer command drops it in; the
quality gate wraps the host's own tooling instead of shipping its own.

Non-goals: non-JS/TS stacks (Python, Go — a possible v2, the report
contract leaves the door open); an npm-published package (vendoring was
chosen deliberately: the engine stays readable and hackable by agents in
the host repo, and no publishing infra is needed).

## Decisions made

- **Target repos:** JS/TS with their own stack (jest or vitest, eslint or
  biome, TS optional). A fresh `create-next-app` output counts as an
  "existing repo" — it already owns package.json, lint config, structure.
- **Adoption mechanism:** an installer that vendors the engine into the
  host repo. Updates = re-run the installer.
- **Tooling binding:** built-in adapters selected by config (approach A),
  not per-repo glue (B) and not a fixed stack (C). The adapters all emit
  the same report contract, so B effectively exists underneath A.

## File layout in a host repo

```
host-repo/
├── .loopwright/
│   ├── package.json          # gate-only deps (jscpd, vitest for engine tests…)
│   ├── config.json           # replaces quality-gate.config.json
│   ├── baseline.json         # replaces quality-baseline.json (committed)
│   ├── scripts/              # the engine: quality-gate.mjs, run-report.mjs,
│   │   ├── adapters/         #   lib/, sticky-comment.mjs, adapters/
│   │   └── lib/
│   └── reports/              # gitignored
├── .claude/                  # skills + agents (mandatory path, additive)
├── .github/                  # workflows + issue templates (mandatory path, additive)
├── .githooks/pre-commit      # additive
└── docs/loopwright/*.md      # docs move under a namespaced subdir
```

Dropped from the template: `src/seed.ts`, `tests/seed.test.ts`, the root
`package.json` scripts/devDeps for the host's stack, root tool configs.
The host owns its stack; loopwright never competes for those files.

Host files the installer touches (minimally):

- `.gitignore`: adds `.loopwright/reports/`.
- `CLAUDE.md`: a loopwright section delimited by
  `<!-- loopwright:start -->` / `<!-- loopwright:end -->` markers, created
  if the file does not exist; re-installs replace only that section.
- Nothing else. No host `package.json` script entries — CI and humans call
  `node .loopwright/scripts/...` directly.

## Components

### 1. Gate engine (`.loopwright/scripts/`)

The existing `quality-gate.mjs`, `run-report.mjs`, `lib/` and
`sticky-comment.mjs`, relocated, with paths parameterized by
`config.json` (source roots, extensions, reports dir, baseline path).
Unchanged principles: collectors write JSON reports; the gate is the only
process allowed to fail the build; the baseline is a one-way ratchet.

### 2. Adapters (`.loopwright/scripts/adapters/`)

One small module per tool, uniform interface: receive `{command, options}`
from config, run the host's tool, normalize output into the corresponding
report schema, always exit 0. Initial set: `tsc`, `eslint`, `biome`,
`vitest`, `jest`, `npm-audit`, `jscpd`. Five already exist hardcoded
inside today's `run-report.mjs`; `biome` and `jest` are new. Each adapter
defines a default `command`; config overrides it when the host needs to
(monorepo, `next lint`, …). Exotic stacks can add their own adapter
module in the vendored copy.

`analyze-source.mjs` (integrity: assertionless tests, `@ts-ignore`,
empty catches, …) is not an adapter — it reads sources directly and is
runner-agnostic; it only needs to recognize jest globals alongside
vitest's.

### 3. Stack detector (part of the installer)

Reads the host's `package.json` and config files, answers: which test
runner, which linter, is there TypeScript? Simple presence rules
(e.g. `biome.json` → biome adapter). Also fills `sources.roots` from what
exists (`src/`, `app/`, `pages/`, `tests/`, `__tests__/`). No clever
heuristics: ambiguous or absent → collector written as `"unconfigured"`
plus a notice at the end of installation.

### 4. Installer (`install.sh` in the loopwright repo)

Run from inside the target repo:

```bash
curl -fsSL https://raw.githubusercontent.com/SamuelDenani/loopwright/main/install.sh | bash
```

Steps, in order:

1. Validate preconditions: git repo, `package.json` present.
2. Download the loopwright tarball (codeload archive; no clone needed).
3. Copy `.loopwright/scripts/` **always** (it is the updatable engine).
   Copy `.claude/`, `.github/`, `.githooks/`, `docs/loopwright/`
   file-by-file **only when absent** — never overwrite an edited workflow.
4. If `config.json` is absent, run the detector and generate it. Never
   overwrite an existing `config.json` or `baseline.json`.
5. Host touches: `.gitignore` entry, marker-delimited `CLAUDE.md` section.
6. `npm ci` inside `.loopwright/`.
7. Offer to run `setup.sh` (GitHub side: labels, branch protection,
   secret check, initial baseline) — separate because it needs an
   authenticated `gh`.

Finishes by printing what it did, what it skipped, and what is
`unconfigured`. Fails early and loud (`set -euo pipefail`); since it
copies-when-absent, an interrupted run is safe to repeat.

## Config format

`config.json` keeps today's `limits`, `metrics` and `audit.ignore`
sections and adds `collectors`:

```json
{
  "sources": { "roots": ["src", "app", "tests"], "extensions": [".ts", ".tsx"] },
  "collectors": {
    "typecheck":   { "adapter": "tsc" },
    "lint":        { "adapter": "eslint" },
    "tests":       { "adapter": "vitest", "command": "npx vitest run --coverage" },
    "audit":       { "adapter": "npm-audit" },
    "duplication": { "adapter": "jscpd" }
  }
}
```

(`limits`, `metrics` and `audit.ignore` omitted above — they carry over
from today's `quality-gate.config.json` unchanged.)

## Data flow

```
adapters → .loopwright/reports/*.json → quality-gate.mjs → verdict
                                              ↕
                                   .loopwright/baseline.json
```

The gate writes `quality-gate.json` + `quality-gate.md` into
`.loopwright/reports/`; `sticky-comment.mjs` posts the `.md` to the PR.
Everything under `.loopwright/reports/` is gitignored.

## Missing tool: `"adapter": "unconfigured"`

The create-next-app case (no test runner on day one):

- The collector writes `{ configured: false }`; its metrics render as
  `n/a` with a fixed warning ("tests: no runner configured") on every PR.
  It never blocks.
- `hardMin`/`hardMax` for those metrics do not apply — no phantom
  "coverage 0%" blocking the repo.
- Once the tool is configured and the baseline re-recorded, the ratchet
  applies from the real numbers.
- **Anti-cheat:** the baseline records which collectors were configured.
  If the baseline had a collector configured and a PR arrives with it
  unconfigured, that is a regression and **blocks** — disabling the
  runner cannot be the way to pass the gate.

## CI workflow changes

`quality-gate.yml` changes little: add `npm ci` inside `.loopwright/`
(with its own cache key), replace the `npm run *:ci` steps with
`node .loopwright/scripts/run-report.mjs <collector>` driven by the
config's collector list, and point artifact/comment paths at
`.loopwright/reports/`. The host's own "Install dependencies" step
remains — adapters run the host's tools, which need the host's
`node_modules`.

## Error handling

- Adapters never fail the workflow (exit 0 always).
- A tool that fails to *run* (not installed, wrong command) produces
  `{ ok: false, error: "…" }` and that **blocks** at the gate —
  infrastructure failure must not look like success. Unparseable output:
  same treatment.
- The installer is the opposite: fail fast and loud.

## Testing

The engine becomes the product, so it gets real tests (vitest, inside
`.loopwright/`):

- **Adapters:** fixtures of real tsc/eslint/biome/vitest/jest output →
  expected normalized report.
- **Detector:** package.json + config-file fixtures → expected generated
  `config.json`.
- **Evaluate/baseline:** regression, tolerance, ratchet, and the
  unconfigured-collector anti-cheat rule.
- **Installer smoke test (CI):** scaffold a create-next-app-like fixture
  repo in a tmpdir, run `install.sh`, assert the gate runs and produces a
  verdict.

The loopwright repo dogfoods itself: its own `.loopwright/` install runs
the gate over the engine's sources and tests on every PR.

## Migration of this repo

The template repo itself is restructured in place: engine moves under
`.loopwright/`, seed src/tests and root tool configs die, docs move to
`docs/loopwright/`, committed `coverage/` and `reports/` are removed from
git, `install.sh` is added at the root. Its README changes from "use this
template" to "run this installer".
