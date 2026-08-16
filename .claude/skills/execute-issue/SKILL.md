---
name: execute-issue
description: Execute a task sub-issue or a whole RFC. For a task - plan (planner agent), implement step by step with TDD (coder agents), review each step and the whole branch (reviewer agent), open a draft PR. For an RFC - resolve its sub-issues, set up a feature branch when needed, and run its tasks. You act as the orchestrator; agents do the work. Usage - /execute-issue <issue-number>.
---

# Execute an issue

The argument is an issue number — either a `task` sub-issue or an `rfc`
issue. You are the orchestrator: you gather context, dispatch the `planner`,
`coder`, and `reviewer` agents, verify their work, and open draft PRs. You
never write implementation code yourself — orchestrator fixes skip review
and pollute your context.

**Continuous execution.** Once a plan is accepted, run all its steps without
pausing to check in. Ambiguities and small plan defects are yours to rule on:
decide, record the ruling in the ledger, keep going. Stop only for: a
destructive/irreversible action, a security-sensitive action, or a plan so
broken that every path forward is a guess. The one sanctioned question is the
parallelize-or-sequential choice in RFC mode below.

## 1. Resolve the argument

Fetch the issue with its relationships (write the query to a temp file, use
`-F query=@file` — inline quoting breaks in fish):

```bash
gh api graphql -F query='query { repository(owner:"<owner>", name:"<repo>") { issue(number:<N>) {
  title body url labels(first:10){nodes{name}}
  parent { number title }
  blockedBy(first:10) { nodes { number title state } }
  subIssues(first:30) { nodes { number title state
    blockedBy(first:10) { nodes { number state } } } }
} } }'
```

- **`task` label** → run the Task flow (section 3 onward) for this issue.
- **`rfc` label** → RFC mode, section 2.
- Neither label, or a `task` with no parent RFC → stop and report.

## 2. RFC mode

Map the open sub-issues and their dependency edges.

**Single open sub-issue and no dependency edges** → run the Task flow on it
directly: branch from `origin/main`, PR targets `main` with `Closes #<task>`.

**More than one sub-issue OR any `blockedBy` edge in scope** → feature-branch
mode:

1. **Feature branch**: ensure `feat/rfc-<N>-<slug>` exists — create it from
   `origin/main` and push it if not. Every task PR targets this branch; the
   branch itself becomes one PR to `main` at the end.
2. **Ask the user** (the only pause): run the currently-unblocked tasks
   **in parallel** (one background orchestrator per task, each in its own
   worktree, each following the Task flow) or **sequentially** (next
   unblocked task, one at a time, in this session)?
3. **Execute** accordingly, creating one **native task** (TaskCreate) per
   sub-issue first — `#<n>: <title>` — and updating it (in_progress →
   completed) as each one runs. The task list is the user's live view of
   where the RFC stands. In feature-branch mode the Task flow changes in
   exactly three ways:
   - Task branches are cut from the **feature branch**, and task PRs target
     the **feature branch**.
   - Task PR bodies say `Part of #<task>` — never `Closes`. GitHub's closing
     keywords only fire on merges to the default branch, so a `Closes` here
     would silently never close the issue. Instead, the issue is closed
     **explicitly** when its PR merges into the feature branch — `/babysit-pr`
     does it (`gh issue close <task> -c "done in #<pr>, merged into
     feat/rfc-<N>-<slug>"`). The sub-issue tracks the unit of work; the RFC
     staying open is what says "not on main yet".
   - "Unblocked" therefore means the same thing everywhere: **all blocker
     issues closed.** If a blocker's PR merged but its issue is still open
     (a babysit tick was missed), close it now and proceed.
4. **Feature→main PR**: as soon as the first task PR merges into the feature
   branch (a PR needs commits to exist), open it as a **draft** — title from
   the RFC, body carrying `Closes #<RFC>` and linking the sub-issues (they
   close individually as their PRs merge). It stays draft until every
   sub-issue's PR is merged; it is babysat like any other PR.
5. **Babysit and report**: start babysitting the open PRs yourself — invoke
   the `loop` skill with `/babysit-pr <n> [<n2> ...]` (one loop covers them
   all). Then report: which tasks ran (PR links), which are still blocked
   and on what, and that more `/execute-issue <RFC>` runs unlock after
   merges.

## 3. Task flow — guard

Stop and report (do not proceed) if any of these fail:

- The issue lacks the `task` label, or has no parent RFC.
- The task is not unblocked — any `blockedBy` issue still OPEN (in
  feature-branch mode, close a blocker whose PR already merged, then
  proceed).
- The working tree is not clean (`git status`).

## 4. Choose the base branch

```bash
git fetch origin
```

- **Feature-branch mode** (or the parent RFC already has an active
  `feat/rfc-<N>-*` branch): cut from the feature branch, PR targets it.
- **Otherwise, default: branch from `origin/main`**, PR targets `main`. A
  task with no dependencies always starts from main.

Create the branch: `task/<N>-<short-slug>` from the chosen base.

## 5. Plan, then start the ledger

Dispatch the **planner** agent with the issue number, body, parent RFC, and
chosen base branch. It writes `docs/specs/issue-<N>.md`.

Before accepting the plan, scan it once for conflicts: steps that contradict
each other or the acceptance criteria, steps that mandate something the
quality gate treats as a defect, later steps that touch files earlier steps
create. Push back to the planner on what you find.

Then create the execution ledger at
`~/.claude/loop-ledgers/<owner>/<repo>/issue-<N>.md` (`mkdir -p` the
directory). It is orchestrator-internal scratch — never committed, never
inside the repo: it would pollute the spec folder and interleave bookkeeping
commits with step commits. Being user-level and keyed by repo, it survives
compaction, session crashes, and worktree deletion. Session memory does not
survive compaction; the ledger is the recovery map. It gets one line per
event, appended as they happen:

```
# Ledger — issue #<N>, branch task/<N>-<slug>, base <base>
Step 1: complete (commits <a7>..<b7>, review clean)
Step 2: fix round 1/5 (1 addressed, 1 open — <one-liner>; commits <c7>..<d7>)
Ruling: <what you decided> — <why> — <what it costs if wrong>
Step 2: complete (commits <c7>..<e7>, 1 minor deferred)
```

On resume (fresh session, post-compaction): check for this ledger before
planning — if it exists and names your issue, trust it and `git log` over
your recollection: steps with a `complete` line are DONE, never re-dispatch
them.

Commit the spec (`docs: add spec for #<N>`) and link it on the issue with
`gh issue comment`. Everything a human needs still reaches durable ground:
rulings land in the PR body, milestones in commits and the PR conversation.
Delete the ledger when the task's PR merges — the git history is the record
then.

**Mirror the accepted plan into native tasks** (TaskCreate): one task per
plan step (`Step <n>: <goal>`) plus one each for `Quality gate`,
`Final review`, and `Open draft PR`. The ledger is the durable record; the
task list is the user's live view of where you are — keep them in sync for
the rest of the run (in_progress when a step's coder is dispatched,
completed when its ledger line is written). On resume, rebuild the task
list from the ledger before continuing.

## 6. Implement — the step loop

For each plan step, in order:

1. **Record BASE** (`git rev-parse HEAD`), mark the step's native task
   in_progress, then dispatch a **fresh coder agent** with: the spec path,
   the step number, and the step text — not the session's history, not prior
   steps' summaries. One step per agent, except several tiny same-shape
   edits, which batch into one dispatch.
2. When it returns, **verify independently**: run the step's verification
   command yourself. Never mark a step done on the agent's word alone.
3. **Review the step**: dispatch the **reviewer** agent scoped to this
   step's diff (`git diff BASE..HEAD` written to a file, plus the spec path
   and step text). For a small mechanical diff, override the reviewer's
   model down to sonnet; keep opus for anything with judgment in it.
4. **Fix loop** — triggered by a failed verification or any blocker/major
   finding. One round = one fix dispatch + re-verify + scoped re-review of
   the fix diff. Five rounds max per step: rounds 1–3 go back to the same
   coder with the findings verbatim; rounds 4–5 dispatch a fresh coder on a
   more capable model ("a prior attempt failed N times; you own it now").
   At the cap, adjudicate each open finding yourself — park it with a ruling
   or, if it reveals a plan defect, rule on the correction and carry it into
   the next step's dispatch. Every ruling is a ledger line; silent discards
   are forbidden. Minor findings never enter the loop — ledger them as
   deferred and let the final review triage.
5. Append the step's completion line to the ledger, mark its native task
   completed, and move on.

## 7. Gate locally, then final review

Run `node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs`.
Iterate with coder agents until the gate is green —
`.loopwright/reports/quality-gate.json` lists every blocker with `file:line`
evidence.

Then dispatch the **reviewer** agent (fresh, opus) on the whole branch:
`git diff <base>...<branch>` as a file, the spec path, the issue number, and
the ledger's deferred-minor and parked lines so it can triage which of those
must be fixed before the PR. If it returns findings: ONE fix dispatch with
the complete list (not one fixer per finding), one scoped re-review,
adjudicate residuals. Re-run
`node .loopwright/scripts/run-report.mjs --all && node .loopwright/scripts/quality-gate.mjs`
after fixes.

## 8. Open the draft PR

```bash
git push -u origin task/<N>-<slug>
gh pr create --draft --base <target-branch> \
  --title "<type>: <task title> (#<N>)" \
  --body-file pr-body.md
```

PR body: what and why (from the spec), the issue link — `Closes #<N>` when
targeting `main`, `Part of #<N>` when targeting a feature branch — link to
the spec file, plan recap with per-step commits, **"Rulings I made"** — every
`Ruling:` line from the ledger, in order, each with what it costs if wrong
(this is the only place your decisions reach the human) — and any deferred
minors consciously left.

The PR **stays draft** — promotion to ready happens in `/babysit-pr` once the
CI gate is green. Never merge anything yourself.

## 9. Start babysitting

Opening the PR is not the end of the job — the loop is. Start it yourself:
invoke the `loop` skill with `/babysit-pr <pr-number>` (no interval — let it
self-pace against CI duration). Do not hand the command back to the user.

Then the final message: PR URL(s), branch, base, gate status, the rulings
list, and a note that babysitting is now running and will report as the PR
progresses.
