---
name: grill-rfc
description: Grill the author of an RFC issue relentlessly until the design is fully settled, then rewrite the issue body as the refined RFC (preserving the original as a comment) and break it into task sub-issues with dependencies. Usage - /grill-rfc <issue-number>.
---

# Grill an RFC

The argument is a top-level RFC issue number. The user has written their
initial deliberation in the issue body; your job is to interrogate it until
you reach a shared understanding, then turn the result into the refined RFC
and its task sub-issues.

## 1. Load

```bash
gh issue view <N> --json number,title,body,labels,url
```

Abort unless the issue has the `rfc` label. The deliberation in the body
seeds the design tree below — its central decision is the root.

## 2. Grill

Interview the user relentlessly until you reach a shared understanding. Map
this as a **design tree**: every decision branches into the decisions that
hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose
prerequisites are already settled — the questions you can ask _now_ without
guessing at answers you haven't heard yet. Ask the whole frontier in one
round: number each question and give your recommended answer. Then wait for
the user's answers before the next round.

Each question should be formatted like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree — settled decisions push the
frontier outward and unblock questions that depended on them. Recompute the
frontier and ask the next round. A question whose answer depends on another
question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs
a fact from the environment (this codebase, the quality gate config, an
upstream library, existing issues), dispatch a sub-agent to find it — don't
ask the user for anything you could look up yourself. Don't block on it: a
running exploration is an unsettled prerequisite, so only the questions
downstream of it wait for the sub-agent to report — ask the rest of the
frontier now. The _decisions_ are the user's — put each to them and wait.

The grill is done when the frontier is empty: every branch of the design tree
visited, nothing left silently assumed. The user may explicitly defer a
branch — that is a settled decision too; it leaves the frontier and lands in
the RFC's **Open questions**, not in limbo.

## 2b. Reverse grill

An empty frontier proves *you* have no questions left — it proves you
understand the user, not that the user understands what is about to be
built. Shared understanding is bidirectional, so before closing, flip the
table: now the questions test the user, same `❓/➡️` format, but the
➡️ line is what the settled design says (revealed after they answer, or as
the "check yourself" key).

Draw them from the two places where surprises hide:

- **Business-rule branches** — walk the ifs of the settled design as
  concrete scenarios: "an order with X and Y arrives — what does the system
  do?" Every conditional the RFC implies should be exercised at least once,
  edge cases first.
- **Connection points** — where the new piece touches existing behavior:
  "this changes `<module>`; what happens to <existing flow> after this
  ships?" Include the non-obvious blast radius you found while gathering
  facts.

An answer that diverges from the settled design means that branch was
**not** actually settled — reopen it on the frontier and grill it again
(the divergence is the question). An "I don't know" is a gap, not a
failure: explain, then re-check with a different scenario.

The session is done when both directions hold: your frontier is empty AND
the user's answers match the design. Do not move to step 3 until the user
confirms you have reached a shared understanding.

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

## 3. Rewrite the issue

First preserve the original deliberation (audit trail), then replace the
body:

```bash
gh issue comment <N> --body-file original.md   # starts with "## Original deliberation (pre-refinement)"
gh issue edit <N> --body-file refined.md
```

Refined RFC structure: **Summary** · **Context** · **Decision** (the settled
tree, with the reasoning that settled contested branches) · **Scope** /
**Non-goals** · **Risks** · **Task breakdown** (mirrors the sub-issues about
to be created, with dependency edges) · **Open questions** (the explicitly
deferred branches).

## 4. Break into task sub-issues

Propose the breakdown to the user first — titles, one-line goals, and the
dependency edges — and get approval before creating anything. Each task must
be one PR's worth of work with testable acceptance criteria.

For each approved task:

```bash
gh issue create --title "Task: <title>" --label task --body-file task-N.md
```

Task body: goal, acceptance criteria (checkboxes), pointers into the RFC.
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

## 5. Report

Final message: link to the refined RFC, the list of created sub-issues with
their dependency edges, and which task is unblocked and ready for
`/execute-issue`.
