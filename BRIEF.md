# Slice 1 — Morpheus Shell foundation (charter: centrifuge#1013)

You are the foundation seat for Seven-Day-Inc/morpheus-shell — our MIT fork
of stablyai/orca, pinned at tag v1.4.183 (you are on branch pin/v1.4.183).
This slice is PROOF, not features: make the fork build and run on THIS
Windows rig, and document exactly how.

1. **Survey the build system** (package.json / turbo / electron config —
   whatever upstream uses). Identify the dev-run path and the package path.
2. **Install + build.** Use X: for any heavy caches if configurable. Fix
   NOTHING except what Windows requires to build — every deviation from
   stock gets a one-line note.
3. **Prove dev-run:** launch the built app locally (it will be a second Orca
   instance — do NOT let it adopt the production Orca's data dir; isolate
   its userData/profile dir explicitly and DOCUMENT the isolation flag; the
   production Orca running on this rig must be untouched).
4. **Document:** BUILD.md at repo root — prerequisites found on this rig,
   exact commands, build time, the isolation recipe, every Windows-specific
   note, and a KNOWN-GAPS list (anything that failed, honestly).
5. **Commit** BUILD.md + any minimal build fixes to pin/v1.4.183, push the
   branch to origin (Seven-Day-Inc/morpheus-shell), and open a PR to the
   fork's default branch titled "slice 1: pinned foundation builds on the
   rig". Two commits max.

Never touch the production Orca's processes, config, or data. If the build
is impossible without something founder-only (a native toolchain install),
STOP and write the exact blocker into BUILD.md instead of working around it.

<!-- WORKER-HYGIENE-FOOTER:START -->
## Mandatory worker hygiene
- Install dependencies once. Start no server unless the task requires it; build once, never watch.
- Use only assigned ports. Record each started PID, launch time, and worktree path.
- Before DONE.marker, stop the full process tree you started.
- Write DONE.marker last, after teardown and all other work.
- Retire the terminal and worktree the same day after the lane lands.
<!-- WORKER-HYGIENE-FOOTER:END -->
