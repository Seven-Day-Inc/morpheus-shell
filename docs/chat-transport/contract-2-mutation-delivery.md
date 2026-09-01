# Contract 2 — Mutation Delivery v1

## The honest promise

Exactly-once delivery **to a provider** cannot be guaranteed without provider-supported
idempotency. What this contract guarantees instead:

- exactly one durable local intent and exactly one displayed user message per
  `clientMutationId`;
- at most one **automatic** provider dispatch when the provider does not support
  idempotent retry;
- provider-observed state is a separate fact, backed by durably journaled evidence;
- any unresolved crash window is surfaced as `deliveryUnknown` — never shown as success
  or failure, never silently retried.

## Mutation states (frozen verbatim — a union, not a ruled ordering)

```ts
type MutationStateV1 =
  | "committed"
  | "attempted"
  | "observed"
  | "notAccepted"
  | "deliveryUnknown"
  | "canceled";
```

"Committed" means only that Orca durably accepted responsibility for the intent — it is
never rendered as "sent" or "acknowledged". The verdict rules the states and their
meanings; it does not rule a transition state machine — defining one is a separate
decision if ever needed.

## Send command

`sessionId`, `expectedOwnershipEpoch`, `clientMutationId` (generated at the outermost
client boundary, reused verbatim on retries), `mode: newTurn | steer` (+
`expectedTurnId`), content blocks. Mid-turn steering is core, not an extension.

## Controller transaction (one durable transaction)

verify epoch → verify send-capable → check `(sessionId, clientMutationId)` uniqueness
(same payload hash ⇒ return the original receipt; different hash ⇒ mutation-id conflict)
→ append the completed local user item → append `mutation.stateChanged: committed` →
insert the durable outbox entry → commit → return/broadcast the receipt. **The user
bubble comes from this committed event. There is no renderer-invented optimistic bubble.**

## Dispatch

Append `attempted` durably BEFORE the external call (conservative: a crash right after
may mean the call never left — treating it as uncertain beats retrying a call that may
have been accepted). The adapter returns `observed` (+evidence) | `notAccepted`
(+retryable, reason) | `unknown`. The controller journals the outcome; an adapter never
acknowledges the renderer directly.

## The crash window

Intent recorded → provider called → provider accepted → crash before evidence recorded:
retry risks a duplicate, not retrying risks a lost send. No acknowledgment placement
removes this. Result: `deliveryUnknown`, then provider-specific reconciliation. Automatic
retry ONLY if the provider formally supports idempotent submission with the same key, or
the adapter can prove non-acceptance. (Codex's `clientUserMessageId` echo is correlation
evidence, NOT a documented idempotency key.) Manual "send again" creates a NEW mutation id
with `retryOf`, disclosing the unknown disposition of the original.

## Invariants (the testable contract)

For every `(sessionId, clientMutationId)`:

1. `localReceipt(m)` ⇒ exactly one durable mutation intent exists.
2. Exactly one canonical user item is linked to `m`.
3. Repeating `m` with the same payload returns the same receipt; with a different
   payload it is rejected.
4. `observed(m)` ⇒ correlated provider evidence was durably committed first.
5. After `attempted(m)`, recovery never auto-dispatches `m` again unless the adapter
   proves non-acceptance or advertises tested idempotency.
6. Any unresolved provider-acceptance window is `deliveryUnknown` — never hidden as
   success, failure, or an automatic retry.

## Adopted-engine notes

Upstream's operation ledger (`callerKey+operationId`, fingerprint-checked
replay/admit/refused, restart-surviving) and outbox (`queued/dispatching/unconfirmed`,
`unknown` outcome with replay-not-respawn semantics) appear to implement invariants 1–6.
Qualification runs the full E0 send-path matrix (double-dispatch, changed-payload,
crash-at-every-boundary) against it before this is marked satisfied.
