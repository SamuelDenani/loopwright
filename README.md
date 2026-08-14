# loopwright

*A wright is a maker — a shipwright builds ships, a playwright builds plays.
A loopwright builds loops.*

Template for AI-assisted TypeScript projects. Repos born from it come with
the full loop pre-wired:

- **RFC-driven issues** — top-level issues are RFCs, refined by interrogation
  (`/grill-rfc`) and broken into task sub-issues with native parent/blocked-by
  relationships.
- **Agentic execution** — `/execute-issue` orchestrates planner (Opus), coder
  (Sonnet, strict TDD, one fresh agent per step), and fresh-context reviewer
  agents from spec to draft PR, then babysits the PR to green (`/babysit-pr`).
- **A quality gate agents cannot cheat** — CI ratchets coverage, complexity,
  duplication, and advisories against a committed baseline, and blocks the
  classic agent shortcuts (`.only`, `as any`, assertion-free tests, empty
  `catch`, baseline edits) as first-class violations.

The gate is the only source of truth for "done"; merging is always the
human's decision.

## Quickstart

```bash
gh repo create my-project --template <owner>/loopwright --private --clone
cd my-project
./scripts/setup.sh        # labels, branch protection, initial baseline
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # if setup reported it missing
```

Then, in Claude Code:

1. Write your first RFC as an issue (template provided), label `rfc`.
2. `/grill-rfc <n>` — refine it and generate the task sub-issues.
3. `/execute-issue <n>` — hand it a task (or the whole RFC) and watch the
   task list.

Replace `src/seed.ts` + `tests/seed.test.ts` when your first real module
lands, and fill in the `TODO(template)` markers in `CLAUDE.md`.

## How it works

| Piece | Where |
|---|---|
| Flow overview | `docs/loop-harness.md` |
| Gate design | `docs/quality-gate.md` |
| Agents (planner / coder / reviewer) | `.claude/agents/` |
| Skills (grill-rfc / execute-issue / babysit-pr) | `.claude/skills/` |
| Gate engine | `scripts/quality-gate.mjs`, `quality-gate.config.json` |
| CI | `.github/workflows/` |
| GitHub state (labels, protection, baseline) | `scripts/setup.sh` |

## Requirements

- Node ≥ 20.11, [`gh`](https://cli.github.com) authenticated
- [Claude Code](https://claude.com/claude-code) locally, and the
  [Claude GitHub App](https://github.com/apps/claude) installed on the repo
  for the review workflows
