# Loop harness

How work flows through this repo when coding agents execute it. The quality
gate (`docs/loopwright/quality-gate.md`) is the enforcement half; this is the
execution half.

## Flow

```
RFC issue (label: rfc)
  │  human writes the initial deliberation
  │  /grill-rfc <N> — agent interrogates, rewrites the body as the refined
  │  RFC (original preserved as a comment), creates task sub-issues with
  │  dependencies (native parent/sub-issue + blocked-by relationships)
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
Ready PR, gate green, reviews addressed → human merges
```

## Rules of the loop

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
- **The gate is the only source of truth for "done".** No agent may override
  a red verdict, regenerate `.loopwright/baseline.json`, or take any of the
  gated shortcuts listed in `CLAUDE.md`.
- **State lives in artifacts, not sessions**: the refined RFC and its comment
  trail on the issue, the committed spec in `docs/specs/`, per-step commits,
  and the PR conversation. Any session (or human) can pick up a half-done
  task from these alone.
- **Merging is always the human's decision.**

## Pieces

| Piece | Where |
|---|---|
| Agents (planner / coder / reviewer) | `.claude/agents/` |
| Skills (grill-rfc / execute-issue / babysit-pr) | `.claude/skills/` |
| Specs | `docs/specs/issue-<N>.md` |
| Quality gate | `.loopwright/scripts/quality-gate.mjs`, `docs/loopwright/quality-gate.md` |
| CI | `.github/workflows/quality-gate.yml`, `claude-code-review.yml` |

Issue relationships use GitHub's native fields — no custom project fields:
`parent`/`subIssues` for RFC→task hierarchy, `blockedBy` for dependencies
(GraphQL: `addSubIssue`, `addBlockedBy`), and the `rfc`/`task` labels to type
the issues.
