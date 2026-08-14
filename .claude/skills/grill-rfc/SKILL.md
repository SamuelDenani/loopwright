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
