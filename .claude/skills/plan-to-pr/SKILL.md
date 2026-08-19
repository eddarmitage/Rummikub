---
name: plan-to-pr
description: Execute a self-contained implementation plan document (produced by the `issue-to-plan` skill, or written by hand) via a completely fresh agent that has never seen the planning conversation — optionally on a cheap/fast model, since a sufficiently thorough plan needs no further judgment calls, only correct execution. Use once a plan document exists and is ready to implement.
---

# Plan to PR

## Why a fresh agent, and why a cheap model can work here

The execution agent's entire value in this split is *not* having to re-derive
anything — a good plan already resolved every judgment call, so execution
should be closer to "follow these exact steps" than "figure out what to do."
That profile is exactly where a cheaper/faster model earns its keep instead
of costing correctness.

A `haiku`-model execution agent, given only a genuinely self-contained plan,
can correctly re-check live repo state as instructed, apply conditional
logic that depends on that check, and produce a diff that matches the plan's
target exactly — provided the plan itself left no real judgment calls
unresolved. A `sonnet`-model run on a plan with no branching logic at all is
an even safer bet. Either way, verify independently (`gh pr diff`, `gh pr
view --json mergeable,labels`) rather than trusting the executing agent's own
self-report — always do this; a subagent's summary describes what it
intended to do, not necessarily what it verified.

The corresponding risk: a weaker model is more likely to mishandle whatever
the plan *didn't* anticipate, and to misjudge ambiguous verification signals
(e.g. deciding whether a CI failure is a known, benign condition or a real
regression — this repo has no CI wired up yet, see issue #10/#9, so treat
any red check as real until that changes). Route back to a stronger model,
or to yourself, for anything the plan's own "handling drift" guidance
doesn't clearly cover.

## Steps

1. Get the plan document's full text (from `issue-to-plan`'s output, or
   hand-written to an equivalent standard).
2. Launch a fresh `general-purpose` agent with **worktree isolation**
   (`isolation: "worktree"` — unlike the planning phase, this one writes
   code, commits, pushes, and opens a PR). Pass the entire plan document as
   the prompt, prefixed with a short frame: this agent has no other context,
   the document is fully self-contained, follow it exactly, and where the
   plan says to re-check live repo state before choosing between branches of
   its own instructions, do that check for real rather than trusting the
   plan's "as of this research" snapshot to still be current.
3. Pick the model deliberately, don't default without thinking:
   - A plan with no remaining judgment calls (pure mechanical diff,
     precedent-based conventions, no live-state branching) is a reasonable
     candidate for `model: "haiku"`.
   - A plan that still leaves some interpretation to execution time (e.g.
     conditional branches depending on live PR/issue state, or a
     verification step that requires judging whether a failure is expected)
     — check whether that interpretation is itself mechanical (a
     `gh pr view --json state` check feeding a clear if/else) or genuinely
     requires judgment. The former is still fine for a cheap model; the
     latter isn't — use a stronger model, or don't skip straight to
     `plan-to-pr` and instead firm up the plan first.
4. Foreground vs background: foreground (`run_in_background: false`) to
   verify immediately before reporting to the user; background if the task
   is well-understood and low-risk enough to fire-and-forget, per the
   parallel-ticket-fanout skill.
5. **Always independently verify the result** — don't relay the execution
   agent's self-report as fact. At minimum: `gh pr view <N> --json
   mergeable,labels`, `gh pr diff <N>` compared against the plan's own
   target-state section, and a check on whether any CI failures match what
   the plan's verification section told you to expect versus something new.

## Note

Both skills together are the pipeline; using `plan-to-pr` without a
preceding, genuinely self-contained plan just moves the risk of an
underspecified brief from "your own prompt, still recoverable in the next
message" to "an execution agent already writing code on its own judgment,
much harder to recover from." Don't skip straight to this skill for anything
nontrivial without going through `issue-to-plan` first, or writing an
equivalently thorough plan by hand.
