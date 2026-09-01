# Contract 1 — Chat Event v1

## Canonical entities

Six concepts, no more: **Session** (the logical Orca conversation), **Scope** (root agent
now; subagents later via `scopeId`/`parentScopeId` — never new message roles), **Turn**
(a provider execution interval), **Item** (message, exposed reasoning summary, tool call,
tool result, or notice), **Interaction** (anything blocking on human or external input),
**Mutation** (a client-requested side effect: send, approve, interrupt, hand off).

A message is NOT a turn: providers allow steering a user message into an active turn, so
user messages must never be structurally welded to `turn.started`.

## Envelope (frozen verbatim)

```ts
type CoreEventKindV1 =
  | "session.bound"
  | "session.capabilitiesChanged"
  | "session.statusChanged"
  | "session.ownershipChanged"
  | "mutation.stateChanged"
  | "turn.started"
  | "turn.completed"
  | "item.started"
  | "item.delta"
  | "item.completed"
  | "interaction.requested"
  | "interaction.responseCommitted"
  | "interaction.resolved"
  | "diagnostic.raised"
  | "session.closed";

interface ChatEventV1 {
  schemaVersion: 1;

  // Orca-owned logical identity, not a provider thread/session ID.
  sessionId: string;

  // ONE sequence domain for the ENTIRE logical session, including future
  // subagents. Gap-free among committed events; never reused. Wall clocks
  // never establish ordering.
  seq: number;
  eventId: string; // UUIDv7 is appropriate.

  recordedAt: string;
  occurredAt?: string; // Informational provider time only.

  // Fences late commands and late adapter events from former owners.
  ownershipEpoch: number;

  // Root scope in v1; child scopes represent subagents later.
  scopeId: string;
  parentScopeId?: string;

  kind: CoreEventKindV1 | `ext.${string}.v${number}`;

  refs?: {
    turnId?: string;
    itemId?: string;
    interactionId?: string;
    mutationId?: string;
    causedByEventId?: string;
  };

  source: {
    kind: "controller" | "provider" | "import";
    adapter?: string;
    runtimeId?: string;
    bindingId?: string;
    providerEventId?: string;
    cursor?: string;
  };

  payload: unknown;
}
```

`seq` is assigned by the controller inside the journal transaction. An event is never
broadcast before its transaction commits. Do NOT give each turn, item, or subagent an
independent sequence — cross-scope ordering matters for approvals, interruptions,
steering, and ownership changes.

## Items (frozen verbatim)

```ts
type ItemV1 =
  | {
      type: "message";
      role: "user" | "assistant";
      content: ContentBlockV1[];
    }
  | {
      type: "reasoning";
      visibility: "providerExposedSummary";
      content: ContentBlockV1[];
    }
  | {
      type: "toolCall";
      name: string;
      input?: unknown;
    }
  | {
      type: "toolResult";
      callItemId: string;
      status: "completed" | "failed" | "declined" | "interrupted";
      content: ContentBlockV1[];
    }
  | {
      type: "notice";
      level: "info" | "warning" | "error";
      code: string;
      content: ContentBlockV1[];
    };

type ContentBlockV1 =
  | {
      type: "text";
      blockId: string;
      text: string;
    }
  | {
      type: `ext.${string}.v${number}`;
      blockId: string;
      data: unknown;
    };
```

Role rulings: `user` and `assistant` are the only ordinary message roles in v1. A tool is
not a chat role. Provider initialization, runtime warnings, compaction notes, and
imported-system entries are `notice` items. Hidden system prompts and hidden
chain-of-thought are never journaled as messages. Subagent identity comes from `scopeId`,
never new roles.

Streaming: `item.started` creates the stable item identity; `item.delta` is an
append-only delta targeted at a content block; `item.completed` contains the **complete
authoritative final item**, not merely a status bit — the reducer treats it as
replacement material (enables delta compaction and crash recovery), never re-append.

## Interactions (frozen verbatim)

```ts
interface InteractionRequestV1 {
  kind: "approval" | "question" | "elicitation";
  subjectItemId?: string;
  blocking: boolean;

  title?: string;
  prompt: ContentBlockV1[];

  choices?: Array<{
    id: string;       // Stable canonical ID.
    label: string;
    semantics: string;
  }>;

  providerToken?: unknown; // Opaque to renderer.
}
```

Three separate journal moments: `interaction.requested`, `interaction.responseCommitted`,
`interaction.resolved` — a user may commit a response the provider then rejects because
the request was already cleared, and a provider may resolve or cancel without a user
response. The renderer never owns the provider callback or JSON-RPC request id.

## Session status (frozen verbatim)

```ts
interface SessionStatusV1 {
  connection:
    | "connecting"
    | "online"
    | "reconnecting"
    | "offline"
    | "closed";

  activity:
    | "idle"
    | "running"
    | "waitingForInput"
    | "interrupting"
    | "failed"
    | "unknown";

  freshness:
    | "catchingUp"
    | "live"
    | "stale"
    | "unknown";

  lastProviderEvidenceAt?: string;
  providerStatus?: string;
}
```

Only the controller emits `session.statusChanged`. The renderer must not derive "live",
"idle", or "running" from timestamps, hooks, animation state, or silence.
`freshness: "live"` requires: adapter connected; reconnect replay caught up through a
known journal head; no unresolved ingestion gap. The JSONL importer uses
`source.kind: "import"` and normally reports `"stale"` or `"unknown"` — it may
reconstruct history; it must not claim live authority.

## Core vs extensions (ruled allocation)

Versioned `ext.*` extensions cover: concrete subagent lifecycle/metadata (e.g.
`ext.orca.scope.started.v1` / `ext.orca.scope.completed.v1` — no envelope break needed;
`scopeId`/`parentScopeId` already exist); attachments, images, audio, files;
content-addressed resource references; plans and structured task lists; diffs and rich
file-change views; citations; token usage/cost/model-routing detail; background-task
progress; provider-specific tool fields; MCP-hosted rich surfaces. Attachments journal
immutable resource references, never bytes. **Mid-turn steering is NOT an extension** —
the send RPC understands it now (Contract 2).

## Raw provider data

Raw provider frames live in a separate rotating, redacted diagnostic sidecar. The
canonical journal carries only the normalized event, the provider IDs/cursors needed for
reconciliation, and at most a raw-frame reference or digest. Provider schema churn must
not become journal schema churn.

## Adopted-engine notes

Upstream's journal grammar (`agent-session-journal-types`: message / tool-call / diff
render-model items with per-provider identity variants) is an engine detail. The facade
normalizes it into THIS schema — including normalizing upstream's epoch-scoped `(epoch,
sequence)` rows into the single flat session-wide `seq` domain above (see Contract 3).
Anything unrepresentable in this schema is a deviation to record here, not a reason to
bend the schema.
