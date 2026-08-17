# Quality gate

A CI gate designed for agentic development: it blocks the merge, explains
exactly what is wrong in the PR comment, and gives an agent enough structured
detail to fix it and push again without a human in the loop.

## The one rule

**`.loopwright/scripts/quality-gate.mjs` is the only step allowed to fail the build.**

Everything upstream — `tsc`, `eslint`, `vitest`, `npm audit`, `jscpd` — runs
non-blocking and just writes reports to `.loopwright/reports/`. That way a
failing test still produces a complete picture instead of aborting the
workflow half-way, and the agent always gets one authoritative verdict to
work against.

```
node .loopwright/scripts/run-report.mjs --all
  ├─ typecheck (tsc)      ─┐
  ├─ lint (eslint/biome)   │
  ├─ tests (vitest/jest)   ├─ each adapter exits 0, writes .loopwright/reports/*.json
  ├─ audit (npm audit)     │
  └─ duplication (jscpd)  ─┘
       │
       ▼
node .loopwright/scripts/quality-gate.mjs
  └─► .loopwright/reports/quality-gate.{json,md} + exit 0|1
       └─ sticky comment + step summary + artifacts
```

## Running it locally

```bash
node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs
# collect everything, then gate (same as CI)

node .loopwright/scripts/run-report.mjs --all
# just refresh the reports

node .loopwright/scripts/quality-gate.mjs
# just re-score the existing reports (fast)

node .loopwright/scripts/quality-gate.mjs --update-baseline
# record the current state as the new baseline
```

Exit codes: `0` pass (warnings allowed), `1` blocked, `2` could not run.

## Baselines

`.loopwright/baseline.json` is the ratchet. It is committed, and every PR is scored
against it: the question is never "is this code good" but "does this PR make it
worse". That is what makes the gate adoptable on an existing codebase — you do
not have to fix the past to start protecting the present.

It records three things:

- **metric values** — coverage, duplication, complexity, lint counts, etc.
- **per-file shape** — code lines per file, and per-function length, complexity,
  nesting depth and parameter count
- **provenance** — the commit and timestamp it was taken from

Regenerate it deliberately, never to make a red build green:

```bash
node .loopwright/scripts/run-report.mjs --all
node .loopwright/scripts/quality-gate.mjs --update-baseline
git add .loopwright/baseline.json && git commit -m "chore: ratchet quality baseline"
```

The gate refuses to write a baseline from incomplete reports, so you cannot
accidentally record a "0 failures" state that just means the tests never ran.

## How a verdict is reached

Two independent judgements, merged into the worst of the two.

### 1. Metric ratchet

Each metric in `.loopwright/config.json` declares:

| field          | meaning                                                        |
| -------------- | -------------------------------------------------------------- |
| `direction`    | `lower-better` or `higher-better`                              |
| `tolerance`    | drift allowed against the baseline before it counts             |
| `hardMax`/`hardMin` | absolute limits, independent of the baseline               |
| `onRegression` | `block` or `warn` when the baseline is breached                 |

Hard limits win over the ratchet: a coverage floor of 80% blocks at 79% even if
the baseline was recorded at 70%.

### 2. Shape limits, with grandfathering

Per-file and per-function limits (`limits` in the config) are checked against
the baseline **per file and per dimension**:

- code is **new** (no baseline entry) and over the hard limit → **block**
- code got **worse** than its baseline value → **block**
- code was already over the limit and did not get worse → **warn** (debt)

So a 400-line legacy file does not block anything, but adding a line to it does.
A renamed function counts as new code, which is the conservative reading: if you
rewrote it, it should meet the current limits.

## What is measured

**Correctness** — failing tests, failing suites, TypeScript errors, ESLint
errors. All `hardMax: 0`.

**Security** — `npm audit` over the whole dependency tree, with **no
production/dev split**: if an agent opened the PR, that PR has to be deployable,
and a gate with an exempt category cannot tell you whether it is. A dev-only CVE
is still a CVE somebody has to deal with — better now, in a PR that is already
open, than at deploy time.

Critical blocks; high warns. The two severities stay distinguishable that way —
if high blocked as well, the severity would carry no information about how
urgently the PR has to stop.

The escape valve is `audit.ignore` in `.loopwright/config.json`, because
otherwise an advisory with no upstream fix deadlocks the PR forever — and an
agent will keep retrying a fix that does not exist. Every entry must carry an
`expires` date:

```json
"audit": {
  "ignore": [
    {
      "advisory": "GHSA-pq67-2wwv-3xjx",
      "package": "tar-fs",
      "reason": "no fix upstream, only reachable from the test fixtures",
      "expires": "2026-12-31"
    }
  ]
}
```

An expired entry — or one with no valid `expires` — stops suppressing and the
advisory blocks again. Suppressions are meant to rot: the alternative is a
permanent exemption that nobody revisits. Active suppressions are counted in
`audit.suppressed` and ratcheted, so adding one shows up in the PR comment
rather than passing silently.

**Coverage** — lines, branches, functions, statements, each with a floor and a
ratchet.

**Duplication** — `jscpd` percentage, floor of 5% and a 0.2pp ratchet.

**Shape** — cyclomatic complexity, function length, nesting depth, parameter
count, file length. Computed by `.loopwright/scripts/lib/analyze-source.mjs`
on the TypeScript compiler API, so it does not depend on parsing ESLint
messages.

**Integrity** — the part that exists specifically because an agent is writing
the code. These are the tells that a green build was bought rather than earned:

| metric                          | why it is gated                                            |
| ------------------------------- | ---------------------------------------------------------- |
| `integrity.skippedTests`        | `it.skip` is the cheapest way to make a test stop failing   |
| `integrity.focusedTests`        | a stray `.only` silently disables every other test          |
| `integrity.assertionlessTests`  | a test with no `expect` always passes                       |
| `integrity.coverageIgnores`     | `/* v8 ignore */` raises coverage without adding a test     |
| `integrity.typeSuppressions`    | `@ts-ignore` makes a type error disappear rather than fix it |
| `integrity.lintSuppressions`    | inline `eslint-disable` does the same for lint              |
| `integrity.emptyCatches`        | an empty catch converts a failure into silent corruption    |

None of these show up as a failure in any conventional tool, which is exactly
why they need their own gate. All of them ratchet against the baseline, so
existing ones are tolerated and new ones are not.

## Tuning

Everything lives in `.loopwright/config.json`. Common adjustments:

- **Too noisy on an existing codebase** — take a baseline first; that alone
  silences all pre-existing debt.
- **A metric should warn, not block** — set `onRegression: "warn"`.
- **A limit is wrong for this codebase** — change `limits`, not the baseline.
- **A metric does not apply** — delete its entry; the gate only scores what is
  configured.

Adding a metric means: collect the number in
`.loopwright/scripts/lib/collect-metrics.mjs`, add a policy entry to the
config, and optionally add a remediation line in
`.loopwright/scripts/lib/report.mjs` so the PR comment tells the agent what
to do about it.
