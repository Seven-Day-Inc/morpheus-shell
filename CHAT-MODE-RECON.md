# Chat Mode Recon

Static diagnosis of `Seven-Day-Inc/morpheus-shell` at `a253a74e626f92677b796bb7aa674a7f471d6706` (2026-08-31). No application run or product-code change was used to reach these conclusions.

## Executive verdict

The founder's hypothesis is close, but the distinction matters: current Chat Mode does **not** reconstruct the conversation from visible terminal output. It tails Claude/Codex provider JSONL session files and decodes their structured records. The terminal still matters for two other reasons: hooks running inside the terminal tell Orca which provider session/file belongs to the pane, and every outbound Chat message is injected as keystrokes into the agent TUI's PTY.

That split architecture is the underlying reliability problem:

1. identity comes from lossy hooks;
2. history comes from an eventually-written file selected by path heuristics;
3. live state comes from a separate hook preview and lifecycle clock;
4. sends go through a non-idempotent PTY, then a local optimistic bubble is heuristically matched back to the file.

There is no single ordered, acknowledged conversation stream. The four reported symptom classes are therefore not one bug; they are expected failure modes at the joins between those four sources.

Recommendation: use Path A only as a short-term stabilization release. For the founder's "premium like Traycer" target, choose Path B: a structured, runtime-owned chat transport, with the terminal/TUI path left intact for Terminal Mode. Path A can reduce incidents, but cannot honestly promise instant, never-stale, duplicate-proof chat while the JSONL file and PTY remain the source and sink.

## Confidence notation

- **Proven**: the failure follows directly from the cited code path.
- **Conditional**: the code permits the failure when the named provider/clock/transport condition occurs; runtime frequency needs telemetry.
- **Design residual**: cannot be eliminated without changing the source-of-truth/transport boundary.

## 1. Current pipeline, end to end

### 1.1 A terminal pane becomes a Chat pane

`TerminalPane` keeps the real terminal mounted and portals `NativeChatView` over the pane when `effectiveChatViewMode` is true. It passes the pane key, PTY ID, launch/detected agent, and a terminal-screen reader (`src/renderer/src/components/terminal-pane/TerminalPane.tsx:3079-3123`). The selected per-tab mode is persisted as `terminal | chat`, so Chat Mode returns immediately after app/session restore (`src/shared/workspace-session-schema.ts:147-152`). Routing deliberately keeps the chat surface alive while hook/title evidence disappears during a reconnect (`src/renderer/src/components/native-chat/native-chat-leaf-routing.ts:69-99`).

`NativeChatView` selects the pane's `agentStatusByPaneKey` row and gates the heavy surface on a resolved agent/session (`src/renderer/src/components/native-chat/NativeChatView.tsx:57-105`). Agent selection is live hook type, then launch-time agent, then title-derived agent. The conversation ID and exact file path come only from `agentStatusEntry.providerSession` (`src/renderer/src/components/native-chat/native-chat-pane-resolution.ts:40-59`).

### 1.2 How Claude and Codex attach to a pane

At terminal creation, Orca injects `ORCA_PANE_KEY`, `ORCA_TAB_ID`, `ORCA_WORKTREE_ID`, hook endpoint coordinates, and launch metadata into the PTY environment (`src/main/runtime/orca-runtime.ts:29288-29315`).

The managed provider hooks post the provider payload plus those pane fields to Orca:

- Claude posts to `/hook/claude` and deliberately swallows timeout/failure so a broken hook never blocks the agent (`src/main/claude/hook-service.ts:98-118`).
- Codex posts to `/hook/codex` with the same pane/tab/launch/worktree envelope (`src/main/codex/hook-service.ts:807-830`; Windows construction is in `src/main/agent-hooks/installer-utils.ts:159-197`).

The local hook HTTP server resolves the provider endpoint, normalizes the event, applies pane authority, and records status (`src/main/agent-hooks/server.ts:2135-2178`). The common normalizer extracts Claude/Codex `session_id` and optional `transcript_path`; the comments explicitly note that recent Claude file UUIDs can differ from the hook session ID (`src/shared/agent-session-resume.ts:24-33`, `src/shared/agent-session-resume.ts:113-140`, `src/shared/agent-session-resume.ts:182-202`). Codex child hooks are prevented from replacing the root session with the child's ID (`src/shared/agent-hook-listener.ts:4281-4290`). Provider-specific status normalization then emits `providerSession` with the pane envelope (`src/shared/agent-hook-listener.ts:4335-4343`, `src/shared/agent-hook-listener.ts:4461-4512`).

Main forwards that normalized status over `agentStatus:set` (`src/main/index.ts:1519-1583`). The renderer validates routing/freshness and records the optional provider session (`src/renderer/src/hooks/useIpcEvents.ts:3163-3193`, `src/renderer/src/hooks/useIpcEvents.ts:3283-3388`). The store intentionally retains the provider ID through waiting/blocked/done and done-to-done reconnect repaints; only a new done-to-working turn without metadata drops it (`src/renderer/src/store/slices/agent-status.ts:2043-2055`, `src/renderer/src/store/slices/agent-status.ts:2125-2151`).

Remote runtime ownership does not change this identity model. Remote Codex child/relay rows also preserve the prior root ID when metadata is absent (`src/main/agent-hooks/server.ts:1183-1205`), and metadata-free OSC status repaints preserve it too (`src/main/agent-hooks/server.ts:1841-1866`).

### 1.3 What the capabilities mean—and do not mean

The runtime advertises:

- `aiVault.v1` and `aiVault.session-titles.v1` for scanning/listing historical sessions and resolving titles;
- `agent-session.session-boundary.v1` for distinguishing an idle session connect from a completed turn;
- `agent-session.host-authority.v1` for choosing the host that owns agent state;
- `agent-session.omp-resume-path.v1` for OMP's resume locator.

The declarations and advertised list are in `src/shared/protocol-version.ts:47-52`, `src/shared/protocol-version.ts:83-90`, and `src/shared/protocol-version.ts:100-138`. AI Vault exposes `resolveSessionTitles`, `listSessions`, and `prepareSessionResume` (`src/main/runtime/rpc/methods/ai-vault.ts:75-111`). These are discovery/resume metadata capabilities, not a live conversation-event transport. Native Chat has separate `nativeChat.readSession` and `nativeChat.subscribe` RPC methods (`src/main/runtime/rpc/methods/native-chat.ts:203-316`).

There is no `kimi-resume` capability literal in this source tree. Kimi is parsed by AI Vault and resumed as `kimi --session <id>` (`src/main/ai-vault/session-scanner-kimi-parser.ts:55-73`, `src/shared/ai-vault-resume-command.ts:147-170`), but Kimi is not a Native Chat transcript agent: that set is Claude/OpenClaude, Codex, Grok, and OMP (`src/shared/native-chat-agent-support.ts:1-13`).

### 1.4 The actual conversation source

For a resolved Claude/Codex session, the preferred source is the hook's exact `.jsonl` path. If it is missing or unreadable, Orca scans provider roots by session ID (`src/main/native-chat/session-file-resolver.ts:77-124`). Claude scans `~/.claude/projects/**/<sessionId>.jsonl`; Codex scans managed/system/WSL session roots for a basename equal to or ending in the session ID (`src/main/native-chat/session-file-resolver.ts:126-165`, `src/main/native-chat/session-file-resolver.ts:168-247`).

The reader parses JSONL records, not screen text. The tail decoder dispatches by agent (`src/main/native-chat/transcript-tail-reader.ts:28-48`):

- Claude maps structured user/assistant records and rich content blocks (`src/main/native-chat/transcript-line-decoders-claude.ts:17-65`, `src/main/native-chat/transcript-record-blocks.ts:42-117`).
- Codex maps early unwrapped messages, `response_item`, legacy `event_msg`, paginated `item_completed`, reasoning, tools, and interrupt markers (`src/main/native-chat/transcript-line-decoders-codex.ts:17-163`, `src/main/native-chat/transcript-line-decoders-codex.ts:166-203`).

Initial reads are bounded backward tail reads in 64 KiB chunks; incomplete last lines wait for a newline, malformed records are omitted, and any single JSONL record over 2 MiB is omitted (`src/main/native-chat/transcript-tail-reader.ts:28-29`, `src/main/native-chat/transcript-tail-reader.ts:50-145`, `src/main/native-chat/transcript-tail-reader.ts:150-200`). Live appends are read from the last byte offset and decoded line-by-line (`src/main/native-chat/transcript-incremental-reader.ts:27-116`).

There is a terminal-scrollback scraper, but it is not wired into production conversation assembly. `scrapeNativeChatSession` and `scrapeScrollbackToMessages` have no non-test caller; production imports only its ANSI-stripping helper for launch drafts and session-option inspection (`src/renderer/src/components/native-chat/native-chat-scrape-fallback.ts:1-7`, `src/renderer/src/components/native-chat/native-chat-scrape-fallback.ts:74-124`). The terminal-screen reader passed to `NativeChatComposer` is likewise used for draft/option confirmation, not history (`src/renderer/src/components/native-chat/NativeChatComposer.tsx:229-262`).

### 1.5 Read, subscribe, reconstruct, render

`NativeChatResolvedView` chooses a runtime owner, starts `useNativeChatRetainedSession`, and separately selects a hook `lastAssistantMessage` as the faux streaming preview (`src/renderer/src/components/native-chat/NativeChatView.tsx:108-159`).

`useNativeChatLiveSession` performs two parallel operations:

1. an initial windowed `readSession` seed;
2. a live `subscribe` stream whose snapshot/replacement is authoritative and whose appended frames are ID-merged.

The full generation key is pane + runtime owner + agent + session ID + transcript path (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:86-126`). A source change clears the current base/appends; a null session ID settles as ready with zero messages and performs no IO (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:129-170`). File-not-found reads retry for 60 seconds, while the subscription can continue searching longer (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:64-65`, `src/renderer/src/components/native-chat/use-native-chat-live-session.ts:172-241`). Pagination performs a larger re-read and fences stale host/session/epoch results (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:251-304`).

Local desktop/web uses `window.api.nativeChat`; only a `runtime:`-owned desktop pane uses runtime RPC (`src/renderer/src/components/native-chat/native-chat-session-transport.ts:41-67`, `src/renderer/src/components/native-chat/native-chat-session-transport.ts:250-259`). The runtime stream reconnects after a drop and converts an unrecognized first successful payload into an empty snapshot rather than leaving loading forever (`src/renderer/src/components/native-chat/native-chat-session-transport.ts:68-98`, `src/renderer/src/components/native-chat/native-chat-session-transport.ts:101-225`).

On the host, file resolution can poll indefinitely because a new provider file may take seconds or minutes to appear (`src/main/native-chat/transcript-watch.ts:44-64`, `src/main/native-chat/transcript-watch.ts:66-190`). Once attached, `fs.watch` is only an accelerator: a 40 ms debounce/250 ms maximum wait and a one-second stat reconciliation own liveness (`src/main/native-chat/transcript-watch-scheduler.ts:1-3`, `src/main/native-chat/transcript-watch-scheduler.ts:53-99`). Rewrites, inode replacement, shrink, and boundary changes cause a full replacement snapshot (`src/main/native-chat/transcript-watch-engine.ts:139-246`); read/watch errors retry with capped backoff (`src/main/native-chat/transcript-watch-engine.ts:249-305`).

In the renderer, the transcript base and appends are merged by ID (`src/shared/native-chat-merge.ts:11-28`, `src/shared/native-chat-merge.ts:69-119`). The assembler then sorts and deduplicates by ID and, only across different sources, by an explicit turn ID or role+normalized-text fallback (`src/renderer/src/components/native-chat/native-chat-session-assembler.ts:126-165`, `src/renderer/src/components/native-chat/native-chat-session-assembler.ts:167-202`). Same-source records with different IDs are intentionally preserved.

Finally, `NativeChatView` appends local launch prompts, `/clear` boundaries, hook streaming preview, and optimistic sends around/after the assembled transcript (`src/renderer/src/components/native-chat/NativeChatView.tsx:262-316`) and renders loading/error/empty/list plus composer (`src/renderer/src/components/native-chat/NativeChatView.tsx:398-448`). Those synthetic rows do not pass through the normal transcript ordering/dedup pass.

### 1.6 Outbound send and optimistic echo

The composer classifies the draft, resolves the current PTY, writes it through a provider-specific path, then immediately calls `onOptimisticSend` for chat messages and clears the local draft (`src/renderer/src/components/native-chat/NativeChatComposer.tsx:239-314`). Ordinary Chat sends are:

1. clear the TUI input;
2. write bracketed-paste body bytes;
3. after the submit delay, write carriage return as a separate operation.

That sequence is in `src/renderer/src/components/native-chat/native-chat-runtime-send.ts:124-161`; image sends add attachment/body delays (`src/renderer/src/components/native-chat/native-chat-runtime-send.ts:275-323`). A per-PTY queue serializes every sequence but does not coalesce or identify duplicates (`src/renderer/src/components/native-chat/native-chat-pty-send-queue.ts:72-189`).

Local and direct-SSH writes are fire-and-forget. Runtime-owned writes call `terminal.send` but the normal Chat path does not await its accepted result, and errors are swallowed (`src/renderer/src/runtime/runtime-terminal-inspection.ts:125-180`). The local IPC writer returns false on a missing provider/mobile lock; only `writeAccepted` can truthfully acknowledge a local PTY, not SSH (`src/main/ipc/pty.ts:7190-7234`). Normal Chat sending uses the unverified API.

Optimistic entries are scoped only to `{paneKey, agent}`, intentionally excluding session ID, and carry renderer `Date.now()` plus the last visible message's ID/timestamp as a boundary (`src/renderer/src/components/native-chat/NativeChatView.tsx:186-244`). They are hidden when an equivalent transcript user turn appears and pruned only after a later non-user record proves that turn advanced (`src/renderer/src/components/native-chat/native-chat-pending.ts:91-190`, `src/renderer/src/components/native-chat/native-chat-pending.ts:192-242`; occurrence logic in `src/renderer/src/components/native-chat/native-chat-pending-occurrence.ts:61-100`, `src/renderer/src/components/native-chat/native-chat-pending-occurrence.ts:198-233`). There is no provider/client mutation ID connecting an optimistic row to the delivered turn.

### 1.7 What triggers a re-read

- showing/revealing the chat, or rebinding pane/agent/session/path/runtime owner, re-runs the session effect (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:129-170`, `src/renderer/src/components/native-chat/use-native-chat-live-session.ts:243-249`);
- `loadEarlier` explicitly re-reads a larger tail (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:251-304`);
- JSONL writes trigger a debounced drain; one-second reconciliation catches missed watch events (`src/main/native-chat/transcript-watch-scheduler.ts:53-87`);
- file replacement/truncation triggers an authoritative replacement snapshot (`src/main/native-chat/transcript-watch-engine.ts:139-193`);
- a dropped runtime stream reconnects after two seconds and seeds a fresh window (`src/renderer/src/components/native-chat/native-chat-session-transport.ts:77-98`);
- no-path subscription resolution polls from 500 ms up to five seconds indefinitely (`src/main/native-chat/transcript-watch.ts:44-51`, `src/main/native-chat/transcript-watch.ts:86-190`).

## 2. Root causes by symptom class

### A. “It glitches a lot”

1. **Proven — four independently-timed render sources.** Transcript snapshots/appends, hook status/preview, retained prior content, and optimistic user rows have different IDs and clocks. The transcript is assembled/sorted first, then preview and pending rows are concatenated afterward (`src/renderer/src/components/native-chat/NativeChatView.tsx:287-316`). A file replacement resets the authoritative list while hook/pending state survives. Temporary reorder, duplicate-looking rows, bubble replacement, loading/list transitions, and spinner disagreement are direct consequences.

2. **Proven — reveal/rebind intentionally shows stale retained content.** One settled transcript is cached for the exact identity, and a same-source loading/error rebind keeps it visible; a failed read with cached rows is converted from error to ready (`src/renderer/src/components/native-chat/use-native-chat-retained-session.ts:12-53`, `src/shared/native-chat-transcript-retention.ts:18-32`). This avoids a blank flash but replaces it with “old content that silently catches up.”

3. **Proven — the “stream” is a hook preview, not provider deltas.** `lastAssistantMessage` is appended as one synthetic bubble while hook state is working (`src/renderer/src/components/native-chat/NativeChatView.tsx:145-159`, `src/shared/native-chat-streaming.ts:25-62`). It is suppressed by comparing only to the list's final row. A pending user/tool/system row after the real assistant message makes that comparison empty, so the same assistant text can transiently appear as transcript plus preview.

4. **Proven — filesystem timing is user-visible.** Normal liveness includes up to 250 ms watch batching and a one-second reconciliation; new files can take minutes to exist; records are invisible until newline flush; rotation produces a replacement generation (`src/main/native-chat/transcript-watch.ts:44-64`, `src/main/native-chat/transcript-watch-scheduler.ts:1-3`, `src/main/native-chat/transcript-watch-engine.ts:139-246`).

5. **Conditional — provider schema drift causes holes/jumps.** Per-line decoding silently skips malformed, unknown, incomplete, and >2 MiB records (`src/main/native-chat/transcript-tail-reader.ts:150-200`). A later supported record can therefore make the UI “jump” forward without explaining what was omitted.

### B. “Sometimes the conversation will not load at all”

1. **Proven — no provider session means no read or discovery.** The pane can resolve as Claude/Codex from launch/title evidence while `sessionId` is null. In that state the live hook returns ready+empty and starts neither read nor watcher (`src/renderer/src/components/native-chat/native-chat-pane-resolution.ts:40-59`, `src/renderer/src/components/native-chat/use-native-chat-live-session.ts:147-153`). There is no AI Vault lookup or terminal scrape fallback that backfills the active session.

2. **Proven — hook delivery is lossy by design.** Claude/Codex hook POSTs have 0.5 s connect/1.5 s total deadlines and fail open (`src/main/claude/hook-service.ts:103-118`, `src/main/codex/hook-service.ts:810-830`). One missed SessionStart/UserPrompt hook can leave the pane without the exact identity/path. This is especially damaging for current Claude because the code itself says session ID may not match the transcript filename (`src/shared/agent-session-resume.ts:24-33`).

3. **Proven — direct SSH is not routed to a transcript-owning host.** The status row has SSH connection provenance, but pane resolution drops it (`src/renderer/src/components/native-chat/native-chat-pane-resolution.ts:46-59`). Transport selection routes only `runtime:` panes remotely; `ssh:` panes use local Electron IPC (`src/renderer/src/components/native-chat/native-chat-session-transport.ts:250-259`, `src/renderer/src/components/native-chat/native-chat-runtime-owner.ts:11-29`). The local read API accepts only agent/session/path, not SSH connection (`src/main/ipc/native-chat.ts:20-45`). Thus a hook-reported `/home/...jsonl` on a Model-A SSH host is handed to the desktop filesystem resolver. WSL has explicit path translation, but direct SSH has no equivalent in this pipeline. Claude/Codex availability does not block that case because only Grok/OMP are marked “requires local transcript” (`src/shared/native-chat-agent-support.ts:16-23`, `src/renderer/src/components/native-chat/native-chat-availability.ts:42-59`).

4. **Conditional — missing exact path falls back to a search that cannot always succeed.** Recent Claude filename/session-ID divergence makes the fallback glob ineffective; old/mixed runtime status may carry an ID without the newer optional path. Codex must search several roots, possibly WSL, and a stalled guest path can surface an error while retrying (`src/main/native-chat/session-file-resolver.ts:98-123`, `src/main/native-chat/transcript-watch.ts:110-170`).

5. **Design residual — file creation can outlast the visible retry.** Initial reads treat not-found as loading for 60 seconds, although comments acknowledge provider files may take minutes. The watcher continues polling, but the user can see a long loading/error/empty period before a later snapshot repairs it (`src/renderer/src/components/native-chat/use-native-chat-live-session.ts:64-65`, `src/renderer/src/components/native-chat/use-native-chat-live-session.ts:172-204`, `src/main/native-chat/transcript-watch.ts:44-64`).

### C. “Sometimes it loads an outdated conversation”

1. **Proven — stale session identity is intentionally replayed and latched.** Hook status, including provider session, is persisted for up to seven days, hydrated on startup, and replayed to the renderer (`src/main/agent-hooks/server.ts:174`, `src/main/agent-hooks/server.ts:640-650`, `src/main/agent-hooks/server.ts:2088-2116`, `src/main/agent-hooks/server.ts:2591-2673`). Completed rows are not marked “restored unconfirmed.” Chat Mode itself is persisted, so a restored pane can immediately bind that old ID before a fresh hook arrives.

2. **Proven — reconnect defenses prefer old identity over blanking.** If the same pane/agent temporarily loses `sessionId`, `NativeChatSessionGate` reinstates the previous ID/path (`src/renderer/src/components/native-chat/NativeChatSessionGate.tsx:19-48`). The store and main process also preserve provider session across metadata-free done/OSC/child rows. These are reasonable continuity defenses, but a missed real boundary turns continuity into stale attachment.

3. **Proven — an existing hook path is trusted without checking its contents.** Any host-readable `.jsonl` path wins immediately; no session metadata inside the file is compared with `sessionId` (`src/main/native-chat/session-file-resolver.ts:98-119`). An old still-existing `transcriptPath` therefore binds successfully.

4. **Proven — ID fallback chooses the first filesystem match, not the newest/provenance match.** Claude returns `files[0]`; Codex stops at the first root/match (`src/main/native-chat/session-file-resolver.ts:168-203`, `src/main/native-chat/session-file-resolver.ts:206-247`). The shared walker preserves underlying directory iteration order and does not stat/sort these results (`src/main/ai-vault/session-scanner-discovery.ts:68-119`). Duplicate/mirrored IDs can select an older file.

5. **Proven — error masking can make stale look healthy.** For the exact same identity, a failed re-read with retained rows is exposed as `ready` with the old messages and no error (`src/renderer/src/components/native-chat/use-native-chat-retained-session.ts:38-53`).

6. **Conditional — `/clear` outside Chat Mode has no local boundary marker.** Only commands dispatched through the Chat composer add the marker that immediately filters pre-clear messages (`src/renderer/src/components/native-chat/native-chat-pending.ts:359-399`). A `/clear` typed in Terminal Mode depends entirely on the new provider hook/file identity arriving; if it is missed, old history remains.

### D. “Sending messages sometimes produces duplicates”

There are two distinct meanings: duplicate provider submissions and duplicate rendered bubbles. Current code can produce both.

1. **Proven — repeated UI events submit twice.** Enter handling calls `send()` for every non-Shift keydown and does not reject `event.repeat` (`src/renderer/src/components/native-chat/use-native-chat-composer-keydown.ts:43-51`, `src/renderer/src/components/native-chat/use-native-chat-composer-keydown.ts:83-92`). `send()` has no synchronous one-shot/in-flight guard (`src/renderer/src/components/native-chat/NativeChatComposer.tsx:239-300`). Two Enter keydowns before React commits the cleared draft enqueue the same captured text twice. The PTY queue serializes both; it does not deduplicate them (`src/renderer/src/components/native-chat/native-chat-pty-send-queue.ts:72-189`). Each gets its own body and Enter, so this is a true duplicate provider turn.

2. **Proven — transport has no idempotency key or delivery acknowledgment.** Normal sends are body and delayed Enter as separate fire-and-forget writes (`src/renderer/src/components/native-chat/native-chat-runtime-send.ts:124-161`, `src/renderer/src/runtime/runtime-terminal-inspection.ts:125-180`). Orca cannot correlate a provider user turn to the initiating UI event, reject a duplicate mutation, or know whether a direct-SSH write arrived.

3. **Proven — an optimistic echo can remain beside its real turn.** When its exact boundary ID is null or paged out, matching falls back to comparing provider transcript timestamps with renderer `sentAt` (`src/renderer/src/components/native-chat/native-chat-pending.ts:91-126`). Host/renderer clock skew can classify the actual user row as “before send,” so the transcript row renders and the pending row remains. Unlike lifecycle status, this matcher has no clock-skew allowance. Pending scope also excludes session ID, so an unmatched echo survives a provider-session change on the same pane/agent (`src/renderer/src/components/native-chat/NativeChatView.tsx:189-209`).

4. **Proven — synthetic preview can duplicate the completed assistant row.** Streaming suppression examines only `messages.at(-1)` (`src/shared/native-chat-streaming.ts:34-51`). If a pending user/tool/system row is last while hook status is still working, an already-flushed assistant message does not suppress the equal hook preview.

5. **Conditional — structured schema copies can survive as same-source duplicates.** The Codex decoder independently accepts legacy `user_message`/`agent_message` and paginated `item_completed` messages (`src/main/native-chat/transcript-line-decoders-codex.ts:111-163`) but has no session-level `history_mode` state. If a rollout contains equivalent accepted families with different IDs, the live merger is ID-only and the assembler deliberately refuses text dedup within one source (`src/shared/native-chat-merge.ts:100-119`, `src/renderer/src/components/native-chat/native-chat-session-assembler.ts:167-202`). AI Vault already has the missing stateful selection logic described below.

The code does **not** contain an automatic retry that would by itself submit a PTY message twice. The proven true-send duplicate is repeated UI admission; the other common cases are duplicate presentation/reconciliation.

## 3. Structured alternatives already present or close

### 3.1 Existing reusable structured parsing

Native Chat already parses structured provider records; its problem is not “screen scraping.” Its problem is that the parser is stateless and downstream of file discovery/flush.

AI Vault contains a second, more stateful structured session stack:

- agent dispatch routes Claude and Codex session files to provider parsers (`src/main/ai-vault/session-scanner-agent-parser.ts:19-37`);
- Claude consumes typed JSONL records incrementally, including session ID, title variants, user/assistant content, model, usage, and resume state (`src/main/ai-vault/session-scanner-primary-parsers.ts:36-160`, `src/main/ai-vault/session-scanner-primary-parsers.ts:191-216`);
- Codex reads `session_meta.history_mode` and selects the correct message family: non-paginated response messages versus paginated `item_completed`, with legacy events as compatibility input (`src/main/ai-vault/session-scanner-codex-parser.ts:80-150`, `src/main/ai-vault/session-scanner-codex-parser.ts:153-195`); message consumers live in `src/main/ai-vault/session-scanner-codex-message-records.ts:6-69`.

This logic can harden Path A, but AI Vault sessions are summaries/previews and resume metadata, not a live ordered event channel. Reusing its state machine does not remove file latency, identity selection, or PTY send ambiguity.

### 3.2 Existing process/protocol footholds

Claude:

- Orca already invokes `claude -p --input-format stream-json --output-format stream-json --verbose` for a control request and parses JSONL output (`src/shared/claude-model-list-probe.ts:3-22`, `src/shared/claude-model-list-probe.ts:83-103`).
- Orca also has ordinary headless Claude invocation plans (`src/shared/commit-message-agent-spec.ts:328-376`).
- Anthropic's official [Claude CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage) documents stream-JSON print input/output and `--resume`; its [Agent SDK guidance](https://platform.claude.com/docs/en/managed-agents/migration) documents a stateful `ClaudeSDKClient` that sends queries and receives structured responses.

Codex:

- Orca has a hardened cross-platform `codex app-server` JSONL/JSON-RPC spawn, handshake, timeout, and process-tree reaper (`src/main/codex/codex-app-server-session.ts:1-20`, `src/main/codex/codex-app-server-session.ts:98-118`, `src/main/codex/codex-app-server-session.ts:212-286`).
- It already calls sanctioned `thread/read` in the session-index healer (`src/main/codex/codex-session-index-heal.ts:24-35`, `src/main/codex/codex-session-index-heal.ts:208-241`).
- The current app-server helper is intentionally short-lived and handles only responses whose numeric IDs are pending; provider notifications are parsed but ignored (`src/main/codex/codex-app-server-session.ts:159-188`). A chat adapter therefore needs a separate long-lived, bidirectional, notification/server-request-capable module rather than reusing the helper unchanged.
- OpenAI's official [Codex app-server protocol](https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md) exposes `thread/start`/`thread/resume`, `turn/start`, provider item/delta notifications, completion, interrupt, approvals, and `clientUserMessageId` echoed on the user item. That is almost exactly the authority/ack model current Chat Mode lacks.

### 3.3 What a structured Chat session replaces

A provider-neutral runtime session controller would own one ordered event sequence per pane/session:

`clientMutationId -> accepted user event -> provider turn/item deltas -> tool/approval events -> terminal turn status`

For Claude, the adapter can begin with stream-JSON print/resume per turn or use the Agent SDK for a long-lived client. For Codex, use app-server thread/turn APIs. The runtime should persist a compact event journal/checkpoint and expose a capability-negotiated `native-chat.structured-session.v1` read/subscribe/send/interrupt surface. Reconnect replays from sequence number; mixed-version clients fall back to current transcript mode.

It replaces:

- hook-derived session identity as the primary Chat attachment;
- `session-file-resolver.ts`, transcript tail/read/watch, and file-not-found polling for structured-owned sessions;
- PTY body+Enter injection for Chat sends;
- content/timestamp optimistic reconciliation;
- hook `lastAssistantMessage` faux streaming;
- retained-error masking as the normal reconnect strategy.

It does **not** need to replace:

- `TerminalPane` and Terminal Mode's PTY/TUI;
- the `NativeChatView` shell, `NativeChatMessageList`, markdown/diff/tool rendering, copy/file-link/autoscroll/font behavior;
- composer visuals, draft/history/autocomplete, image attachment UI, or question/approval cards;
- `NativeChatMessage`/block shapes, though they should gain authoritative sequence, provider item ID, turn ID, mutation ID, and delivery state (`src/shared/native-chat-types.ts:27-80`);
- runtime owner selection and the existing RPC streaming framework, after a new capability gate;
- AI Vault for browsing/importing older externally-created TUI sessions.

The terminal remains unchanged for terminal sessions. The structured controller owns only sessions launched/continued in Chat Mode. Switching a live session to Terminal Mode must be an explicit ownership handoff (`stop structured driver -> launch TUI --resume <id>`), not two clients driving one provider session simultaneously.

## 4. Price and residual risk

These are engineering hours for production behavior across Windows/macOS/Linux, local/WSL/direct SSH/runtime hosts, folder workspaces, app restart, and mixed client/server versions. They exclude visual reskin work and provider-side defects.

### Path A — harden reconstruction in place

**Scope**

- make hook/session freshness explicit; do not auto-bind a seven-day-old completed row without live pane evidence;
- validate exact transcript provenance and deterministically select the newest matching file;
- route Model-A SSH transcript reads to the SSH host or explicitly disable Chat there;
- share a stateful Claude/Codex record-family decoder with AI Vault and generate stable provider turn IDs;
- reject repeated Enter/click admission, add a per-draft send fence, and surface delivery uncertainty;
- session-scope optimistic sends and reconcile by provider turn evidence where available, with cross-host clock tolerance otherwise;
- make retained stale/error/loading states visible instead of silently calling old content ready;
- add local/WSL/SSH/runtime/restart/clear/rotation/schema fixtures.

**Likely existing production files touched (15–22)**

`agent-hooks/server.ts`, `agent-session-resume.ts`, `agent-status.ts`, `NativeChatSessionGate.tsx`, `native-chat-pane-resolution.ts`, `use-native-chat-live-session.ts`, `use-native-chat-retained-session.ts`, `native-chat-session-transport.ts`, `session-file-resolver.ts`, the Claude/Codex decoders, tail/watch code, `native-chat-session-assembler.ts`, `NativeChatView.tsx`, pending reconciliation, composer keydown/send/queue, plus narrow RPC/routing changes. Expect 18–28 focused test files.

**Estimate**

| Work | Hours |
|---|---:|
| Identity freshness, provenance, deterministic resolver, SSH routing | 16–24 |
| Stateful provider decoding and stable turn identity | 12–18 |
| Send admission and optimistic reconciliation | 12–18 |
| Loading/retention/watch state hardening and diagnostics | 8–12 |
| Cross-platform/host/restart/mixed-version regression coverage | 16–24 |
| **Total** | **64–96 hours** |

Expected production delta: roughly 900–1,500 changed lines across existing modules, plus 1,500–2,500 test lines. This is a broad fork surface because most changes land in existing upstream-sensitive modules.

**Residual glitches, honestly**

- Normal replies remain delayed until the provider flushes complete JSONL lines; this is not token streaming.
- New-file/session discovery can still take seconds or minutes after a missed hook.
- Provider schema changes, compaction/rotation, oversized records, and filesystem/WSL/SSH stalls can still omit or replace visible rows.
- Direct PTY/SSH delivery still lacks provider-level idempotency/ack; a process crash between body and Enter remains ambiguous.
- Hook state and transcript state can still disagree temporarily.
- There is no defensible incident-rate percentage without telemetry. The architecture still permits all four symptom classes at lower frequency; it cannot meet “never stale.”

**Single riskiest unknown:** whether current and near-future Claude/Codex TUI transcript schemas expose enough stable session/turn identity across clear, compact, resume, subagents, and paginated history to make heuristic reconciliation durable.

### Path B — structured transport for Chat sessions

**Scope**

- add a provider-neutral structured-session controller with sequence numbers, client mutation IDs, reconnect replay, session ownership, and a compact event journal;
- add a Claude adapter (Agent SDK preferred; stream-JSON print/resume is the lower-dependency fallback);
- add a long-lived Codex app-server adapter that handles notifications and server-initiated approval requests;
- add capability-negotiated runtime RPCs for start/resume/send/interrupt/respond-to-prompt/read-from-sequence;
- add a renderer event reducer/transport; map accepted/delta/completed events into existing message/block UI;
- preserve current JSONL Chat as a compatibility/import fallback for external TUI sessions and old runtimes;
- implement explicit structured-to-TUI ownership handoff on “Switch to Terminal.”

**Thin-fork surface**

- 10–14 added production modules, approximately 2,600–3,800 new lines, under concrete domains such as `native-chat-session-controller`, `native-chat-event-journal`, `native-chat-provider-adapter`, `claude-structured-session`, `codex-app-server-chat-session`, `native-chat-mutation-index`, and `native-chat-event-reducer`;
- only 8–12 existing product files touched, approximately 350–700 lines total, primarily the view/composer integration, runtime RPC registry, protocol capability list, and terminal handoff;
- approximately 2,500–4,000 added test lines.

This keeps roughly 80–88% of the fork-specific production surface in added modules, which is materially better for a thin fork than Path A's edits across the existing tail/hook stack.

**Estimate**

| Work | Hours |
|---|---:|
| Provider-neutral controller, journal, mutation/sequence contract, RPC | 36–52 |
| Codex app-server chat adapter | 22–34 |
| Claude Agent SDK/stream-JSON adapter | 30–46 |
| Renderer reducer, composer/card mapping, ownership handoff | 30–46 |
| Local/WSL/SSH/runtime/restart/mixed-version/approval tests | 36–54 |
| Rollout fallback, diagnostics, telemetry | 10–16 |
| **Total** | **164–248 hours** |

That is roughly 4–6 focused engineering weeks for one experienced engineer, or 2–3 calendar weeks for two engineers with provider adapters split after the event contract is fixed. A 24-hour time-boxed spike should prove Claude approval/resume semantics and Codex server-request handling before committing the remainder; those hours are included above.

**Premium behaviors that become natural**

- token/reasoning/tool progress streams from provider deltas instead of fake hook preview;
- instant user echo from an acknowledged mutation with one stable ID;
- duplicate mutation rejection and deterministic reconnect replay;
- authoritative turn/order/status IDs, so no clock/text dedup heuristics;
- immediate approval/question/error states;
- no stale file selection or wait-for-newline latency for structured-owned sessions;
- “never stale” after reconnect in the precise sense that the UI replays the owning runtime's event sequence, not whichever JSONL file a scan first finds.

“Never stale” does not automatically extend to a session concurrently driven by an external TUI or imported from an older runtime. Those remain compatibility/import cases until ownership transfers.

**Single riskiest unknown:** exact parity and safe ownership handoff between the interactive Claude/Codex TUI and structured execution—especially approvals, slash/session commands, account/permission modes, MCP/tools, resume/clear/compact, and switching views without forking or double-driving the provider session.

## 5. Recommendation

Choose **Path B**, preceded by the included 24-hour provider-parity spike. It directly removes the file-selection, file-flush, clock matching, optimistic reconciliation, and PTY idempotency joins responsible for the founder's four complaints, while preserving Terminal Mode and most of the existing premium UI components.

If release pressure requires an interim patch, take only the highest-value Path A subset: repeated-send admission guard, session-scoped pending entries, stale-restored identity labeling, deterministic path selection, and direct-SSH gating/routing. Do not treat that subset—or the full Path A estimate—as the final premium architecture.
