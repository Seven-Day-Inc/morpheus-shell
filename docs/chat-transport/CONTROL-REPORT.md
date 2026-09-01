# Control report — upstream v1.4.194 on Windows

## Headline

| Classification | Files |
| --- | ---: |
| UPSTREAM-ON-WINDOWS | 43 |
| MERGE-INDUCED | 0 |
| NOT-ON-TAG | 0 |

All 43 requested paths exist at pristine upstream `v1.4.194` and all 43 failed in
this Windows control run. Consequently, none of the candidate failures is
merge-induced under the lane rule.

## Control method

- Fetched `upstream --tags`, then detached at `v1.4.194`
  (`07f4356a1678f6170a439527cd043f59b84343f0`).
- Confirmed `git diff v1.4.194 --stat` was empty before the run.
- Reused the candidate worktree's installed `node_modules` through an untracked
  junction, matching the spike's dependency setup.
- Ran `node config/scripts/ensure-native-runtime.mjs --runtime=node` first.
- Ran the requested 43 paths, in the brief's order, with this exact Vitest
  invocation:

```text
node node_modules/vitest/vitest.mjs run --config config/vitest.config.ts --reporter=json --outputFile=control-result.json config/scripts/build-windows-cli-launcher.test.mjs config/scripts/ensure-native-runtime.test.mjs src/cli/handlers/orchestration-gate-cli.test.ts src/main/ai-vault/session-scanner.test.ts src/main/ai-vault/session-scanner-codex-dual-root.test.ts src/main/codex-accounts/runtime-home-wsl-managed-accounts.test.ts src/main/codex-accounts/runtime-home-wsl-system-default.test.ts src/main/codex-accounts/service-wsl-accounts.test.ts src/main/daemon/pty-subprocess.test.ts src/main/daemon/pty-subprocess-env-inheritance.test.ts src/main/git/status-submodule-path-cache.test.ts src/main/git/worktree-add-local-base-refresh.test.ts src/main/git/worktree-add-local-base-suggestion.test.ts src/main/ipc/parcel-watcher-process-entry.test.ts src/main/ipc/pty-login-shell-startup-commands.test.ts src/main/ipc/pty-wsl-cwd-validation.test.ts src/main/providers/local-pty-shell-ready-wrapper-generation.test.ts src/main/quit-path-durable-write-blocking.test.ts src/main/runtime/fit-override-integration.test.ts src/main/runtime/graph-sync-mobile-snapshot-gating.test.ts src/main/runtime/graph-sync-payload-partition.test.ts src/main/runtime/multi-client-navigation-isolation.integration.test.ts src/main/runtime/orca-runtime-mobile-agent-status-title-truthfulness.test.ts src/main/runtime/orca-runtime-terminal-close-continuity.test.ts src/main/runtime/orca-runtime-terminal-retirement.test.ts src/main/runtime/orca-runtime-terminal-retirement-host-partition.test.ts src/main/runtime/orca-runtime-terminal-split-authority.test.ts src/main/runtime/quarter-circle-title-send-authorization.test.ts src/main/runtime/rpc/terminal-opencode-send-guard.integration.test.ts src/main/runtime/runtime-rpc-long-poll-transport.test.ts src/main/runtime/runtime-rpc-mobile-terminal-streaming.test.ts src/main/runtime/runtime-rpc-terminal-list.test.ts src/main/runtime/runtime-rpc-worktree-queries.test.ts src/main/runtime/terminal-list-payload-size.test.ts src/main/runtime/terminal-list-stale-leaf-liveness.test.ts src/main/runtime/terminal-mobile-subscribe-tab-mount.test.ts src/main/runtime/terminal-restore-record-seed.test.ts src/main/runtime/terminal-send-stale-leaf-liveness.test.ts src/main/sqlite/sync-database.test.ts src/relay/git-handler-worktree-provisioning.test.ts src/renderer/src/components/feature-interaction-writer-boundaries.test.ts src/shared/wsl-login-shell-command.test.ts tests/e2e/remote-terminal-tab-retirement.unit.test.ts
```

`control-result.json` contains exactly 43 requested path entries: 43 failed,
352 assertions passed, 40 failed, and 38 were pending. No requested path was
absent from the tag.

## Per-file classification

Each row failed in the detached, zero-diff upstream checkout, so each is
`UPSTREAM-ON-WINDOWS`. The final column is a concise failure signature from the
control result; it is evidence, not a fork-side attribution.

| File | Pristine control evidence | Classification |
| --- | --- | --- |
| `config/scripts/build-windows-cli-launcher.test.mjs` | File error: `Invalid or unexpected token` | UPSTREAM-ON-WINDOWS |
| `config/scripts/ensure-native-runtime.test.mjs` | Assertion: patched node-pty ConPTY artifact missing after rebuild | UPSTREAM-ON-WINDOWS |
| `src/cli/handlers/orchestration-gate-cli.test.ts` | Assertion: recovery message lacked `--retry-request mutation_1` | UPSTREAM-ON-WINDOWS |
| `src/main/ai-vault/session-scanner.test.ts` | Assertion: scanned session object mismatch | UPSTREAM-ON-WINDOWS |
| `src/main/ai-vault/session-scanner-codex-dual-root.test.ts` | Assertion: dual-root dedup session object mismatch | UPSTREAM-ON-WINDOWS |
| `src/main/codex-accounts/runtime-home-wsl-managed-accounts.test.ts` | Assertion: WSL config path was not the expected Windows path | UPSTREAM-ON-WINDOWS |
| `src/main/codex-accounts/runtime-home-wsl-system-default.test.ts` | Assertion: mounted-drive WSL config call arguments differed | UPSTREAM-ON-WINDOWS |
| `src/main/codex-accounts/service-wsl-accounts.test.ts` | Assertion: refreshed WSL account config differed | UPSTREAM-ON-WINDOWS |
| `src/main/daemon/pty-subprocess.test.ts` | Assertion: expected cancellation-path spawn call was absent | UPSTREAM-ON-WINDOWS |
| `src/main/daemon/pty-subprocess-env-inheritance.test.ts` | Assertion: injected `history` path was `undefined` | UPSTREAM-ON-WINDOWS |
| `src/main/git/status-submodule-path-cache.test.ts` | Assertion: recreated submodule cache stayed empty | UPSTREAM-ON-WINDOWS |
| `src/main/git/worktree-add-local-base-refresh.test.ts` | Assertion: reset/fast-forward Git command sequence differed | UPSTREAM-ON-WINDOWS |
| `src/main/git/worktree-add-local-base-suggestion.test.ts` | Assertion: advisory owner-probe command sequence differed | UPSTREAM-ON-WINDOWS |
| `src/main/ipc/parcel-watcher-process-entry.test.ts` | Assertion: shallow watcher subscription call differed | UPSTREAM-ON-WINDOWS |
| `src/main/ipc/pty-login-shell-startup-commands.test.ts` | Assertion: POSIX shell-wrapper path differed | UPSTREAM-ON-WINDOWS |
| `src/main/ipc/pty-wsl-cwd-validation.test.ts` | Assertion: login-shell wrapper path differed | UPSTREAM-ON-WINDOWS |
| `src/main/providers/local-pty-shell-ready-wrapper-generation.test.ts` | Assertion: `ORCA_USER_DATA_PATH` wrapper root was undefined | UPSTREAM-ON-WINDOWS |
| `src/main/quit-path-durable-write-blocking.test.ts` | Assertion: synchronous filesystem call was observed | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/fit-override-integration.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/graph-sync-mobile-snapshot-gating.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/graph-sync-payload-partition.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/multi-client-navigation-isolation.integration.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/orca-runtime-mobile-agent-status-title-truthfulness.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/orca-runtime-terminal-close-continuity.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/orca-runtime-terminal-retirement.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/orca-runtime-terminal-retirement-host-partition.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/orca-runtime-terminal-split-authority.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/quarter-circle-title-send-authorization.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/rpc/terminal-opencode-send-guard.integration.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/runtime-rpc-long-poll-transport.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/runtime-rpc-mobile-terminal-streaming.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/runtime-rpc-terminal-list.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/runtime-rpc-worktree-queries.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/terminal-list-payload-size.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/terminal-list-stale-leaf-liveness.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/terminal-mobile-subscribe-tab-mount.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/terminal-restore-record-seed.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/runtime/terminal-send-stale-leaf-liveness.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |
| `src/main/sqlite/sync-database.test.ts` | Assertion: `EBUSY` unlinking contended SQLite database | UPSTREAM-ON-WINDOWS |
| `src/relay/git-handler-worktree-provisioning.test.ts` | Assertion: `addWorktree` Git command sequence differed | UPSTREAM-ON-WINDOWS |
| `src/renderer/src/components/feature-interaction-writer-boundaries.test.ts` | Assertion: writer boundary position was before the expected boundary | UPSTREAM-ON-WINDOWS |
| `src/shared/wsl-login-shell-command.test.ts` | Assertion: in-guest wrapper-root command exited nonzero | UPSTREAM-ON-WINDOWS |
| `tests/e2e/remote-terminal-tab-retirement.unit.test.ts` | File error: `EPERM` removing `orca-vitest-userdata-*` | UPSTREAM-ON-WINDOWS |

## Merge-induced assertions and fork-side causes

None. There are no `MERGE-INDUCED` files in this control, so no candidate-only
failing assertion exists to inspect and no fork-side cause (including an
automation-editor resolution, M1 reskin delta, or another fork delta) applies.

## Landing recommendation

**land-with-0-fixes** for this 43-file merge-regression gate: every listed
candidate failure reproduces at pristine upstream `v1.4.194` on this Windows
host, so none is attributable to the fork merge or a conflict resolution. The
upstream-on-Windows failures remain separate upstream/environmental triage
items, but they do not require a merge-specific fix before landing this
candidate.
