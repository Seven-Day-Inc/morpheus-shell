# v1.4.194 merge resolution

## Scope

- Branch: `merge-candidate/v1.4.194`
- Upstream tag: `v1.4.194` (`07f4356a`)
- Conflicts resolved: four, all in the automation editor
- No rename or delete conflicts occurred.

## Conflict resolutions

### `src/renderer/src/components/automations/AutomationEditorDialog.tsx`

Upstream added destination-aware create/edit flows, recovery and action notices, owner-conflict UI, and add-project support. The fork introduced the wider three-column dialog shell and paired editor/settings surface. The resolution keeps the fork's layout, while threading the upstream destination, notice, recovery, and project-selection data through it and rendering the owner-conflict notice in the upstream position.

### `src/renderer/src/components/automations/AutomationEditorPromptEditor.tsx`

Upstream changed programmatic prompt synchronization so the content ref updates in the synchronization effect. The fork replaced the text surface with the Monaco prompt editor, including initial synchronization, undoable external updates, and dialog-safe Escape handling. The resolution retains that Monaco surface and uses the upstream ref/update ordering.

### `src/renderer/src/components/automations/AutomationEditorSettingsSidebar.tsx`

Upstream added parsed schedule support and destination/project selectors, including the create-destination control and add-project capability. The fork added the 320px settings rail and its grouped three-column-editor layout. The resolution preserves the rail and incorporates the upstream controls and parsed schedule data flow.

### `src/renderer/src/components/automations/AutomationSchedulePicker.tsx`

Upstream split schedule parsing and occurrence logic into their shared modules and made weekday labels locale-aware. The fork's existing schedule picker surface remains; its static English weekday list is replaced by the upstream localized weekday mapping.

## Mechanical merge artifacts

- Regenerated `resources/skills/current-manifest.json`, `resources/skills/release-mapping.json`, and `resources/skills/snapshot-registry.json` so the skill-bundle manifest check passes.
- Preserved the upstream LF policy for the two patched xterm package files; their patch content did not change.
- `BRIEF.md` is not included in the merge commit.

## Verification

| Gate | Result |
| --- | --- |
| Typecheck | PASS — `node config/scripts/run-typecheck-projects-in-parallel.mjs` |
| Lint | PASS — the full `package.json` lint sequence (oxlint, reliability, ratchets, skill generation, and localization checks) completed successfully. |
| Unit tests | Completed with environment-related failures: 165 failed / 6,916 passed / 76 skipped test files; 319 failed / 65,142 passed / 942 skipped tests; 5 errors. |
| Merge hygiene | PASS — no unresolved paths or conflict markers; scoped whitespace checks passed for the four resolved files and this report. |

The normal `corepack pnpm run …` wrappers could not reach their scripts in this restarted Windows environment because the pending root postinstall hit the `@vscode/windows-process-tree` FileTracker deep-path error. The listed commands were therefore run directly after a frozen-lockfile install, using the same project scripts and configuration.

The unit suite ran through to completion after restoring the required native runtime modules. Its failures were outside the four resolved files and were dominated by this host's Windows/Unix mismatch and cleanup constraints: unavailable `/bin/sh` and WSL support, `X:\\factory` socket access errors, POSIX-versus-Windows path expectations, and `EPERM` cleanup failures for `orca-vitest-userdata-*`. No unrelated source changes were made to address them.

The repository-wide staged `git diff --check` reports trailing whitespace that is part of upstream package patch payloads. It is outside the four-file conflict scope and was left unchanged.

## Delivery

This merge is committed and pushed only to `merge-candidate/v1.4.194`. No pull request was opened and `main` was not changed.
