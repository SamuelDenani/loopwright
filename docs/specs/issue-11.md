# Issue #11 — Write docs/loopwright/principles.md

RFC: #5 · Branch: task/11-principles-doc · Base: feat/rfc-5-core-principles

## Spec

Create one new file, `docs/loopwright/principles.md`, holding the descriptive
statement of loopwright's core opinions (P1–P12) and its detail territory
(T1–T8), plus the classification rule and the amendment mechanism. The doc is
the artifact RFC #5 exists to produce: #6, #7 and #8 already cite it textually,
and #12 and #13 are blocked on it existing. It gates nothing, no skill consults
it, and no RFC is required to carry a classification line — its job is to name
the boundary so it stops being re-argued.

The source of truth for content is RFC #5's body (`gh issue view 5`): the
**Decision** section carries the P1–P12 table and the T1–T8 table, and the
**Detail territory** section carries T5's four capabilities and the T6/T7 notes.
Two things are **not** in those tables and must be authored or lifted from
prose: the twelve `rejects:` lines (the RFC mandates them but supplies none —
seeds are in Step 2 below), and the normative residue that lives only in the
RFC's *"Why the contested branches settled where they did"* prose. The rule for
that prose, stated by #11: a rule a reader must obey travels into the doc; the
story of how it was decided stays in the issue.

This is documentation only. Nothing under `.loopwright/scripts/`, `.claude/` or
`.github/` changes, and no test exists or can exist for a markdown file — see
**How steps are verified** before Step 1.

**The path and the id scheme are already promised.** RFC #5's close-out act has
been performed: #6, #7, #8, #9 and #10 each end with an identical `## Boundary
document` footer naming `docs/loopwright/principles.md` (task #11) and stating
that core opinions are cited as `P<n>` and detail territory as `T<n>`. The file
must land at exactly that path with exactly that id scheme, or five issues point
at nothing. #9's footer additionally carries a supersession note citing `P8` by
id — which is why the doc itself needs no citation of #9 (Step 3).

### Acceptance criteria

- [ ] `docs/loopwright/principles.md` exists and opens with the Context that
      states near-autonomy as the destination and the core opinions as its
      preconditions, not its constraints.
- [ ] P1–P12 are present as a list with stable ids, each carrying three things:
      the assertion, a `rejects:` line naming one concrete change it refuses,
      and an enforcement pointer that is a file name with no line number (left
      empty where nothing enforces it).
- [ ] T1–T8 are present, each with its territory and its current default. Six
      carry a named seam; T4 and T6 carry none. No contract is specified for
      T1, T2, T3, T7 or T8, with T5 the one exception, whose four required
      capabilities are enumerated in full.
- [ ] The classification rule and an `Amendments` section are present; the
      amendment rule states that ids are stable, amendments never renumber, and
      a withdrawn opinion stays as `P4 (withdrawn, RFC #N)`.
- [ ] P7 names the policy file only. `baseline.json` is described as measured
      state belonging to P3, never as policy.
- [ ] P12's assertion carries the three-valued connector contract — a value for
      a core-owned key, `unconfigured`, `failed` — with each state's verdict
      stated (`unconfigured` warns and never blocks; `failed` always blocks).
- [ ] Read against #6, #7, #8, #9 and #10, the doc contradicts none of them
      except the #9 version-bump contradiction, which the RFC states is
      deliberate.
- [ ] Style matches the two siblings in `docs/loopwright/` (see **Style
      contract**), and the quality gate is green.

### Out of scope

- Any change to `.loopwright/scripts/`, `.loopwright/tests/`, `.claude/` or
  `.github/`. RFC #5's non-goals forbid an engine or workflow change.
- Any change to `docs/loopwright/loop-harness.md` (that is #12) or to
  `README.md`, `CLAUDE.md`, `.loopwright/claude-md-section.md`,
  `package.json` (that is #13). Do not touch them even to fix a reference.
- A **"Known violations" section**, and any mention of the known P5 divergence
  at `.loopwright/scripts/quality-gate.mjs:97-99`. RFC #5 considered recording
  it and rejected it explicitly.
- Defining any contract for T1, T2, T3, T4, T6, T7 or T8. T5's four
  capabilities are the single exception the RFC resolves.
- **History**: which alternative the grill rejected, what the RFC said before
  refinement, which RFC a decision contradicts, the names #9/#6/#8 as sources
  of a decision. The doc carries rules, not provenance.
- Mermaid or any diagram. The four boundary diagrams on #5 are scaffolding; the
  doc names seams and draws nothing.
- Appending the pointer to this doc into the bodies of #6–#10. RFC #5 makes
  that a close-out act on the RFC, not part of this task.
- Naming the policy file's eventual filename (`config.yml` vs `settings.yml`) —
  that belongs to #8. P7 asserts "one file, under `.loopwright/`" only.

## Context the coder needs

### Style contract (measured from the siblings, not guessed)

Both siblings were measured; these are facts, not preferences.

| Rule | Evidence |
|---|---|
| Single `#` title, subject in sentence case | `loop-harness.md:1` `# Loop harness`, `quality-gate.md:1` `# Quality gate` |
| Short sentence-case `##` section names | `Flow`, `Rules of the loop`, `Pieces`, `Baselines`, `What is measured`, `Tuning` |
| No front matter, no date, no emoji, no author | neither sibling has any |
| Impersonal declarative voice, no "we"/"you should" | throughout; `quality-gate.md` uses "you" only in the reader-advice sense at `:53`, `:178` |
| Tables for anything enumerable | `loop-harness.md:81-88`, `quality-gate.md:82-87`, `:157-165` |
| Bold lead-in term in list items | `loop-harness.md:46` `- **Base branch**: …`, `quality-gate.md:144` `**Coverage** — …` |
| Every path, filename, tool and metric name backticked | throughout both |
| Prose wraps at ~78 chars | max prose line is 80 chars (`quality-gate.md:59`, `:101`, `:111`); 78 is the target |
| Table rows and fenced code blocks are exempt from the wrap | table rows reach 98 chars (`quality-gate.md:163`) |
| Cross-reference the sibling docs by path | `loop-harness.md:4` cites `docs/loopwright/quality-gate.md` |

Count characters, not bytes: an em dash is three bytes, so `awk 'length>78'`
over-reports. Use the Python check given in each step's **Verify**.

### Section spine (decided here so the coder does not dither)

```
# Principles
## Context
## Core opinions
## Detail territory
## Classification rule
## Amendments
```

`## Context` is the **first** section with no lead paragraph before it, because
AC 1 requires the doc to open with the Context. The sibling convention of an
opening cross-reference is satisfied inside Context, which cites
`docs/loopwright/loop-harness.md` and `docs/loopwright/quality-gate.md`. The
rationale prose for the opinions sits as paragraphs **below** the P1–P12 list,
inside `## Core opinions`, per the RFC's Form rule ("Rationale goes in prose
below the list") — no sixth section for it.

### Entry form for P1–P12 (fixed, so AC 2 is greppable)

```markdown
- **P1 — Flow.** <assertion, one to three sentences.>
  - `rejects:` <one concrete change this opinion refuses.>
  - `enforced by:` `<one file path>`
```

The `rejects:` and `enforced by:` tokens are literal and backticked, on their
own nested bullet, exactly twelve times each. Where nothing enforces an
opinion, the line is `- \`enforced by:\`` with nothing after it — the gap stays
visible, because RFC #5 states an empty pointer is itself a finding. Pointers
are file paths with **no line number**.

### Enforcement pointers (verified by reading each file — do not invent)

| id | `enforced by:` | What was read |
|---|---|---|
| P1 | `.claude/skills/execute-issue/SKILL.md` | spec committed at `:140`, "Session memory does not" at `:123` |
| P2 | `.loopwright/scripts/quality-gate.mjs`, `.claude/skills/babysit-pr/SKILL.md` | the gate decides the checks half; babysit-pr `:48-56` enforces the review half |
| P3 | `.loopwright/scripts/lib/evaluate.mjs` | the ratchet, `evaluateMetric` at `:87`, grandfathering at `:183-219` |
| P4 | `.loopwright/scripts/lib/collect-metrics.mjs` | `INTEGRITY_METRICS` at `:290-297` |
| P5 | `.loopwright/scripts/lib/evaluate.mjs` | `failed` → BLOCK at `:112-113`; `collectorRegressions` at `:150-162` ("disabling a tool is not a way to pass the gate") |
| P6 | *(empty)* | nothing in `.loopwright/scripts/` or `.claude/` enforces mediation; grep for "mediat"/"peer to peer" returns nothing |
| P7 | `.loopwright/scripts/lib/paths.mjs` | `CONFIG_PATH` is a single constant at `:11`, and `quality-gate.mjs:49` / `run-report.mjs:39` read only it |
| P8 | `.claude/skills/babysit-pr/SKILL.md` | `:56` "**Merging is the user's decision — never merge.**" |
| P9 | `.claude/agents/coder.md` | `:12` "## TDD loop (mandatory for plan steps)", `:15`, `:33` |
| P10 | `.claude/agents/reviewer.md` | frontmatter `:4` `tools: Read, Grep, Glob, Bash` — no Write/Edit, though Bash is write-capable; the three sibling reviewers carry `Read, Grep, Glob` only |
| P11 | `.claude/agents/sub-issue-reviewer.md` | `:27-28` rejects a horizontal layer |
| P12 | `.loopwright/scripts/lib/collect-metrics.mjs` | `COLLECTOR_METRICS` at `:76` is the closed id map |

Tie-break used: name the file that would **reject** a violation, not the file
that merely states the rule. That is why P11 points at
`sub-issue-reviewer.md` and not `grill-rfc/SKILL.md`, which also carries the
rule at `:273-274`. P2 is the one entry with two paths, because the opinion has
two clauses with two different enforcers; keep both, and see **Open questions**.

Line numbers in the table above are for the coder's verification only. **None
of them appears in the doc.**

### How steps are verified

There is no test, because the deliverable is a markdown file and nothing
executes it. Inventing a vitest case that asserts on the text of a doc would be
a test with no subject, and the repo's collectors cannot see the file anyway:
`.loopwright/config.json` sets `sources.roots` to `.loopwright/scripts` and
`.loopwright/tests` with `extensions: ['.mjs']`, so no metric moves on a
markdown-only diff.

Each step therefore substitutes a **check first**: a command that fails before
the step's change and passes after, plus a readthrough against the one
acceptance criterion the step owns. Run the check before writing, see it fail,
then make it pass. That is the same discipline as TDD with the only executable
surface available.

### Commit hygiene — read before the first commit

`coverage/` and `reports/` exist untracked in the repo root and are **not** in
`.gitignore` (only `.loopwright/reports/` is). They hold 28 generated
artifacts. Every commit in this plan must add explicit paths:

```bash
git add docs/loopwright/principles.md   # or docs/specs/issue-11.md
```

Never `git add -A`, never `git add .`, never `git add docs`. Verify with
`git status --short` after each commit that `?? coverage/` and `?? reports/`
are still untracked.

## Implementation plan

Steps 1–5 each add one complete section and leave the repo green by
construction (markdown is outside every collector's scope, proven above). Step
6 is the cross-RFC and style pass. Step 7 runs the gate once, because an
unconfigured-to-failed collector transition blocks for reasons unrelated to the
diff and must be caught before the PR opens.

### Step 1: The file, its spine, and the Context (AC 1)

- **Check first**: the file does not exist.
  ```bash
  test -f docs/loopwright/principles.md && echo PRESENT || echo ABSENT
  ```
  Expected before: `ABSENT`.
- **Then**: create `docs/loopwright/principles.md` with the title `# Principles`
  and the five `##` headings from **Section spine** in order, each followed for
  now only by the Context body. Context must carry, in impersonal prose:
  - Near-autonomy, done properly rather than for hype, as the **destination**,
    and the opinions below as its **preconditions, not its constraints** — an
    agent that merges on its own is only acceptable if "done" is a mechanical
    verdict that cannot be bought.
  - That the doc is **descriptive**: no skill consults it, no gate checks it,
    no RFC carries a classification line.
  - The definition of **core**: the rule has no knob — not that the rule is
    frozen, and not that the action it governs has no knob (an action may be
    configurable when the rule itself provides for it, as P8 does).
  - That the limit of autonomy is deliberately not declared here.
  - The cross-references: `docs/loopwright/loop-harness.md` for how work flows
    and `docs/loopwright/quality-gate.md` for how a verdict is reached.
- **Files**: `docs/loopwright/principles.md`
- **Verify**:
  ```bash
  test -f docs/loopwright/principles.md && \
  grep -n '^#\{1,2\} ' docs/loopwright/principles.md
  ```
  Exactly one `# ` line, then `## Context`, `## Core opinions`,
  `## Detail territory`, `## Classification rule`, `## Amendments` in that
  order. Then read the Context against AC 1: it must state near-autonomy as the
  destination and the opinions as preconditions. A Context that only says "this
  doc lists principles" fails the step.
- **Commit**: `docs: add principles doc skeleton and context`

### Step 2: P1–P12 as a list with ids, `rejects:` and pointers (AC 2, AC 5, AC 6)

- **Check first**:
  ```bash
  grep -c '`rejects:`' docs/loopwright/principles.md
  grep -c '`enforced by:`' docs/loopwright/principles.md
  ```
  Expected before: `0` and `0`. After: `12` and `12`.
- **Then**: under `## Core opinions`, write the twelve entries in the fixed
  **Entry form**. Take each assertion from RFC #5's Decision table
  (`gh issue view 5`) — its wording is authoritative; compress only to fit the
  wrap, never change the claim. Three entries carry extra required content:
  - **P7** names the policy file and *only* the policy file: all loopwright
    policy lives in one versioned file under `.loopwright/` in the host repo,
    the engine's defaults are frozen, and changing what the gate demands is a
    PR in the host repo. P7 must not mention `baseline.json` and must not name
    a filename (#8 owns the name).
  - **P3** states that the baseline is **measured state**: machine-written,
    engine-schema'd, host-committed, never hand-edited, and never regenerated
    to hide a regression. Either P3's assertion or the prose in Step 3 must say
    it is not the policy file P7 names; putting it in P3's assertion is the
    safer reading of AC 5.
  - **P12**'s assertion carries the full three-valued connector contract: a
    connector reports, per metric, either a value for a core-owned key, or
    `unconfigured`, or `failed`. `unconfigured` warns forever and never blocks;
    `failed` always blocks. "Connectors measure, they never invent a key" alone
    fails AC 6.
  - Use the `enforced by:` column from the table above verbatim.
- **Seed `rejects:` lines** — the RFC mandates the line and supplies none, so
  these are authored. Refine the wording to fit the wrap; do not weaken one
  into a slogan. Each must name a change somebody could actually propose:
  - P1: a loop that keeps task state in session memory instead of a committed
    artifact, so a crashed session loses the work. (Keep this narrow: #7 permits
    a local mailbox cache in front of GitHub, which stays the source of truth.
    A line broad enough to forbid a cache would contradict #7.)
  - P2: a merge — autonomous or human — over a red configured check or an
    unresolved review finding.
  - P3: regenerating `.loopwright/baseline.json` to make a regression
    disappear.
  - P4: a gate that scores correctness and coverage but leaves the integrity
    metrics unconfigured, so a suite made green with `.only` and empty catches
    still passes.
  - P5: switching a configured collector off, or letting a collector that
    failed to run read as "no data" and merely warn. (P5 may assert that this
    **blocks**: `collectorRegressions` returns `status: STATUS.BLOCK` at
    `.loopwright/scripts/lib/evaluate.mjs:158`. #8's open question 3 describes
    today's behaviour as a PR-comment flag, which understates the code.)
  - P6: agents that message each other directly instead of through the
    mediator that dispatched them.
  - P7: a second policy file, an environment variable that changes a verdict,
    or a loopwright update that moves a host's verdict without a breaking
    release.
  - P8: a harness that merges, tags, publishes or deploys without an explicit
    opt-in entry in the host's config file.
  - P9: a step that writes the implementation first and backfills a test that
    was never seen to fail.
  - P10: the agent that wrote a diff reviewing its own diff.
  - P11: a unit of work that delivers a horizontal layer — "define all the
    types" — instead of a slice that ships on its own.
  - P12: a connector that reports a metric key core does not define.
- **Files**: `docs/loopwright/principles.md`
- **Verify**:
  ```bash
  grep -c '^- \*\*P' docs/loopwright/principles.md          # 12
  grep -c '`rejects:`' docs/loopwright/principles.md         # 12
  grep -c '`enforced by:`' docs/loopwright/principles.md     # 12
  grep -n 'baseline' docs/loopwright/principles.md           # none inside P7
  grep -n 'unconfigured\|failed' docs/loopwright/principles.md  # both inside P12
  grep -nE '\.(mjs|md|json):[0-9]' docs/loopwright/principles.md # must be empty
  ```
  The last check is the AC 2 trap: a pointer with a line number fails. Then
  read P7, P3 and P12 against AC 5 and AC 6.
- **Commit**: `docs: add the twelve core opinions with rejects lines`

### Step 3: The rationale prose below the list (AC 5, AC 6 support)

- **Check first**:
  ```bash
  grep -c 'division of labour\|decides' docs/loopwright/principles.md
  ```
  Expected before: `0` for the P2/P8 paragraph's lead term (adjust the grep to
  the lead-in actually chosen; the point is the paragraphs are absent).
- **Then**: below the twelve-entry list, still inside `## Core opinions`, write
  the short rationale paragraphs with bold lead-ins. Exactly these, and nothing
  that is history:
  - **The P2/P8 division of labour.** P2 decides *what* "done" is: every
    configured check green for the current diff and review findings resolved.
    P8 decides *who may act* on an irreversible action. Nothing may silently
    remove the human from an irreversible action; who merges is a default, and
    a configurable one. Which CI step may fail the build is mechanics and lives
    in `docs/loopwright/quality-gate.md`.
  - **The irreversibles.** Enumerated today: merge, publishing a tag or
    release, deploy — the list is not exhaustive. Everything else the harness
    automates is reversible and needs no opt-in: closing an issue reopens,
    `gh pr ready` de-promotes, comments edit. A version bump is not
    irreversible: it lives in a file inside the PR and the human sees it in the
    same act as the merge. **Do not** name #9 or say that this contradicts a
    published RFC — that is the history that stays in the issue.
  - **The baseline is measured state.** Reinforce, in one or two sentences,
    that `.loopwright/baseline.json` belongs to P3 and is not the policy file
    P7 names.
  - **Defaults are opinions too.** One recommended default per territory,
    wired out of the box, the way framework starters ship `eslint`; a default
    is never a requirement, and there is always a documented way to swap it.
    (This may instead open `## Detail territory` in Step 4 — pick one place,
    not both.)
  - **An artifact exists before production.** An issue and a PR exist before
    anything reaches production, because P1 requires the artifact: without it
    there is nowhere for a diagnosis to live, and a fix deployed without a
    trail is green without evidence.
  - **An empty enforcement pointer is a finding**, not a completed entry.
- **Files**: `docs/loopwright/principles.md`
- **Verify**: readthrough. The prose contains no sentence naming an issue
  number as the source of a decision, no "originally", "was rejected",
  "before the grill", or "contradicts".
  ```bash
  grep -niE 'rejected|originally|before the grill|contradict|alternative' \
    docs/loopwright/principles.md   # expect no hits
  ```
- **Commit**: `docs: add the rationale prose under the core opinions`

### Step 4: Detail territory T1–T8, with T5's four capabilities (AC 3)

- **Check first**:
  ```bash
  grep -c '^| T[1-8] ' docs/loopwright/principles.md
  ```
  Expected before: `0`. After: `8`.
- **Then**: under `## Detail territory`, reproduce the RFC's table — a table,
  because it is enumerable — with the columns `id`, `Territory`, `Seam`,
  `Default today`, taking all eight rows from RFC #5's Decision section. Then,
  below it:
  - **T4 and T6 have `—` in the Seam column.** The RFC omits them
    deliberately. Inventing a seam name for either is a defect.
  - **Strip the issue numbers** the RFC's table carries in its default column
    (`js (#6)`, `mise, never required (#6)`, `container per #7`,
    `changesets, internal, host-first`) — the default travels, the citation
    does not. Keep the defaults themselves exactly.
  - One line stating this doc defines **no** contract for these territories;
    each belongs to its own RFC.
  - **T5 is the one exception**, and its four capabilities are enumerated in
    full, as a list: dispatch a subagent with fresh context and an explicit
    payload; restrict tools per role; choose a model tier per task; an external
    reviewer that can write on the PR. Add that anything the loop needs beyond
    those four is leakage — it either enters the contract as a core change or
    it is a bug; that capability 2 is load-bearing for P10, because a reviewer
    is read-only by being handed no write tools, not by being told to behave;
    and that the engine has zero coupling here — nothing under
    `.loopwright/scripts/` references Claude, agents, skills or sessions.
  - **T6 is independent of T1**: CI written in a different language than the
    project is ordinary, so a Go host needing Node in CI is not coupling. One
    line. Do not turn it into a contract.
  - **T7: name the seam and the default, and stop there.** Write the seam
    (`release`) and the default (changesets, internal to loopwright,
    host-first — if the host already uses it, loopwright uses the host's).
    **Do not** write the RFC's further claim that T7 therefore works on a
    non-JS host because the engine is already Node. #9's own body says the
    opposite — that `@changesets/cli` assumes a `package.json` and "conflicts
    with the connectors RFC for non-JS hosts", and that the release tool "should
    be pluggable" (knope elsewhere). Omitting the claim satisfies AC 3 ("no
    contract is specified for T7") and avoids a second contradiction with #9
    that AC 7 does not sanction. See **Open questions**.
  - **Do not add a T9.** #10's territory (first-time setup / installer UX) is
    not in T1–T8, and AC 3 fixes the list at eight entries. The gap is recorded
    in **Open questions**, not filled here.
- **Files**: `docs/loopwright/principles.md`
- **Verify**:
  ```bash
  grep -c '^| T[1-8] ' docs/loopwright/principles.md   # 8
  grep -nE '^\| T(4|6) ' docs/loopwright/principles.md # Seam column is —
  grep -n '#[6-9]\|#10' docs/loopwright/principles.md  # no issue refs in the table
  ```
  Then count the T5 capabilities: exactly four, no fifth. Read AC 3 line by
  line against the section.
- **Commit**: `docs: add the detail territory and the agent-host contract`

### Step 5: Classification rule and Amendments (AC 4)

- **Check first**:
  ```bash
  grep -c 'withdrawn' docs/loopwright/principles.md
  ```
  Expected before: `0`. After: at least `1`.
- **Then**:
  - `## Classification rule`: if a change alters what counts as done, or how
    work flows, it is core and must be argued against the opinions above. If it
    alters how a fact is measured or where a step runs, it belongs behind a
    contract, with a default implementation.
  - `## Amendments`: changing a core opinion is an explicit amendment — a dated
    entry naming the RFC that changed it. Ids are stable and amendments never
    renumber. A withdrawn opinion stays in place as `P4 (withdrawn, RFC #N)`,
    written exactly in that form as the example. State that there are no
    amendments yet; do not fabricate an entry, and do not add a date anywhere
    else in the doc.
- **Files**: `docs/loopwright/principles.md`
- **Verify**:
  ```bash
  grep -n 'P4 (withdrawn, RFC #N)' docs/loopwright/principles.md
  grep -n '^## Classification rule' docs/loopwright/principles.md
  grep -n '^## Amendments' docs/loopwright/principles.md
  ```
  All three must hit. Read AC 4: stable ids, never renumber, and the withdrawn
  form must all be stated, not implied.
- **Commit**: `docs: add the classification rule and the amendment mechanism`

### Step 6: Cross-RFC consistency and style pass (AC 7, AC 8)

- **Check first**: run the wrap check; it will report the prose lines the
  drafting left long.
  Save this as `/tmp/wrapcheck.py` and run `python3 /tmp/wrapcheck.py` — do not
  inline it, the fence marker does not survive shell quoting:

  ```python
  FENCE = chr(96) * 3
  path = 'docs/loopwright/principles.md'
  inside = False
  for n, line in enumerate(open(path, encoding='utf-8').read().split('\n'), 1):
      if line.startswith(FENCE):
          inside = not inside
          continue
      if inside or line.lstrip().startswith('|'):
          continue
      if len(line) > 80:
          print(n, len(line), line[:50])
  ```
  Expected after the pass: no output. Table rows and fenced blocks are exempt
  by the measured sibling convention.
- **Then**:
  1. **Confirm the four in-body citations land.** These were read out of the
     five bodies; each one is a phrase an RFC already uses, so the doc has to
     make it true:

     | Citation, verbatim from the RFC | What the doc must satisfy it with |
     |---|---|
     | #7: "The runtime is a detail behind a contract, **per the principles RFC**" | T3 is a territory with a named seam (`runtime`) and a default |
     | #7: peer-to-peer messaging "**conflicts with the mediated principle**" | P6 is nameable as the mediated principle and is strong enough to reject peer-to-peer |
     | #7: "consistent with the principle that **state never lives in session memory**" | P1's second clause says exactly that |
     | #8: "the section boundaries mirror the principles RFC: **each feature is a detail with a default, and its section is where you swap it**" | every T-row carries a default, and "there is always a documented way to swap it" is present |

     #6 carries the defaults rule verbatim but uncited ("mise is the default
     provider, the way eslint is the default linter that framework starters
     ship with"), so "Defaults are opinions too" must be recognizable as the
     same rule. #9 and #10 cite nothing in-body beyond their footers.
  2. **Check the two territory namings against the RFCs that own them.** #7's
     T3 default is plain Docker and its non-goal is "Keeping git worktrees as a
     supported isolation level" — so the doc must not describe a worktree as the
     current default. #8 and #9 both write the config section as `changesets:`,
     while #5's T7 row names the seam `release`; if the doc writes both, it must
     be unambiguous that `release` is the seam and changesets is today's default
     — never that `release` is a config key.
  3. **Read the doc against each of #6–#10 for any further contradiction.** The
     RFCs are the facts; the doc adjusts to them. The one permitted
     contradiction is #9 on who decides the version bump — leave it. Two known
     near-misses that are **not** doc bugs and need no edit: #6's connector
     contract is two-valued (a value or `unconfigured`) while P12 is
     three-valued — `failed` is real in the engine
     (`.loopwright/scripts/lib/evaluate.mjs:112-113`), so P12 adds a state
     rather than contradicting #6; and P7's frozen defaults answer a question #8
     leaves open rather than restating it. Anything else found: fix the doc,
     never the RFC, and report it.
  4. Fix the wrap, then sweep the style contract: no emoji, no front matter, no
     date, no "we"/"I", every path and tool name backticked, bold lead-ins on
     list items, section names short and sentence-case.
- **Files**: `docs/loopwright/principles.md`
- **Verify**:
  ```bash
  python3 -c "print(open('docs/loopwright/principles.md',encoding='utf-8').read().count('---'))"
  grep -nE '\b(we|I|our)\b' docs/loopwright/principles.md   # expect no hits
  grep -n '^## ' docs/loopwright/principles.md              # five sections, unchanged
  ```
  Plus the wrap check above returning nothing, and a written note of what each
  of #6–#10 was checked against.
- **Commit**: `docs: reconcile the principles doc with RFCs #6-#10`

### Step 7: Gate run and final readthrough (all ACs)

- **Check first**: the gate has not been run against this branch.
  ```bash
  node .loopwright/scripts/run-report.mjs --all && \
  node .loopwright/scripts/quality-gate.mjs
  ```
- **Then**: nothing, if the verdict is green. A markdown-only diff cannot move
  a metric (`sources.roots` is `.loopwright/scripts` and `.loopwright/tests`,
  `extensions: ['.mjs']`), so any blocker is pre-existing or environmental.
  If it is red, read `.loopwright/reports/quality-gate.json` and report the
  verdict to the orchestrator — do **not** touch `.loopwright/baseline.json`,
  `.loopwright/config.json` or any engine file to make it green. Both are out
  of scope for this task.
- **Files**: none. `.loopwright/reports/` is gitignored; the untracked
  `coverage/` and `reports/` directories the run refreshes must stay
  untracked.
- **Verify**:
  ```bash
  node .loopwright/scripts/quality-gate.mjs ; echo "exit=$?"
  git status --short     # only docs/ paths; coverage/ and reports/ still ??
  ```
  Exit `0`. Then a final readthrough of the whole file against all eight
  acceptance criteria, in order, ticking each.
- **Commit**: nothing to commit unless the readthrough found a fix, in which
  case `docs: ...` with `git add docs/loopwright/principles.md` only.

## Risks and open questions

- **The twelve `rejects:` lines are authored, not lifted.** RFC #5 mandates the
  line and its Decision table supplies none. Step 2's seeds are derived from
  the RFC's own prose, but the wording is the coder's, and the RFC's first risk
  ("principles written too broadly stop deciding anything") lands here. The
  reviewer should read each line against "could somebody actually propose
  this change?".
- **P2 carries two enforcement pointers.** AC 2 says "a file name", singular,
  but P2 has two clauses with two enforcers: the gate decides the checks half,
  `.claude/skills/babysit-pr/SKILL.md:48-56` the review half. Dropping either
  misdescribes the opinion. Flagged rather than resolved.
- **P7's "frozen defaults" is not enforced today.**
  `.loopwright/scripts/detect-stack.mjs:104-121` *copies*
  `config.default.json` into `config.json` once and refuses to overwrite — it
  is not an overlay, so there are no live defaults to freeze. #8 owns that
  change. P7 describes the decided state; its pointer
  (`.loopwright/scripts/lib/paths.mjs`) honestly covers only the "one file"
  clause.
- **P8 is the one non-descriptive line in a descriptive doc.** It describes the
  decided state, and the opt-in knob it assumes does not exist. The doc should
  not hedge it into vagueness, and should not claim the knob exists.
- **The version-bump consequence is resolved, not open.** AC 7 implies the doc
  does contradict #9, so the consequence travels; the issue's rule means the
  words "#9" and "contradicts" do not. Step 3 resolves it as "a version bump is
  not an irreversible action", with no citation — and that is safe because #9's
  own `## Boundary document` footer already carries the supersession note,
  citing `P8` by id and giving the same reasoning ("a version bump is reversible
  inside the PR — the human still sees it in the same act as the merge"). The
  cross-reference lives on the issue, where the RFC put it.
- **T7 is the one place the RFC and #9 genuinely conflict, and the plan avoids
  it rather than deciding it.** RFC #5's Detail territory prose asserts "T7
  works on a non-JS host because of T6 … changesets can be internal to
  loopwright and still serve a Go host". #9's body says the opposite: that
  `@changesets/cli` assumes a `package.json`, "conflicts with the connectors
  RFC for non-JS hosts", and that "the *release tool* that consumes it should be
  pluggable (changesets on JS, a single-binary tool such as knope elsewhere)".
  Under #5's own one-way consistency rule the RFCs are the facts, and AC 7
  sanctions only the version-bump contradiction — so Step 4 omits the claim and
  writes the seam and default only, which AC 3 independently requires. **This is
  the one item the orchestrator may want to rule on before Step 4 runs.**
- **P8 versus #9's release workflow — a second P8/#9 tension, not planned
  around.** P8's enumerated irreversibles include "publishing a tag or
  release"; #9 has a CI workflow that "creates a git tag and GitHub release"
  and never mentions an opt-in. It may not be a real conflict — changesets'
  usual shape is a release PR a human merges, which satisfies P8 through the
  merge — and #9 is not yet grilled. P8's wording comes from the RFC's
  authoritative Decision table and must not be weakened to dodge this, so the
  plan states P8 as given and records the tension here.
- **`settings.yml` is a misnomer in the RFC, and the plan sidesteps it.** RFC
  #5's open question 3 calls #8's filename alternatives "`config.yml` vs
  `settings.yml`"; #8's actual open question 2 is "`config.yml` or
  `loopwright.yml`". Out of scope already forbids the doc from naming the file
  at all, which is why this cannot leak in.
- **A ninth territory is visible but must not be added.** #10's subject —
  first-time setup / installer UX — is not in T1–T8, and #10 claims no seam of
  its own (it consumes T2's bundled `mise`). AC 3 fixes the list at eight, so
  Step 4 forbids a T9. Whether the RFC's territory list is complete is a
  question for #5, not for this task.
- **P7's freeze is a new decision presented as a settled one.** RFC #5 says P7
  "settles #8's open question 1"; #8 leaves that question open and leans the
  other way for the gate section ("a middle ground: overlay for feature
  sections, full copy for `gate:`"), calling it "the decision that matters most
  here". P7's assertion is still the RFC's to make — the doc states it without
  claiming #8 agreed.
- **`# Principles` as the title** is chosen to match the siblings' pattern
  (subject in sentence case, no subtitle). RFC #5's own title is longer; the
  file is `principles.md`.
