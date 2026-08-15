# Slice 1 — Windows foundation build

Status: **blocked by a founder-installed native toolchain prerequisite**. This document records the attempted build faithfully; no source changes were made.

## Build-system survey

- The root is a standalone pnpm project (`packageManager: pnpm@10.24.0`, `engines.node: 24`), not a recursive workspace build. `mobile/` deliberately has its own lockfile and is excluded from the root package graph.
- The development entry point is `pnpm run dev`. It runs `config/scripts/run-electron-vite-dev.mjs`, which prepares the dev CLI wrapper, starts Electron Vite, and allocates a localhost CDP port unless `REMOTE_DEBUGGING_PORT` is set.
- The desktop compilation path is `pnpm run build:desktop` (type checks, relay, CLI, Electron Vite, bundled-skill verification, and web client build).
- The Windows package path is `pnpm run build:win`, which runs `build:desktop`, ensures the Electron runtime, then invokes Electron Builder for Windows. The builder configuration does not override Electron Builder's output directory, so the expected installer is `dist/orca-windows-setup.exe`.

## Rig prerequisites observed

| Requirement | Found on this rig |
| --- | --- |
| OS / architecture | Windows 10 10.0.22631, x64 |
| Node.js | v24.18.0 |
| npm / Corepack | npm 11.16.0 / Corepack 0.35.0 |
| pnpm | Not on `PATH`; Corepack resolved the pinned v10.24.0 successfully |
| Git | 2.55.0.windows.3 |
| Python for node-gyp | **Not found** |
| Visual Studio Build Tools / MSVC | Not found by `vswhere` or on `PATH` |

## Command record

All large caches were intentionally kept on `X:` inside the ignored `.pnpm-store/` directory. In a normal PowerShell session, run:

```powershell
$repo = 'X:\factory\repos\morpheus-shell'
$env:COREPACK_HOME = "$repo\.pnpm-store\corepack"
$env:npm_config_cache = "$repo\.pnpm-store\npm-cache"
$env:ELECTRON_CACHE = "$repo\.pnpm-store\electron-cache"
$env:HUSKY = '0'

corepack pnpm install --frozen-lockfile --store-dir .pnpm-store\packages
corepack pnpm run build:win
```

The only deviations from a stock project invocation were:

- Cache locations were set under `X:` so package, npm, Electron, and Corepack downloads do not consume the system drive.
- `HUSKY=0` prevented the dependency install from writing Git hooks in this managed, read-only `.git` environment; it changes neither source nor the packaged application.
- This automation shell inherited duplicate `Path` / `PATH` keys, so its background launcher used a normalized child environment. A normal interactive PowerShell session does not need that launcher workaround.

## Attempt result

The dependency installation began at `2026-08-15T19:20:56Z` and stopped at `2026-08-15T19:21:38Z` (about 42 seconds) during the root `postinstall` script, before any build command could start.

`config/scripts/rebuild-native-deps.mjs` correctly invoked Electron rebuild for `windows-native-registry`; its native module was absent and `node-gyp` failed with:

```text
Error: Could not find any Python installation to use
...
[rebuild] Native module rebuild failed: node-gyp failed to rebuild
'...\\windows-native-registry'
ELIFECYCLE Command failed with exit code 1.
```

This is the brief's native-toolchain stop condition. I did not install Python, Visual Studio Build Tools, or any workaround; no source or build-script changes were made. Electron itself downloaded successfully, but `windows-native-registry` and `node-pty` did not acquire their required Electron-native outputs.

## Safe dev-run isolation recipe

Do not launch a development instance against the production Orca profile. The development startup code explicitly honors `ORCA_DEV_USER_DATA_PATH` before Electron is ready and then records the resulting canonical path as `ORCA_USER_DATA_PATH` for daemon and CLI children.

```powershell
$repo = 'X:\factory\repos\morpheus-shell'
$profile = "$repo\tmp\slice-1-dev-user-data"

$env:ORCA_DEV_USER_DATA_PATH = $profile
$env:ORCA_USER_DATA_PATH = $profile
$env:REMOTE_DEBUGGING_PORT = '9433'

# Electron's explicit Chromium profile flag; keep it identical to the app override.
# The two `--` delimiters are intentional: pnpm forwarding, then Electron Vite -> Electron.
corepack pnpm run dev -- -- --user-data-dir="$profile"
```

`ORCA_DEV_USER_DATA_PATH` is the application-level isolation control. `--user-data-dir` is the Chromium/Electron profile flag requested for defense in depth. The explicit CDP port is localhost-only and can be checked with Playwright after startup. Record the launched PID, UTC launch time, and worktree; stop that full process tree before deleting the temporary profile.

## Known gaps / required founder action

- No `build:win` command ran, so there is no `dist/orca-windows-setup.exe` artifact to validate.
- No development Electron instance was launched, and therefore no rendered/CDP UI validation was possible. The production Orca processes and their data directories were not touched.
- No test suite ran: the dependency lifecycle did not complete.
- A founder must install a Python 3 runtime visible to `node-gyp`. Because a Windows Electron native rebuild follows, install Visual Studio 2022 Build Tools with the C++ build tools and a Windows SDK as well, then rerun the two commands above from a fresh terminal. Do not bypass or disable the native rebuild.
