# loopwright

**A CI quality gate for repos where agents write the code — plus the loop that
feeds it.** Vendor it into any JS/TS repo: every PR gets scored against a
committed baseline, and the verdict comes back as a comment an agent can act on
without a human translating it first.

> *A wright is a maker — a shipwright builds ships, a playwright builds plays.
> A loopwright builds loops.*

## Why

Ask an agent to make CI green and it usually will. Sometimes by fixing the code.
Sometimes by adding `.only`, deleting the assertion, dropping in a `@ts-ignore`,
or swallowing the failure in an empty `catch`. Those shortcuts are invisible to
the tools you already run — lint, `tsc` and the test runner all report success,
because success is exactly what you asked them about.

So loopwright asks two questions conventional CI doesn't:

**Did this PR make the repo worse?** Not "is this code good". Coverage,
duplication, complexity, file and function shape, advisories — each is scored
against a committed baseline with its own tolerance, and each file's existing
debt is grandfathered. A 400-line legacy file blocks nothing; adding a line to
it blocks. That's what makes the gate adoptable on a codebase with history: you
don't have to fix the past to start protecting the present.

**Was this green earned or bought?** Skipped tests, `.only`, assertion-free
tests, coverage-ignore hints, type suppressions, inline `eslint-disable` and
empty catch blocks are each a first-class metric, ratcheted at zero tolerance.
None of them fail any normal tool, which is precisely why they need their own
gate.

Hard floors sit on top of the ratchet (80% line coverage, 0 lint errors, 0
critical advisories, 5% duplication), so the baseline can't be ratcheted
downwards into nothing.

## What a blocked PR looks like

One comment, blockers first, each with a concrete instruction and `file:line`
evidence — written for the agent that has to fix it:

> ### ❌ Quality gate failed — 2 blocker(s)
>
> commit `4f1c9ae` · baseline `ece7656` · 1 warning(s)
>
> **🚫 Blockers**
>
> | | Check | Baseline | Now | Verdict |
> |---|---|---|---|---|
> | 🚫 | Line coverage | 84.67% | 78.42% | 78.42% is below the hard floor of 80% |
> | 🚫 | Focused tests (.only) | 0 | 1 | 1 exceeds the hard limit of 0 |
>
> **🛠️ What to do**
>
> 1. **Line coverage** (78.42%) — Add real tests covering the uncovered lines listed below. Do not add coverage-ignore hints.
> 2. **Focused tests (.only)** (1) — Remove `.only` — it silently disables every other test in the file.
>
> <details><summary>Evidence (file:line)</summary>
>
> **Focused tests (.only)**
> - `src/cart/total.test.ts:12` — `describe.only('applies the discount', () => {`
>
> </details>

The same content is written to `.loopwright/reports/quality-gate.json`, so a
babysitting agent reads structured findings instead of scraping logs. Warnings
and the full metric table are folded away; blockers are never buried.

## Install

Into a repo you already have (or one `create-next-app` just made):

```bash
curl -fsSL https://raw.githubusercontent.com/SamuelDenani/loopwright/main/install.sh | bash
./setup.sh        # gh auth required: labels, branch protection, initial baseline
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # if setup reported it missing
```

`install.sh` is idempotent. It syncs the engine under `.loopwright/scripts/`,
copies integration files (`.claude/`, `.github/`, `.githooks/`, docs) only when
they're absent, and never touches your `config.json` or `baseline.json`. Your
stack stays yours: loopwright owns `.loopwright/` and nothing else.

**Or use this repo as a template** if you'd rather own the layer itself — you
get the engine, its 148 tests and its docs as a starting point to modify. Point
`sources.roots` in `.loopwright/config.json` at your code and re-baseline.

## Your stack, not loopwright's

Each collector picks an adapter, and the installer detects which one you're on:

| Collector | Adapters |
|---|---|
| `typecheck` | `tsc` |
| `lint` | `eslint`, `biome` |
| `tests` + coverage | `vitest`, `jest` |
| `audit` | `npm-audit` |
| `duplication` | `jscpd` |

Anything the detector can't find is written as `unconfigured`: it warns forever
and never blocks, and it suppresses that family's hard floors — so a fresh app
with no test runner yet isn't held hostage by a coverage requirement it can't
meet. Wiring one up later is a config line. Turning a *configured* collector
back to `unconfigured` is itself a blocking violation, because disabling a tool
is not a way to pass the gate.

A tool that's configured but can't run writes `{ok: false, error}` and **blocks**.
Infrastructure failure must never look like success.

### Package managers

npm, pnpm and yarn all work. Adapters invoke bare binaries (`tsc`, `vitest`, …)
and the engine resolves them from your `node_modules/.bin` — never through
`npx`, which falls back to the registry and will happily download an unrelated
package of the same name when your dependencies aren't installed. The CI
workflow installs host dependencies with whichever package manager your lockfile
names.

`audit` is the one collector that is npm-only: `pnpm audit --json` and
`yarn npm audit` emit a different report shape than `npm-audit` parses, so on a
pnpm or yarn host the detector leaves `audit` **unconfigured** rather than
wiring an adapter that would silently report zero advisories.

## The loop

The gate is the enforcement half. The other half is how work reaches it:

```
RFC issue ──/grill-rfc──► task sub-issues ──/execute-issue──► draft PR ──/babysit-pr──► ready, green
             agent               native parent /              planner (Opus)      gate red → fix & push
             interrogates        blocked-by edges             coder (Sonnet, TDD)  green → ready for review
             the design                                       reviewer (fresh ctx) review findings → answer
```

Three Claude Code skills (`.claude/skills/`) and three agents
(`.claude/agents/`) drive it. State lives in artifacts — the refined RFC on the
issue, a committed spec in `docs/specs/`, one commit per plan step, the PR
conversation — so any session or human can pick up a half-finished task from
the repo alone.

Two rules hold the whole thing together: **the gate is the only source of truth
for "done"**, and **merging is always the human's decision.**

## Running it

```bash
node .loopwright/scripts/run-report.mjs --all   # collect every report
node .loopwright/scripts/quality-gate.mjs       # score them (exactly what CI runs)
node .loopwright/scripts/quality-gate.mjs --update-baseline
```

Exit codes: `0` pass (warnings allowed), `1` blocked, `2` could not run. Only
`quality-gate.mjs` can fail the build — every collector exits 0 and writes a
report, so one broken tool still leaves you a complete picture and one
authoritative verdict.

## How it's wired

| Piece | Where |
|---|---|
| Flow overview | `docs/loopwright/loop-harness.md` |
| Gate design, metric by metric | `docs/loopwright/quality-gate.md` |
| Gate engine + adapters | `.loopwright/scripts/` |
| Policy (metrics, limits, collectors) | `.loopwright/config.json` |
| Ratchet | `.loopwright/baseline.json` |
| Agents / skills | `.claude/agents/`, `.claude/skills/` |
| CI | `.github/workflows/` |
| Installer / one-time GitHub setup | `install.sh`, `setup.sh` |

## Requirements

- Node ≥ 20.11 and a `package.json` (loopwright targets JS/TS repos)
- npm, pnpm or yarn — the engine and its CI workflow detect which from your lockfile
- [`gh`](https://cli.github.com), authenticated
- [Claude Code](https://claude.com/claude-code) locally, and the
  [Claude GitHub App](https://github.com/apps/claude) on the repo for the
  review workflow

## This repo runs on itself

The engine that ships to your repo lives here under `.loopwright/scripts/`,
covered by 148 tests in `.loopwright/tests/`, gated by the same workflow that
will gate your PRs — baseline, integrity metrics and all. If the gate is wrong,
it's wrong here first.

## License

MIT — see [`LICENSE`](LICENSE). Vendoring the layer does not license your repo;
what `install.sh` copies is yours to modify.
