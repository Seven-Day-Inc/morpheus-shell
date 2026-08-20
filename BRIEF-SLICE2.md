# Slice 2 — the upstream merge-candidate lane (charter centrifuge#1013)

You are in Seven-Day-Inc/morpheus-shell (fork of stablyai/orca, pinned
v1.4.183 on pin/v1.4.183). Build slice 2: the automation that keeps the fork
tracking upstream WITHOUT human toil. Deliver in tools/upstream/:
1. watch.mjs — checks stablyai/orca releases/tags vs our pin, emits a
   machine-readable delta (new version, commit count, changed areas).
2. candidate.mjs — given a target tag: creates branch merge-candidate/<tag>
   from our pin branch, attempts the merge from upstream, records
   conflicts-vs-clean per file to a CANDIDATE-REPORT.md, runs whatever test
   suite upstream ships (discover it; document), never force-resolves.
3. A GitHub Actions workflow (.github/workflows/upstream-watch.yml) running
   watch weekly, opening/refreshing ONE issue titled "upstream: vX available"
   with the delta when ahead.
Thin-fork law in comments: our surfaces live in added modules; candidate
merges never rewrite our panels. Tests for watch+candidate logic (mock git).
Commit to pin/v1.4.183 (or branch slice-2 off it), push, open PR to the fork
titled "slice 2: upstream merge-candidate lane". Do not stop to ask
questions.
