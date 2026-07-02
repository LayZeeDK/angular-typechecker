---
phase: 13-engine-solution-tsconfig-reference-walking
plan: 02
subsystem: test-fixtures
tags: [fixtures, walk-references, solution-tsconfig, test-substrate]
requires:
  - "fixtures/solution-style (existing) + fixtures/*/tsconfig.base.json (existing base)"
provides:
  - "fixtures/solution-style upgraded: app+spec leaves, distinct-file TS2322 each"
  - "fixtures/solution-style-overlap: lib+spec share one source (dedupe collapse substrate)"
  - "fixtures/solution-style-oop: references an existing outside leaf (boundary-skip substrate)"
  - "fixtures/solution-style-empty: files:[] + no references (90001 empty-project substrate)"
  - "fixtures/solution-style-broken-ref: real leaf + nonexistent path (D-05 90002 substrate)"
  - "fixtures/solution-style-selfref: self + duplicate leaf references (D-04 dedupe substrate)"
affects:
  - "Plan 13-05 walk-references.integration.spec.ts (consumes these fixtures)"
  - "config-resolution.integration.spec.ts solution-style block rewrite (consumes upgraded solution-style)"
tech-stack:
  added: []
  patterns:
    - "leaf tsconfig mirrors fixtures/solution-style/tsconfig.app.json compilerOptions"
    - "spec leaf adds types [vitest/globals, node]"
    - "plain TS2322 (string->number) with literal template; no interpolated signal (Pitfall 3)"
key-files:
  created:
    - fixtures/solution-style/tsconfig.spec.json
    - fixtures/solution-style/error.component.spec.ts
    - fixtures/solution-style-overlap/tsconfig.json
    - fixtures/solution-style-overlap/tsconfig.lib.json
    - fixtures/solution-style-overlap/tsconfig.spec.json
    - fixtures/solution-style-overlap/shared.component.ts
    - fixtures/solution-style-oop/tsconfig.json
    - fixtures/solution-style-empty/tsconfig.json
    - fixtures/solution-style-broken-ref/tsconfig.json
    - fixtures/solution-style-broken-ref/tsconfig.app.json
    - fixtures/solution-style-broken-ref/error.component.ts
    - fixtures/solution-style-selfref/tsconfig.json
    - fixtures/solution-style-selfref/tsconfig.app.json
    - fixtures/solution-style-selfref/error.component.ts
  modified:
    - fixtures/solution-style/tsconfig.json
    - fixtures/solution-style/error.component.ts
decisions:
  - "oop reference target = ../solution-style/tsconfig.app.json (an existing outside leaf that now carries a planted TS2322, so a no-guard baseline would leak it)"
metrics:
  duration: ~10m
  completed: 2026-07-01
  tasks: 2
  files: 16
---

# Phase 13 Plan 02: solution-style walk fixtures Summary

Upgraded `fixtures/solution-style` to a two-leaf (app + spec) walk substrate with a distinct-file
planted TS2322 in each leaf, and added five sibling fixtures (overlap, oop, empty, broken-ref,
selfref) that supply the exact substrate the Plan 13-05 walk assertions need. Pure test-data only;
no engine code.

## What Was Built

### Task 1 -- Upgraded `fixtures/solution-style` (commit 11b5d3f)

- `tsconfig.json`: added a second reference `{ "path": "./tsconfig.spec.json" }` alongside the
  existing `./tsconfig.app.json` (keeps `extends`, `compileOnSave: false`, `files: []`).
- `error.component.ts`: replaced the clean signal component with `SolutionStyleLeafComponent`
  (selector `solution-style-leaf`, `standalone: true`, template the plain literal `<p>ready</p>`)
  planting ONE TS2322 (`count: number = 'not-a-number';`). No interpolated signal, so no
  NG8117/NG8109 co-fire (Pitfall 3).
- `tsconfig.spec.json` (new): mirrors `tsconfig.app.json` compilerOptions, adds
  `"types": ["vitest/globals", "node"]` and `"files": ["error.component.spec.ts"]`.
- `error.component.spec.ts` (new): imports `SolutionStyleLeafComponent` from `./error.component`,
  plants a DISTINCT TS2322 in this file (`const specOnly: number = 'also-not-a-number';`), then
  `void specOnly; void SolutionStyleLeafComponent;`. Comment notes a build never compiles specs but
  the walk's spec leaf does -- the named build differentiator.

The two planted errors live in distinct files, so their `(file.path, start, length, code,
messageText)` identities cannot collapse under `ts.sortAndDeduplicateDiagnostics` -- the walk union
unambiguously reports both leaves (SC1/SC2 completeness proof).

### Task 2 -- Five sibling fixtures (commit 7993bc8)

- **`solution-style-overlap/`**: solution references `./tsconfig.lib.json` + `./tsconfig.spec.json`,
  BOTH listing the SAME `shared.component.ts` (one planted TS2322, `shared-not-a-number`). The
  shared diagnostic is gathered in two Programs but must collapse to ONE in the union
  (cross-Program value-dedupe proof, SC2). Spec leaf carries `types [vitest/globals, node]`.
- **`solution-style-oop/`**: `files: []` and a SINGLE reference to `../solution-style/tsconfig.app.json`
  -- an EXISTING leaf OUTSIDE this fixture directory that (post-Task-1) carries its own TS2322. The
  D-01 boundary guard must skip it (its error never leaks), and a no-guard baseline WOULD leak it.
  No local source files.
- **`solution-style-empty/`**: `{ "extends": "../../tsconfig.base.json", "files": [] }` with NO
  `references` key -- the references-less empty-project branch (90001, SC3).
- **`solution-style-broken-ref/`**: solution references a real `./tsconfig.app.json`
  (`error.component.ts` planting TS2322 `broken-ref-not-a-number`) PLUS a nonexistent
  `./tsconfig.missing.json`. Proves D-05 fold-and-count: one synthesized 90002 for the missing path
  PLUS the survivor leaf's TS2322 still reported (SC3/D-05). `tsconfig.missing.json` is genuinely
  absent from disk.
- **`solution-style-selfref/`**: solution references `./tsconfig.json` (self), `./tsconfig.app.json`,
  and `./tsconfig.app.json` again (duplicate). Real `./tsconfig.app.json` leaf plants TS2322
  `selfref-not-a-number`. Proves D-04 output-neutral dedupe + self-reference skip: the leaf's single
  TS2322 appears exactly once despite the duplicate + self edges.

## Verification

- Task 1 gate (`node -e` JSON parse: both refs present + spec leaf parseable): **OK**.
- Task 2 gate (`node -e`: all five sibling `tsconfig.json` parse + `tsconfig.missing.json` absent):
  **OK**.
- Extended acceptance checks (all pass):
  - overlap lib+spec both list `shared.component.ts`; token `shared-not-a-number` present.
  - oop reference resolves to an EXISTING tsconfig OUTSIDE the oop dir
    (`fixtures/solution-style/tsconfig.app.json`); exactly one reference.
  - empty `files: []`, NO `references` key.
  - broken-ref references both `./tsconfig.app.json` and `./tsconfig.missing.json`;
    `tsconfig.missing.json` does not exist; token `broken-ref-not-a-number` present.
  - selfref references `./tsconfig.json` and lists `./tsconfig.app.json` twice; token
    `selfref-not-a-number` present.
- All 16 files ASCII-only (LC_ALL=C non-ASCII scan clean); no `{{` interpolation; no `@ts-nocheck`
  pragma (only the "Do NOT add @ts-nocheck" instruction comment, per the fixture header convention).
- No accidental file deletions in either commit.

Full behavioral proof is deferred to Plan 13-05 (the walk-references integration spec asserts
against these fixtures once the engine exists). This plan committed pure test-data substrate only.

## Deviations from Plan

None - plan executed exactly as written. The oop reference target was left to executor discretion
per the plan action text ("FIRST confirm which sibling fixture tsconfig actually exists"); chose
`../solution-style/tsconfig.app.json` because it is an existing outside leaf whose own source
(upgraded in Task 1) carries a planted TS2322, satisfying the "no-guard baseline WOULD leak it"
requirement.

## Known Stubs

None. Every fixture is complete test-data with the exact reference/leaf/planted-error shapes the
plan specified.

## Commits

- 11b5d3f: test(core): upgrade solution-style fixture with app+spec walk leaves
- 7993bc8: test(core): add five sibling walk fixtures (overlap/oop/empty/broken-ref/selfref)
- e7c7363: docs(13-02): complete solution-style walk fixtures plan

## Self-Check: PASSED

All 16 created/modified fixture files exist on disk, the SUMMARY.md exists, and all three commits
(11b5d3f, 7993bc8, e7c7363) are present in the git log. `fixtures/solution-style-broken-ref/tsconfig.missing.json`
is confirmed ABSENT (the D-05 nonexistent-path requirement).
