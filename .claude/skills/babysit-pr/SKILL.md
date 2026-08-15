---
name: babysit-pr
description: Babysit one or more open task PRs until they are ready to merge - watch the quality gate and reviews, dispatch coder agents to fix findings, promote draft to ready when the gate is green. Designed to run under /loop (each invocation is one tick). Usage - /babysit-pr <pr-number> [<pr-number> ...].
---

# Babysit PRs

The arguments are PR numbers opened by `/execute-issue` — usually one, or
several sibling task PRs from the same RFC. Each invocation is one tick of
the loop: for **each listed PR**, read its current state and apply the rule
table below once, then report and (if running under `/loop`) schedule the
next tick to match the soonest thing you are waiting for — CI runs take
minutes, so do not poll every 60s. A PR that reaches a terminal rule (1 or 6)
leaves the list; the loop stops when the list is empty.

## Read the state

```bash
gh pr view <N> --json state,isDraft,headRefName,baseRefName,mergeable,statusCheckRollup,reviewDecision,url
gh pr checks <N>
gh pr view <N> --comments   # quality-gate sticky comment + Claude review
```

## Act — first matching rule wins

1. **PR merged or closed** → if it merged into a feature branch, close its
   task issue explicitly — closing keywords only fire on the default branch:
   `gh issue close <task> -c "done in #<pr>, merged into <feature-branch>"`.
   This is what unblocks dependent tasks. Report the outcome and drop this
   PR from the list.
2. **Checks still running** → no action. Wait roughly one CI duration.
3. **Quality gate red** → the sticky PR comment (same content as
   `.loopwright/reports/quality-gate.json` in the `quality-reports-*`
   artifact) lists every blocker with `file:line`. Check out the branch,
   dispatch a **coder** agent per blocker (or one agent for related
   blockers), verify locally with
   `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs`,
   push. Never "fix" a blocker with a gated shortcut — skipping tests,
   `as any`, editing `.loopwright/baseline.json` — the gate catches all of
   them and you lose a round-trip.
4. **Gate green and PR is draft** → promote it: `gh pr ready <N>`. This
   triggers the Claude review workflow. Wait for it.
5. **Unaddressed review findings** (Claude review or human) → triage each:
   - Real problem → dispatch a coder fix, push, reply to the comment with
     what changed.
   - Disagree → reply explaining why, with evidence. Never silently ignore a
     finding, and never change code just to appease a review you believe is
     wrong.
6. **Gate green, not draft, reviews addressed** → the PR is ready. Report it
   as mergeable with a one-paragraph summary and drop it from the list.
   **Merging is the user's decision — never merge.**

## Invariants

- The quality gate is the only source of truth for "done". Never regenerate
  the baseline, never edit gate config, never override a red verdict.
- Every push happens on the task branch; never commit to main or the feature
  base directly.
- If the same blocker survives two fix attempts, stop and report to the user
  instead of burning more attempts — the plan may be wrong, not the code.
