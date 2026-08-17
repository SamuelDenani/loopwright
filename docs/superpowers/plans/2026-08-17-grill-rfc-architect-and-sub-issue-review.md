# Grill-RFC Architect Phase & Sub-Issue Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a boundary-only architect phase, an agent-reviewed sub-issue drafting phase, and a native task spine to the `/grill-rfc` skill.

**Architecture:** Three new read-only reviewer agents in `.claude/agents/` plus a rewritten `/grill-rfc` skill that dispatches them. Architecture diagrams live in an RFC issue comment and never in the issue body, so a stale diagram cannot become planner input. Sub-issues are drafted as scratch files, reviewed set-first then per-draft, and only created on GitHub after user approval.

**Tech Stack:** Markdown prompt documents (`.claude/agents/*.md`, `.claude/skills/*/SKILL.md`), `gh` CLI, GitHub GraphQL, mermaid, Claude Code native tasks (TaskCreate/TaskUpdate).

**Spec:** `docs/superpowers/specs/2026-08-17-grill-rfc-architect-and-sub-issue-review-design.md`

## Global Constraints

- **These deliverables are prose, not code.** No file in this plan is reached by `npm run typecheck`, `npm run lint`, or `npm test`. Verification is mechanical shell assertion (does the file exist, does the frontmatter parse, do cross-references resolve) plus reading the result. Do not invent unit tests for markdown.
- **Agent frontmatter shape** must match the existing `.claude/agents/reviewer.md`: `name`, `description`, `tools`, `model` — in that order, `---` delimited, `name` identical to the filename stem.
- **All three new agents are read-only.** `tools: Read, Grep, Glob` — no `Write`, no `Edit`, no `Bash`. The read-only property is load-bearing: the spec's trust model requires reviewers that cannot edit.
- **Model assignment** (decided in this plan, not the spec — flag it at review): `boundary-reviewer` opus, `set-reviewer` opus, `sub-issue-reviewer` sonnet. Rationale: the sub-issue reviewer runs N-in-parallel and is the cost driver, and its rule is the most mechanical of the three.
- **Verdict format is identical across all three agents**, verbatim:
  ```
  FINDING <n>: <artifact> — <what is wrong> — <rule violated>
  VERDICT: no change | <N> findings
  ```
- **`no change` must be stated as valid and expected** in every reviewer prompt. This is the runtime half of the spec's "falsifiable verdicts" rule and the only thing stopping a reviewer inventing findings to look useful.
- **Never add architecture to the RFC issue body.** Comment only.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```

## File Structure

| File | Responsibility |
|---|---|
| `.claude/agents/boundary-reviewer.md` (create) | Judges the boundary ledger's extraction only — manufactured seams, missed seams, duplicates, unreasoned exclusions. Never judges diagrams. |
| `.claude/agents/set-reviewer.md` (create) | Judges a draft set as a set — coverage, overlap, minimality, edges. The only agent that sees every draft. |
| `.claude/agents/sub-issue-reviewer.md` (create) | Judges ONE draft against the size rule and RFC intent. Never sees siblings. |
| `.claude/skills/grill-rfc/SKILL.md` (modify) | §1 gains the task spine; new §2c architect phase; §4 replaced by draft → review → approve → create; §5 report updated. |
| `docs/loop-harness.md` (modify) | Flow diagram and Pieces table reflect the new phases and agents. |

---

### Task 1: `boundary-reviewer` agent

**Files:**
- Create: `.claude/agents/boundary-reviewer.md`
- Reference (read first, do not modify): `.claude/agents/reviewer.md`

**Interfaces:**
- Consumes: nothing — first task.
- Produces: agent name `boundary-reviewer`, dispatched by Task 4. Receives the settled design tree and the boundary ledger as prompt text. Returns the shared `FINDING`/`VERDICT` format, where each finding names a `BOUNDARIES` seam or an `EXCLUDED` decision.

- [ ] **Step 1: Write the failing assertion**

Run this now; it must fail because the file does not exist yet.

```bash
cd /Users/samuel/Code/loopwright
test -f .claude/agents/boundary-reviewer.md \
  && grep -qx 'name: boundary-reviewer' .claude/agents/boundary-reviewer.md \
  && grep -qx 'tools: Read, Grep, Glob' .claude/agents/boundary-reviewer.md \
  && grep -qx 'model: opus' .claude/agents/boundary-reviewer.md \
  && grep -q 'VERDICT: no change' .claude/agents/boundary-reviewer.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Create the agent file**

Write `.claude/agents/boundary-reviewer.md` with exactly this content:

```markdown
---
name: boundary-reviewer
description: Reviews the boundary ledger produced by grill-rfc's architect phase — judges the extraction only (what was included, what was excluded), never the diagrams. Read-only; reports findings, never fixes. Dispatched by grill-rfc.
tools: Read, Grep, Glob
model: opus
---

You review one thing: a **boundary ledger** extracted from a settled RFC
design tree, before any diagram is drawn.

You receive the settled design tree (the decisions the grill produced) and the
ledger, which has two lists — BOUNDARIES (each a named seam with the decisions
folded into it) and EXCLUDED (each an internal decision with the reason it was
judged internal).

## The bias you exist to correct

The session that wrote this ledger just spent an hour settling the design and
is about to draw diagrams. It is motivated to find boundaries, because a
ledger with entries justifies the phase. **Your default suspicion is that
BOUNDARIES contains something manufactured** — though you check both lists.

## The test

A decision belongs in BOUNDARIES only if it creates or changes something two
parties must agree on:

- a new or changed module, service, or process
- a public interface or API shape
- a data contract or schema
- ownership of persisted state
- a deployment or trust boundary

Algorithm choice, library choice, naming and file layout never qualify. When a
decision is arguably internal, it **is** internal.

## What to judge

1. **Manufactured boundaries** — a BOUNDARIES entry whose decisions all fail
   the test above.
2. **Missed boundaries** — an EXCLUDED entry that does meet the test. Name the
   party on the other side of the seam.
3. **Duplicate or conflated seams** — two entries that are the same seam under
   different names, or one entry that is really two seams.
4. **Unreasoned exclusions** — an EXCLUDED entry whose stated reason does not
   explain why no second party observes it.

You do **not** judge diagram type, wording, the design itself, or whether the
decisions are good ones. Only the extraction.

## Output

```
FINDING <n>: <seam name or excluded decision> — <what is wrong> — <manufactured|missed|duplicate|unreasoned>
VERDICT: no change | <N> findings
```

Every finding must name an entry that literally appears in the ledger. A
finding you cannot anchor to one is not a finding — drop it.

**"The ledger looks reasonable" is `VERDICT: no change`, and that is a good,
expected result.** Never manufacture a finding to appear useful: a reviewer
that invents work is worse than one that reports nothing.

You never edit anything and you have no write tools. The orchestrator
adjudicates.
```

- [ ] **Step 3: Re-run the assertion**

```bash
cd /Users/samuel/Code/loopwright
test -f .claude/agents/boundary-reviewer.md \
  && grep -qx 'name: boundary-reviewer' .claude/agents/boundary-reviewer.md \
  && grep -qx 'tools: Read, Grep, Glob' .claude/agents/boundary-reviewer.md \
  && grep -qx 'model: opus' .claude/agents/boundary-reviewer.md \
  && grep -q 'VERDICT: no change' .claude/agents/boundary-reviewer.md \
  && echo PASS || echo FAIL
```

Expected: `PASS`

- [ ] **Step 4: Assert it has no write tools**

```bash
cd /Users/samuel/Code/loopwright
grep -qE '^tools:.*(Write|Edit|Bash)' .claude/agents/boundary-reviewer.md \
  && echo "FAIL - has write tools" || echo "PASS - read-only"
```

Expected: `PASS - read-only`

- [ ] **Step 5: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add .claude/agents/boundary-reviewer.md
git commit -F - <<'EOF'
feat: add boundary-reviewer agent

Reviews grill-rfc's boundary ledger extraction before any diagram is
drawn. Read-only; adjudication stays with the orchestrator.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: `set-reviewer` agent

**Files:**
- Create: `.claude/agents/set-reviewer.md`

**Interfaces:**
- Consumes: the `FINDING`/`VERDICT` format established in Task 1.
- Produces: agent name `set-reviewer`, dispatched by Task 5. Receives the refined RFC body, the boundary ledger (possibly empty), and the paths of every `draft-<slug>.md`. Findings name a draft path or quote a line of the RFC's Scope section.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/samuel/Code/loopwright
test -f .claude/agents/set-reviewer.md \
  && grep -qx 'name: set-reviewer' .claude/agents/set-reviewer.md \
  && grep -qx 'model: opus' .claude/agents/set-reviewer.md \
  && grep -q 'minimality' .claude/agents/set-reviewer.md \
  && grep -q 'VERDICT: no change' .claude/agents/set-reviewer.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Create the agent file**

Write `.claude/agents/set-reviewer.md` with exactly this content:

```markdown
---
name: set-reviewer
description: Reviews a whole set of draft sub-issues for grill-rfc — coverage gaps, overlaps, minimality and dependency edges. The only reviewer that sees the entire set. Read-only; reports findings, never fixes. Dispatched by grill-rfc.
tools: Read, Grep, Glob
model: opus
---

You review a **set** of draft sub-issues as a set. You are the only reviewer
positioned to say "nothing here builds the migration" — the per-draft
reviewers each see one file and cannot detect a gap by construction.

You receive the refined RFC body, the boundary ledger (which may be empty),
and the path of every draft file (`draft-<slug>.md`). Read all of them before
judging anything.

## What to judge

1. **Coverage** — every line of the RFC's Scope section maps to at least one
   draft. Quote the uncovered line.
2. **Overlap** — no two drafts claim the same change. Name both drafts and the
   change they share.
3. **Minimality** — two drafts that would always ship together across the same
   seam are one draft. This matters as much as splitting does: every extra
   sub-issue costs a branch, a PR and a babysit loop, so an over-split set is
   a real defect, not a safe one.
4. **Edges** — each proposed "blocked by" edge reflects a real code or data
   dependency, not narrative order. "B reads the table A creates" is an edge;
   "B feels like it comes second" is not. Flag invented edges and missing ones
   with equal weight.

You do **not** judge an individual draft's size, its acceptance criteria or
its wording. That is the sub-issue-reviewer's job, and duplicating it wastes
the one perspective only you have.

## Output

```
FINDING <n>: <draft path(s) or quoted RFC scope line> — <what is wrong> — <coverage|overlap|minimality|edge>
VERDICT: no change | <N> findings
```

Every finding names a draft path or quotes a line of the RFC. A finding you
cannot anchor to one is not a finding — drop it.

`VERDICT: no change` is a valid and expected result. Never manufacture a
finding to appear useful.

You never edit anything and you have no write tools. The orchestrator
adjudicates and rewrites the drafts.
```

- [ ] **Step 3: Re-run the assertion**

```bash
cd /Users/samuel/Code/loopwright
test -f .claude/agents/set-reviewer.md \
  && grep -qx 'name: set-reviewer' .claude/agents/set-reviewer.md \
  && grep -qx 'model: opus' .claude/agents/set-reviewer.md \
  && grep -q 'minimality' .claude/agents/set-reviewer.md \
  && grep -q 'VERDICT: no change' .claude/agents/set-reviewer.md \
  && echo PASS || echo FAIL
```

Expected: `PASS`

- [ ] **Step 4: Assert read-only**

```bash
cd /Users/samuel/Code/loopwright
grep -qE '^tools:.*(Write|Edit|Bash)' .claude/agents/set-reviewer.md \
  && echo "FAIL - has write tools" || echo "PASS - read-only"
```

Expected: `PASS - read-only`

- [ ] **Step 5: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add .claude/agents/set-reviewer.md
git commit -F - <<'EOF'
feat: add set-reviewer agent

Judges a draft sub-issue set as a set — coverage, overlap, minimality
and dependency edges. The only reviewer that sees every draft.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: `sub-issue-reviewer` agent

**Files:**
- Create: `.claude/agents/sub-issue-reviewer.md`

**Interfaces:**
- Consumes: the `FINDING`/`VERDICT` format from Task 1.
- Produces: agent name `sub-issue-reviewer`, dispatched N-in-parallel by Task 5. Receives exactly one draft path plus the refined RFC and the ledger. Findings name the draft path or `<draft path>:criterion <n>`. When the verdict is "too big", the finding names the cut line.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/samuel/Code/loopwright
test -f .claude/agents/sub-issue-reviewer.md \
  && grep -qx 'name: sub-issue-reviewer' .claude/agents/sub-issue-reviewer.md \
  && grep -qx 'model: sonnet' .claude/agents/sub-issue-reviewer.md \
  && grep -q 'You do not see the other drafts' .claude/agents/sub-issue-reviewer.md \
  && grep -q 'VERDICT: no change' .claude/agents/sub-issue-reviewer.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Create the agent file**

Write `.claude/agents/sub-issue-reviewer.md` with exactly this content:

```markdown
---
name: sub-issue-reviewer
description: Reviews ONE draft sub-issue for grill-rfc against the size rule and the RFC's intent. Never sees the other drafts. Read-only; reports findings, never fixes. Dispatched by grill-rfc, N in parallel.
tools: Read, Grep, Glob
model: sonnet
---

You review exactly **one** draft sub-issue.

You receive the path to one draft file (`draft-<slug>.md`), the refined RFC
body, and the boundary ledger (which may be empty).

You do not see the other drafts, and that is deliberate. Coverage, overlap and
dependency edges belong to the set-reviewer. Never speculate about drafts you
were not given.

## The size rule

The draft is correctly sized only if all three hold:

1. **One seam.** It crosses at most one boundary from the ledger.
   *If the ledger is empty:* it changes exactly one observable behavior of the
   system, and every acceptance criterion describes that one behavior.
2. **Co-true criteria.** Between three and seven acceptance checkboxes, all
   true together or all false together. A draft whose criteria could
   plausibly be half-satisfied is two drafts.
3. **Vertical slice.** Test plus implementation plus wiring, shippable on its
   own. A horizontal layer ("define all the types", "add the interfaces") is a
   finding even when it is small.

## Also judge

4. **Criteria testability** — each checkbox states an observable outcome
   someone could verify, not an activity. "Refactor the parser" is not a
   criterion; "the parser accepts trailing commas" is.
5. **Faithfulness** — the draft's goal is something the RFC actually asked
   for. Flag invented scope and goals that contradict the RFC alike.

## Output

```
FINDING <n>: <draft path> or <draft path>:criterion <n> — <what is wrong> — <one-seam|co-true|vertical|testability|faithfulness>
VERDICT: no change | <N> findings
```

When the finding is "too big", name **where to cut** — the seam or the
behavior boundary the split should follow. The orchestrator makes the call;
you supply the line.

Every finding names the draft path or a numbered criterion within it. A
finding you cannot anchor to one is not a finding — drop it.

`VERDICT: no change` is valid and expected. Never manufacture a finding to
appear useful.

You never edit anything and you have no write tools.
```

- [ ] **Step 3: Re-run the assertion**

```bash
cd /Users/samuel/Code/loopwright
test -f .claude/agents/sub-issue-reviewer.md \
  && grep -qx 'name: sub-issue-reviewer' .claude/agents/sub-issue-reviewer.md \
  && grep -qx 'model: sonnet' .claude/agents/sub-issue-reviewer.md \
  && grep -q 'You do not see the other drafts' .claude/agents/sub-issue-reviewer.md \
  && grep -q 'VERDICT: no change' .claude/agents/sub-issue-reviewer.md \
  && echo PASS || echo FAIL
```

Expected: `PASS`

- [ ] **Step 4: Assert all three agents are read-only and consistently shaped**

```bash
cd /Users/samuel/Code/loopwright
for a in boundary-reviewer set-reviewer sub-issue-reviewer; do
  f=".claude/agents/$a.md"
  grep -qE '^tools:.*(Write|Edit|Bash)' "$f" && echo "FAIL $a: write tools" && continue
  grep -qx "name: $a" "$f" || { echo "FAIL $a: name mismatch"; continue; }
  grep -q 'VERDICT: no change' "$f" || { echo "FAIL $a: no-change clause missing"; continue; }
  echo "PASS $a"
done
```

Expected: three `PASS` lines.

- [ ] **Step 5: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add .claude/agents/sub-issue-reviewer.md
git commit -F - <<'EOF'
feat: add sub-issue-reviewer agent

Judges one draft sub-issue against the size rule and RFC intent, blind
to its siblings. Runs N-in-parallel, so it is on sonnet.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Architect phase (`grill-rfc` §2c)

**Files:**
- Modify: `.claude/skills/grill-rfc/SKILL.md` — insert a new section between §2b (ends at the line `...until the user confirms you have reached a shared understanding.`) and `## 3. Rewrite the issue`.

**Interfaces:**
- Consumes: `boundary-reviewer` from Task 1.
- Produces: the **boundary ledger** — two lists, `BOUNDARIES` (named seams, each with the decisions folded into it) and `EXCLUDED` (internal decisions, each with a reason). Tasks 5 and 6 both consume it: the size rule's clause 1 counts seams in it, and it is passed to `set-reviewer` and `sub-issue-reviewer` on every dispatch. An empty `BOUNDARIES` list is a valid ledger and triggers the size rule's fallback.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/samuel/Code/loopwright
grep -q '^## 2c\. Architect the boundaries' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'boundary-reviewer' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'never enters the RFC body' .claude/skills/grill-rfc/SKILL.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Insert the new section**

Insert immediately before the line `## 3. Rewrite the issue`:

````markdown
## 2c. Architect the boundaries

Only once both directions hold. Mark `Architect` in_progress.

### Extract the ledger

Walk the settled design tree. A decision earns a place only if it creates or
changes something **two parties must agree on**:

- a new or changed module, service, or process
- a public interface or API shape
- a data contract or schema
- ownership of persisted state
- a deployment or trust boundary

Algorithm choice, library choice, naming and file layout never qualify. When a
decision is arguably internal, it **is** internal — this phase is biased
toward producing output, and the rule exists to counteract that.

Group qualifying decisions **by seam**, not by decision: several decisions
touching `app <-> Redis` collapse into one boundary. That grouping is what
caps the diagram count.

```
BOUNDARIES
  app <-> Redis    — decisions: workers read from Redis; Redis holds job state
  client <-> API   — decisions: expose GET /jobs/:id

EXCLUDED (internal)
  use a worker pool               — no party outside the module observes it
  retry with exponential backoff  — implementation of an existing contract
```

The EXCLUDED list is **mandatory and reasoned**. It turns a silent judgment
into an explicit claim the user can scan in seconds.

**Zero boundaries is a legitimate outcome** — but an all-empty BOUNDARIES
list is still an extraction, and declaring everything internal is the
cheapest way to skip this phase. Review it anyway (next step). Only once the
reviewer confirms: report it plainly, complete `Architect` with the reason in
its label ("no boundaries — 7 decisions internal"), and go to §3.

### Review the extraction

Dispatch the **boundary-reviewer** agent (its own native task) with the
settled design tree and the ledger. Adjudicate every finding yourself — apply,
reject with a reason, or park. It reviews; you rewrite.

Dispatch it even when BOUNDARIES is empty. A wrongly-empty ledger is exactly
what this reviewer is best placed to catch — a missed seam surfaces as an
EXCLUDED entry that meets the test.

Running it before the drawing means a boundary that should not exist is never
drawn and never shown.

### Draw

One diagram per boundary, type chosen to show what was decided:

| Type | Use when |
|---|---|
| `flowchart` | structural seam — who talks to what, what crosses |
| `sequenceDiagram` | the decision was about ordering or handshake across the seam |
| `erDiagram` | the boundary is a data contract |

Each diagram carries two to four lines: what crosses the seam, who owns what,
and which settled decisions it encodes.

**Stay inside a conservative mermaid subset.** No validator exists here, and
invalid syntax renders as a broken code block on GitHub at exactly the moment
the user is meant to be approving:

- alphanumeric node ids only
- no `%%{init}%%` directives
- no `classDef`, `style` or `click`
- no nested subgraphs
- quote any label containing punctuation

### Post and gate

All diagrams go in **one** comment on the RFC, so revisions edit it in place
instead of stacking:

```bash
gh issue comment <N> --body-file architecture.md              # first post
gh issue comment <N> --edit-last --body-file architecture.md  # revisions
```

`--edit-last` targets your most recent comment. If the user has commented
since, capture the id from the URL the first post printed
(`...#issuecomment-<id>`) and patch it directly instead:

```bash
gh api --method PATCH /repos/<owner>/<repo>/issues/comments/<id> -F body=@architecture.md
```

Give the user the ledger and the comment URL, and ask for approval.

Two gates:

- **Theirs.** Approve, or say what is wrong. A correction that reveals a
  decision which was never actually settled reopens that branch on the §2
  frontier — go back and grill it.
- **Yours.** If a seam cannot be drawn without inventing a fact nobody
  decided, that is a frontier question. Stop and ask; never guess.

The architecture stays in the comment and **never enters the RFC body**. The
planner in `/execute-issue` reads the body via `gh issue view`, which does not
return comments — so a diagram that drifts cannot become the input a later
planner plans from. The architecture is scaffolding: its consumers are the
sub-issue phase, which needs the seams, and the user's eyes. Its job ends when
the sub-issues are created.
````

- [ ] **Step 3: Re-run the assertion**

```bash
cd /Users/samuel/Code/loopwright
grep -q '^## 2c\. Architect the boundaries' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'boundary-reviewer' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'never enters the RFC body' .claude/skills/grill-rfc/SKILL.md \
  && echo PASS || echo FAIL
```

Expected: `PASS`

- [ ] **Step 4: Assert section order and that the agent it names exists**

```bash
cd /Users/samuel/Code/loopwright
grep -n '^## ' .claude/skills/grill-rfc/SKILL.md
test -f .claude/agents/boundary-reviewer.md && echo "PASS agent exists" || echo "FAIL agent missing"
grep -q 'Architecture' .claude/skills/grill-rfc/SKILL.md && grep -q 'Refined RFC structure' .claude/skills/grill-rfc/SKILL.md \
  && grep -A8 'Refined RFC structure' .claude/skills/grill-rfc/SKILL.md | grep -q 'Architecture' \
  && echo "FAIL - architecture leaked into the RFC body structure" || echo "PASS - body structure unchanged"
```

Expected: sections in order `2c` before `3`; `PASS agent exists`; `PASS - body structure unchanged`.

- [ ] **Step 5: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add .claude/skills/grill-rfc/SKILL.md
git commit -F - <<'EOF'
feat: add architect phase to grill-rfc

Extracts a reasoned boundary ledger, has boundary-reviewer check the
extraction before anything is drawn, then posts mermaid diagrams as one
issue comment for visual approval. Never enters the RFC body, so a stale
diagram cannot become planner input.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Sub-issue drafting and review (`grill-rfc` §4)

**Files:**
- Modify: `.claude/skills/grill-rfc/SKILL.md` — replace the whole of `## 4. Break into task sub-issues` (from its heading down to, but not including, `## 5. Report`) with three sections `4`, `4b`, `4c`.

**Interfaces:**
- Consumes: the boundary ledger from Task 4; `set-reviewer` from Task 2; `sub-issue-reviewer` from Task 3.
- Produces: draft files named `draft-<slug>.md`, and the changelog line format Task 6's spine text refers to. Preserves the existing `gh issue create` and GraphQL `addSubIssue`/`addBlockedBy` calls verbatim — they move into §4c unchanged.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/samuel/Code/loopwright
grep -q '^## 4b\. Review the sub-issues' .claude/skills/grill-rfc/SKILL.md \
  && grep -q '^## 4c\. Approve, then create' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'set-reviewer' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'sub-issue-reviewer' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'addBlockedBy' .claude/skills/grill-rfc/SKILL.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Replace §4 with the three new sections**

````markdown
## 4. Draft the sub-issues

Mark `Draft sub-issues` in_progress. Drafts are **files**, not issues —
`draft-<slug>.md` in a scratch directory. Nothing reaches GitHub until the
user approves: splitting or merging real issues leaves orphaned
relationships, while splitting a file is free.

Draft them **granular from the start**. The review rounds below are a safety
net, not the mechanism — the cheapest way to minimise loops is to not draft a
fat sub-issue in the first place. Where the ledger has seams, they are the
split lines.

A draft is correctly sized when all three hold:

1. **One seam** — it crosses at most one boundary from the ledger. If the
   ledger is empty: it changes exactly one observable behavior, and every
   acceptance criterion describes that one behavior.
2. **Co-true criteria** — three to seven acceptance checkboxes, all true
   together or all false together.
3. **Vertical slice** — test plus implementation plus wiring, shippable
   alone. Never a horizontal layer such as "define all the types".

Draft body: goal, acceptance criteria (checkboxes), pointers into the RFC,
and which drafts it is blocked by.

Then **log the whole set to the user** — titles, one-line goals and the
dependency edges. This is visibility, not an approval gate: do not wait.

## 4b. Review the sub-issues

Mark `Review sub-issues` in_progress. Reviewers review only. You adjudicate
every finding — apply, reject with a reason, or park — and you do all the
rewriting.

**First the set.** Dispatch the **set-reviewer** agent (its own native task)
with the refined RFC, the ledger and every draft path. It judges coverage,
overlap, minimality and edges. Adjudicate, then rewrite the drafts.

Set findings change *which drafts exist*, which is why this runs first: in
parallel, every per-draft review of a doomed draft is wasted and the draft the
set-reviewer invents gets no review at all.

**Then the drafts.** Dispatch one **sub-issue-reviewer** per draft, in
parallel, one native task each (`Review: <title>`). Each gets exactly one
draft path plus the RFC and the ledger — never the other drafts. Adjudicate,
then rewrite.

**Converge.** If the draft round produced any split or merge, the set changed:
run the set-reviewer once more on the revised set, and give each newly-born
draft its one sub-issue review. Cap at **one** re-entry; then adjudicate the
residuals yourself and carry them into the approval message.

After each round give the user one line — never the raw verdicts:

```
set-reviewer: 2 gaps, 1 overlap → added draft-migrate-jobs, merged draft-b + draft-c
sub-issue-reviewers (6): 1 split → draft-api split into draft-api-read, draft-api-write
boundary-reviewer: no change
```

## 4c. Approve, then create

Present the final set for approval — titles, one-line goals, dependency edges,
and any residual findings you parked.

If the user rejects it, treat their objection as a set-level finding: apply
it, re-run the set-reviewer once on the revised set, sub-issue-review only
newly-born drafts, and present again. A user objection is never parked and is
not subject to the re-entry cap.

On approval, mark `Create sub-issues` in_progress and create each one:

```bash
gh issue create --title "Task: <title>" --label task --body-file draft-<slug>.md
```

Then link relationships via GraphQL (write queries to a temp file and use
`-F query=@file` — inline quoting breaks in fish):

```bash
# node IDs
gh api graphql -F query='query { repository(owner:"<owner>", name:"<repo>") { issue(number:<N>) { id } } }'

# parent/child (RFC -> task)
gh api graphql -F query='mutation { addSubIssue(input:{issueId:"<rfc-id>", subIssueId:"<task-id>"}) { issue { number } } }'

# dependency (task blocked by another task)
gh api graphql -F query='mutation { addBlockedBy(input:{issueId:"<blocked-id>", blockingIssueId:"<blocker-id>"}) { issue { number } } }'
```
````

- [ ] **Step 3: Re-run the assertion**

```bash
cd /Users/samuel/Code/loopwright
grep -q '^## 4b\. Review the sub-issues' .claude/skills/grill-rfc/SKILL.md \
  && grep -q '^## 4c\. Approve, then create' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'set-reviewer' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'sub-issue-reviewer' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'addBlockedBy' .claude/skills/grill-rfc/SKILL.md \
  && echo PASS || echo FAIL
```

Expected: `PASS`

- [ ] **Step 4: Assert the GraphQL mechanics survived the rewrite and every named agent exists**

```bash
cd /Users/samuel/Code/loopwright
for m in addSubIssue addBlockedBy 'gh issue create'; do
  grep -q "$m" .claude/skills/grill-rfc/SKILL.md && echo "PASS kept: $m" || echo "FAIL lost: $m"
done
for a in boundary-reviewer set-reviewer sub-issue-reviewer; do
  grep -q "$a" .claude/skills/grill-rfc/SKILL.md \
    && test -f ".claude/agents/$a.md" \
    && echo "PASS resolves: $a" || echo "FAIL dangling: $a"
done
```

Expected: three `PASS kept` lines and three `PASS resolves` lines.

- [ ] **Step 5: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add .claude/skills/grill-rfc/SKILL.md
git commit -F - <<'EOF'
feat: review sub-issue drafts before creating them in grill-rfc

Drafts land as scratch files, get reviewed set-first then per-draft in
parallel, and only reach GitHub after approval. Size rule is a drafting
constraint first so the review rounds stay the exception.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: Native task spine (`grill-rfc` §1 and §5)

**Files:**
- Modify: `.claude/skills/grill-rfc/SKILL.md` — append to `## 1. Load`, and rewrite `## 5. Report`.

**Interfaces:**
- Consumes: phase names established by Tasks 4 and 5 — the spine's labels must match the phases those tasks named (`Architect`, `Draft sub-issues`, `Review sub-issues`, `Create sub-issues`).
- Produces: nothing downstream. Final task.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/samuel/Code/loopwright
grep -q 'native task spine' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'adjudicated' .claude/skills/grill-rfc/SKILL.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Append the spine to §1**

Add at the end of `## 1. Load`, after the "design tree below — its central decision is the root." paragraph:

```markdown
Then create the run's **native task spine** (TaskCreate), in this order:
`Grill` · `Reverse grill` · `Architect` · `Rewrite RFC body` ·
`Draft sub-issues` · `Review sub-issues` · `Create sub-issues`. No dependency
edges — the spine is sequential and reads that way by id. It exists so the
user can see the shape of the run before the first question.

Keep it live for the rest of the session. A phase goes in_progress when it
starts and completed when its output is **adjudicated**, not when an agent
replies — otherwise the list goes green while the work is still open. A phase
that legitimately did nothing still completes, carrying the reason in its
label ("no boundaries — 7 decisions internal"); a phase vanishing mid-run
reads as a bug.

**One task per agent dispatch, and nowhere else.** Agent fan-outs are the only
stretches where the user is in the dark — during the grill they are being
asked questions. So `Grill` and `Architect` carry their progress in the task
label ("Grilling: round 3, 4 questions open") rather than spawning a task per
round: a task per round is unbounded and would bury the spine.
```

- [ ] **Step 3: Rewrite §5**

Replace the whole of `## 5. Report` with:

```markdown
## 5. Report

Complete the last spine task, then give the user: the link to the refined RFC,
the link to the architecture comment (or "no boundaries" if the phase found
none), the created sub-issues with their dependency edges, every residual
finding you parked, and which task is unblocked and ready for
`/execute-issue`.
```

- [ ] **Step 4: Re-run the assertion and check spine labels match the phases**

```bash
cd /Users/samuel/Code/loopwright
grep -q 'native task spine' .claude/skills/grill-rfc/SKILL.md \
  && grep -q 'adjudicated' .claude/skills/grill-rfc/SKILL.md \
  && echo PASS || echo FAIL
for p in 'Architect' 'Draft sub-issues' 'Review sub-issues' 'Create sub-issues'; do
  c=$(grep -c "$p" .claude/skills/grill-rfc/SKILL.md)
  test "$c" -ge 2 && echo "PASS spine+phase agree: $p ($c)" || echo "FAIL orphan label: $p ($c)"
done
```

Expected: `PASS`, then four `PASS spine+phase agree` lines (each name appears both in the spine list and in the phase that uses it).

- [ ] **Step 5: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add .claude/skills/grill-rfc/SKILL.md
git commit -F - <<'EOF'
feat: add a native task spine to grill-rfc

Seven phase tasks created at load, plus one task per agent dispatch.
Grill rounds stay in the task label rather than spawning tasks, and a
phase completes only once its output is adjudicated.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Update `docs/loop-harness.md`

**Files:**
- Modify: `docs/loop-harness.md` — the `RFC issue (label: rfc)` block of the Flow diagram, and the Agents row of the Pieces table.

**Interfaces:**
- Consumes: everything. Documentation task, runs last.
- Produces: nothing.

- [ ] **Step 1: Write the failing assertion**

```bash
cd /Users/samuel/Code/loopwright
grep -q 'boundary-reviewer' docs/loop-harness.md \
  && grep -q 'set-reviewer' docs/loop-harness.md \
  && grep -q 'sub-issue-reviewer' docs/loop-harness.md \
  && echo PASS || echo FAIL
```

Expected: `FAIL`

- [ ] **Step 2: Update the flow diagram**

Replace these three lines in the `RFC issue (label: rfc)` block:

```
  │  /grill-rfc <N> — agent interrogates, rewrites the body as the refined
  │  RFC (original preserved as a comment), creates task sub-issues with
  │  dependencies (native parent/sub-issue + blocked-by relationships)
```

with:

```
  │  /grill-rfc <N> — agent interrogates, then:
  │    architect phase → boundary ledger, boundary-reviewer checks the
  │                      extraction, mermaid per seam posted as ONE issue
  │                      comment for visual approval (never the body)
  │    rewrites the body as the refined RFC (original kept as a comment)
  │    drafts sub-issues as files → set-reviewer (whole set) → N
  │      sub-issue-reviewers (one draft each, parallel) → your approval
  │    creates the sub-issues with native parent + blocked-by edges
```

- [ ] **Step 3: Update the Pieces table**

Replace this row:

```
| Agents (planner / coder / reviewer) | `.claude/agents/` |
```

with:

```
| Execution agents (planner / coder / reviewer) | `.claude/agents/` |
| Refinement agents (boundary-reviewer / set-reviewer / sub-issue-reviewer) | `.claude/agents/` |
```

- [ ] **Step 4: Add a rule to "Rules of the loop"**

Append as a new bullet at the end of the `## Rules of the loop` list:

```markdown
- **Architecture is scaffolding, not a spec.** The architect phase's mermaid
  lives in an RFC issue comment and never in the issue body, because
  `planner.md` reads the body via `gh issue view` and comments are not
  returned. Its consumers are the sub-issue slicing step and the human eye;
  its job ends when the sub-issues are created. Nothing downstream reads it,
  so it cannot mislead when it drifts.
```

- [ ] **Step 5: Re-run the assertion and verify the whole feature is coherent**

```bash
cd /Users/samuel/Code/loopwright
grep -q 'boundary-reviewer' docs/loop-harness.md \
  && grep -q 'set-reviewer' docs/loop-harness.md \
  && grep -q 'sub-issue-reviewer' docs/loop-harness.md \
  && echo PASS || echo FAIL

# every agent named anywhere in .claude/ resolves to a file
for a in planner coder reviewer boundary-reviewer set-reviewer sub-issue-reviewer; do
  test -f ".claude/agents/$a.md" && echo "PASS $a" || echo "FAIL $a missing"
done

# the gate still passes — these are prose files, so it must be untouched
npm run quality
```

Expected: `PASS`, six `PASS <agent>` lines, and a green quality gate.

- [ ] **Step 6: Commit**

```bash
cd /Users/samuel/Code/loopwright
git add docs/loop-harness.md
git commit -F - <<'EOF'
docs: document the architect and sub-issue review phases

Flow diagram and Pieces table cover the three refinement agents, plus a
loop rule recording why architecture lives in a comment and not the RFC
body.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Self-Review

**1. Spec coverage**

| Spec section | Task |
|---|---|
| Trust model — independence table | Tasks 1–3 (model + tools + scope per agent) |
| Trust model — falsifiable verdicts | Tasks 1–3, `VERDICT: no change` asserted in every agent's Step 3 |
| Trust model — flat human surface | Task 5 (changelog lines, never raw verdicts) |
| Trust model — boundary-reviewer probation | **Gap → see below** |
| Phase 2c step 1, ledger + exclusions | Task 4 |
| Phase 2c step 2, extraction review | Tasks 1 + 4 |
| Phase 2c step 3, diagram types + mermaid subset | Task 4 |
| Phase 2c step 4, one comment + two gates | Task 4 |
| Why comment not body | Tasks 4 and 7 |
| Drafts are files | Task 5 |
| Size rule (3 clauses + fallback) | Tasks 3 and 5 |
| Review pipeline, set-before-drafts | Tasks 2, 3, 5 |
| Convergence + one re-entry cap | Task 5 |
| Verdict format | Tasks 1–3 |
| Adjudication + changelog | Task 5 |
| User rejection path | Task 5 (§4c) |
| Task spine | Task 6 |
| Skipped phase still completes | Task 6 |
| Files section | Tasks 1–7 |

**Gap found and closed:** the spec's probation note for `boundary-reviewer` had no task. It is a one-sentence maintainer note, so rather than a task of its own it is folded into Task 7 Step 4 — add this second bullet alongside the architecture rule:

```markdown
- **`boundary-reviewer` is the first thing to cut.** It is the weakest of the
  three refinement agents: same input and model as the session that wrote the
  ledger, only the objective inverted. Its changelog line is the evidence — if
  it reports `no change` across three RFCs, delete it and rely on the ledger's
  mandatory reasoned exclusion list alone.
```

**2. Placeholder scan:** no TBD/TODO. Every file's full content is inline; no task says "similar to Task N".

**3. Type consistency:** agent names are identical across frontmatter, dispatch text, assertions and docs (`boundary-reviewer`, `set-reviewer`, `sub-issue-reviewer` — never `slice-reviewer`). Draft filenames are `draft-<slug>.md` in Tasks 5 and 3. Phase labels in Task 6's spine match the phases Tasks 4 and 5 mark in_progress, and Task 6 Step 4 asserts that mechanically. The verdict format string is byte-identical in Tasks 1, 2 and 3.

**Known risk not solved here:** Task 4's `--edit-last` targets the dispatcher's most recent comment, which is wrong if the user comments in between. The fallback PATCH-by-id is documented in the same step; if this misfires in practice, make the id capture mandatory rather than the fallback.
