# Chat Transport Contracts v1

Six frozen contracts governing structured chat in this fork. Source: the Einstein
interface verdict (centrifuge `projects/factory/consults/2026-08-31-einstein-chat-transport-verdict.md`),
adopted unmodified by founder ruling
(centrifuge `decisions/2026-09-01-chat-transport-adopt-upstream-engine.md`).

**How these are used.** Upstream's structured transport (merged upstream 2026-08-28,
`fd9125ea8c`) is adopted as the engine. These contracts are therefore two things at once:

1. **The acceptance bar** for the adopted engine — the qualification gauntlet
   (Contract 2 §Invariants, Contract 3 §Reducer, Contract 5 §Rules) must pass against it
   on our machines before we trust it.
2. **The spec** for everything we build that upstream lacks: the Claude Agent SDK
   adapter, the general idle-fenced terminal↔chat handoff, and the premium UI.

**Frozen means:** parallel lanes may not reinterpret these meanings ("sent", "live",
"owned", "attached", "same session"). Changing a contract requires a new decision in the
centrifuge ledger, not a code comment.

| # | Contract | Governs |
|---|---|---|
| 1 | [Chat Event](contract-1-chat-event.md) | envelope, event kinds, entities, items, interactions |
| 2 | [Mutation Delivery](contract-2-mutation-delivery.md) | local receipt, dispatch, delivery-unknown, idempotency |
| 3 | [Replay & Projection](contract-3-replay-projection.md) | snapshot/tail handshake, caught-up barrier, reducer |
| 4 | [Adapter Capability](contract-4-adapter-capability.md) | what an adapter must declare and provide |
| 5 | [Ownership & Fencing](contract-5-ownership-fencing.md) | epochs, quiescence, handoff, split-brain recovery |
| 6 | [Provider Binding](contract-6-provider-binding.md) | logical↔provider identity, fingerprints, tail verification |

Known deviations of the adopted engine from the letter of these contracts are tracked in
each contract's **Adopted-engine notes** section (e.g. epoch-partitioned sequence chains
vs one flat domain). A deviation is either qualified as equivalent under the contract's
invariants, or it becomes work.
