# Slice 3 — THE RESKIN (charter centrifuge#1013; founder-ratified 2026-08-16)

Elevate Orca's face per the founder's spec: "all the best elements from
Traycer / Claude Code / Cursor / Codex desktop." Thin-fork law: our changes
live in added modules/styles wherever possible; minimal upstream-file edits.

## LAW — the 11 ratified properties (all four bundles)
Chrome: one thin titlebar band (~50px, menu+tabs+controls merged);
terminal/editor/tree coexist, no focus-stealing; empty sidebar = 4 elements.
Composer: idle shows full structure; progress = labeled collapsible steps,
never a bare spinner. Diffs inline-first, full pane one click; contextual
actions float anchored, never blocking modals. Settings rows carry one-line
descriptions; palette legible at 1000+ entries; in-app fuzzy folder browser;
appearance previews live. (Evidence shots: centrifuge PR #1011 corpus.)

## WARTS — all four, in kill order
1. WORK IS INVISIBLE (first, always): every running seat/agent = a decorated
   first-class card — name, color, live activity line, model badge. Tabs
   never hide work.
2. Silent send failures: sends confirm delivery or error loudly; long text
   never truncates silently.
3. Spawn glitchiness: PTY create/attach retries with visible state; a dead
   terminal SHOWS dead.
4. Board clutter: visual hierarchy active/idle/done; done lanes fold away.

## SOUL — Traycer adoption, founder order 1→4
(1) Plan-first task cards: work rendered as tasks with plan→execute→verify
arcs, not raw terminals. (2) Onboarding polish as the taste signature.
(3) Verification surfaces: work shown against what was asked.
(4) Inter-agent messaging as first-class conversation.

## PROCESS LAW — visual checkpoints
The founder ratifies from SCREENSHOTS. Every milestone delivers annotated
before/after captures; no prose-only approvals. Milestone 1 target: the
worktree board + cards + titlebar (the daily-stare surfaces), workable in a
dev build launched via BUILD.md's isolation recipe (Python now installed).

Milestone 1 deliverable: branch reskin/m1, buildable, screenshots committed
to .shots/reskin-m1/, PR with before/after. Two commits per push max. Do not
stop to ask questions.
