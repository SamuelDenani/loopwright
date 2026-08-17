## loopwright

This repo has the loopwright layer vendored under `.loopwright/`: RFC-driven
issues, an agentic execution loop, and a CI quality gate. See
`docs/loopwright/quality-gate.md` for how the gate works, and
`docs/loopwright/loop-harness.md` for how work flows from an RFC issue to a
merged PR (the `/grill-rfc`, `/execute-issue`, and `/babysit-pr` skills).

### Commands

```bash
node .loopwright/scripts/run-report.mjs --all   # collect all reports
node .loopwright/scripts/quality-gate.mjs       # run the gate (what CI runs)
node .loopwright/scripts/quality-gate.mjs --update-baseline
```

### Working on a PR

The `Quality gate` workflow blocks the merge. `.loopwright/scripts/quality-gate.mjs`
is the only step that can fail the build; every other step writes a report and
exits 0.

When the gate is red:

1. Read `.loopwright/reports/quality-gate.json` — it has the verdict, every
   metric with its baseline and current value, and `evidence` with `file:line`
   for each finding. In CI the same content is in the PR comment, the step
   summary, and the `quality-reports-*` artifact.
2. Fix the blockers listed under `What to do`. Re-run
   `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs`
   to confirm before pushing.
3. Warnings do not block. Fix them if they are cheap; do not let them distract
   from the blockers.

### Do not do these

The gate exists because these are the shortcuts that turn a build green without
making the code correct. Each one is itself gated and will block the PR:

- skipping, focusing (`.only`) or deleting a failing test instead of fixing it
- writing a test with no assertion
- adding `/* v8 ignore */` or `/* istanbul ignore */` to lift coverage
- adding `@ts-ignore`, `@ts-expect-error` or `as any` to silence a type error
- adding an inline `eslint-disable` to silence a rule
- swallowing an error in an empty `catch`
- regenerating `.loopwright/baseline.json` to make a regression disappear
- adding an `audit.ignore` entry for an advisory that does have a fix available

Dependency advisories have no dev/prod exemption — a critical blocks wherever
it is in the tree, and a high warns. Upgrade the dependency. Only when there is
genuinely no fix upstream, add an `audit.ignore` entry with an `expires` date
and explain it in the PR description.

The baseline is a ratchet, not a knob. Only regenerate it when the metrics
genuinely improved, and say so explicitly in the PR description.
