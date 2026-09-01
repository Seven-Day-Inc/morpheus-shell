# Structured chat engine qualification — v1.4.194 candidate

## ADDENDUM — landing disposition

**LAND.** The subsequent Windows control in
[`CONTROL-REPORT.md`](./CONTROL-REPORT.md) classified all 43 candidate failures as
`UPSTREAM-ON-WINDOWS`, with zero merge-induced failures; Sol independently reproduced
that result. The founder decision
`centrifuge/decisions/2026-09-01-chat-transport-adopt-upstream-engine.md` dispositions
the contract gaps below as the follow-on build behind Einstein's facade rather than as
landing blockers. This addendum supersedes the original point-in-time verdict and
recommendation retained below.

## Original executive verdict (superseded)

**Do not land this candidate yet.** The upstream Codex engine passes the requested
double-dispatch, crash-ambiguity, replay-within-an-epoch, and fail-closed ownership
tests. It does not satisfy the frozen contracts end to end: explicit retry of an
unknown send reuses the same mutation id, epoch rollover resets sequence to 1, legacy
imports have no freshness/caught-up certificate, and the handoff path has no
contract-complete quiescence oracle. Independently, the clean-main comparison found 43
test files that pass on `origin/main` and fail on the candidate, which the lane brief
defines as real merge regressions.

## Part A — clean-main unit baseline

### Method

- Candidate: `c7633aa77003ed26e7b9448f3c3670fb6262bc43`
  (`merge-candidate/v1.4.194`).
- Baseline: detached clean sibling at `a2c08f66397bef8cb6f0cb3f9bbd421d297bfa71`
  (`origin/main` after fetch).
- The sibling lived under `X:/factory/tmp/`, used the candidate's installed
  `node_modules` through an untracked junction so dependencies were identical, and was
  removed after the comparison.
- Both revisions ran the same commands, sequentially:

```text
node config/scripts/ensure-native-runtime.mjs --runtime=node
node node_modules/vitest/vitest.mjs run --config config/vitest.config.ts --reporter=json --outputFile=<revision-result>.json
```

### Counts and verdict

| Revision | Result files | Failed files | Failed tests | Passed tests | Pending tests |
| --- | ---: | ---: | ---: | ---: | ---: |
| clean `origin/main` | 5,666 | 89 | 373 | 51,869 | 694 |
| merge candidate | 7,157 | 162 | 317 | 65,144 | 942 |

The prior blanket attribution to the Windows environment is **refuted**. There is a
large environmental component—64 files fail on both revisions—but 43 paths fail on the
candidate while the same path passes on main. By the brief's rule, those 43 are real
merge regressions. Another 55 failed candidate files do not exist on main and cannot be
classified by this baseline. Twenty-five main failures no longer fail, or no longer
exist, on the candidate.

### Initially classified merge regressions (43; superseded by the control)

```text
config/scripts/build-windows-cli-launcher.test.mjs
config/scripts/ensure-native-runtime.test.mjs
src/cli/handlers/orchestration-gate-cli.test.ts
src/main/ai-vault/session-scanner.test.ts
src/main/ai-vault/session-scanner-codex-dual-root.test.ts
src/main/codex-accounts/runtime-home-wsl-managed-accounts.test.ts
src/main/codex-accounts/runtime-home-wsl-system-default.test.ts
src/main/codex-accounts/service-wsl-accounts.test.ts
src/main/daemon/pty-subprocess.test.ts
src/main/daemon/pty-subprocess-env-inheritance.test.ts
src/main/git/status-submodule-path-cache.test.ts
src/main/git/worktree-add-local-base-refresh.test.ts
src/main/git/worktree-add-local-base-suggestion.test.ts
src/main/ipc/parcel-watcher-process-entry.test.ts
src/main/ipc/pty-login-shell-startup-commands.test.ts
src/main/ipc/pty-wsl-cwd-validation.test.ts
src/main/providers/local-pty-shell-ready-wrapper-generation.test.ts
src/main/quit-path-durable-write-blocking.test.ts
src/main/runtime/fit-override-integration.test.ts
src/main/runtime/graph-sync-mobile-snapshot-gating.test.ts
src/main/runtime/graph-sync-payload-partition.test.ts
src/main/runtime/multi-client-navigation-isolation.integration.test.ts
src/main/runtime/orca-runtime-mobile-agent-status-title-truthfulness.test.ts
src/main/runtime/orca-runtime-terminal-close-continuity.test.ts
src/main/runtime/orca-runtime-terminal-retirement.test.ts
src/main/runtime/orca-runtime-terminal-retirement-host-partition.test.ts
src/main/runtime/orca-runtime-terminal-split-authority.test.ts
src/main/runtime/quarter-circle-title-send-authorization.test.ts
src/main/runtime/rpc/terminal-opencode-send-guard.integration.test.ts
src/main/runtime/runtime-rpc-long-poll-transport.test.ts
src/main/runtime/runtime-rpc-mobile-terminal-streaming.test.ts
src/main/runtime/runtime-rpc-terminal-list.test.ts
src/main/runtime/runtime-rpc-worktree-queries.test.ts
src/main/runtime/terminal-list-payload-size.test.ts
src/main/runtime/terminal-list-stale-leaf-liveness.test.ts
src/main/runtime/terminal-mobile-subscribe-tab-mount.test.ts
src/main/runtime/terminal-restore-record-seed.test.ts
src/main/runtime/terminal-send-stale-leaf-liveness.test.ts
src/main/sqlite/sync-database.test.ts
src/relay/git-handler-worktree-provisioning.test.ts
src/renderer/src/components/feature-interaction-writer-boundaries.test.ts
src/shared/wsl-login-shell-command.test.ts
tests/e2e/remote-terminal-tab-retirement.unit.test.ts
```

### Shared environmental failures (64)

```text
config/scripts/mobile-pairing-qrcode-import-plugin.test.mjs
config/scripts/pr-workflow-parallelism.test.mjs
config/scripts/resolve-7za-path.test.mjs
config/scripts/trim-windows-icon-source.test.mjs
config/scripts/verify-skills-cli-runtime.test.mjs
src/main/agent-hooks/managed-hook-stdin-lifecycle.test.ts
src/main/ai-vault/session-delete.test.ts
src/main/ai-vault/session-delete-target.test.ts
src/main/ai-vault/session-scanner-opencode-sources-wsl-stall.test.ts
src/main/ai-vault/session-scanner-values.test.ts
src/main/artifacts/artifact-create-intent-store.test.ts
src/main/bitbucket/credential-store.test.ts
src/main/cli/linux-bare-orca-dispatcher.test.ts
src/main/cli/linux-terminal-orca-cli-shim.test.ts
src/main/codex/codex-session-resume-home.test.ts
src/main/codex/codex-session-resume-preparation.test.ts
src/main/codex-accounts/runtime-home-mirrored-status-home.test.ts
src/main/codex-accounts/runtime-home-service-per-account-migration.test.ts
src/main/daemon/daemon-preflight-client-replacement.test.ts
src/main/daemon/daemon-pty-adapter-daemon-recovery.test.ts
src/main/daemon/pty-subprocess-foreground-scan-cadence.test.ts
src/main/devin/hook-service.test.ts
src/main/durable-file-write-syscall-proof.test.ts
src/main/ephemeral-vm-runtime-service.test.ts
src/main/git/porcelain-v1-records.test.ts
src/main/git/repo-detection.test.ts
src/main/git/status-branch-line-total-exec-contract.test.ts
src/main/git/worktree-deferred-removal-real-git.test.ts
src/main/ipc/ephemeral-vm.test.ts
src/main/ipc/filesystem-watcher-local-unsubscribe.test.ts
src/main/ipc/local-network-connection-test.test.ts
src/main/ipc/native-chat.test.ts
src/main/ipc/pty-daemon-spawn-wsl-runtime.test.ts
src/main/ipc/worktree-base-directory-event-filter.test.ts
src/main/ipc/worktree-base-directory-watcher.test.ts
src/main/kimi/hook-service.test.ts
src/main/native-chat/transcript-read-cache.test.ts
src/main/rate-limits/codex-fetcher.test.ts
src/main/rate-limits/service-account-target-selection.test.ts
src/main/rate-limits/service-inactive-account-previews.test.ts
src/main/rate-limits/service-refresh-orchestration.test.ts
src/main/runtime/agent-session-claim-identity.test.ts
src/main/runtime/orca-runtime-files-terminal-link-host-translation.test.ts
src/main/runtime/orchestration/preamble.test.ts
src/main/runtime/rpc/methods/ai-vault.test.ts
src/main/ssh/ssh-g-config-resolution.test.ts
src/main/ssh/ssh-relay-upload-stage-commands.test.ts
src/main/ssh/ssh-remote-commands.test.ts
src/main/ssh/ssh-remote-node-resolution.test.ts
src/main/ssh/ssh-system-fallback.test.ts
src/main/ssh/system-ssh-forward-process.test.ts
src/main/text-generation/commit-message-text-generation-model-discovery.test.ts
src/main/window/clipboard-file-copy.test.ts
src/relay/agent-exec-handler.test.ts
src/relay/ai-vault-handler.test.ts
src/relay/ai-vault-service-client.test.ts
src/relay/rotating-log-writer.test.ts
src/renderer/src/app-startup-routing.test.ts
src/renderer/src/components/editor/monaco-content-sync.undo-history.test.ts
src/renderer/src/components/pull-request-page-host-boundary.test.ts
src/renderer/src/components/right-sidebar/SourceControl.host-context-boundary.test.ts
tests/e2e/helpers/nested-runtime-proxy-jump-fixture.unit.test.ts
tests/tools/upstream/candidate.test.mjs
tests/tools/upstream/watch.test.mjs
```

### Candidate-only failed files, absent on main (55; not baseline-comparable)

```text
config/scripts/build-orcad-prebuilds.test.mjs
config/scripts/check-runtime-electron-ratchet.test.mjs
config/scripts/install-node-dependencies-action.test.mjs
config/scripts/regenerate-xterm-patches.test.mjs
config/scripts/verify-dev-channel-packaging.test.mjs
src/cli/orchestration-mutation-recovery.test.ts
src/cli/runtime/client-recovery.test.ts
src/main/agent-hooks/hook-script-outside-orca.test.ts
src/main/agent-hooks/spool.test.ts
src/main/automations/automation-run-terminal-surface.test.ts
src/main/automations/external-manager-scoped.test.ts
src/main/browser/agent-browser-process-environment.test.ts
src/main/browser/browser-manager-client-hosted-downloads.test.ts
src/main/browser/wsl-browser-network-relay-launch.test.ts
src/main/codex/codex-app-server-connection.test.ts
src/main/codex/codex-tui-rollout-proof.test.ts
src/main/daemon/pty-subprocess-cwd-cancel-identity.test.ts
src/main/git/status-diff-settled-cache.test.ts
src/main/grok/grok-hook-config-file.test.ts
src/main/ipc/worktree-base-directory-watch-targets.test.ts
src/main/ipc/worktrees-authoritative-local-metadata-pruning.test.ts
src/main/native-chat/agent-session-wire/structured-agent-session-host.test.ts
src/main/native-chat/agent-session-wire/structured-agent-session-recovery-exits.test.ts
src/main/orcad/node-pty-prebuilt-slot.test.ts
src/main/orcad/node-pty-precondition.test.ts
src/main/orcad/orcad-app-paths.test.ts
src/main/orcad/orcad-health.test.ts
src/main/persistence/loading-store/metadata-lineage-batch-pruning.test.ts
src/main/persistence/tracking-repos/local-worktree-metadata-scan-expectation.test.ts
src/main/persistence/tracking-repos/missing-local-worktree-metadata-pruning.test.ts
src/main/persistence/tracking-repos/worktree-metadata-normalization.test.ts
src/main/runtime/agent-session-process-identity-probe.test.ts
src/main/runtime/agent-session-pty-write-enforcement.test.ts
src/main/runtime/exit-provenance-audit.test.ts
src/main/runtime/graph-sync-live-daemon-pty-tab-preservation.test.ts
src/main/runtime/orca-runtime-mobile-close-preserved-resurrection.test.ts
src/main/runtime/orca-runtime-structured-session-restore.test.ts
src/main/runtime/orchestration/lightweight-run-worker-exit-escalation.test.ts
src/main/runtime/pty-inventory-liveness-verdict.test.ts
src/main/runtime/rpc/methods/orchestration-worker-interactive-wait.test.ts
src/main/runtime/rpc/methods/session-tabs-inventory-census-race.test.ts
src/main/runtime/session-tabs-inventory-publication.test.ts
src/main/runtime/structured-agent-session-integration.test.ts
src/main/runtime/terminal-interactive-wait-visibility.test.ts
src/main/runtime/terminal-list-execution-host-scope.test.ts
src/main/sqlite/sqlite-read-failure.test.ts
src/main/ssh/orcad-remote-shell-commands.integration.test.ts
src/main/startup/headless-pty-hydration-ordering.test.ts
src/relay/skill-upload-multi-relay.integration.test.ts
src/relay/terminal-history-wsl.test.ts
src/renderer/src/components/terminal/initial-terminal-wiring.test.ts
src/shared/agent-hook-listener-relay-dependency.test.ts
tests/e2e/cross-version-wire/cross-version-agent-session-wire.unit.test.ts
tests/e2e/cross-version-wire/release-checkout.unit.test.ts
tests/tools/windows-pty-native-capability-smoke/packaged-node-pty-capability-probe.test.mjs
```

### Main-only failures (25)

```text
config/scripts/generate-bundled-skill-guides.test.mjs
src/main/git/worktree-shared-directories.test.ts
src/main/ipc/pty-codex-account-attribution.test.ts
src/main/ipc/pty-spawn-env-codex-resume-provenance.test.ts
src/main/native-chat/transcript-watch-error.test.ts
src/main/pty/codex-shell-launch-preflight.test.ts
src/main/skills/skill-git-tree-identity.test.ts
src/renderer/src/components/dashboard-popout/preview-terminal-ime-bridge-kitty-bytes.test.ts
src/renderer/src/components/github-item-dialog-source-boundary.test.ts
src/renderer/src/components/status-bar/resource-session-classification-parity.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-hangul-syllable-flush.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-macos-keybinding-dict-trace.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-substituted-text-commit.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-won-composition-order.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-adversarial.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-composition-cancel.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-composition-deduplication.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-korean-enter-commit-order.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-linux-native-trace-replay.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-resumed-preedit-visibility.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-transaction-events.test.ts
src/renderer/src/components/terminal-pane/terminal-ime-xterm-windows-resumed-preedit-trace.test.ts
src/renderer/src/components/terminal-search-decoration-leak.test.ts
src/shared/node-markdown-document-discovery.test.ts
tests/e2e/cross-version-wire/cross-version-terminal-wire.unit.test.ts
```

## Part B — E0 contract gauntlet

The qualification suite lives in `tests/chat-transport-qualification/`. It uses the real
record store, operation ledger, journal store/loader/reducer, mutation admission, send
path, lease adjudicator, and resume gate. Provider effects use deterministic Codex-shaped
stubs. Command:

```text
node node_modules/vitest/vitest.mjs run --config tests/chat-transport-qualification/vitest.config.ts --reporter=verbose
```

Result: **3 files passed, 17 tests passed**. Diagnostic tests assert the engine's shipped
behavior; therefore a green test executable does not turn a diagnosed contract mismatch
into a PASS below.

Artifact verification also passed `oxlint tests/chat-transport-qualification`, the full
TypeScript project check (`node config/scripts/run-typecheck-projects-in-parallel.mjs`),
and `git diff --check`. The repository-wide changed-file quality wrapper was attempted,
but it could not start its lint subprocess on Windows: the 822-commit candidate delta
expanded to more than 9,200 command-line paths and `spawnSync pnpm.cmd` returned
`EINVAL`. That is a command-size limitation, not a clean or failed lint verdict; the
qualification directory was therefore linted directly.

### Contract 2 — mutation delivery

| Clause | Verdict | Engine receipt and finding |
| --- | --- | --- |
| Same id dispatched twice ⇒ one durable intent, one user item, at most one automatic provider dispatch | **PASS** | The ledger replays an existing matching fingerprint at `src/shared/agent-session-operation-ledger.ts:129`; `performSend` returns an existing submission before dispatch at `src/main/native-chat/agent-session-wire/structured-agent-session-turns.ts:98`; the submission seeds exactly one user item at `src/main/native-chat/agent-session-journal/journal-reducer.ts:175` and `:186`. The durable-store/journal reopen test observes one ledger row, one submission, one item, and one adapter call. |
| Same id + changed payload ⇒ rejected | **PASS** | Ledger fingerprint conflict is returned at `src/shared/agent-session-operation-ledger.ts:133`; the journal also refuses a changed fingerprint at `src/main/native-chat/agent-session-wire/structured-agent-session-turns.ts:95`. No second dispatch occurs. |
| Crash after local commit before dispatch | **PASS** | The write-ahead submission is appended before the provider call at `src/main/native-chat/agent-session-wire/structured-agent-session-turns.ts:105`. Restart converts surviving pending rows to `unknown` at `src/main/native-chat/agent-session-journal/journal-pending-submission-recovery.ts:9`, and the store explicitly promises no automatic resend at `src/main/native-chat/agent-session-journal/journal-store.ts:241`. |
| Crash after `attempted` before provider call | **PASS** for conservative outcome | Upstream collapses the contract's `committed` and `attempted` markers into one durable `pending` write-ahead row (`src/main/native-chat/agent-session-journal/journal-reducer.ts:179`). The recovered result is still `unknown`, never success or retry. The facade must map this coarser engine state without inventing stronger evidence. |
| Crash/provider call after effect but before response | **PASS** | Adapter exceptions are converted to `unknown` by `dispatchSafely` at `src/main/native-chat/agent-session-wire/structured-agent-session-turns.ts:53`; a replay returns the recorded unknown without invoking the adapter again at `:98`. |
| Crash after provider response before journal resolution | **PASS** | A pending row reopened after the accepted stub response is marked recovered/unknown (`src/main/native-chat/agent-session-journal/journal-pending-submission-recovery.ts:14`). No receipt exists because receipts are minted only from a durably accepted dispatch at `src/main/native-chat/agent-session-journal/journal-reducer.ts:211` and `:215`. |
| Manual “send again” after unknown mints a new id with `retryOf` | **FAIL** | `retryUnknown` deliberately makes the plan rerunnable at `src/main/native-chat/agent-session-wire/structured-agent-session-mutation-plans.ts:51`; `performSend` then redispatches the existing same id at `src/main/native-chat/agent-session-wire/structured-agent-session-turns.ts:98` and `:104`. The renderer request carries that control at `src/shared/structured-agent-session-outbox.ts:162`. The diagnostic test proves the same id becomes accepted on the second provider call. |

### Contract 3 — replay and projection

| Clause | Verdict | Engine receipt and finding |
| --- | --- | --- |
| Close/reopen during streaming | **PASS** | Reopen seeds the persisted snapshot and applies tail rows through the same reducer at `src/main/native-chat/agent-session-journal/journal-open.ts:66` and `:93`. A later revision replaces the partial body without moving or duplicating the item at `src/main/native-chat/agent-session-journal/journal-reducer.ts:141` and `:154`. |
| Disconnect after a delta before completion converges to the same projection | **PASS** | The qualification test compares reopen-between-delta-and-completion with uninterrupted ingestion and gets byte-for-byte equal snapshots. Receipt is the shared loader/reducer path above. |
| Replay from zero equals snapshot + tail | **PASS within one epoch** | `loadJournal` seeds compacted state at `src/main/native-chat/agent-session-journal/journal-open.ts:66` and folds only rows above the compaction boundary at `:93`. The test compares full rows with a real compacted snapshot plus a later tail. |
| Epoch-partitioned `(epoch, seq)` chains normalize to one monotonic session-wide order | **FAIL** | Every rollover hard-codes `seq: 1` at `src/main/native-chat/agent-session-journal/journal-epoch-rollover.ts:32`; an old cursor produces `epoch_changed` rather than a normalized successor at `src/main/native-chat/agent-session-journal/journal-cursor.ts:45`. The diagnostic test observes sequence `2 → 1 → 2` and loss of the prior epoch from the current projection. No facade normalization exists on this branch. |
| Replayed provider events never duplicate items | **PASS** | Revision comparison drops stale/equal rows at `src/main/native-chat/agent-session-journal/journal-reducer.ts:141`, and a later revision retains the original creation sequence at `:154`. Reopen plus repeated provider identity yields one item at revision 2. |
| Imported/legacy session never becomes falsely live | **FAIL at the engine/facade boundary** | Legacy import replaces the epoch at `src/main/native-chat/agent-session-journal/journal-legacy-import.ts:128`, but `AgentJournalSnapshot` has no source or freshness field (`src/shared/agent-session-journal-types.ts:200`), and projected status is only `working | attention | idle` (`src/shared/structured-agent-session-projection.ts:128`). The diagnostic import has no freshness certificate. The facade must force `stale | unknown` and withhold Live. |
| Race-free watch emits an explicit caught-up certificate | **NOT-EXERCISABLE / missing canonical facade** | The upstream subscribe union begins at `src/shared/agent-session-wire.ts:119` and ends with `end` at `:143`; it has no `caughtUp` variant. This prevents testing the frozen Live certificate until the facade adds it. |

### Contract 5 — ownership and fencing

| Clause | Verdict | Engine receipt and finding |
| --- | --- | --- |
| Two writers attempt acquisition | **PASS** | Store mutations serialize in `src/main/runtime/agent-session-store-transaction-queue.ts:86`, reload disk under the transaction at `:146`, and replace stale in-memory state at `:161`. Two independently opened stores racing the same session produce one reservation, one operation row, and one loser. |
| Old-epoch mutation after handoff is rejected | **PASS** | Mutation admission requires strict current-fence equality at `src/shared/agent-session-mutation-envelope.ts:114` and returns `agent_session_checkpoint_stale` with the new fence at `:120`. |
| Provider process outlives controller disconnect | **PASS** | A proven-live native owner is routed to `recovering`, not readopted or freed, at `src/shared/agent-session-lease-adjudication.ts:220` and `:225`. An unreconciled lease admits no writer at `:95`. |
| Second app-server tries to resume a writer-owned thread | **PASS** | Resume eligibility requires `claimStatus === 'released'` at `src/main/native-chat/agent-session-wire/structured-agent-session-resume-eligibility.ts:18`; live writer-owned records return `null` at `:29`. The qualification test opens the gate only after the owner is explicitly released. |
| Lease timeout alone must not transfer ownership | **PASS** | The adjudicator states the fail-closed rule at `src/shared/agent-session-lease-adjudication.ts:4`; when an owner remains, absence of proven death refuses acquisition at `:154`–`:160`. The expired-deadline test gets `ownership_unknown` for an indeterminate probe and `conflict` for a proven-live probe. |
| General idle handoff satisfies every frozen quiescence/checkpoint precondition | **NOT-EXERCISABLE / incomplete upstream path** | The forward path enters `preparing` immediately at `src/main/native-chat/agent-session-wire/structured-agent-session-handoff-forward.ts:30` and then asks the adapter to stop at `:43`. The context transition at `src/main/native-chat/agent-session-wire/structured-agent-session-handoff-flow-context.ts:31` has no checks for active turn, blocking prompt, background task, pending/unknown submission, or ingested checkpoint. There is no provider-neutral quiescence oracle to exercise. |

## Gaps that become our build

1. **Claude adapter.** Upstream's default structured-provider gate is Codex-only at
   `src/main/native-chat/agent-session-wire/structured-agent-session-provider-support.ts:14`
   and `:24`. Einstein needs a Claude adapter with the same dispatch-evidence and fencing
   semantics.
2. **Contract-complete idle handoff.** Add one host-owned quiescence adjudicator covering
   active turns, blocking interactions, background mutations, outbound rows (especially
   `unknown`), provider ingestion checkpoint, process exit proof, and tail verification.
3. **Flat sequence normalization.** Translate upstream `(epoch, sequence)` positions into
   one gap-free, never-reused session-wide `seq` before publishing canonical events.
   Ownership changes, approvals, and interruptions must share that order.
4. **Freshness and caught-up certificate.** Imported sessions must publish
   `freshness: stale | unknown`; the canonical watch must emit `caughtUp`, and Live must be
   impossible before that certificate is processed.
5. **Unknown-send retry semantics.** Manual resend must mint a new mutation id and record
   `retryOf`; same-id redispatch must be gated on a formally idempotent provider capability
   or proof of non-acceptance.
6. **State vocabulary mapping.** Upstream's single pre-dispatch `pending` row is
   conservative, but the facade must expose the frozen `committed` / `attempted` /
   `deliveryUnknown` meanings without claiming evidence the engine does not store.

## Original recommendation (superseded)

Do **not** land the current candidate. Preserve the upstream engine direction—the tested
Codex mutation journal and lease adjudicator are a strong base—but first resolve or
explicitly disposition all 43 baseline-defined merge regressions, add flat-sequence and
freshness/caught-up normalization at the facade, rotate unknown manual retries to a new
id with `retryOf`, and require the complete quiescence/checkpoint proof before general
handoff. The Claude adapter remains a planned follow-on, not evidence supplied by this
candidate.
