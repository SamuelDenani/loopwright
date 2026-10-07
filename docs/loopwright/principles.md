# Principles

## Context

The destination is near-autonomy, done properly rather than for hype: an
agent takes an issue to a merged change with a human stepping in only where
a human is genuinely needed. The opinions in this document are the
preconditions of that destination, not constraints on it. An agent that
merges on its own is only acceptable if "done" is a mechanical verdict that
cannot be bought. The gate as sole authority, the integrity signals and the
ratchet are preconditions of autonomy, not constraints on it.

This document is descriptive. No skill consults it, no gate checks it, and
no RFC is required to carry a classification line. Its job is to name the
boundary between what is fixed and what is swappable, so the boundary stops
being re-argued case by case.

An opinion is **core** when the rule has no knob. That is a statement about
the rule only. It does not say the rule is frozen, and it does not say the
action the rule governs has no knob: an action may be configurable when the
rule itself provides for it, as P8 does.

How far autonomy may eventually reach is deliberately not declared here.
Declaring a limit would turn a precondition into a ceiling. Nothing in this
document may foreclose an alert-driven investigate, fix, deploy sequence,
and the limit is a decision to revisit only if an actual problem appears,
not a gap to fill pre-emptively.

For how work flows from an issue to a merged change, see
`docs/loopwright/loop-harness.md`. For how a verdict is reached, see
`docs/loopwright/quality-gate.md`.

## Core opinions

- **P1 — Flow.** Work flows RFC issue, then task sub-issues, then PRs. State
  lives in artifacts, never in session memory. The trigger is detail; the
  flow is core.
  - `rejects:` a loop that keeps task state in session memory instead of a
    committed artifact, so a crashed session loses the work.
  - `enforced by:` `.claude/skills/execute-issue/SKILL.md`
- **P2 — Done.** "Done" is determined by configured checks, never by the
  judgement of whoever merges. A merge, autonomous or not, requires every
  configured check green for the current diff and review findings resolved.
  - `rejects:` a merge, autonomous or human, over a red configured check or
    an unresolved review finding.
  - `enforced by:` `.loopwright/scripts/quality-gate.mjs`,
    `.claude/skills/babysit-pr/SKILL.md`
- **P3 — Ratchet.** Quality is a ratchet against a committed baseline, with
  per-file debt grandfathered. The baseline is measured state:
  machine-written, engine-schema'd, host-committed, never hand-edited, and
  never regenerated to hide a regression. It is not the policy file P7 names.
  - `rejects:` regenerating `.loopwright/baseline.json` to make a regression
    disappear.
  - `enforced by:` `.loopwright/scripts/lib/evaluate.mjs`
- **P4 — Integrity.** Green earned versus green bought, the integrity
  signals, is a first-class concern, not an add-on.
  - `rejects:` a gate that scores correctness and coverage but leaves the
    integrity metrics out, so a suite made green with `.only` and empty
    catches still passes.
  - `enforced by:` `.loopwright/scripts/lib/collect-metrics.mjs`
- **P5 — Failure blocks.** Infrastructure failure blocks. Disabling a
  configured check is itself a violation.
  - `rejects:` switching a configured collector off, or letting a collector
    that failed to run read as "no data" and merely warn.
  - `enforced by:` `.loopwright/scripts/lib/evaluate.mjs`
- **P6 — Mediation.** Agents communicate and coordinate through a mediator,
  never peer to peer.
  - `rejects:` agents that message each other directly instead of through
    the mediator that dispatched them.
  - `enforced by:`
- **P7 — Policy.** All loopwright policy lives in one versioned file under
  `.loopwright/` in the host repo, and the engine's defaults are frozen.
  Changing what the gate demands is a PR in the host repo.
  - `rejects:` a second policy file, an environment variable that changes a
    verdict, or a loopwright update that moves a host's verdict without a
    breaking release.
  - `enforced by:` `.loopwright/scripts/lib/paths.mjs`
- **P8 — Irreversibles.** Irreversible actions require a human by default.
  Automating one is an explicit opt-in in the host's config file.
  - `rejects:` a harness that merges, tags, publishes or deploys without an
    explicit opt-in entry in the host's config file.
  - `enforced by:` `.claude/skills/babysit-pr/SKILL.md`
- **P9 — Test first.** Strict TDD: the test comes before the implementation.
  - `rejects:` a step that writes the implementation first and backfills a
    test that was never seen to fail.
  - `enforced by:` `.claude/agents/coder.md`
- **P10 — Fresh review.** Fresh-context review: every diff is reviewed by an
  agent that did not write it.
  - `rejects:` the agent that wrote a diff reviewing its own diff.
  - `enforced by:` `.claude/agents/reviewer.md`
- **P11 — Vertical slices.** A unit of work is a vertical slice, never a
  horizontal layer.
  - `rejects:` a unit of work that delivers a horizontal layer, such as
    "define all the types", instead of a slice that ships on its own.
  - `enforced by:` `.claude/agents/sub-issue-reviewer.md`
- **P12 — Vocabulary.** The metric vocabulary and its semantics are core and
  closed. Connectors measure and never invent a key: per metric, a connector
  reports a value for a core-owned key, or `unconfigured` (warns forever,
  never blocks), or `failed` (always blocks).
  - `rejects:` a connector that reports a metric key core does not define.
  - `enforced by:` `.loopwright/scripts/lib/collect-metrics.mjs`

## Detail territory

## Classification rule

## Amendments
