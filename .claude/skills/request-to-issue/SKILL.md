---
name: request-to-issue
description: Rewrite a terse, informal request or ask into this repo's actual GitHub issue style (short intro, concrete bullet list, explicit `Depends on #N` and `docs/spec.md` pointers) and create or edit it via gh issue create/edit. Use this whenever the user describes a piece of work in a sentence or two and wants it turned into a proper issue, says things like "file a ticket for X," "write this up as an issue," "can you flesh this issue out," or wants an existing issue's body tightened up to match the rest of the tracker.
---

# Request to Issue

This repo's issues don't follow a fixed heading template — no `## Background`/`## Goal`/`## Scope`/`## Acceptance Criteria`. Instead every issue (see #2–#13) reads as a short intro paragraph or sentence stating what to build or decide, an optional bullet list of concrete requirements, and — when relevant — a trailing `Depends on #N (...)` line and/or a pointer to the specific section of `docs/spec.md` that governs it. This skill turns a rough ask into that same shape and files/updates the real GitHub issue, rather than leaving a structured write-up stranded in chat.

## Why this shape, not a generic template

Matching precedent matters more than following a generic issue template — a differently-shaped issue sticks out and is harder to scan alongside the rest of the tracker. Each part does a specific job:

- **Intro** — one or two sentences naming what gets built or decided, in plain prose, not a heading. Example (#5): "Attach a Cloudflare Access policy directly to the Worker (native Workers integration) and add auth middleware." For a decision-shaped issue rather than a build-shaped one (see #6), the intro instead frames the open gap/tension that needs resolving.
- **Bullets** (optional, but include when there's more than one concrete requirement) — specifics of what the change must do or must not do. Example (#4): "Reads must stay public — don't gate `GET` routes behind auth." Vague bullets are the most common way a rewritten issue is worse than the terse original — be concrete enough that someone could start work without asking a clarifying question.
- **Spec pointer** — when the work is governed by `docs/spec.md`, name the section explicitly rather than paraphrasing it into the issue body. Example (#7): "See the 'Design language across all screens' section of `docs/spec.md`." Keeps the issue as a pointer, not a duplicate source of truth.
- **`Depends on #N`** — a trailing line naming blocking issues and, in parenthesis, *why* they block. Example (#8): "Depends on #4 (API routes) and #7 (Scorecard screen, to trigger from)." Omit entirely if there's no dependency — don't force the line.

## Steps

1. Get the raw ask from the user if it isn't already in the conversation.
2. Before drafting, check for real context to ground the issue in: `gh issue list --state open` for related/blocking work, `docs/spec.md` for the relevant section to point at, and `AGENTS.md`'s "Open design questions" section in case the ask touches an already-flagged unresolved decision (e.g. league-table grouping) — don't invent an answer to those, surface the open question instead.
3. Draft the issue: intro, bullets if there's more than one concrete requirement, spec pointer if `docs/spec.md` governs it, `Depends on #N` if something blocks it. Keep it as tight as the existing issues — most are a handful of lines, not a long writeup.
4. If this ticket has a scope boundary against a sibling ticket (e.g. #5 explicitly notes per-game membership is out of scope, deferred to the `game_members` backlog issue), spell that out as its own bullet rather than leaving it implicit.
5. Show the drafted body to the user if there's any ambiguity about scope or if this is a new issue (not just a rewrite) — cheap to confirm before filing, more friction to fix after.
6. File or update it. New issue:

   ```bash
   gh issue create --title "<title>" --body "$(cat <<'EOF'
   <intro>

   - <bullet>
   - <bullet>

   Depends on #<N> (<why>).
   EOF
   )"
   ```

   Existing issue: `gh issue edit <N> --body "$(cat <<'EOF' ... EOF)"` (same
   heredoc shape) — re-paste the full body, since `gh issue edit --body`
   replaces it wholesale rather than patching.

7. Label it in the same step, not as a later backfill. This repo uses GitHub's stock label set (`enhancement`, `bug`, `question`, `documentation`, etc. — run `gh label list` if unsure what exists) rather than a `type:*`/`app:*` scheme; pick whichever existing label(s) actually fit — `enhancement` for new build work, `question` for an open decision like #6 — via `gh issue create --label ...` or `gh issue edit <N> --add-label ...`. Don't invent a new label scheme without checking with the user first.

## Note on creating/editing issues

`CONTRIBUTING.md` says anything beyond a small fix should have its issue opened before work starts so the approach can be agreed first — draft the body and confirm with the user before actually calling `gh issue create`/`gh issue edit` unless they've clearly already asked for the issue to be filed, not just drafted.
