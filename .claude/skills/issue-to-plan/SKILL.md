---
name: issue-to-plan
description: Turn a GitHub issue into a single, self-contained implementation plan document by spawning a fresh research agent that investigates the repo and interrogates the user on any real ambiguity, without carrying forward this conversation's accumulated context. Use this when planning how to implement a ticket, especially before fanning out multiple tickets, or once conversation context has grown large enough that researching inline would only grow it further. Pairs with the `plan-to-pr` skill for the execution half.
---

# Issue to Plan

This repo's issue tracker holds well-scoped tickets, but *implementing* one still
means researching the repo (code, docs, in-flight overlap) before
writing anything. Doing that research inline, in a long-lived orchestrator
conversation, means it never leaves that conversation's context — it gets
resent on every subsequent turn, compounding cost across every ticket handled
in the session. This skill instead spawns a fresh, disposable agent to do the
research once, in its own isolated context, and hand back a single compact
plan document rather than leaving its intermediate reasoning behind in the
orchestrator's history.

## Why a separate agent instead of researching inline

Research (reading code, checking issues/PRs, `docs/spec.md`, and the "Open
design questions" section of `AGENTS.md`, working out real scope) is the
token-heavy part of implementing a ticket — more so than the eventual diff,
for most tickets in this repo. A fresh agent pays that cost once, in a
session that gets thrown away afterward, and returns only the artifact that
matters: a plan thorough enough that a *different*, completely context-free
agent could execute it correctly with no further questions.

In practice, some tickets in this repo need no interrogation at all — the
scope is fully spelled out in the issue body and `docs/spec.md` — while
others (e.g. #6, "Decide + implement the v1 game-creation flow without a
Home page") are explicitly framed as open decisions that need a real answer
before a plan can be finalized. A good planning agent recognizes which
situation it's in, rather than always asking or never asking.

## Steps

1. Launch a fresh `general-purpose` agent (not `Plan` — that type lacks
   Edit/Write, and this phase needs to save a file and needs AskUserQuestion
   access to interrogate the user). Run it in the **foreground**
   (`run_in_background: false`): the point is one coherent research-and-
   dialogue turn where any clarifying questions get asked and answered before
   you move on, not a fire-and-forget background job. No worktree isolation
   is needed — this phase is read-only — but do have it fetch `origin/main`
   fresh at the start rather than trusting whatever the current directory
   happens to have checked out.
2. Brief it with:
   - The issue number and this repo.
   - Explicit research steps: `gh issue view <N>` (and linked
     issues/PRs/comments), `docs/spec.md` (the source of truth for
     architecture, data model, API routes, and UI reference), `AGENTS.md`
     (including its "Open design questions" section) and `CONTRIBUTING.md`,
     and `gh pr list --state open` / `gh issue list --state open` to catch
     in-flight overlap — don't let it guess at any of this.
   - Explicit instruction to use AskUserQuestion for any genuine judgment
     call *before* finalizing the plan — and, equally, not to over-ask if
     the ticket turns out to be unambiguous. Both failure modes are real;
     let the agent judge which situation applies rather than hard-coding
     "always ask" or "never ask."
   - Explicit instruction: no implementation code in this phase — a
     planning document only.
   - What the plan document must contain so a context-free execution agent
     needs nothing else: restated Goal/Scope/Acceptance-Criteria, exact
     file paths and diffs/snippets, exact verification commands, and exact
     repo conventions (branch name, commit prefix, label list, PR body
     template) pulled from real precedent commits/PRs — not invented. Any
     scope boundary against in-flight sibling work found in research should
     be spelled out explicitly, not left implicit.
   - Where to save it: the session scratchpad directory (outside the repo —
     this is a working handoff artifact, not something to commit), e.g.
     `<scratchpad>/<issue-number>-plan.md`.
   - To include the plan's full text in its final report, not just a
     "done, see file" pointer — you need the content in hand to pass to the
     execution phase.
3. If the agent comes back with questions instead of a finished plan (this
   is expected and correct for an underspecified ticket — see #6), relay
   them to the user, then resume the same agent via `SendMessage` with the
   answers so it can finalize. This is not a failure state; don't re-launch
   from scratch.
4. Read the saved plan file yourself before moving on. A plan that's vague
   on scope, or hand-waves a verification step, is worse than useless in the
   next phase — the execution agent has no way to ask about it.
5. Hand off to the `plan-to-pr` skill next.

## Note

This phase deliberately spends more tokens asking questions than staying
silent would — that's the point. Interrogation is cheap now, while this
agent still has research context live; it is expensive — functionally
impossible — once a fresh execution agent is running with no memory of this
conversation at all.
