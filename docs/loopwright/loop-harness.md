# Loop harness

How work flows through this repo when coding agents execute it. The quality
gate (`docs/loopwright/quality-gate.md`) is the enforcement half; this is the
execution half. The opinions both halves serve are stated in
`docs/loopwright/principles.md`.

## Flow

```
RFC issue (label: rfc)
  │  human writes the initial deliberation
  │  /grill-rfc <N> — agent interrogates, then:
  │    architect phase → boundary ledger, boundary-reviewer checks the
  │                      extraction, mermaid per seam posted as ONE issue
  │                      comment for visual approval (never the body)
  │    rewrites the body as the refined RFC (original kept as a comment)
  │    drafts sub-issues as files → set-reviewer (whole set) → N
  │      sub-issue-reviewers (one draft each, parallel) → your approval
  │    creates the sub-issues with native parent + blocked-by edges
  ▼
Task sub-issue (label: task)
  │  /execute-issue <N> — accepts a task OR the RFC itself.
  │  RFC with >1 sub-issue or any blocked-by edge → feature branch
  │  (feat/rfc-<N>-<slug>): task PRs target it ("Part of #task"), and the
  │  feature branch becomes ONE draft PR to main carrying every "Closes".
  │  The user chooses: parallelize unblocked tasks (background orchestrators
  │  in worktrees) or run the next unblocked one sequentially.
  │  Per task, the orchestrator session:
  │    planner agent (Opus)  → docs/specs/issue-<N>.md, committed
  │    coder agents (Sonnet) → one fresh agent per plan step, strict TDD,
  │                            one commit per step
  │    reviewer agent (Opus) → fresh context, read-only, diff vs spec
  │  → draft PR (Closes #N)
  ▼
Draft PR
  │  /loop /babysit-pr <PR> — orchestrator ticks:
  │    quality gate red  → dispatch coder fixes, push
  │    gate green, draft → promote to ready (triggers Claude review)
  │    review findings   → fix or reply with reasons, never ignore
  ▼
Ready PR, gate green, reviews addressed → merge
```

## Mechanics

- **Base branch**: a task with no open `blockedBy` always branches from
  `origin/main`. A task inside a feature-branch RFC branches from
  `feat/rfc-<N>-<slug>` and its PR targets it. Branch naming:
  `task/<N>-<slug>`.
- **Closing keywords only fire on the default branch**: task PRs against a
  feature branch say `Part of #<task>`, and the babysit loop closes the task
  issue explicitly when its PR merges into the feature branch. "Unblocked"
  therefore always means the same thing: all blocker issues closed. The
  feature→main PR carries `Closes #<RFC>`.
- **Draft until ready**: PRs open as drafts. The quality gate runs on drafts
  (cheap, mechanical signal for the babysitting loop); the Claude review
  workflow skips drafts and runs on `ready_for_review`.
- **The grill phase is session-scoped.** `/grill-rfc` holds its task spine
  and its sub-issue drafts in the session that runs it: the spine is a native
  task list, the drafts are `draft-<slug>.md` files in a scratch directory,
  and neither is committed. A crashed grill restarts.
- **Architecture is scaffolding, not a spec.** The architect phase's mermaid
  lives in an RFC issue comment and never in the issue body, because
  `planner.md` reads the body via `gh issue view` and comments are not
  returned. Its consumers are the sub-issue slicing step and the human eye;
  its job ends when the sub-issues are created. Nothing downstream reads it,
  so it cannot mislead when it drifts.
- **`boundary-reviewer` is the first thing to cut.** It is the weakest of the
  three refinement agents: same input and model as the session that wrote the
  ledger, only the objective inverted. Its changelog line is the evidence — if
  it reports `no change` across three RFCs, delete it and rely on the ledger's
  mandatory reasoned exclusion list alone.

## Opinions

The opinions the loop runs on are stated once, in
`docs/loopwright/principles.md`, and this file does not restate them. Three
of them bear directly on the mechanics above:

| Opinion | The question it settles |
|---|---|
| P1 | Where loop state lives |
| P2 | What counts as "done" |
| P8 | Who may perform an irreversible action, merge included |

## Pieces

| Piece | Where |
|---|---|
| Execution agents (planner / coder / reviewer) | `.claude/agents/` |
| Refinement agents (boundary-reviewer / set-reviewer / sub-issue-reviewer) | `.claude/agents/` |
| Skills (grill-rfc / execute-issue / babysit-pr) | `.claude/skills/` |
| Specs | `docs/specs/issue-<N>.md` |
| Quality gate | `.loopwright/scripts/quality-gate.mjs`, `docs/loopwright/quality-gate.md` |
| CI | `.github/workflows/quality-gate.yml`, `claude-code-review.yml` |

Issue relationships use GitHub's native fields — no custom project fields:
`parent`/`subIssues` for RFC→task hierarchy, `blockedBy` for dependencies
(GraphQL: `addSubIssue`, `addBlockedBy`), and the `rfc`/`task` labels to type
the issues.
