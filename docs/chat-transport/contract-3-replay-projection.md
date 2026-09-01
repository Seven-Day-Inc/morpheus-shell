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

Upstream reduces via `journal-reducer` over epoch-scoped rows whose sequence resets each
epoch. That is an **engine detail, not an alternative contract**: the ruling is one
flat, session-wide, gap-free, never-reused `seq` domain (Contract 1), and reduction is
ordered by `seq` alone. The facade therefore normalizes upstream's `(epoch, sequence)`
rows into the canonical flat domain before events enter the journal projection path.
Qualification tests the NORMALIZATION — including across an epoch rollover with
interleaved approvals/interruptions/ownership changes — not an equivalence exception.
Changing this requires a new ledger decision, not an engine accommodation.
