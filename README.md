# loopwright

*A wright is a maker — a shipwright builds ships, a playwright builds plays.
A loopwright builds loops.*

A vendorable quality layer for AI-assisted TypeScript projects. Drop it into
any repo and it wires in the full loop:

- **RFC-driven issues** — top-level issues are RFCs, refined by interrogation
  (`/grill-rfc`) and broken into task sub-issues with native parent/blocked-by
  relationships.
- **Agentic execution** — `/execute-issue` orchestrates planner (Opus), coder
  (Sonnet, strict TDD, one fresh agent per step), and fresh-context reviewer
  agents from spec to draft PR, then babysits the PR to green (`/babysit-pr`).
- **A quality gate agents cannot cheat** — CI ratchets coverage, complexity,
  duplication, and advisories against a committed baseline, and blocks the
  classic agent shortcuts (`.only`, `as any`, assertion-free tests, empty
  `catch`) as first-class violations. Baseline edits are a different kind of
  guard: the pre-commit hook and human review catch those, not the gate — a
  PR that regenerates the baseline has to justify it explicitly in the
  description.

The gate is the only source of truth for "done"; merging is always the
human's decision.

This repository is itself built on loopwright — the engine that ships to
other repos lives here under `.loopwright/scripts/`, tested by
`.loopwright/tests/` (see `CLAUDE.md`).

## Quickstart

Vendor the layer into an existing repo:

```bash
curl -fsSL https://raw.githubusercontent.com/SamuelDenani/loopwright/main/install.sh | bash
./setup.sh        # gh auth required: labels, branch protection, initial baseline
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # if setup reported it missing
```

`install.sh` is idempotent: re-running it re-syncs the engine under
`.loopwright/scripts/` and never overwrites your config, baseline, or any
integration file you already have.

Then, in Claude Code:

1. Write your first RFC as an issue (template provided), label `rfc`.
2. `/grill-rfc <n>` — refine it and generate the task sub-issues.
3. `/execute-issue <n>` — hand it a task (or the whole RFC) and watch the
   task list.

## How it works

| Piece | Where |
|---|---|
| Flow overview | `docs/loopwright/loop-harness.md` |
| Gate design | `docs/loopwright/quality-gate.md` |
| Agents (planner / coder / reviewer) | `.claude/agents/` |
| Skills (grill-rfc / execute-issue / babysit-pr) | `.claude/skills/` |
| Gate engine | `.loopwright/scripts/quality-gate.mjs`, `.loopwright/config.json` |
| Installer | `install.sh` |
| CI | `.github/workflows/` |
| Pre-commit fast checks | `.githooks/pre-commit` |
| GitHub state (labels, protection, baseline, hooks) | `setup.sh` |

## Requirements

- Node ≥ 20.11, [`gh`](https://cli.github.com) authenticated
- [Claude Code](https://claude.com/claude-code) locally, and the
  [Claude GitHub App](https://github.com/apps/claude) installed on the repo
  for the review workflows
