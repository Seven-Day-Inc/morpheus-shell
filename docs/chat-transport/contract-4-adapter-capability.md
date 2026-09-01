# Contract 4 — Adapter Capability v1

## Role

Adapters translate provider protocols and produce evidence. They never acknowledge the
renderer, never own canonical state, never invent events under a stale epoch. Every
adapter instance is created under exactly one `ownershipEpoch`.

## Declared capabilities

An adapter declares, and is only used for, what it proves: streaming deltas; resume of a
specific provider session id; mid-turn steering; approval/question interactions; history
read/pagination for reconciliation; handoff class (`none` | `idleResume` | `liveAttach`);
delivery semantics (idempotent-retry supported or not — see Contract 2 §Dispatch).
`liveAttach` may not be advertised for any provider without a documented, tested
shared-owner protocol; v1 requires only `idleResume`.

## Claude

Primary backend: the **Claude Agent SDK** (typed, maintained control surface —
interactive conversation, partial streaming, interrupts, session resume/enumeration/
reads, approval callbacks). Raw stream-JSON remains a fallback backend behind the SAME
Claude adapter interface (`ClaudeSessionDriver` → `ClaudeSdkBackend` primary,
`ClaudeRawStreamJsonBackend` compatibility); both backends emit the same canonical
events, and capability negotiation chooses the backend. Pin and record: Agent SDK package
version, actual Claude Code binary version, native-Windows vs WSL runtime, supported
session-resume behavior, supported partial-stream and approval behavior.

**Hard behavior (frozen):** when the tested backend is unavailable, a structured session
**fails closed into terminal/read-only mode**. It must NOT silently return to keystroke
injection — a structured-send failure never falls back to typing into a TUI.

Before advertising terminal handoff for Claude on any runtime, the hard conformance path
must pass there: native TUI → clean exit → SDK lists the session → SDK reads its messages
→ SDK resumes the same id → send and complete a turn → SDK exits → TUI resumes the same
id → transcript tail and workspace state compare clean. (Windows first; WSL and each
remote runtime qualify separately.) The supported v1 "attach" is discover → wait for the
terminal owner to exit → acquire → verify → resume the same provider session id; seizing
a still-running foreground TUI is unsupported — no concurrent SDK writer and TUI writer.

## Codex

One long-lived `codex app-server` per runtime profile — approximately (host/runtime
boundary, `CODEX_HOME` or auth principal, app-server binary version, trust/security
domain) — with all eligible workspaces and sessions multiplexed through it. Never one
process per chat; workspace alone never implies another provider process. Shard further
only on differing credentials/`CODEX_HOME`, host/OS boundary, required binary/protocol
version, trust policy, or demonstrated load/failure isolation.

The stable subset is the contract surface: `initialize`, `thread/start|resume|read`
(history pagination for reconciliation), `turn/start|interrupt|steer`, item
started/delta/completed, `turn/completed`, user-message `clientId` correlation, approval
requests + `serverRequest/resolved`, thread status, reconnect/resume. No experimental
methods unless no stable equivalent exists.

**Hard behavior (frozen) — approval routing.** The controller's Codex broker owns ALL
server-initiated requests. For every request: receive the JSON-RPC request → map the
connection-scoped request id to a canonical `interactionId` → journal
`interaction.requested` → expose it to the global approval inbox and subscribed views →
on user response, journal `interaction.responseCommitted` → send the JSON-RPC response →
wait for `serverRequest/resolved` → journal `interaction.resolved` → treat the final
`item/completed` as the authoritative tool outcome. When a chat view closes: the renderer
unsubscribes, the controller REMAINS subscribed to app-server, the pending interaction
stays globally visible, the provider session stays paused until answered or explicitly
canceled — nothing is auto-approved because a view disappeared. Every interaction is
keyed by `appServerInstanceId + providerRequestId + threadId + turnId + itemId +
ownershipEpoch`; a response from a stale renderer or an old app-server instance is
rejected.

**Versioning:** generate and commit the stable schema from the exact app-server binary
the adapter uses (stable-only generation by default); record a protocol fingerprint in
`session.bound`/`capabilitiesChanged` at startup. A new binary must not silently change
the adapter contract under active sessions.

## Adopted-engine notes

Upstream ships the Codex adapter (app-server connection + multi-session structured
adapter) — qualification measures it against this surface. **No Claude adapter exists
upstream; ours is built to this contract from day one.**
