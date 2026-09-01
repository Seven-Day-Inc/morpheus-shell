# Contract 1 — Chat Event v1

## Canonical entities

Six concepts, no more: **Session** (the logical Orca conversation), **Scope** (root agent
now; subagents later via `scopeId`/`parentScopeId` — never new message roles), **Turn**
(a provider execution interval), **Item** (message, exposed reasoning summary, tool call,
tool result, or notice), **Interaction** (anything blocking on human/external input),
**Mutation** (a client-requested side effect: send, approve, interrupt, hand off).

A message is NOT a turn: providers allow steering a user message into an active turn, so
user messages must never be structurally welded to `turn.started`.

## Envelope

Every event carries: `schemaVersion`; an Orca-owned `sessionId` (never a provider thread
id); a controller-assigned `seq` (gap-free among committed events; wall clocks never
establish ordering); `eventId` (UUIDv7); `recordedAt` (+ optional informational
`occurredAt`); `ownershipEpoch` (fences late commands/events from former owners);
`scopeId`/`parentScopeId`; `kind`; optional `refs` (`turnId`, `itemId`, `interactionId`,
`mutationId`, `causedByEventId`); `source` (`controller` | `provider` | `import`, with
adapter/runtime/binding/providerEventId/cursor); `payload`.

Core kinds: `session.bound|capabilitiesChanged|statusChanged|ownershipChanged|closed`,
`mutation.stateChanged`, `turn.started|completed`, `item.started|delta|completed`,
`interaction.requested|responseCommitted|resolved`, `diagnostic.raised`. Extensions are
`ext.<ns>.<name>.v<N>` — versioned, never redefining core kinds.

`seq` is assigned inside the journal transaction; an event is never broadcast before its
transaction commits.

## Items

The v1 item union stays small: `message` (roles `user`/`assistant` only), `reasoning`
(provider-exposed summary only), `toolCall`, `toolResult` (status
`completed|failed|declined|interrupted`), `notice` (info/warning/error + code). A tool is
not a chat role. Provider init, runtime warnings, compaction notes, and imported system
entries are notices. Hidden system prompts and hidden chain-of-thought are never
journaled as messages.

Streaming: `item.started` fixes the stable identity; `item.delta` is an append-only delta
targeting a content block; `item.completed` carries the **complete authoritative final
item** (enables delta compaction and crash recovery — the reducer treats it as
replacement, never re-append).

## Interactions

Provider-neutral: `kind: approval|question|elicitation`, `blocking`, prompt content,
optional stable `choices`, and an opaque `providerToken` the renderer never interprets.
Three separate journal moments: `requested`, `responseCommitted`, `resolved` — a user can
commit a response the provider then rejects, and a provider can resolve/cancel without a
user response. The renderer never owns the provider callback or RPC request id.

## Session status

One controller-emitted projection with orthogonal axes: `connection`
(connecting/online/reconnecting/offline/closed), `activity`
(idle/running/waitingForInput/interrupting/failed/unknown), `freshness`
(catchingUp/live/stale/unknown) + `lastProviderEvidenceAt`. The renderer must not derive
"live"/"idle"/"running" from timestamps, hooks, animation, or silence. `freshness: live`
requires: adapter connected, replay caught up through a known journal head, no unresolved
ingestion gap. JSONL imports use `source.kind: import` and report stale/unknown — history
reconstruction never claims live authority.

## Raw provider data

Raw provider frames live in a rotating, redacted diagnostic sidecar — the canonical
journal carries only the normalized event, reconciliation ids/cursors, and at most a
raw-frame reference/digest. Provider schema churn must not become journal schema churn.
Attachments journal immutable resource references, never bytes.

## Adopted-engine notes

Upstream's journal grammar (`agent-session-journal-types`: message / tool-call / diff
render-model items with per-provider identity variants) maps onto this item model but is
not identical. Qualification maps their kinds onto these six entities; anything
unrepresentable is a deviation to record here.
