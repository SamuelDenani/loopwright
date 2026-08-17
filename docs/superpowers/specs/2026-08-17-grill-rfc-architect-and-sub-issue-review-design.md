# Grill-RFC: an architect phase, a reviewed sub-issue phase, and a task spine

**Date:** 2026-08-17
**Status:** Approved design, pending implementation plan

## Problem

`/grill-rfc` goes from a settled design tree straight to task sub-issues in
one unreviewed step. Three gaps follow from that.

**No visual record of structure.** The grill settles boundaries — what talks
to what, who owns which state, what crosses a process line — and then records
them only as prose. Boundaries are the part of a design most worth seeing and
the part prose hides best.

**The breakdown is a single unchecked judgment.** It is made by the session
that just spent an hour grilling, which is the context most committed to its
own conclusions and least able to notice what it omitted. An oversized task is
expensive downstream: it becomes a plan whose steps `/execute-issue` loops
over one dispatch at a time, and a fat task is exactly where the orchestrator
loses the thread on context size. Fixing that in the execution phase costs
coder dispatches that read the codebase; fixing it here costs a prose review.

**The run is opaque while it happens.** Long stretches of agent work pass with
no indication of where the session is.

## Goal

Three additions to `/grill-rfc`:

1. An **architect phase** that draws boundaries — and only boundaries — as
   mermaid, for visual approval.
2. A **reviewed sub-issue phase**: sub-issues are drafted granular by
   construction, then reviewed by agents before any issue is created.
3. A **native task spine** so the run is legible while it runs.

**Non-goals.** No changes to `/execute-issue` or `/babysit-pr`. No
architecture committed to the repo. No resume ledger for `grill-rfc` (see
Known limitations).

## Decisions made

- **Architecture is a gate, not documentation.** The agent draws; the user
  reviews visually and approves. A correction that reveals an unsettled
  decision reopens that branch on the grill frontier.
- **The contract test decides what earns a diagram**, and diagrams group by
  boundary rather than by decision. Grouping is what caps the count.
- **Architecture lives in an issue comment and nowhere else** — not in the
  refined RFC body, not in the repo.
- **The set reviewer runs before the per-task reviewers**, not in parallel
  with them.
- **Task size is "one seam, one vertical slice"**, with a stated fallback when
  the architect phase finds no boundaries.
- **Reviewers review only.** The orchestrator session adjudicates and rewrites.

## Trust model

Three reviewer agents are added. The reason that is not just a regress —
agents checking agents — is that a second opinion only buys something when its
failure mode differs from the first's. Same model, same input, same framing
produces agreement, not verification. Four rules make the difference concrete,
and they are binding on the implementation.

**1. Every added reviewer must have an independent failure mode.** Rated
against that standard:

| Reviewer | Independence | Basis |
|---|---|---|
| `set-reviewer` | Strong | Sees what a per-task view structurally cannot contain |
| `sub-issue-reviewer` | Medium | Fresh context, no sunk cost, and its rule is countable |
| `boundary-reviewer` | Weak | Same input, same model, only the objective inverted |

**2. Verdicts must be falsifiable.** Every finding names a specific artifact —
a draft file, a numbered acceptance criterion, a named seam, a line of the
RFC's scope — and the rule it violates. A finding that cannot point at one is
not a finding. `no change` is a valid and expected verdict; a reviewer must
never manufacture a finding to appear useful.

**3. The human review surface stays flat regardless of agent count.** Reviewer
verdicts go to the orchestrator and never reach the user raw. The user sees
artifacts and a one-line changelog per reviewer round. Exactly **one approval
gate is added** — the diagrams; the final-set approval already existed.
Everything else the user receives is output they do not have to answer: the
ledger, the draft set, and the changelog lines.

**4. `boundary-reviewer` is the designated first deletion candidate.** It is
the weakest of the three. Its changelog line is the evidence: if it reports
`no change` across three RFCs, delete it and rely on the mandatory exclusion
list alone. This is a note to the maintainer, not runtime behaviour — the only
runtime enforcement is rule 2, which stops it inventing findings to survive.

### The economic bet

Everything added here reads prose: issue text, a ledger, draft task bodies.
None of it reads the codebase. `/execute-issue` dispatches a planner plus a
coder plus a reviewer *per plan step*, all of which do. If a granular breakdown
prevents even one five-round fix loop over there, this entire review layer is
paid for several times over.

That trade is asserted, not measured. It becomes falsifiable through the
changelog lines, which record what each reviewer actually changed.

## Phase 2c — Architect

Runs after the reverse grill (§2b), only once both directions hold: the
frontier is empty and the user's answers match the settled design.

### Step 1 — Extract the boundary ledger

Walk the settled design tree. A decision earns a place only if it creates or
changes something two parties must agree on:

- a new or changed module, service, or process
- a public interface or API shape
- a data contract or schema
- ownership of persisted state
- a deployment or trust boundary

Algorithm choice, library choice, naming, and file layout never qualify.
**When a decision is arguably internal, it is internal.** The phase is biased
toward producing output; the rule exists to counteract that.

Group the qualifying decisions **by seam**, not by decision. Several decisions
touching `app ↔ Redis` collapse into one boundary.

The ledger names both lists:

```
BOUNDARIES
  app <-> Redis    — decisions: workers read from Redis; Redis holds job state
  client <-> API   — decisions: expose GET /jobs/:id

EXCLUDED (internal)
  use a worker pool                 — no party outside the module observes it
  retry with exponential backoff    — implementation of an existing contract
```

The exclusion list is **mandatory and reasoned**. It converts a silent
judgment into an explicit claim the user reads in five seconds during the
approval they are already making.

**Zero boundaries is a legitimate outcome** — many RFCs (tuning gate
thresholds, restructuring docs) are correctly boundary-free. It is still
reviewed: an all-empty BOUNDARIES list is an extraction like any other, and
declaring everything internal is the cheapest way to skip the phase. Only
after `boundary-reviewer` confirms does the phase report it and skip to §3.

### Step 2 — Review the extraction

Dispatch `boundary-reviewer` with the settled design tree and the ledger. It
judges the extraction only: is anything excluded actually a seam, is anything
included actually internal, are two listed boundaries the same seam. It is
told the drafting session's bias explicitly. It reviews only; the orchestrator
adjudicates and revises the ledger.

Running before the drawing means a boundary that should not exist is never
drawn and never shown.

### Step 3 — Draw

One diagram per boundary, type chosen to show what was actually decided:

- `flowchart` — structural seams: who talks to what, what crosses
- `sequenceDiagram` — the decision was about ordering or handshake across the seam
- `erDiagram` — the boundary is a data contract

Each diagram carries two to four lines: what crosses the seam, who owns what,
and which settled decisions it encodes.

**Conservative mermaid subset**, because no validator exists in this
environment and invalid syntax renders as a broken code block on GitHub at
exactly the moment the user is meant to be approving:

- alphanumeric node ids only
- no `%%{init}%%` directives
- no `classDef`, `style`, or `click`
- no nested subgraphs
- quote any label containing punctuation

### Step 4 — Post and gate

All diagrams post as **one comment** on the RFC issue; revisions edit that
comment in place rather than stacking new ones. The user receives the ledger
and the comment link in the terminal.

Two gates:

- **The user's.** Approve, or say what is wrong. A correction that reveals a
  decision which was never actually settled reopens that branch on the §2
  frontier.
- **The phase's own.** If a seam cannot be drawn without inventing a fact
  nobody decided, that is a frontier question. Stop and ask; do not guess.

On approval the phase completes. Its output is the approved diagrams, so
`Architect` closes at this gate — not at the earlier point where the
boundary-reviewer's findings were adjudicated.

### Why the comment and not the body

`planner.md` reads the parent RFC via `gh issue view`, which returns the body
and not comments. Keeping architecture out of the body means a drifted diagram
physically cannot become the input a later planner plans from — the failure
mode of treating ADRs as durable planning input.

The architecture is **scaffolding**: its consumers are the sub-issue phase, which
needs the seams, and the user's eyes. Its job ends when the sub-issues are
created. Nothing downstream is supposed to read it, so it cannot mislead when
it rots. Re-running `/grill-rfc` posts a newer comment; latest wins.

**Accepted cost:** someone reading only the RFC body never sees a diagram.

## Phase 4 — Drafting and reviewing the sub-issues

Replaces the current §4.

### Drafts are files, not issues

Everything before approval lives in scratch files (`draft-<slug>.md`), never
on GitHub. Splitting and merging real issues leaves orphans and broken
relationships; splitting a file is free. Reviewers receive a **path**, not
pasted content — cheaper, and it keeps their context small.

Issues are created only after user approval, via the existing `gh issue
create` plus GraphQL `addSubIssue` / `addBlockedBy` mechanics.

If the user rejects the set at that final approval, their objection is treated
as a set-level finding: the orchestrator applies it, re-runs `set-reviewer`
once on the revised set, runs sub-issue review on newly-born tasks only, and presents
again. This is the same convergence rule as the re-entry above, and it is not
subject to the one-re-entry cap — a user objection is never parked.

### The size rule

Applied at **drafting** time first and review time second. The loops this
design exists to minimise are cheapest to avoid by not drafting a fat task.
Where the ledger has seams, they are the split lines.

A draft task is correctly sized when all three hold:

1. **One seam.** It crosses at most one boundary from the ledger.
   *Zero-boundary fallback:* it changes exactly one observable behaviour of
   the system, and every acceptance criterion describes that one behaviour.
2. **Co-true criteria.** Three to seven acceptance checkboxes that are all
   true or all false together.
3. **Vertical slice.** Test plus implementation plus wiring, shippable alone.
   Never a horizontal layer such as "define all the types".

### The review pipeline

```
draft (granular by construction)
  └─ log the full set to the user            ← visibility, no approval asked
set-reviewer          (refined RFC + ledger + whole draft set)
  └─ orchestrator adjudicates → rewrite → changelog line
sub-issue-reviewers   (N in parallel; each: ONE draft + RFC + ledger)
  └─ orchestrator adjudicates → rewrite → changelog line
if membership changed (any split or merge):
  set-reviewer once more on the revised set
  + sub-issue review for newly-born tasks only
  └─ cap: one re-entry
user approval → create issues → link parent / blockedBy
```

**Set before sub-issues, deliberately.** Set findings change *which tasks exist*.
Run the two in parallel and every sub-issue review of a doomed task is wasted
while the task the set reviewer invents gets no review at all — a second round
becomes guaranteed whenever the set reviewer finds anything. Sequential makes
the second round the exception. It also raises sub-issue review accuracy: "is this
one seam?" is ambiguous while the task is still a merge candidate.

**Convergence.** A split or merge from the sub-issue round is itself a membership
change, so the set reviewer runs once more on the revised set and newly-born
tasks get their one sub-issue review. Splits are local, so this converges fast.
Capped at one re-entry; the orchestrator then adjudicates residuals and
surfaces them in the approval message.

### What each reviewer judges

**`sub-issue-reviewer`** — input: one draft file, the refined RFC, the ledger. It
does **not** see the other drafts; that is what keeps its context small and
its judgment independent, and coverage is explicitly not its job. It judges:
the three size-rule clauses, criteria testability, and faithfulness to RFC
intent.

**`set-reviewer`** — input: the refined RFC, the ledger, the whole draft set.
It judges the set and only the set:

1. **Coverage** — every line of the RFC's Scope maps to at least one task.
2. **Overlap** — no two tasks claim the same change.
3. **Minimality** — two tasks that always ship together across the same seam
   are one task. This counter-pressure matters: without it "granular" drifts
   into twenty tasks, and every task costs a branch, a PR, and a babysit loop.
4. **Edges** — `blockedBy` reflects real code or data dependency, not
   narrative order.

### Verdict format

Every reviewer returns:

```
FINDING <n>: <artifact> — <what is wrong> — <rule violated>
...
VERDICT: no change | <N> findings
```

Legal artifacts: a draft file path, `<draft>:criterion <n>`, a seam name from
the ledger, or a quoted line of the RFC's Scope section.

### Adjudication and the changelog

Reviewers never edit. The orchestrator applies, rejects with a reason, or
parks each finding. What the user sees is one line per reviewer round:

```
set-reviewer: 2 gaps, 1 overlap → added draft-migrate-jobs, merged draft-b + draft-c
sub-issue-reviewers (6): 1 split → draft-api split into draft-api-read, draft-api-write
boundary-reviewer: no change
```

## The native task spine

Created at §1 load, so the shape of the run is visible before the first
question:

`Grill` · `Reverse grill` · `Architect` · `Rewrite RFC body` ·
`Draft sub-issues` · `Review sub-issues` · `Create sub-issues`

**One task per agent dispatch, and nowhere else.** Agent fan-outs are the only
stretches where visibility is genuinely missing — the user is not in the dark
during the grill, they are being asked questions. So: `boundary-reviewer`
under Architect; `set-reviewer` and the N parallel `Review: <task>` tasks
under Review sub-issues, created at dispatch when the count is known. The
re-entry round adds its own, suffixed `(round 2)`.

**A skipped phase still completes.** On a zero-boundary RFC, `Architect`
completes with its label recording why ("no boundaries — 7 decisions internal")
rather than being deleted. A phase vanishing from the spine mid-run reads as a
bug; a phase that completed having done nothing reads as the answer it is.

**Grill rounds get no tasks.** A task per round is unbounded and would bury
the spine. `Grill` stays one task carrying the round in its live label —
"Grilling: round 3, 4 questions open". `Architect` does the same with the seam
being drawn.

**No dependency edges.** The spine is strictly sequential and reads that way
by id; the fan-out is parallel by definition. Wiring `blockedBy` would cost a
call per task and encode nothing already invisible.

**Completed means adjudicated, not returned.** A reviewer's task completes
when the orchestrator has ruled on its findings. Otherwise the list goes green
while the work is still open.

The task list answers *where*. The changelog answers *what changed*. Neither
repeats the other.

## Files

**New** — `.claude/agents/boundary-reviewer.md`,
`.claude/agents/set-reviewer.md`, `.claude/agents/sub-issue-reviewer.md`. All
three are read-only, report-never-fix, matching the existing `reviewer.md`
contract shape.

**Modified** — `.claude/skills/grill-rfc/SKILL.md` (new §2c, rewritten §4,
task spine in §1). `docs/loop-harness.md` (flow diagram and Pieces table).

**Unchanged** — `execute-issue`, `babysit-pr`, `planner.md`, `coder.md`,
`reviewer.md`, the quality gate, the issue templates.

## Known limitations

**No resume.** Unlike `/execute-issue`, this skill keeps no ledger, so the
task spine dies with the session. Partial recovery exists — the refined issue,
the architecture comment, and the draft files survive — but a crashed grill
restarts the grill. Adding a ledger is a larger change than this design
covers.

**Architecture goes stale.** Nothing updates the diagrams once execution
reveals the design was slightly off. This is accepted rather than solved: the
comment placement means nothing downstream reads them, and re-running
`/grill-rfc` refreshes them.

**Mermaid is unvalidated.** The conservative subset reduces the risk; it does
not eliminate it. If broken renders show up in practice, the fix is a
validator, not more prose rules.
