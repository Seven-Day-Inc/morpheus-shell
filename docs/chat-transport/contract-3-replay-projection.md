# Contract 3 — Replay & Projection v1

## One race-free watch

Never a loosely-coordinated `getSnapshot` then `subscribe`. One operation:

```
watchSession({ sessionId, afterSeq? }) → stream of
  { type: "snapshot", asOfSeq, projection }
  { type: "event", event }
  { type: "caughtUp", throughSeq }
```

The controller atomically establishes the replay boundary. The renderer may paint while
catching up but must not display **"Live"** until it has processed `caughtUp` — live is a
certificate, not an animation.

## Reducer invariant

```
reduce(all events through N) == reduce(snapshot through S + events S+1..N)
```

Deterministic, order-driven by `seq` alone. Replayed provider events must not duplicate
items (`item.completed` is authoritative replacement material). Closing and reopening a
view is always snapshot + tail replay; a disconnect after a delta but before completion
recovers to the identical projection.

## Import boundary

A session reconstructed from provider JSONL (`source.kind: import`) replays like any
other event source but reports `freshness: stale|unknown` — it never becomes falsely
live (see Contract 1 §Session status).

## Adopted-engine notes

Upstream reduces via `journal-reducer` over epoch-scoped rows. Qualification proves the
reducer invariant across an epoch rollover boundary (their `seq` resets per epoch — the
equivalence claim is that `(epoch, seq)` chains reduce identically to one flat domain;
if a cross-epoch ordering ambiguity is found for approvals/interruptions/ownership
changes, it is a contract violation, not an acceptable deviation).
