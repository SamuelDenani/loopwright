# Issue #12 — Strip opinions from loop-harness.md, leaving mechanics

RFC: #5 · Branch: task/12-strip-harness-opinions · Base: feat/rfc-5-core-principles

## Spec

`docs/loopwright/loop-harness.md:44-77` carries eight bolded "Rules of the
loop". Three of them assert what `docs/loopwright/principles.md` now asserts
as P1, P2 and P8. Two lists of rules is two sources of truth, and the one
nobody updates starts lying. This task deletes those three from
`loop-harness.md` and replaces them with a reference to the principle that
owns them. The five that remain are harness mechanics and stay as they are.

**This task writes no principle.** `principles.md` landed with #11 and is the
sole author of P1–P12; it is off-limits here, and so is every file #13 owns.
The change is one-directional: text leaves `loop-harness.md` and a pointer
arrives. Nothing is copied in the other direction, and no sentence is
authored here that a reader could mistake for a principle.

It also reconciles the one place where `principles.md` changed a rule rather
than describing it. `loop-harness.md:66` states that merging is always the
human's decision, absolutely; P8 makes it an opt-in-automatable default. The
absolute claim appears twice in this file — at `:66` and at the end of the
`Flow` diagram at `:41` ("human merges") — and both go, because a bare
reference to P8 next to a surviving absolute statement of P8 is still two
sources of truth.

### Acceptance criteria

Copied verbatim from the issue body.

- [ ] All eight rules at `loop-harness.md:44-77` are handled per this fixed
      classification, with no rule left undecided:

      | Lines | Rule | Verdict |
      |---|---|---|
      | 46-49 | Base branch | mechanics — stays |
      | 50-54 | Closing keywords | mechanics — stays |
      | 55-57 | Draft until ready | mechanics — stays |
      | 58-60 | The gate is the only source of truth for "done" | opinion **P2** — deleted, replaced by a reference |
      | 61-65 | State lives in artifacts, not sessions | opinion **P1** — deleted, replaced by a reference |
      | 66 | Merging is always the human's decision | opinion **P8** — deleted, replaced by a reference |
      | 67-72 | Architecture is scaffolding, not a spec | mechanics — stays |
      | 73-77 | `boundary-reviewer` is the first thing to cut | mechanics — stays |
- [ ] No rule that is an opinion remains stated in `loop-harness.md` — the file
      references the principle by its id instead of repeating it, so no rule
      exists in both files and no principle text is authored here.
- [ ] The merge rule at `loop-harness.md:66` is replaced by a **bare reference to
      P8** — not by a restatement of it. `loop-harness.md` may still describe that
      a merge step exists at the end of the flow, which is mechanics; it must not
      state who holds the authority or under what condition, which is P8's.
      Concretely: "See P8" and not "merging is the human's by default, automating
      it is an opt-in" — the second sentence is principle text, and authoring it
      here is what recreates the two-sources-of-truth problem this task exists to
      remove.
- [ ] What remains in `loop-harness.md` still reads coherently on its own as the
      execution half — base branch, closing keywords, draft-until-ready, the flow
      diagram and the `Pieces` table are intact.
- [ ] `docs/loopwright/quality-gate.md:7-9` ("The one rule") is left untouched:
      "only `quality-gate.mjs` can fail the build" is CI mechanics, not an
      opinion, and P2 does not replace it.

Short names used below: **AC1** classification table, **AC2** no opinion
stated / referenced by id, **AC3** bare P8 reference, **AC4** coherent
remainder, **AC5** `quality-gate.md` untouched.

| AC | Completed by | Also touched by |
|---|---|---|
| AC1 | Step 2 | Step 1 |
| AC2 | Step 3 (the "referenced by id" half) | Steps 1, 2 (the "not stated" half) |
| AC3 | Step 3 (the reference) | Step 1 (the two removals) |
| AC4 | Step 3 | — |
| AC5 | Step 3 (verified) | standing constraint on every step |

### Out of scope

- **Every file but `docs/loopwright/loop-harness.md`.** #13 is executing in
  parallel and owns `README.md`, `CLAUDE.md`,
  `.loopwright/claude-md-section.md` and `package.json`. Do not edit them,
  not even to fix a cross-reference this change makes stale. A set review
  verified there is no file overlap, and that is what makes the parallel run
  safe. Also off-limits: `.loopwright/baseline.json`,
  `.loopwright/config.json`, `docs/loopwright/quality-gate.md`,
  `docs/loopwright/principles.md`.
- **Any test.** See **There is no test** below. Do not add, edit or read
  `.loopwright/tests/` for this task.
- **Writing, amending or paraphrasing any principle.** No step may add a
  sentence to `loop-harness.md` that states what P1, P2 or P8 decides. Naming
  the question a principle settles is the limit.
- **Adjudicating whether the grill phase conforms to P1.** RFC #5 put that
  question out of scope for #11, so it is out of scope here. The grill-phase
  fact re-homed in Step 2 is neither labelled an exception to P1 nor called a
  violation of it.
- **The `Flow` diagram's structure and the `Pieces` table.** AC4 requires both
  intact. The only diagram change in this plan is the three-word terminal at
  `:41`, ruled on below.
- Rewriting the five surviving mechanics bullets. Their wording is not in
  scope; only the three deletions, one re-homing and the pointer are.
- Running `/babysit-pr`, opening the PR, or committing this spec. The
  orchestrator owns those.

## Rulings carried in from the orchestrator

These were decided before planning and are not re-argued by any step.

**R1 — the exception clause is mechanics and stays.** `:64-65` today reads
"— except the grill phase itself, whose task spine and drafts are
session-scoped, so a crashed grill restarts". P1 admits no exception, and the
bullet that carried the clause is being deleted, so the clause is re-homed as
a behavioural fact about `/grill-rfc`: purely descriptive, no `except`, no
`may`, no `is allowed to`, asserting nothing about what should be. Step 2
owns it.

**R2 — line 66 becomes a bare reference.** `loop-harness.md` may describe
that a merge step exists at the end of the flow. It may not say who holds the
authority or under what condition. "See P8" is correct; "merging is the
human's by default, automating it is an opt-in" is principle text and is
forbidden.

**R3 — `docs/loopwright/quality-gate.md:7-9` stays exactly as it is.** It is
CI mechanics, not an opinion, and `principles.md:107-108` already says so.

## Design decisions this plan makes

Three questions the issue leaves open. Each is settled here so the coder does
not dither, and each is justified from something measured in the repo.

**The section is renamed `## Mechanics`.** "Rules of the loop" is the wrong
name for a list that is now five mechanics items and no rules of judgement:
the heading is an invitation to add the next rule here, which is how the
duplication this task removes came to exist. "Mechanics" is the word the
issue and RFC #5 use for what stays ("leaving behind only harness
mechanics"), so the vocabulary is the repo's own, not invented. It satisfies
the measured style for `##` names — one short sentence-case word, like
`Flow`, `Pieces`, `Baselines`, `Tuning`. Nothing links to the old anchor:
`rg 'rules-of-the-loop'` returns no hits, and the only live references to the
file are `CLAUDE.md:13` and `README.md:162`, both of which cite the path and
not a section (and both belong to #13 — leave them).

**The three P-references live collected in one `## Opinions` section, not
inline.** Inline stubs would leave three half-bullets in a list whose point
is that it contains only mechanics, and a bullet reading "**Done** — see P2"
still occupies the slot where a rule used to be, which is what invites the
restatement back. One block is also the form the repo prefers for anything
enumerable: three ids and what each settles is a table
(`loop-harness.md:81-88`, `quality-gate.md:82-87`). The section sits between
the mechanics and `## Pieces` — after the list, because a reader who
remembers the merge rule being "in loop-harness" looks where the rules were.

**The right-hand column names the question, never the answer.** This is what
keeps the block a reference rather than a restatement under R2. "Who may
perform an irreversible action, merge included" states no authority; "merging
is the human's by default" would. A reviewer can check the whole block with
one test: no cell asserts a rule.

**The file gains a pointer to `principles.md` in its opening paragraph.**
`principles.md:29-31` already points here, so the link is one-directional
today. One navigational clause at `:3-5`, where the file already cites
`docs/loopwright/quality-gate.md`, makes it bidirectional. It is deliberately
redundant with `## Opinions`: the opening clause is navigation between the
three docs, the section is the specific redirect for the three rules.

**`:41`'s "human merges" is softened to "merge".** R2 forbids stating who
holds the authority, and a diagram terminal reading "human merges" states it
as flatly as the deleted `:66` did — being inside a code fence does not make
a claim mechanics. Dropping the actor leaves the step, which is mechanics,
and the diagram stays a flow of artifact states: RFC issue, task sub-issue,
draft PR, ready PR, merge. The P8 pointer is **not** put inside the fence —
a cross-reference in an ASCII diagram is noise, and `## Opinions` already
carries it with "merge included" as the hook back to this line.

**This is the one tension between two acceptance criteria.** AC4 asks for the
flow diagram "intact"; AC3 forbids stating who holds the authority. AC3 wins
for those three words. AC4's "intact" is read as "still present and still
describing the flow" — it is listed alongside "the `Pieces` table are
intact", i.e. neither was deleted — not as "byte-identical". Flagged here
because it is the one place a reviewer could reasonably read the two criteria
against each other.

## Context the coder needs

### There is no test

Markdown is outside every collector's scope. `.loopwright/config.json` sets
`sources.roots` to `.loopwright/scripts` and `.loopwright/tests` with
`extensions: ['.mjs']`, so no metric moves on a markdown-only diff.
**Inventing a vitest case that asserts on a documentation file's text is
itself a defect** and the reviewer will flag it. Do not write one, and do not
touch `.loopwright/tests/`.

Each step therefore carries a **check first** instead: a one-liner that fails
before the step's change and passes after. Run it, see the pre-state, make
the change, run it again. That is the same discipline as TDD against the only
executable surface this diff has.

Every check is scoped to `docs/loopwright/loop-harness.md` by path on
purpose. **Never run these greps repo-wide** — this spec file quotes the
strings being deleted, so a repo-wide sweep reports them as still present
and is meaningless.

### Style, measured from the file and its sibling

| Rule | Evidence |
|---|---|
| Single `#` title, sentence case | `loop-harness.md:1`, `quality-gate.md:1` |
| Short sentence-case `##` names | `Flow`, `Pieces`, `Baselines`, `Tuning` |
| Tables for anything enumerable | `loop-harness.md:81-88`, `quality-gate.md:82-87` |
| Bold lead-in on list items | `loop-harness.md:46` `- **Base branch**: …` |
| Full-sentence bold lead with a period | `loop-harness.md:67`, `:73` — the form the two surviving grill notes use |
| Prose wraps at ~78 characters | longest prose line in the file is 78 |
| No front matter, no date, no emoji | neither doc has any |
| Impersonal declarative voice | throughout |
| Every path and tool name backticked | throughout |

Count **characters**, not bytes: `→` and `—` are three bytes each, so
`awk 'length>78'` over-reports. Every line this plan adds was measured at 78
or fewer characters; keep it that way if you reflow.

### The grill-phase facts Step 2 asserts, and where they were read

| Claim | Read at |
|---|---|
| The task spine is a native task list created per run | `.claude/skills/grill-rfc/SKILL.md:22-26` |
| It is session-scoped — "Keep it live for the rest of the session" | `.claude/skills/grill-rfc/SKILL.md:28` |
| Drafts are `draft-<slug>.md` files in a scratch directory | `.claude/skills/grill-rfc/SKILL.md:255-256` |
| The scratch directory is never committed | `.claude/skills/grill-rfc/SKILL.md:198-199` |

Step 2 states only these four facts and their consequence. It invents
nothing, and none of these line numbers appears in the doc.

### What is knowingly lost, and why that is accepted

The deleted bullet at `:58-60` has a second sentence — "No agent may override
a red verdict, regenerate `.loopwright/baseline.json`, or take any of the
gated shortcuts listed in `CLAUDE.md`." The fixed classification deletes
`:58-60` whole, and that is settled input, so it goes with the rest. Two
consequences, both accepted:

- The baseline clause is P3's, not P2's. A reader reaches it through
  `## Opinions` ("the opinions the loop runs on are stated once, in
  `principles.md`"), and `principles.md:48-54` states it in full. The
  `## Opinions` table lists P1, P2 and P8 only, because the fixed
  classification names exactly those three — do not add a P3 row.
- `loop-harness.md` loses its only pointer to `CLAUDE.md`'s "Do not do these"
  list. `CLAUDE.md` still carries that list, and `CLAUDE.md:13` still points
  back at this file. Restoring the pointer would mean editing `CLAUDE.md` or
  re-authoring the sentence; the first is #13's file and the second is
  principle text. Leave it.

### Commit hygiene — read before the first commit

`coverage/` and `reports/` exist untracked in the repo root and are **not**
in `.gitignore` (only `.loopwright/reports/` is). They hold 28 generated
artifacts, and running the gate refreshes them. Every commit in this plan
stages one explicit path:

```bash
git add docs/loopwright/loop-harness.md
```

Never `git add -A`, never `git add .`, never `git add docs`. After each
commit run:

```bash
git status --short
```

and confirm that the only paths it reports are this spec and
`docs/loopwright/loop-harness.md`, and that if `coverage/` or `reports/`
appear they appear as `??` and never staged. In a freshly cut worktree those
two directories do not exist until the gate runs, which is why the Step 3
gate run comes after the last commit and not before it. Every commit message
ends with:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

### Base branch

Base and PR target are both `feat/rfc-5-core-principles`. RFC #5 runs on a
feature branch because it has three sub-issues with `blocked-by` edges, #12
is blocked by #11, and #11's work is already merged into that branch —
`principles.md` exists there and nowhere upstream, so basing on `main` would
make every reference this task adds dangle. The PR body says
`Part of #12`; the feature branch's own PR carries `Closes #5`.

## Implementation plan

Three steps. Step 1 is two mechanical deletions plus the diagram terminal.
Step 2 is the judgement-heavy re-homing, kept separate per the plan shape,
and owns the whole of the `:61-65` bullet because the clause it re-homes
comes out of that same bullet — splitting the deletion from the re-homing
would leave the repo transiently missing a true fact about the harness.
Step 3 is the pointer architecture and the branch-level readthrough.

Edit by matching text, not by line number: Step 1 shifts every line below
`:57`.

### Step 1: Delete the P2 and P8 rules and drop the actor from the diagram terminal (AC1 rows 58-60 and 66, AC3 removal half)

- **Check first** (run all four; the fourth is a guard):

  ```bash
  rg -q 'the only source of truth for "done"' docs/loopwright/loop-harness.md && echo STILL-P2 || echo P2-GONE
  rg -q 'Merging is always' docs/loopwright/loop-harness.md && echo STILL-P8 || echo P8-GONE
  rg -q 'Ready PR, gate green, reviews addressed → merge' docs/loopwright/loop-harness.md && echo TERMINAL-OK || echo TERMINAL-OLD
  rg -c '^- \*\*' docs/loopwright/loop-harness.md
  ```

  Expected **before**: `STILL-P2`, `STILL-P8`, `TERMINAL-OLD`, `8`.
  Expected **after**: `P2-GONE`, `P8-GONE`, `TERMINAL-OK`, `6`.

- **Then**, three edits in `docs/loopwright/loop-harness.md`.

  1. Delete these three lines (`:58-60`) entirely, leaving no stub bullet:

     ```markdown
     - **The gate is the only source of truth for "done".** No agent may override
       a red verdict, regenerate `.loopwright/baseline.json`, or take any of the
       gated shortcuts listed in `CLAUDE.md`.
     ```

  2. Delete this line (`:66`) entirely:

     ```markdown
     - **Merging is always the human's decision.**
     ```

  3. In the `Flow` fence, change the last line (`:41`) from:

     ```
     Ready PR, gate green, reviews addressed → human merges
     ```

     to:

     ```
     Ready PR, gate green, reviews addressed → merge
     ```

     Nothing else inside the fence changes — not a character.

- **Files**: `docs/loopwright/loop-harness.md`
- **Verify**: the four checks above show the after-state. Then confirm the
  deletions were clean and the diagram survived:

  ```bash
  rg -n '^- \*\*' docs/loopwright/loop-harness.md
  rg -n '^```' docs/loopwright/loop-harness.md
  ```

  The first prints six bullets, in this order: `Base branch`, `Closing
  keywords only fire on the default branch`, `Draft until ready`, `State
  lives in artifacts, not sessions`, `Architecture is scaffolding, not a
  spec`, `` `boundary-reviewer` is the first thing to cut ``. The second
  prints exactly two fence lines, still bracketing the `Flow` diagram.

- **Commit**: stage the one path, then
  `docs: delete the P2 and P8 rules from loop-harness (#12)`

### Step 2: Re-home the grill-phase fact and delete the P1 rule (AC1 row 61-65, AC2 "not stated" half)

This is R1. The clause at `:64-65` is harness mechanics about `/grill-rfc`,
re-stated as a fact and its consequence — not as an exception to anything.

- **Check first**:

  ```bash
  rg -q 'State lives in artifacts, not sessions' docs/loopwright/loop-harness.md && echo STILL-P1 || echo P1-GONE
  rg -q 'except' docs/loopwright/loop-harness.md && echo EXCEPTION-LANGUAGE || echo DESCRIPTIVE
  rg -q 'The grill phase is session-scoped' docs/loopwright/loop-harness.md && echo REHOMED || echo NOT-REHOMED
  ```

  Expected **before**: `STILL-P1`, `EXCEPTION-LANGUAGE`, `NOT-REHOMED`.
  Expected **after**: `P1-GONE`, `DESCRIPTIVE`, `REHOMED`.

  The middle check works because `except` occurs exactly once in the file
  today, at `:64`, and this step is the only one that removes it.

- **Then**, one edit: replace this bullet (`:61-65` as numbered in the
  issue) —

  ```markdown
  - **State lives in artifacts, not sessions**: the refined RFC and its comment
    trail on the issue, the committed spec in `docs/specs/`, per-step commits,
    and the PR conversation. Any session (or human) can pick up a half-done
    task from these alone — except the grill phase itself, whose task spine and
    drafts are session-scoped, so a crashed grill restarts.
  ```

  — with this one, in the same position, which is immediately above
  `- **Architecture is scaffolding, not a spec.**`:

  ```markdown
  - **The grill phase is session-scoped.** `/grill-rfc` holds its task spine
    and its sub-issue drafts in the session that runs it: the spine is a native
    task list, the drafts are `draft-<slug>.md` files in a scratch directory,
    and neither is committed. A crashed grill restarts.
  ```

  Why that position: it keeps all three grill-phase facts adjacent at the end
  of the list — session scope, then the architecture note, then the
  `boundary-reviewer` note — so the list reads as three loop mechanics
  followed by three grill-phase mechanics. The alternative, putting it inside
  the `Flow` fence's grill block, was rejected because AC4 requires the
  diagram intact and a fence has no room for the three clauses without
  reflowing the block.

  Three things the replacement must not do, and a reviewer will check each:
  it must not contain `except`, `may`, `is allowed to` or `should`; it must
  not name P1 or any principle; and it must not say the grill phase is an
  exception to, or in violation of, anything. It asserts four facts read from
  `.claude/skills/grill-rfc/SKILL.md` and one consequence, and nothing about
  what ought to be.

- **Files**: `docs/loopwright/loop-harness.md`
- **Verify**: the three checks show the after-state, plus

  ```bash
  rg -c '^- \*\*' docs/loopwright/loop-harness.md
  rg -n '\bmay\b|allowed|should' docs/loopwright/loop-harness.md
  ```

  First prints `6`. Second prints nothing at all — `may` occurred once in the
  file, in the bullet Step 1 deleted, and this step adds no modal.

  Run that second command **at this step, not after Step 3**: Step 3 adds the
  row `| P8 | Who may perform an irreversible action, merge included |`, which
  is the one legitimate `may` in the finished file because it poses a question
  rather than making a claim. Step 3's own sweep uses a narrower pattern for
  exactly that reason.

- **Commit**: stage the one path, then
  `docs: re-home the grill-phase session-scope fact as mechanics (#12)`

### Step 3: Rename the section, add the `## Opinions` reference and the top pointer (AC2, AC3, AC4, AC5)

- **Check first**:

  ```bash
  rg -q '^## Rules of the loop$' docs/loopwright/loop-harness.md && echo OLD-HEADING || echo RENAMED
  rg -q '^## Opinions$' docs/loopwright/loop-harness.md && echo POINTER-SECTION || echo NO-POINTER-SECTION
  rg -c 'docs/loopwright/principles.md' docs/loopwright/loop-harness.md
  ```

  Expected **before**: `OLD-HEADING`, `NO-POINTER-SECTION`, and the third
  command exits non-zero printing `0`.
  Expected **after**: `RENAMED`, `POINTER-SECTION`, `2`.

- **Then**, three edits in `docs/loopwright/loop-harness.md`.

  1. Extend the opening paragraph (`:3-5`). From:

     ```markdown
     How work flows through this repo when coding agents execute it. The quality
     gate (`docs/loopwright/quality-gate.md`) is the enforcement half; this is the
     execution half.
     ```

     to:

     ```markdown
     How work flows through this repo when coding agents execute it. The quality
     gate (`docs/loopwright/quality-gate.md`) is the enforcement half; this is the
     execution half. The opinions both halves serve are stated in
     `docs/loopwright/principles.md`.
     ```

  2. Rename the heading. From `## Rules of the loop` to `## Mechanics`.

  3. Insert a new section between the last bullet of `## Mechanics` (the
     `boundary-reviewer` one) and `## Pieces`, separated by one blank line on
     each side:

     ```markdown
     ## Opinions

     The opinions the loop runs on are stated once, in
     `docs/loopwright/principles.md`, and this file does not restate them. Three
     of them bear directly on the mechanics above:

     | Opinion | The question it settles |
     |---|---|
     | P1 | Where loop state lives |
     | P2 | What counts as "done" |
     | P8 | Who may perform an irreversible action, merge included |
     ```

     Verbatim. In particular the right-hand column names the question and
     never the answer: a cell that said "the human merges by default" or "the
     gate decides" would be principle text and would fail AC2 and AC3. Add no
     fourth row, no prose after the table, and no sentence explaining what any
     of the three decides.

- **Files**: `docs/loopwright/loop-harness.md`
- **Verify**, in four parts.

  1. The after-state of the three checks above.

  2. The structure holds — the file is six mechanics bullets, five `##`
     sections, one fence pair, and the `Pieces` table untouched:

     ```bash
     rg -n '^#{1,2} ' docs/loopwright/loop-harness.md
     rg -c '^- \*\*' docs/loopwright/loop-harness.md
     rg -q '^\| Quality gate \| `.loopwright/scripts/quality-gate.mjs`' docs/loopwright/loop-harness.md && echo PIECES-OK || echo PIECES-BROKEN
     ```

     (`rg` takes `{1,2}` unescaped — `'^#\{1,2\} '` is `grep` syntax and
     silently matches nothing here.)

     First prints `# Loop harness`, then `## Flow`, `## Mechanics`,
     `## Opinions`, `## Pieces` in that order. Second prints `6`. Third
     prints `PIECES-OK`.

  3. No opinion remains stated anywhere in the file, and the wrap holds:

     ```bash
     rg -n 'source of truth|State lives in artifacts|Merging is always|human merges|except' docs/loopwright/loop-harness.md
     rg -n '\balways\b' docs/loopwright/loop-harness.md
     python3 -c "print([(i,len(l)) for i,l in enumerate(open('docs/loopwright/loop-harness.md',encoding='utf-8').read().splitlines(),1) if len(l)>78 and not l.startswith('|')])"
     ```

     The first prints nothing. The second prints exactly two lines — the
     `Base branch` bullet and the `Closing keywords` bullet — both mechanics,
     both survivors, and neither an authority claim. The third prints `[]`
     before and after; a non-empty list means reflow the line it names. The
     `not l.startswith('|')` filter is load-bearing: `Pieces` rows `:84` and
     `:87` are 97 and 92 characters today, and the style contract exempts
     table rows from the wrap. Every prose and fence line in the file is
     already inside 78, and this plan adds none that is not.

  4. The scope held and AC5 is satisfied:

     ```bash
     git diff --name-only origin/feat/rfc-5-core-principles
     sed -n '7,9p' docs/loopwright/quality-gate.md
     ```

     The first prints `docs/loopwright/loop-harness.md`, plus
     `docs/specs/issue-12.md` once the orchestrator has committed this spec
     (an uncommitted spec is untracked and `git diff` will not list it) —
     nothing else, and in particular not
     `README.md`, `CLAUDE.md`, `.loopwright/claude-md-section.md`,
     `package.json`, `docs/loopwright/principles.md`,
     `docs/loopwright/quality-gate.md`, `.loopwright/config.json` or
     `.loopwright/baseline.json`. The second prints `## The one rule`, a blank
     line, and
     **`` `.loopwright/scripts/quality-gate.mjs` is the only step allowed to fail the build.``**
     unchanged.

  Then read `docs/loopwright/loop-harness.md` top to bottom once against AC4:
  it must stand on its own as the execution half — the flow from RFC issue to
  merge, the six mechanics, where the opinions live, and what the pieces are.
  A reader who never opens `principles.md` must still be able to run the loop
  from this file.

- **Commit**: stage the one path, then
  `docs: point loop-harness at the principles that own its opinions (#12)`
- **After the commit**, once per branch, confirm the gate is green for
  reasons unrelated to this diff:

  ```bash
  node .loopwright/scripts/run-report.mjs --all
  node .loopwright/scripts/quality-gate.mjs
  ```

  A markdown-only diff moves no metric, so a red verdict here is
  pre-existing — read `.loopwright/reports/quality-gate.json` and report it
  to the orchestrator rather than changing `loop-harness.md` to chase it.
  This run creates or refreshes the untracked `coverage/` and `reports/`
  directories in the worktree root; stage neither, and do not add them to
  `.gitignore` (that file belongs to nobody in this RFC's task set). It runs
  last so that no commit in this plan is made with those directories
  present.
