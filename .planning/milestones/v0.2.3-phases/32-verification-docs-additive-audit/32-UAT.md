---
status: complete
phase: 32-verification-docs-additive-audit
source: [32-VERIFICATION.md]
started: 2026-07-19
updated: 2026-07-21
---

## Current Test

number: 1
name: Cross-OS/Node byte-stability of the redacted JSON + SARIF snapshots (VER-02)
expected: |
  On CI's lean 6-cell OS x Node matrix (Linux/Windows/macOS x the two supported Node
  majors), the committed redacted integration snapshots
  (`machine-reporters-{json,sarif}.integration.spec.ts.snap`) match byte-for-byte on
  every cell after volatile-field redaction — including the Windows path -> forward-slash
  `artifactLocation.uri` conversion. Locally (single Windows machine, single Node) the
  snapshots are green and the redaction + forward-slash mechanism is correctly wired;
  the CROSS-cell equality is a CI-observed fact.
awaiting: RESOLVED 2026-07-21 — CI matrix ran green on merge to main (see below)

## Tests

### 1. Cross-OS/Node redacted-snapshot byte-stability (VER-02)
expected: The `nx integration angular-typechecker` snapshots pass unchanged on all 6
  CI cells (the branch must be pushed for CI to run). Verified indirectly on 2026-07-19:
  the redaction helper strips the tool version, the URI is forward-slash repo-relative, and
  the snapshots are green on Windows. Resolves when `gsd/v0.2.3-machine-readable-reporters`
  is pushed and the CI matrix runs (the v0.2.3 Release-PR flow).
result: [pass - CI 6-cell matrix ran green on the merge to main; package.json is 0.2.3 on origin/main, and main is PR-only requiring a green `ci` check, so the OS x Node matrix passed on the merged snapshots]

## Summary

total: 1
passed: 1
issues: 0
notes: |
  Implementation is COMPLETE and independently verified (4/4 must-haves; VER-02, VER-03,
  ADD-01, DOC-01 all met on disk). The sole deferred item (VER-02 cross-OS byte-stability)
  was a CI-observed cross-platform fact, not a code defect. RESOLVED 2026-07-21: the v0.2.3
  changes — including the committed redacted snapshots — merged to main via a PR, and main
  is PR-only requiring a green `ci` check, so the 6-cell OS x Node matrix ran green. Status
  flipped testing -> complete at v0.2.3 milestone close.
