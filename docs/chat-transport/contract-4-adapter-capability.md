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
Claude adapter interface. Before advertising terminal handoff for Claude on any runtime,
the hard conformance path must pass there: native TUI → clean exit → SDK lists → SDK
reads → SDK resumes same id → turn completes → SDK exits → TUI resumes same id →
transcript tail and workspace state compare clean. (Windows first; WSL and remote
runtimes each qualify separately.)

## Codex

One `codex app-server` per runtime/account/security boundary; sessions are multiplexed
through it, never one process per chat. The stable subset is the contract surface:
`initialize`, `thread/start|resume|read`, `turn/start|interrupt|steer`, item
started/delta/completed, `turn/completed`, user-message `clientId` correlation, approval
requests + `serverRequest/resolved`, thread status, reconnect/resume. No experimental
methods unless no stable equivalent exists.

## Adopted-engine notes

Upstream ships the Codex adapter (app-server connection + multi-session structured
adapter) — qualification measures it against this surface. **No Claude adapter exists
upstream; ours is built to this contract from day one.**
