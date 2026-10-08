# Issue #13 — Describe loopwright by its principles, not its stack

RFC: #5 · Branch: task/13-principles-first-identity · Base: feat/rfc-5-core-principles

## Spec

Four files currently write loopwright's identity through its stack and its
directory layout. This task rewrites each of them so the process opinion comes
first and the stack follows as a requirement rather than a definition. The
opinions already exist as prose: `docs/loopwright/principles.md` landed on this
branch from #11, and this task is the identity half of the same RFC — the
source repo would otherwise talk about principles while every adopter still
read a description by directory and test runner.

The most consequential of the four is **`.loopwright/claude-md-section.md`**.
`install.sh:30` syncs it into every host repo on every run, and `install.sh:53-63`
splices it into that repo's `CLAUDE.md` between `<!-- loopwright:start -->` and
`<!-- loopwright:end -->`. It is how loopwright introduces itself to everyone
who adopts it. This repo's own `CLAUDE.md:8-62` **is** that block — verified
byte-identical to `.loopwright/claude-md-section.md:1-55`, and the installer's
awk splice round-trips `CLAUDE.md` unchanged today. So those two edits are one
edit, applied twice, and the pair must stay identical (Step 3).

Nothing factual is removed, with **exactly one exception**. Every *requirement*
fact survives — Node ≥ 20.11, the need for a `package.json`, npm/pnpm/yarn
support, the engine's test-runner command. They stop being the identity and
stay stated; see **Requirement facts that must survive**. The single exception
is `README.md:142-143`, where *"merging is always the human's decision"* is the
one line in this task whose **truth value** changes rather than its framing:
P8 makes the human's decision a default that a host can opt out of. That is a
correction, not a reframing, and it is the only one. Read together: the
requirement rule and the `:142-143` correction are not in tension, because
`:142-143` states no requirement.

### Acceptance criteria

- [ ] `README.md:3-6` leads with a named opinion, and the "vendor it into any
      JS/TS repo" clause follows rather than defines. Passes the textual test
      in **The test for "leads with the process opinion"**.
- [ ] `README.md:89` (`## Your stack, not loopwright's`) and `README.md:173`
      (the parenthetical "loopwright targets JS/TS repos") no longer frame
      identity as the stack, while remaining factually accurate about what is
      required. `README.md:174` is untouched.
- [ ] `README.md:158-169` ("How it's wired") gains a row for
      `docs/loopwright/principles.md`, placed before the `loop-harness.md` row.
- [ ] `README.md:142-143` is reconciled with P8: merge is the human's decision
      **by default**, and automating an irreversible action is an explicit
      opt-in. The gate half of that sentence survives as P2. No text claims a
      config key that does not exist (see **Accuracy traps**).
- [ ] `.loopwright/claude-md-section.md` and the marker region of `CLAUDE.md`
      both point at three docs with `principles.md` first, both describe
      loopwright by what it is opinionated about before naming `.loopwright/`,
      and the two remain byte-identical.
- [ ] `CLAUDE.md:1-6` — the preamble **above** `<!-- loopwright:start -->`,
      which is unique to this repo and shared with nothing — no longer defines
      the project by the directory its engine lives in. The test-runner fact
      (`cd .loopwright && npx vitest run`) survives.
- [ ] `package.json:4` describes loopwright by its process opinions rather than
      as a "quality layer for AI-assisted JS/TS repos". No other field of
      `package.json` changes.
- [ ] No factual requirement is lost: Node ≥ 20.11, the need for a
      `package.json`, and npm/pnpm/yarn support remain stated in `README.md`.
- [ ] The quality gate is green (pass with the two pre-existing warnings, see
      Step 6).

### Out of scope

- **`docs/loopwright/loop-harness.md`. Do not open it for editing.** #12 is
  executing against it in parallel right now; a set review confirmed that no
  file is touched by both tasks, and that is the only reason parallel execution
  is safe. Do not edit it even to fix a cross-reference — `README.md:162`
  cites it by path, and the path does not change.
- `docs/loopwright/principles.md` (#11, already landed) and
  `docs/loopwright/quality-gate.md`. Both are read-only input here.
- `install.sh` and `setup.sh`. The marker mechanism is correct as it stands.
- Anything under `.loopwright/scripts/`, `.loopwright/tests/`, `.claude/` or
  `.github/`. RFC #5's non-goals forbid an engine or workflow change.
- `.loopwright/config.json` and `.loopwright/baseline.json`.
- Every field of `package.json` except `description`. Touching `scripts`,
  `engines` or `dependencies` would be an engine change.
- README sections the acceptance criteria do not name: `:85-87` (template
  use), `:111-123` (Package managers), `:125-140` (loop prose and diagram),
  `:145-156` (Running it), `:174-178` (the other requirement bullets),
  `:180-185` ("This repo runs on itself"), `:187-190` (License). `:174` in
  particular carries no identity framing and needs no edit.
- Adding a `principles.md` pointer anywhere beyond the four named here: one
  README table row, one README citation at `:142-143`, the three-doc list in
  the shared block, one pointer in the `CLAUDE.md` preamble. Nothing more.
- Writing a test. See the next section — this is not an omission.
- Any `audit.ignore` entry, and any regeneration of `.loopwright/baseline.json`.

## Context the coder needs

### There is no test to write — every step has a check instead

The deliverable is four prose/metadata edits. Nothing executes them, and no
collector can see them: `.loopwright/config.json` scopes `sources.roots` to
`.loopwright/scripts` and `.loopwright/tests` with `extensions: ['.mjs']`, so a
diff of markdown and one JSON string moves no metric. A vitest case asserting
on the text of `README.md` would be a test with no subject, and the gate would
be right to flag it.

So each step substitutes a **check** for the test, with the same discipline:
run the check before writing, see it fail, make the change, see it pass. Every
check below was run against this branch, and the "expected before" lines are
recorded output, not guesses.

Two environment facts about the checks, learned the hard way:

- The `node -e` checks hardcode their file path **inside** the script. The
  operand form (`node -e '…' FILE`) and any `process.argv` use is refused by
  the worktree guard. Keep the path inline.
- `git <cmd> | grep …` is also refused inside an isolated worktree. Every
  check here either uses plain `git` with no pipe, or avoids `git` entirely.

### The test for "leads with the process opinion"

Three of the five sites are leads, and "principles first" has to be checkable
or two coders produce two different leads. The literal test, applied to each
rewritten lead:

1. The lead's **first sentence names a concrete opinion** — something
   loopwright requires or refuses about process, which a repo doing the
   opposite would falsify. "A CI quality gate for repos where agents write the
   code" is a category, not an opinion, and fails. So does "Opinionated about
   process, agnostic about stack" — that is a claim *about* having opinions,
   not an opinion.
2. The first sentence does **not** contain the stack/mechanism words for that
   site before the opinion appears: `JS/TS` or `vendor` for `README.md` and
   `package.json`; `vendor` or `.loopwright/` for `CLAUDE.md` and
   `.loopwright/claude-md-section.md`.

The tone to match is `docs/loopwright/quality-gate.md:3-5`, the one place in
the repo that already states purpose process-first:

> A CI gate designed for agentic development: it blocks the merge, explains
> exactly what is wrong in the PR comment, and gives an agent enough
> structured detail to fix it and push again without a human in the loop.

The check command below prints the extracted first sentence and scores both
halves. The token list is a **proxy** for part 1: a first sentence that
matches a token but asserts nothing still fails the readthrough, which is the
authoritative test. The printed sentence is the evidence for a reviewer.

```bash
node -e 'const F="README.md",S=3,BAD=/js\/ts|vendor/i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nforbidden word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
```

`F` and `BAD` change per site; `S=3` is the first line of the lead paragraph in
all three files. Recorded output on this branch, before any change:

| Site | `opinion in first sentence` | `forbidden word before it` |
|---|---|---|
| `README.md` | FAIL | PASS |
| `.loopwright/claude-md-section.md` | FAIL | FAIL |
| `CLAUDE.md` | FAIL | FAIL |

`README.md` passes the second half already — its first sentence names a
mechanism without naming the stack. The opinion half is the one that has to
move, at every site.

### The two `CLAUDE.md` sites are different sites

This was missed once in review. `CLAUDE.md` holds two independent pieces of
text, and only one of them is shared:

| Lines | What it is | Shared with |
|---|---|---|
| `CLAUDE.md:1-6` | the preamble, above `<!-- loopwright:start -->` | nothing — unique to this repo |
| `CLAUDE.md:7` | `<!-- loopwright:start -->` | the marker `install.sh:53` matches |
| `CLAUDE.md:8-62` | the injected block | byte-identical to `.loopwright/claude-md-section.md:1-55` |
| `CLAUDE.md:63` | `<!-- loopwright:end -->` | the marker `install.sh:53` matches |

The preamble is the worst identity-by-mechanism text in the repo:

> Built from the loopwright project — this repo IS the product: the engine
> lives in `.loopwright/scripts/`, its tests in `.loopwright/tests/`
> (`cd .loopwright && npx vitest run` runs them).

It gets its own step (Step 4), separate from the shared block (Step 3), because
editing the block does not touch it and a sync check cannot see it.

### Requirement facts that must survive

The final review checks this list. Each fact must still be stated somewhere
after the rewrite, with a check command that finds it.

| Fact | Lives at | Check |
|---|---|---|
| Node ≥ 20.11 | `README.md:173` | `grep -n '20\.11' README.md` |
| A `package.json` is required | `README.md:173` | `grep -n -A8 '^## Requirements' README.md` |
| npm, pnpm and yarn all work | `README.md:174` (untouched), `:111-123` | `grep -n 'npm, pnpm' README.md` |
| The engine's tests run with `cd .loopwright && npx vitest run` | `CLAUDE.md:5` | `grep -n 'npx vitest run' CLAUDE.md` |
| The engine is at `.loopwright/scripts/`, its tests at `.loopwright/tests/` | `CLAUDE.md:4`, `README.md:182-183` | `grep -n '\.loopwright/tests/' CLAUDE.md` |
| JS/TS is what loopwright measures today | `README.md:4` and `:173` (2 hits now) | `grep -cn 'JS/TS' README.md` |
| The layer is vendored under `.loopwright/` | shared block | `grep -n 'loopwright/' .loopwright/claude-md-section.md` |
| What the layer is: RFC-driven issues, an agentic execution loop, a CI quality gate | shared block `:3-4` | readthrough |
| `gh`, Claude Code, the Claude GitHub App | `README.md:175-178` (untouched) | — |

### Accuracy traps

Three ways to write a true-sounding sentence that is false. A reviewer will
catch these, so do not write them.

- **P8's opt-in knob does not exist yet.** RFC #5 records this in its Risks:
  P8 "describes the decided state, not the current one, and the knob it assumes
  does not exist yet." So `README.md:142-143` may state the rule — an
  irreversible action needs a human unless automating it has been explicitly
  opted into — but must not send a reader looking for a config key. Say that
  loopwright ships no such opt-in today, so merge stays human. That is both P8
  and the truth.
- **Stack agnosticism is a boundary claim, not a shipped capability.** T1's
  only connector today is `js`; #6 owns the seam and has not landed. No lead
  may imply loopwright measures a non-JS repo today. "Agnostic about stack by
  design, JS/TS in practice" is the honest shape.
- **The shared block is read in repos that are not this one.** It is spliced
  into arbitrary host repos, so it says "this repo has / this repo is governed
  by", never "loopwright itself". It may cite `docs/loopwright/principles.md`:
  `install.sh:43` copies `docs/loopwright` file-by-file into the host, so the
  pointer resolves there — including for a host that installed before #11
  landed, on its next install run.

Two facts that remove worries rather than create them: `installer.test.sh:28`
and `:46` assert only that the markers exist and are not duplicated, never the
block's content, so no test depends on this text; and the installer's awk
splice (`install.sh:57-60`) round-trips `CLAUDE.md` byte-identically today,
which is what makes Step 3's propagation mechanical.

### Style contract

Measured from the files being edited, not guessed.

| Rule | Evidence |
|---|---|
| Prose wraps at ~78 chars; 80 is the practical ceiling | `README.md` has 9 lines over 80, all code fences, the flow diagram, or two prose lines at `:108` (82) and `:174` (84); `claude-md-section.md` has 2, both backticked commands |
| Table rows and fenced code are exempt from the wrap | `README.md:130-133` reach 107 |
| Every path, filename, command and metric name is backticked | throughout all four files |
| Bold for the claim a paragraph turns on | `README.md:3`, `:21`, `:28`, `:142` |
| Sentence-case `##` headings | `Why`, `Install`, `The loop`, `Running it`, `How it's wired` |
| The shared block addresses the host repo impersonally | `claude-md-section.md:3` "This repo has…" |

Do not reflow paragraphs that are not being changed — it inflates the diff and
makes the review harder than the change.

### Commit hygiene — read before the first commit

Root `coverage/` and `reports/` are **not** in `.gitignore` — it covers only
`node_modules/`, `.loopwright/reports/` and `.loopwright/node_modules/`. In the
main checkout those two directories exist untracked with 28 generated
artifacts. In a fresh worktree they may be absent, and **their absence is not a
finding**. Either way, a bare `git add -A` would stage any generated artifact a
collector run creates, so every commit stages explicit paths:

```bash
git add README.md                              # Steps 1, 2
git add .loopwright/claude-md-section.md CLAUDE.md   # Step 3
git add CLAUDE.md                              # Step 4
git add package.json                           # Step 5
```

**Never `git add -A`, never `git add .`, never `git add docs`.** After each
commit run plain `git status --short` and confirm it shows **no staged or
modified path other than the ones that step names**, and no generated artifact
staged.

### Line numbers and anchors

Every line number in this plan is as of this branch's HEAD before any change.
Step 1 changes the length of the README lead, so `:89`, `:142` and `:158` all
shift. **Locate every site by its quoted anchor text, not by number.** The
anchors:

| # | Site | Anchor to match | Step |
|---|---|---|---|
| A | `README.md:3-6` | `**A CI quality gate for repos where agents write the code` | 1 |
| B | `README.md:89` | `## Your stack, not loopwright's` | 1 |
| C | `README.md:91` | `Each collector picks an adapter, and the installer detects` | 1 |
| D | `README.md:173` | `(loopwright targets JS/TS repos)` | 1 |
| E | `README.md:142-143` | `Two rules hold the whole thing together` | 2 |
| F | `README.md:162` | `| Flow overview | ` | 2 |
| G | `claude-md-section.md:3-7` + `CLAUDE.md:10-14` | `This repo has the loopwright layer vendored under` | 3 |
| H | `CLAUDE.md:3-5` | `Built from the loopwright project` | 4 |
| I | `package.json:4` | `"description": "Vendorable quality layer` | 5 |

## Implementation plan

Six steps. Steps 1–5 each own one file group, are independently checkable, and
leave the repo green by construction (markdown and one JSON string are outside
every collector's scope, proven above). Step 6 is the requirement sweep and the
one gate run.

Step 3 runs before Step 4 on purpose: the preamble's job is to say what is true
of *this* repo and not already said by the shared block, so it is written
against the rewritten block.

### Step 1: README identity leads — sites A, B, C, D (AC 1, AC 2)

- **Check first**:
  ```bash
  node -e 'const F="README.md",S=3,BAD=/js\/ts|vendor/i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nforbidden word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
  grep -n "Your stack, not loopwright" README.md
  grep -n "loopwright targets JS/TS repos" README.md
  ```
  Expected before, exactly:
  ```
  FIRST: A CI quality gate for repos where agents write the code — plus the loop that feeds it.
  opinion in first sentence: FAIL
  forbidden word before it:  PASS
  89:## Your stack, not loopwright's
  173:- Node ≥ 20.11 and a `package.json` (loopwright targets JS/TS repos)
  ```
- **Then**: edit the three sites **bottom-up** (D, then C/B, then A) so the
  earlier line numbers stay valid while you work.
  - **D — `README.md:173`.** Keep both requirement facts, drop the identity
    parenthetical. The stack becomes what today's adapters measure, not what
    loopwright is. For example:
    `- Node ≥ 20.11 and a \`package.json\` — the engine runs on Node, and`
    `  today's adapters measure a JS/TS repo`
    Leave `:174` exactly as it is.
  - **B — `README.md:89`.** Rename the heading so it frames the section by the
    opinion instead of by the stack. `## Your toolchain is a detail` is the
    recommended wording: it matches the detail-territory vocabulary in
    `docs/loopwright/principles.md:132-138` without importing the `connector`
    seam, which #6 owns and which has not landed.
  - **C — `README.md:91`.** One clause may be added ahead of the existing
    sentence to carry the heading's claim — what loopwright fixes (the metric
    vocabulary and the verdict) versus what is yours (which tool measures each
    metric). **One clause, and nothing else in that section.** The adapter
    table and the `unconfigured` paragraphs at `:101-109` are correct and stay.
  - **A — `README.md:3-6`.** Rewrite the lead so the first sentence names a
    concrete opinion and the "vendor it into any JS/TS repo" clause follows.
    The paragraph must still carry: scoring against a committed baseline, the
    earned-vs-bought question, and the verdict coming back as a comment an
    agent can act on without a human translating it. A lead that passes both
    halves of the test:
    ```markdown
    **"Done" is a mechanical verdict, not a judgement call.** loopwright
    scores every PR against a committed baseline, asks whether the green was
    earned or bought, and hands back a verdict an agent can act on without a
    human translating it first. Vendor it into any JS/TS repo: it is
    opinionated about how work flows and how "done" is judged, and agnostic
    about the tools that measure it.
    ```
    Use it or better it — but if you rewrite it, re-run the check. Do not
    write a first sentence that claims loopwright works on a non-JS repo today
    (see **Accuracy traps**).
  - The blockquote at `:8-9` (the "wright is a maker" note) stays where it is.
- **Files**: `README.md`
- **Verify**:
  ```bash
  node -e 'const F="README.md",S=3,BAD=/js\/ts|vendor/i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nforbidden word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
  ```
  Expected: `opinion in first sentence: PASS` and
  `forbidden word before it:  PASS`, with the printed sentence readable as an
  opinion.
  ```bash
  grep -n "Your stack, not loopwright" README.md
  grep -n "loopwright targets JS/TS repos" README.md
  ```
  Expected: no output from either (exit 1).
  ```bash
  grep -cn "JS/TS" README.md
  grep -n "20\.11" README.md
  grep -n "npm, pnpm" README.md
  ```
  Expected: at least `2` JS/TS hits (the lead clause and the requirement
  bullet), the Node floor still present, `:174` untouched.
  ```bash
  node -e 'const L=require("fs").readFileSync("README.md","utf8").split("\n");let n=0;L.forEach((l,i)=>{const w=[...l].length;if(w>80&&!/^\s*[|>]/.test(l)){n++;console.log((i+1)+" ("+w+"): "+l)}});console.log("count: "+n)'
  ```
  Expected: `count: 9` or fewer, and every listed line is one that was already
  long before the change (code fences at `:74-78`, `:147-151`, the flow
  diagram, `:108`, `:174`). A new prose line over 80 means the wrap slipped.
- **Commit**: `git add README.md` —
  `docs: lead the README with the process opinion, not the stack (#13)`

### Step 2: README loop section — sites E and F (AC 3, AC 4)

- **Check first**:
  ```bash
  grep -n "always the human" README.md
  grep -n "principles.md" README.md
  ```
  Expected before: one hit for the first —
  `143:for "done"**, and **merging is always the human's decision.**` — and
  **no output** for the second.
- **Then**:
  - **E — the "Two rules" sentence.** Rewrite it so the gate half states P2
    (what "done" is: the gate's verdict, not the judgement of whoever merges)
    and the merge half states P8 (an irreversible action needs a human unless
    automating it has been explicitly opted into). Cite
    `docs/loopwright/principles.md` and name P2 and P8 — this is the README's
    only prose pointer to the doc, and it is where a reader asks "says who?".
    The phrase "always the human's decision" must not survive anywhere.
    Per **Accuracy traps**, state that loopwright ships no opt-in today, so
    merge stays human; do not name a config key. A shape that satisfies both:
    ```markdown
    Two rules hold the whole thing together: **"done" is the gate's verdict,
    never the judgement of whoever merges**, and **an irreversible action
    needs a human unless automating it has been explicitly opted into** —
    loopwright ships no such opt-in, so nothing in the harness merges. Both
    are stated in full in `docs/loopwright/principles.md` (P2 and P8).
    ```
    Do not touch `:153-156`. "Only `quality-gate.mjs` can fail the build" is CI
    mechanics, not the authority claim — `docs/loopwright/principles.md:107-108`
    draws exactly that line, and it belongs where it is.
  - **F — the "How it's wired" table.** Add one row, **first** in the table,
    before `| Flow overview | \`docs/loopwright/loop-harness.md\` |`:
    ```markdown
    | Principles — what is fixed, what is swappable | `docs/loopwright/principles.md` |
    ```
    The row's label may be reworded; its position and its path may not. The
    other eight rows stay as they are.
- **Files**: `README.md`
- **Verify**:
  ```bash
  grep -n "always the human" README.md
  ```
  Expected: no output (exit 1).
  ```bash
  grep -n -B2 -A6 "Two rules hold" README.md
  ```
  Read the result: the gate half must claim the verdict decides "done", the
  merge half must carry both the default and the opt-in, and neither may name
  a config key that does not exist.
  ```bash
  grep -n "docs/loopwright/" README.md
  ```
  Expected: the `principles.md` table row appears, and its line number is lower
  than the `loop-harness.md` row's.
- **Commit**: `git add README.md` —
  `docs: reconcile the README merge rule with P8 and wire in the principles doc (#13)`

### Step 3: the shared block — site G, in both files at once (AC 5)

- **Check first**:
  ```bash
  node -e 'const F=".loopwright/claude-md-section.md",S=3,BAD=/vendor|\.loopwright\//i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nmechanism word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
  awk '/^<!-- loopwright:start -->$/{f=1;next} /^<!-- loopwright:end -->$/{f=0} f' CLAUDE.md > "$TMPDIR/lw-block.md"
  diff "$TMPDIR/lw-block.md" .loopwright/claude-md-section.md && echo IN-SYNC
  ```
  Expected before: `opinion in first sentence: FAIL`,
  `mechanism word before it:  FAIL`, then no diff output and `IN-SYNC` — the
  two files start identical and must end identical.
- **Then**: edit **`.loopwright/claude-md-section.md` only**, then propagate.
  - Rewrite `:3-7` so the first sentence names the opinions and the
    `.loopwright/` location follows. The paragraph must still carry every fact
    it carries today: what the layer is (RFC-driven issues, an agentic
    execution loop, a CI quality gate), that it is vendored under
    `.loopwright/`, and the doc pointers — now **three**, with
    `docs/loopwright/principles.md` first, then `quality-gate.md` ("how the
    gate works" / how a verdict is reached), then `loop-harness.md` (how work
    flows from an RFC issue to a merged PR, with the `/grill-rfc`,
    `/execute-issue` and `/babysit-pr` skills). A shape that passes:
    ```markdown
    ## loopwright

    In this repo, "done" is a mechanical verdict from configured checks, never
    the judgement of whoever merges: quality is a ratchet against a committed
    baseline, and a green build has to be earned rather than bought. Read
    `docs/loopwright/principles.md` for those opinions and what each one
    refuses, `docs/loopwright/quality-gate.md` for how a verdict is reached,
    and `docs/loopwright/loop-harness.md` for how work flows from an RFC issue
    to a merged PR (the `/grill-rfc`, `/execute-issue`, and `/babysit-pr`
    skills). The layer that enforces it — RFC-driven issues, an agentic
    execution loop and a CI quality gate — is vendored under `.loopwright/`.
    ```
    It addresses a host repo, not this one (see **Accuracy traps**).
  - Leave `:9-55` — Commands, Working on a PR, Do not do these — untouched.
    They are mechanics and instructions, not identity.
  - Propagate into `CLAUDE.md` with the installer's own splice, which is
    `install.sh:57-60` verbatim and is the reason the two stay byte-identical:
    ```bash
    awk -v s='<!-- loopwright:start -->' -v e='<!-- loopwright:end -->' -v f='.loopwright/claude-md-section.md' '
      $0==s {print; while ((getline line < f) > 0) print line; skip=1; next}
      $0==e {print; skip=0; next}
      !skip {print}' CLAUDE.md > CLAUDE.md.tmp && mv CLAUDE.md.tmp CLAUDE.md
    ```
    `CLAUDE.md.tmp` must not survive the command; if it does, the `mv` did not
    run and `CLAUDE.md` is unchanged. Do not hand-edit the marker region.
- **Files**: `.loopwright/claude-md-section.md`, `CLAUDE.md`
- **Verify**:
  ```bash
  node -e 'const F=".loopwright/claude-md-section.md",S=3,BAD=/vendor|\.loopwright\//i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nmechanism word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
  ```
  Expected: both `PASS`.
  ```bash
  awk '/^<!-- loopwright:start -->$/{f=1;next} /^<!-- loopwright:end -->$/{f=0} f' CLAUDE.md > "$TMPDIR/lw-block.md"
  diff "$TMPDIR/lw-block.md" .loopwright/claude-md-section.md && echo IN-SYNC
  ```
  Expected: no diff output, then `IN-SYNC`. This is the step's load-bearing
  check — if it prints a diff, the two copies have drifted and the step is not
  done.
  ```bash
  grep -n "principles.md\|quality-gate.md\|loop-harness.md" .loopwright/claude-md-section.md
  grep -c "loopwright:start" CLAUDE.md
  ```
  Expected: the three doc paths in that order, `principles.md` first; and
  exactly `1` start marker.
  ```bash
  node -e 'const L=require("fs").readFileSync(".loopwright/claude-md-section.md","utf8").split("\n");let n=0;L.forEach((l,i)=>{const w=[...l].length;if(w>80){n++;console.log((i+1)+" ("+w+"): "+l)}});console.log("count: "+n)'
  ```
  Expected: `count: 2`, both in the untouched body (`The \`Quality gate\`
  workflow…` and the re-run command). A third entry means the new lead does not
  wrap.
- **Commit**: `git add .loopwright/claude-md-section.md CLAUDE.md` —
  `docs: introduce loopwright to host repos by its opinions first (#13)`

### Step 4: the `CLAUDE.md` preamble — site H (AC 6)

This is a **different site** from Step 3, above the `<!-- loopwright:start -->`
marker, shared with nothing, and the one a review already missed once.

- **Check first**:
  ```bash
  sed -n '1,8p' CLAUDE.md
  node -e 'const F="CLAUDE.md",S=3,BAD=/vendor|\.loopwright\//i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nmechanism word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
  ```
  Expected before: the preamble printed, then
  `opinion in first sentence: FAIL` and `mechanism word before it:  FAIL`.
- **Then**: rewrite `CLAUDE.md:3-5` (the paragraph; `:1` stays `# loopwright`,
  `:2` stays blank) so that:
  - the first sentence says what this repo is held to, not where its engine
    lives — this repo *is* loopwright, so it is governed by the opinions it
    ships, and nothing in it may make "done" a judgement call or buy a green
    build;
  - it points at `docs/loopwright/principles.md` once;
  - the engine-development facts survive after that, as mechanics: the engine
    at `.loopwright/scripts/`, its tests at `.loopwright/tests/`, and
    `cd .loopwright && npx vitest run` to run them. **The test-runner command
    is a requirement fact and must survive verbatim.**

  A shape that passes:
  ```markdown
  # loopwright

  This repo is loopwright itself, so nothing in it may make "done" a judgement
  call or buy a green build — it is held to the opinions it ships
  (`docs/loopwright/principles.md`). The engine that enforces them lives in
  `.loopwright/scripts/`, its tests in `.loopwright/tests/`
  (`cd .loopwright && npx vitest run` runs them).
  ```
  Keep it to one short paragraph. Everything host-facing is already in the
  block below it; this paragraph only says what is true of *this* repo.
- **Files**: `CLAUDE.md`
- **Verify**:
  ```bash
  node -e 'const F="CLAUDE.md",S=3,BAD=/vendor|\.loopwright\//i,OPI=/\b(done|verdict|merge|merging|earned|bought|ratchet|ratchets|baseline|review|reviewed|test first|TDD|judgement|judgment|irreversible)\b/i;const L=require("fs").readFileSync(F,"utf8").split("\n");let i=S-1,b=[];while(i<L.length&&L[i].trim()!=="")b.push(L[i++]);const p=b.join(" ").replace(/\*\*/g,"");const s=(p.match(/^.*?[.!?](?=\s|$)/)||[p])[0];console.log("FIRST: "+s+"\nopinion in first sentence: "+(OPI.test(s)?"PASS":"FAIL")+"\nmechanism word before it:  "+(BAD.test(s)?"FAIL":"PASS"))'
  grep -n "npx vitest run" CLAUDE.md
  grep -n "\.loopwright/tests/" CLAUDE.md
  grep -n "IS the product" CLAUDE.md
  ```
  Expected: both halves `PASS`; the vitest command and the tests path still
  found in the preamble; no hit for `IS the product`.
  ```bash
  awk '/^<!-- loopwright:start -->$/{f=1;next} /^<!-- loopwright:end -->$/{f=0} f' CLAUDE.md > "$TMPDIR/lw-block.md"
  diff "$TMPDIR/lw-block.md" .loopwright/claude-md-section.md && echo IN-SYNC
  ```
  Expected: `IN-SYNC` still. This proves the preamble edit did not reach into
  the shared block.
- **Commit**: `git add CLAUDE.md` —
  `docs: define this repo by the opinions it is held to, not its directories (#13)`

### Step 5: `package.json` description — site I (AC 7)

- **Check first**:
  ```bash
  cp package.json "$TMPDIR/pkg-base.json"
  node -e 'const d=JSON.parse(require("fs").readFileSync("package.json","utf8")).description;const OPI=/\b(done|verdict|merge|earned|bought|ratchet|ratchets|baseline|review|judgement|judgment|irreversible)\b/i;const s=(d.match(/^.*?[.!?:](?=\s|$)/)||[d])[0];console.log("DESC  : "+d+"\nlength: "+d.length+"\nFIRST : "+s+"\nopinion first: "+(OPI.test(s)?"PASS":"FAIL")+"\nstack word before it: "+(/js\/ts|vendor/i.test(s)?"FAIL":"PASS"))'
  ```
  Expected before, exactly:
  ```
  DESC  : Vendorable quality layer for AI-assisted JS/TS repos: RFC-driven issue flow, agentic execution loop, and a CI quality gate that agents cannot cheat.
  length: 148
  FIRST : Vendorable quality layer for AI-assisted JS/TS repos:
  opinion first: FAIL
  stack word before it: FAIL
  ```
  The `cp` is part of the check: it is the baseline the verify step compares
  against, and it avoids piping `git` into anything.
- **Then**: replace the value of `description` and nothing else. Constraints:
  - the first clause (up to the first `.`, `!`, `?` or `:`) names a concrete
    process opinion and contains neither `JS/TS` nor `vendor`;
  - the facts that survive: an RFC-driven issue flow, an agentic execution
    loop, a CI quality gate, and JS/TS as what it measures today;
  - one line, ≤ 220 characters (it is 148 today), valid JSON;
  - **no `"` inside the string.** Escaped quotes in a `package.json`
    description are a needless hazard; leave `done` unquoted.

  A value that passes:
  ```
  Done is a mechanical verdict, not a judgement call: quality ratchets against a committed baseline and green must be earned — RFC-driven issue flow, agentic execution loop and CI quality gate for JS/TS repos.
  ```
- **Files**: `package.json`
- **Verify**:
  ```bash
  node -e 'const d=JSON.parse(require("fs").readFileSync("package.json","utf8")).description;const OPI=/\b(done|verdict|merge|earned|bought|ratchet|ratchets|baseline|review|judgement|judgment|irreversible)\b/i;const s=(d.match(/^.*?[.!?:](?=\s|$)/)||[d])[0];console.log("DESC  : "+d+"\nlength: "+d.length+"\nFIRST : "+s+"\nopinion first: "+(OPI.test(s)?"PASS":"FAIL")+"\nstack word before it: "+(/js\/ts|vendor/i.test(s)?"FAIL":"PASS"))'
  ```
  Expected: both `PASS`, `length` ≤ 220. The `JSON.parse` succeeding is also
  the JSON-validity check.
  ```bash
  node -e 'const fs=require("fs"),a=JSON.parse(fs.readFileSync(process.env.TMPDIR+"/pkg-base.json","utf8")),b=JSON.parse(fs.readFileSync("package.json","utf8"));delete a.description;delete b.description;console.log(JSON.stringify(a)===JSON.stringify(b)?"PASS: only description differs":"FAIL: another field changed")'
  ```
  Expected: `PASS: only description differs`. Because `JSON.stringify` of a
  parsed object preserves key order, this also catches a reordering of
  `scripts`, `engines` or `devDependencies`.
  ```bash
  git diff -U0 -- package.json
  ```
  Expected: exactly one `-` line and one `+` line, both the `"description":`
  line. Plain `git diff` with no pipe — the piped form is refused in a
  worktree.
- **Commit**: `git add package.json` —
  `chore: describe loopwright by its process opinions (#13)`

### Step 6: requirement sweep, sync re-check, and the one gate run

No file changes unless the sweep finds a dropped fact.

- **Check first**: nothing to fail — this step verifies the previous five.
- **Then**: run the sweep. If a fact is missing, restore it in the file that
  owned it and amend that file's commit (or add a fixup commit); do not move a
  fact to a different file to make a grep pass.
- **Files**: none expected.
- **Verify**:
  ```bash
  grep -n "20\.11" README.md
  grep -n -A8 "^## Requirements" README.md
  grep -n "npm, pnpm" README.md
  grep -cn "JS/TS" README.md
  grep -n "npx vitest run" CLAUDE.md
  grep -n "\.loopwright/tests/" CLAUDE.md
  grep -n "principles.md" README.md .loopwright/claude-md-section.md CLAUDE.md
  ```
  Expected: every row of **Requirement facts that must survive** accounted
  for; `principles.md` found in all three files.
  ```bash
  awk '/^<!-- loopwright:start -->$/{f=1;next} /^<!-- loopwright:end -->$/{f=0} f' CLAUDE.md > "$TMPDIR/lw-block.md"
  diff "$TMPDIR/lw-block.md" .loopwright/claude-md-section.md && echo IN-SYNC
  ```
  Expected: `IN-SYNC`.
  ```bash
  git status --short
  ```
  Expected: no staged or modified path beyond the five this task owns, and no
  generated artifact staged. Root `coverage/` and `reports/` may legitimately
  not exist here — they are absent in a fresh worktree, and that absence is not
  a finding; if they do appear, they must stay untracked.
  ```bash
  git diff --stat origin/feat/rfc-5-core-principles...HEAD
  ```
  Expected: exactly five paths — `README.md`, `CLAUDE.md`,
  `.loopwright/claude-md-section.md`, `package.json`, `docs/specs/issue-13.md`.
  **`docs/loopwright/loop-harness.md` must not appear.** If it does, Step 1–5
  reached into #12's file and the change must be reverted.

  The `origin/` prefix is **required** and the three-dot form is deliberate.
  The local branch of that name is stale in this worktree — it points at
  `2b510fa`, which is also `origin/main`'s tip, so
  `feat/rfc-5-core-principles...HEAD` and `main...HEAD` both pick the wrong
  merge-base and report seven paths, with #11's `docs/loopwright/principles.md`
  and `docs/specs/issue-11.md` reappearing. Only
  `origin/feat/rfc-5-core-principles` (`26681fe`, the commit carrying #11's
  merge) gives the five-path result. Do not run `git fetch` and do not move,
  reset or update any branch to make this command agree — the orchestrator owns
  the refs.
  Dependencies must be installed before the collectors can run — in a fresh
  worktree `eslint`, `vitest` and `jscpd` are absent and a collector fails with
  "command not found", which is a missing install and not a finding about this
  diff. `npm ci` at the repo root and `cd .loopwright && npm ci` fix it.
  ```bash
  node .loopwright/scripts/run-report.mjs --all
  node .loopwright/scripts/quality-gate.mjs
  ```
  Expected: exit `0`, verdict pass, with the two pre-existing warnings —
  `typecheck` unconfigured and `audit.high` = 2 (`brace-expansion`,
  `js-yaml`). Neither is ours and neither blocks. **Do not add an
  `audit.ignore` entry**: both advisories have upstream fixes, and `CLAUDE.md`
  forbids ignoring an advisory that does. Do not regenerate the baseline — no
  metric can move on this diff, so a baseline change would be unexplainable.
  The collectors write to `.loopwright/reports/`, which is gitignored, so a
  run leaves `git status --short` empty in a worktree. Re-check it after the
  run anyway: if any generated path does appear, it is untracked and stays
  that way.
- **Commit**: none, unless the sweep found something. If it did:
  `git add <the one file>` — `docs: restore <fact> dropped in the rewrite (#13)`

## Risks and open questions

- **P8's opt-in does not exist in the code.** Step 2 states a rule the harness
  does not yet implement a knob for. The wording in **Accuracy traps** keeps it
  honest, but a reviewer may still read "explicitly opted into" as a promise.
  RFC #5 accepted this risk explicitly ("P8 is the only non-descriptive line in
  a descriptive document"); the mitigation is the clause saying loopwright
  ships no such opt-in today.
- **`README.md:89`'s heading wording is a judgement call.** `## Your toolchain
  is a detail` is recommended, not mandated by any acceptance criterion. The
  criterion is only that the heading no longer frames identity as the stack.
  A reviewer may prefer different wording; that is a comment, not a blocker.
- **The shared block ships to hosts on their next `install.sh` run**, replacing
  their marker region. That is the mechanism working as designed, and the only
  reason this task matters more than the other three, but it does mean the
  wording gets no second chance in an adopter's repo once released.
- **Line-number drift.** Every site is anchored by text for this reason, but
  Step 1 moves `:89`, `:142`, `:158` and `:173`. A coder working top-down from
  numbers will edit the wrong lines.
- **Open question, not blocking**: `README.md:180-185` ("This repo runs on
  itself") also describes the repo through `.loopwright/scripts/` and a test
  count. It is a dogfooding claim rather than an identity statement, no
  acceptance criterion names it, and RFC #5's scope does not list it — so it
  is out of scope here. If a reviewer wants it reframed, it is a follow-up
  issue, not a scope creep into this PR.
