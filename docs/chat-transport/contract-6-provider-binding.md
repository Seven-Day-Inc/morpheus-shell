# Contract 6 — Provider Binding v1

## Identity model

The **logical Orca session id** is ours and permanent. The **provider session/thread id**
is evidence bound to it — never the primary key, never shown as identity. A binding
records: logical id ↔ provider session id, the runtime identity that owns the provider
process (machine/host/workspace), the provider binary + protocol fingerprint (version,
capability set), and the adapter that made the binding, under one ownership epoch.

## Binding lifecycle

`session.bound` is journaled when an adapter proves it holds the provider session (fresh
start, resume, or import-then-bind). Rebinding after handoff or recovery requires
**transcript-tail verification**: the adapter reads the provider's current tail and the
controller compares it against the journal's authoritative tail digest (from the handoff
checkpoint, Contract 5). Match ⇒ same-session continuity is proven and incremental
reconciliation proceeds. Mismatch ⇒ `recoveryRequired`; histories are never silently
merged; the resolution is an explicit fork or import decision.

## Fingerprint drift

A provider binary/protocol fingerprint change at rebind time (upgrade, WSL vs native,
remote runtime) is journaled as `session.capabilitiesChanged` and re-derives the declared
adapter capabilities (Contract 4). A capability lost by drift (e.g. steering) revokes the
corresponding mutation verbs rather than letting them fail deep in dispatch.

## Terminal-origin sessions

A session born in a terminal TUI is imported first (Contract 1 §import — stale, never
live), then bound on the first controller acquisition per Contract 5's initial
transition. After that, later terminal round-trips reconcile only the missing tail.

## Adopted-engine notes

Upstream binds provider identity per journal item (per-provider identity variants) and
keys sessions in its record store. Qualification verifies a tail-digest equivalent exists
at rebind; if their rebind trusts ids without tail verification, that is a gap our
handoff build closes at the facade.
