# Contract 5 — Ownership & Fencing v1

## Rule zero

**Views do not own sessions. Drivers own sessions.** Many observers, exactly one mutator:
`controller` (structured chat) | `terminal` (terminal mode) | `none` (transfer/recovery).
Every mutation carries `expectedOwnershipEpoch`; late mutations and provider events from
an older epoch never update canonical state — they are journaled only as diagnostics.

## Durable ownership record

`{ sessionId, epoch, owner, holderId?, runtimeId?, providerSessionId?, state:
acquiring|owned|quiescing|releasing|recoveryRequired }` — durable, transactional.

## Quiescence (v1 handoff precondition — ALL of)

no active foreground turn; no pending blocking interaction; no background task that can
still mutate the session; no uncommitted outbound mutation; **no `deliveryUnknown`
mutation**; provider state fully ingested through a known checkpoint. "Idle" alone is
insufficient.

## Handoff state machine

`owned → quiescing → released → acquiring(target) → verifying → owned(target)`; any
failure → `recoveryRequired`. The swap: CAS the epoch into quiescing → disable all input
→ confirm quiescence → flush provider events → persist a checkpoint (logical id, provider
session id, runtime/workspace identity, provider binary/protocol version, last journal
seq, last provider item ids, transcript-tail digest) → stop the old driver → verify its
process and provider-writer ownership are released → increment epoch → start target →
resume the SAME provider session id → reconcile the tail → verify id + common tail →
journal `session.ownershipChanged` → enable input. If tail verification fails: never
silently merge histories — `recoveryRequired` and an explicit fork/import decision.

Chat→terminal→chat round-trips are idle stop-and-resume with incremental tail
reconciliation — never a live handoff of a running conversation. While terminal-owned,
the chat view may stay open read-only and must say so; it must not show stale
idle/running state as current.

## Split-brain rules (the question our packet missed; Einstein supplied)

- a renderer heartbeat does not grant ownership;
- a process PID alone does not prove ownership;
- a lease timeout alone must NOT transfer ownership across a network partition;
- remote disconnection ⇒ `recoveryRequired` / owner-unreachable — never auto-authorize a
  second writer;
- a new owner is granted only after the old owner is proven stopped/released, or via an
  explicit, auditable force-recovery that assumes the prior provider effect may still
  exist;
- a session with `deliveryUnknown` cannot be handed off until reconciled or explicitly
  abandoned;
- the provider's own single-writer lock (Codex) is one layer — the controller still
  fences stale UI commands, Claude sessions, imports, and remote partitions itself.

## Adopted-engine notes

Upstream's lease store advertises fail-closed adjudication and restart handoff
adjudication; only crash-recovery handoff shipped — the general idle-fenced handoff above
is OUR build, to this contract. Qualification runs the E0 ownership matrix (two windows
racing acquisition; old-epoch send after handoff; provider process alive after controller
disconnect; second app-server resuming a writer-owned thread).
