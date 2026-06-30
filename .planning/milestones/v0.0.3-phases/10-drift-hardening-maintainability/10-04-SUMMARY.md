---
phase: 10-drift-hardening-maintainability
plan: 04
subsystem: core
tags: [hard-05, regression-test, diagnostics, render-report, integration-spec]
requires:
  - render-report.ts (the renderReport seam loading the real cli.formatDiagnostics)
  - diagnostic-codes.ts (the NG() symbolic encoder)
  - run-typecheck.ts (runTypecheck against a fixture tsconfig)
  - fixtures/extended-promoted (a real NG8101 producer)
provides:
  - HARD-05 TS-99 leak regression on the color:false output path via the real cli.formatDiagnostics
affects:
  - packages/angular-typechecker test suite (one new integration-tier spec)
tech-stack:
  added: []
  patterns:
    - "Integration-spec fixture-path resolution (fileURLToPath/packageRoot/workspaceRoot)"
    - "Real-cli.formatDiagnostics rendering seam via renderReport({ color: false })"
    - "Symbolic NG(code) assertions (never the bare 4-digit)"
key-files:
  created:
    - packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts
  modified: []
decisions:
  - "Routed the spec through renderReport (the real cli.formatDiagnostics seam) rather than a TypeScript-formatter fake, so the spec exercises Angular's runtime TS-to-NG rewrite and cannot pass vacuously while production leaks TS-998101 (D-11, threat T-10-04-01)."
  - "Reused the committed extended-promoted fixture (NG8101 as Error) as the real NG8xxx producer (10-RESEARCH A3) rather than a hand-built diagnostic with a fabricated negative code."
  - "Rephrased the explanatory comment block to avoid the literal tokens ts.formatDiagnostics / vi.fn / replaceTsWithNgInErrors so the acceptance grep (git grep -c ... returns 0) is honored exactly while keeping the rationale documented."
metrics:
  duration: ~6 min
  completed: 2026-06-30
  tasks: 1
  files: 1
---

# Phase 10 Plan 04: HARD-05 TS-99 Leak Regression Summary

A new integration-tier spec proves no `TS-99` substring survives the `color: false`
output path while an `NG####` label still renders, exercising the REAL
`@angular/compiler-cli` formatter's TS-to-NG rewrite through the existing
`renderReport` seam against the committed `extended-promoted` (NG8101) fixture.

## What Was Built

- **`packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts`** (new,
  integration tier). The single test:
  1. Resolves the `extended-promoted` fixture `tsconfig.app.json` via the
     `fileURLToPath`/`packageRoot`/`workspaceRoot` idiom (the established integration
     -spec convention).
  2. Runs `runTypecheck({ tsConfigPath })` and sanity-asserts a real NG8xxx is
     present: `result.diagnostics.some((d) => d.code === NG(8101))` -- asserting the
     NG code **symbolically** via `NG` from `./diagnostic-codes`, never the bare
     `8101` (which would never match the negative-encoded `-998101`).
  3. Renders via the REAL seam: `await renderReport({ diagnostics }, { color: false })`
     -- `renderReport` loads the real `cli.formatDiagnostics`, which runs Angular's
     internal TS-to-NG rewrite.
  4. Asserts BOTH the positive `expect(out).toMatch(/NG\d{4}/)` (an NG#### label
     rendered) AND the negative `expect(out).not.toContain('TS-99')` (no raw,
     un-rewritten negative NG code leaked).

## Why It Matters

HARD-05 is the only requirement that guards a RUNTIME rewrite (Angular's
TS-to-NG error-code rewrite), not a type or config. That rewrite helper is declared
in `index.d.ts` but is NOT exported from the runtime bundle, so it cannot be called
directly, and a TypeScript-formatter fake does NOT run it -- such a fake would pass
VACUOUSLY while production leaks `TS-998101`. Routing through `renderReport` (the
real `cli.formatDiagnostics`) is what makes the regression load-bearing.

## Verification

- `NX_DAEMON=false npx nx run angular-typechecker:test --skip-nx-cache -t "TS-99"`:
  GREEN. The new file reports `src/core/ts99-leak.integration.spec.ts (1 test)` ->
  `renders an NG#### label and NO TS-99 substring on the color:false path`; full
  suite `Tests 144 passed (144)`.
- Acceptance grep `git grep -c "ts.formatDiagnostics\|vi.fn\|replaceTsWithNgInErrors"
  -- packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts` returns
  no matches (0) -- no fake formatter, no direct rewrite call.
- Spec routes through `renderReport(...)`; asserts BOTH `toMatch(/NG\d{4}/)` and
  `not.toContain('TS-99')`; sanity-checks the symbolic `NG(8101)`; uses a real
  fixture via `runTypecheck`.
- ASCII-only (verified: no non-ASCII bytes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Rephrased comment block to satisfy the acceptance grep exactly**
- **Found during:** Task 1 (acceptance-criteria verification)
- **Issue:** The initial explanatory comment block named the forbidden approaches
  using their literal tokens (`ts.formatDiagnostics`, `vi.fn`,
  `replaceTsWithNgInErrors`) to document WHY they must not be used. That tripped the
  plan's literal acceptance grep (`git grep -c ... returns 0`) even though none were
  actual code usage -- all 6 hits were in comments.
- **Fix:** Rewrote the comment block to describe the forbidden approaches in prose
  ("TypeScript's own diagnostic formatter", "the TS-to-NG rewrite helper", "a mocked
  formatter") without the literal greppable tokens, preserving the full rationale.
  The spec's actual logic was unchanged.
- **Files modified:** packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts
- **Commit:** e2e0580
- **Re-verified:** acceptance grep now returns 0; test still green (144 passed).

## Commits

- `e2e0580` test(10): add HARD-05 TS-99 leak regression via real cli.formatDiagnostics

## Threat Surface Scan

No new security-relevant surface. The spec reads a committed in-repo fixture and
exercises the already-installed `@angular/compiler-cli` rewrite via the production
render path -- no network, no secrets, no new endpoints, no package installs (D-03:
zero new dependency). T-10-04-01 (a fake formatter masking a leak) is mitigated by
routing through the real `cli.formatDiagnostics` and by the acceptance grep that
forbids fakes/direct-rewrite calls in the file.

## Known Stubs

None. The spec exercises real production code against a real fixture; no placeholder
values, no mock data sources.

## Self-Check: PASSED

- Created file exists: packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts -- FOUND
- Commit exists: e2e0580 -- FOUND
