---
phase: 13-engine-solution-tsconfig-reference-walking
plan: 01
subsystem: core
tags: [engine, path-canonicalization, reuse, visibility]
requires:
  - packages/angular-typechecker/src/core/filter-diagnostics.ts (existing createCanonicalizer + isUnderDir helpers)
provides:
  - Exported createCanonicalizer + isUnderDir from filter-diagnostics.ts (reusable realpath/case-fold path-containment machinery for the Phase 13 walk)
affects:
  - packages/angular-typechecker/src/core/walk-references.ts (Plan 13-03 imports these)
tech-stack:
  added: []
  patterns:
    - "Existing export style of filterDiagnostics as the visibility analog"
key-files:
  created: []
  modified:
    - packages/angular-typechecker/src/core/filter-diagnostics.ts
decisions:
  - "Export from filter-diagnostics.ts (smallest delta) rather than extracting a new path-canonicalize.ts module -- RESEARCH Open Question 1 / Pitfall 6"
  - "isNodeModulesPath stays module-private (the walk does not need it; minimize public surface)"
metrics:
  duration: ~6 min
  completed: 2026-07-01
  tasks: 1
  files: 1
requirements: [WALK-01]
---

# Phase 13 Plan 01: Export path-canonicalization helpers Summary

Exported the module-private `createCanonicalizer` and `isUnderDir` helpers from
`filter-diagnostics.ts` so the Phase 13 reference-walk (`walk-references.ts`, Plan 13-03) can
reuse the SAME realpath/case-fold path-containment machinery verbatim -- no duplicate
canonicalizer. Pure visibility change: two `export` keywords added, bodies and doc-comments
byte-unchanged; `isNodeModulesPath` stays private.

## What Was Built

- `packages/angular-typechecker/src/core/filter-diagnostics.ts`: added the `export` keyword to
  exactly two declarations -- `function createCanonicalizer` (~:128) and `function isUnderDir`
  (~:184). No signature change, no body change, no doc-comment change, no new imports.

This satisfies WALK-01's D-01 mandate ("reuse tested machinery verbatim"): the Plan 13-03
boundary guard (T-13-01 mitigation ENABLER) and D-04 self-reference/leaf dedupe now import the
identical containment logic instead of re-implementing it, so the guard cannot silently diverge
from the tested filter.

## Task Commits

| Task | Name                                                          | Commit  | Files                                                        |
| ---- | ------------------------------------------------------------- | ------- | ------------------------------------------------------------ |
| 1    | Export createCanonicalizer and isUnderDir from filter-diagnostics.ts | fbf3573 | packages/angular-typechecker/src/core/filter-diagnostics.ts |

## Verification

- `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache`: **PASS** -- 24 test files, 183
  tests passed (no behavior change; existing filter-diagnostics coverage stays green).
- `git grep -c "export function createCanonicalizer" -- .../filter-diagnostics.ts` -> 1 (exactly one match).
- `git grep -c "export function isUnderDir" -- .../filter-diagnostics.ts` -> 1 (exactly one match).
- `git grep -c "export function isNodeModulesPath" -- .../filter-diagnostics.ts` -> 0 (stays private).
- No `console.`/`process.` token added under `packages/angular-typechecker/src/core/**` (core purity
  preserved; the pre-existing matches are all in doc-comments describing the purity policy or in a
  `.spec.ts` timing log, none added by this change).
- Diff stat: 1 file changed, 2 insertions(+), 2 deletions(-) -- exactly the two `export` keywords.

## Deviations from Plan

None - plan executed exactly as written.

## Notes for the Next Plan

- Plan 13-03 (`walk-references.ts`) imports `{ createCanonicalizer, isUnderDir }` from
  `./filter-diagnostics` for the D-01 boundary guard and D-04 self-ref/leaf dedupe. The single
  implementation is now the only one -- do NOT add a second canonicalizer.
- `isNodeModulesPath` remains private; if a future plan needs it, export it the same way.

## Self-Check: PASSED

- FOUND: `packages/angular-typechecker/src/core/filter-diagnostics.ts` (modified)
- FOUND: `.planning/phases/13-engine-solution-tsconfig-reference-walking/13-01-SUMMARY.md` (created)
- FOUND commit fbf3573 (feat: export helpers)
- FOUND commit 2841586 (docs: SUMMARY)
- STATE.md / ROADMAP.md untouched (worktree mode; orchestrator owns those writes)
