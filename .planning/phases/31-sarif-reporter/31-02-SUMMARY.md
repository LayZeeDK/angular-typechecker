---
phase: 31-sarif-reporter
plan: 02
subsystem: reporting
tags: [sarif, node-sarif-builder, ver-04, require-graph, lazy-import, interop, nx-plugin]

# Dependency graph
requires:
  - phase: 31-sarif-reporter
    provides: "31-01 shipped render-report.js sarif branch reached via await import('./sarif-report.js'), node-sarif-builder@^4.1.0 declared+installed, and the (mod.default ?? mod) interop cast form in sarif-report.ts"
provides:
  - "core/sarif-require-graph.spec.ts: a static require-graph guard proving the human/JSON/--help/CLI-boot paths (render-report.js + bin.js) never require node-sarif-builder nor its transitive fs-extra, with a positive control that the lazy import('./sarif-report.js') is present"
  - "core/sarif-report.interop.spec.ts: a REAL-import (not mocked) test-tier spec proving node-sarif-builder resolves via (mod.default ?? mod) and builds SARIF 2.1.0"
  - "VER-04 closed: the lazy firewall is locked (T-31-05), the CJS-under-await-import() interop is locked (T-31-06), and @nx/dependency-checks visibility is resolved at the real nx lint (T-31-07)"
affects: [32 VER-02/VER-03 SARIF schema validation + cross-OS determinism + tarball e2e + the additive-only git-diff audit vs @0.2.2 + DOC-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static require-graph laziness guard: clone the bin-static.spec.ts walk (project.json-derived distRoot, stripCommentLines, relative-require follow), retarget the forbidden regex to the deferred dependency + its top-level transitive require, and add a positive control asserting the dynamic import() is present so 'no violation' means 'lazy', not 'missing'"
    - "REAL-import (not mocked) interop spec at the test tier for a lazy-import()ed CJS dependency, typed via import type * as (raw declared namespace, no synthetic esModuleInterop default) so the (mod.default ?? mod) cast type-checks"

key-files:
  created:
    - packages/angular-typechecker/src/core/sarif-require-graph.spec.ts
    - packages/angular-typechecker/src/core/sarif-report.interop.spec.ts
  modified: []

key-decisions:
  - "Positive-control substring corrected to the ACTUAL emitted bytes import('./sarif-report.js') (single quotes + .js), NOT the plan/RESEARCH double-quoted sketch: @nx/js:tsc downlevels the async body to a tslib __awaiter generator and preserves the source single quotes + the nodenext-mandated .js"
  - "Interop cast mirrors the shipped sarif-report.ts (import type * as NodeSarifBuilder + (mod as typeof NodeSarifBuilder & { default?: typeof NodeSarifBuilder }).default ?? mod); the RESEARCH sketch's typeof mod form failed nx typecheck (TS2352) because the await import() namespace already carries a non-optional synthetic default"
  - "Task 3 A1 confirmed at the REAL nx lint (maxWarnings:0 green): @nx/dependency-checks sees the lazy await import('node-sarif-builder') via the Nx project graph, so NO ignoredDependencies entry was added -- eslint.config.mjs is byte-unchanged"

coverage:
  - id: V1
    description: "The human/JSON/--help/CLI-boot require graph (render-report.js + bin.js) never statically requires node-sarif-builder nor its transitive fs-extra; a positive control asserts the lazy import('./sarif-report.js') is present"
    requirement: "VER-04"
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-require-graph.spec.ts > require graph from render-report.js (the shared seam) never reaches node-sarif-builder or fs-extra"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-require-graph.spec.ts > require graph from bin.js (CLI boot) never reaches node-sarif-builder or fs-extra"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-require-graph.spec.ts > positive control: render-report.js reaches the reporter via a lazy dynamic import"
        status: pass
    human_judgment: false
  - id: V2
    description: "The REAL node-sarif-builder resolves via (mod.default ?? mod) into the four builder classes and a minimal run serializes to SARIF 2.1.0 -- the CJS-under-await-import() interop a mocked test cannot catch (Pitfall 9)"
    requirement: "VER-04"
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/sarif-report.interop.spec.ts > resolves the four builders via (mod.default ?? mod) and builds SARIF 2.1.0"
        status: pass
    human_judgment: false
  - id: V3
    description: "@nx/dependency-checks visibility of the lazy-only await import('node-sarif-builder') is resolved against the real nx lint (maxWarnings:0) -- green with the dep declared and NO ignoredDependencies entry (A1)"
    requirement: "VER-04"
    verification:
      - kind: unit
        ref: "nx lint angular-typechecker (@nx/dependency-checks, maxWarnings:0) -- All files pass linting"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-18
status: complete
---

# Phase 31 Plan 02: VER-04 guards Summary

**Two test-tier specs that LOCK Phase-31's lazy SARIF boundary: a static require-graph guard proving `node-sarif-builder` (+ its transitive `fs-extra`) never reach the human/JSON/`--help`/CLI-boot paths (from `render-report.js` and `bin.js`, with a positive control that the lazy `import('./sarif-report.js')` is present), and a REAL-import (not mocked) interop spec proving the CJS-under-`await import()` shape resolves via `(mod.default ?? mod)` and builds SARIF 2.1.0 -- with `@nx/dependency-checks` visibility resolved green at the real `nx lint` (A1: no `ignoredDependencies` entry).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-18
- **Tasks:** 3 (2 producing a spec + committed; 1 resolve-at-execute with no change)
- **Files modified:** 2 (2 created, 0 modified)

## Accomplishments

- `core/sarif-require-graph.spec.ts` (VER-04 / D-03, T-31-05): clones the `bin-static.spec.ts` static require-graph walk (project.json-derived `distRoot`, `stripCommentLines`, relative-`require` follow) with three retargets -- the forbidden regex `/^(node-sarif-builder|fs-extra)$/`, and BOTH the built `render-report.js` (the shared seam all three formats pass through) and the built `bin.js` (explicit CLI-boot proof) as entry points. Because the `sarif` branch reaches the reporter via `await import(...)` -- never `require(...)` -- the walk never enters `sarif-report.js`, so the SARIF dependency never appears; both walks assert `violations === []`. A positive control asserts the comment-stripped `render-report.js` contains `import('./sarif-report.js')`, so "no violation" provably means "lazy", not "the module was deleted/unreferenced".
- `core/sarif-report.interop.spec.ts` (VER-04 / D-03, T-31-06): a test-tier spec (node_modules only, mirroring `compiler-loader.spec.ts`) that does the GENUINE `await import('node-sarif-builder')` (NO `vi.mock`), resolves the four builders (`SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder`) via the defensive `(mod.default ?? mod)` access, and asserts a minimal `initSimple` + `addRun` run serializes to `version: '2.1.0'` -- catching a CJS-under-`await import()` interop-shape drift a mocked unit test would miss.
- Task 3 (VER-04 / D-05 / A1, T-31-07): resolved `@nx/dependency-checks`' visibility of the lazy-only dynamic import against the REAL `nx lint angular-typechecker` (maxWarnings:0). It passes green with `node-sarif-builder` declared and NO `ignoredDependencies` entry -- Nx's project graph sees the dynamic `import('node-sarif-builder')`. `eslint.config.mjs` is byte-unchanged (A1 confirmed, matching 31-01's finding).

## Task Commits

1. **Task 1: Static require-graph guard (VER-04 / D-03)** - `3ef131f` (test)
2. **Task 2: REAL-import node-sarif-builder interop spec (VER-04 / D-03)** - `6a7da23` (test)
3. **Task 3: Resolve @nx/dependency-checks visibility (VER-04 / D-05 / A1)** - no commit (no file change; `nx lint` green with no `ignoredDependencies` entry)

## Files Created/Modified

- `packages/angular-typechecker/src/core/sarif-require-graph.spec.ts` - NEW static require-graph guard (render-report.js + bin.js walks + positive control), 152 lines
- `packages/angular-typechecker/src/core/sarif-report.interop.spec.ts` - NEW REAL-import CJS interop spec, 50 lines
- `packages/angular-typechecker/eslint.config.mjs` - UNCHANGED (Task 3: A1 confirmed, no `ignoredDependencies` entry needed)

## Decisions Made

- **Positive-control substring = the ACTUAL emitted bytes `import('./sarif-report.js')`.** The plan truths/acceptance and the 31-RESEARCH sketch used a double-quoted `import("./sarif-report")` (no `.js`); the 31-01 note corrected it to a double-quoted `.js` form. The real `@nx/js:tsc` output is neither: the async body is downleveled to a tslib `__awaiter` generator (`yield import(...)`) and the specifier keeps the SOURCE's SINGLE quotes plus the nodenext-mandated `.js` -> `import('./sarif-report.js')`. The guard asserts that exact substring on the comment-stripped source.
- **Interop cast mirrors the shipped `sarif-report.ts`, not the RESEARCH sketch.** `import type * as NodeSarifBuilder from 'node-sarif-builder'` gives the RAW declared namespace (no synthetic esModuleInterop `default`); `(mod as typeof NodeSarifBuilder & { default?: typeof NodeSarifBuilder }).default ?? mod` type-checks cleanly. The sketch's `typeof mod` form fails `nx typecheck` (TS2352) because the `await import()` namespace already carries a non-optional synthetic `default`.
- **No `ignoredDependencies` entry (A1).** Resolved at the real `nx lint` per D-05; `@nx/dependency-checks` sees the lazy dynamic import, so declaring `node-sarif-builder` satisfies the rule. `eslint.config.mjs` peer ranges are untouched (no `eslint --fix`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Interop cast `typeof mod` did not type-check (TS2352)**
- **Found during:** Task 2 (`nx typecheck` gate, before the commit landed)
- **Issue:** The 31-RESEARCH sketch's `(mod as { default?: typeof mod } & typeof mod).default ?? mod` failed `nx typecheck` with TS2352 -- the `await import('node-sarif-builder')` namespace already carries a non-optional synthetic esModuleInterop `default`, which conflicts with the optional `default?: typeof mod` in the intersection.
- **Fix:** Mirrored the shipped `sarif-report.ts` interop form: added `import type * as NodeSarifBuilder from 'node-sarif-builder'` (raw declared namespace, no synthetic default) and cast via `(mod as typeof NodeSarifBuilder & { default?: typeof NodeSarifBuilder }).default ?? mod`.
- **Files modified:** packages/angular-typechecker/src/core/sarif-report.interop.spec.ts
- **Verification:** `nx typecheck` green after the fix; `nx test` proves the real interop builds SARIF 2.1.0.
- **Committed in:** `6a7da23` (Task 2 commit, fixed before landing)

**2. [Rule 1 - Correction] Positive-control substring corrected to the real emitted bytes**
- **Found during:** Task 1 (reading the built `dist/.../render-report.js` before writing the assertion)
- **Issue:** The plan/RESEARCH sketch and the 31-01 note assumed a DOUBLE-quoted specifier (`import("./sarif-report")` / `import("./sarif-report.js")`). The actual `@nx/js:tsc` emit is `yield import('./sarif-report.js')` -- SINGLE quotes (the source quote style, preserved through the async->tslib-`__awaiter` downlevel) with the nodenext-mandated `.js`. A double-quoted assertion would fail against the shipped dist.
- **Fix:** Asserted `import('./sarif-report.js')` (single quotes, `.js`) on the comment-stripped source, with a code comment explaining the emitted shape.
- **Files modified:** packages/angular-typechecker/src/core/sarif-require-graph.spec.ts
- **Verification:** `nx test` positive-control assertion green against the built dist.
- **Committed in:** `3ef131f` (Task 1 commit, correct on first landing)

---

**Total deviations:** 2 auto-fixed (1 blocking type error, 1 build-output substring correction). Both are test-assertion corrections against the real toolchain output; neither changes production code or plan scope.

## Threat Model Coverage

All three registered threats are LOCKED by this plan's guards (no new surface introduced -- this is a verification-only plan, no runtime code, no new dependency):

| Threat ID | Disposition | Lock |
|-----------|-------------|------|
| T-31-05 (lazy firewall regression to eager load) | mitigate | `sarif-require-graph.spec.ts`: a static require-graph regression to a top-level `import 'node-sarif-builder'`/`fs-extra` on the render-report.js/bin.js graph fails CI; positive control proves the lazy import is present |
| T-31-06 (CJS-under-await-import() interop drift) | mitigate | `sarif-report.interop.spec.ts`: the REAL (not mocked) import + `(mod.default ?? mod)` + SARIF 2.1.0 assertion catches an interop-shape break |
| T-31-07 (manifest dependency-classification integrity) | mitigate | `@nx/dependency-checks` (maxWarnings:0) keeps `node-sarif-builder` honestly classified; resolved at the real `nx lint` with no `eslint --fix` (peer ranges untouched) |

No new threat surface flagged.

## Additive-only Charter (D-08)

Holds by construction: no production code changed, no new dependency, no version bump, and the public barrel / `index.drift.ts` / `builder.ts` / `sarif-report.ts` / `extended-catalog.ts` are all byte-unchanged. This plan adds only two `.spec.ts` files (excluded from the published tarball via `tsconfig.lib.json` test excludes + the `files` whitelist).

## Verification Gates (all green)

- `nx test angular-typechecker` -- 521 passed (50 files), incl. `sarif-require-graph.spec.ts` (3) + `sarif-report.interop.spec.ts` (1); builds dist first via `dependsOn: build`.
- `nx typecheck angular-typechecker` -- green (spec type-check + drift; the separate gate `nx test` does NOT cover).
- `nx lint angular-typechecker` (maxWarnings:0) -- green (Task 3 A1 resolved: no `ignoredDependencies` entry).
- `nx format:check` -- green.

## Issues Encountered

- **Emitted dynamic-import quote style (Deviation 2):** required reading the actual built `render-report.js` before writing the positive control -- the RESEARCH/plan/31-01 prose all mispredicted the quote style/extension. Confirms the standing repo lesson to verify against the real toolchain output, not the sketch.
- **Interop cast typing (Deviation 1):** `nx test` (esbuild, transpile-only) would have masked the TS2352 -- only `nx typecheck` (tsc over `tsconfig.spec.json`) caught it, reaffirming the repo rule that `nx test` does not type-check specs.

## Next Phase Readiness

- **VER-04 is closed:** the lazy firewall (require-graph), the CJS interop (real-import), and the dependency-checks visibility (real lint) are all locked in CI.
- **Phase 32 (VER-02/VER-03/ADD-01/DOC-01)** owns full SARIF 2.1.0 schema validation (ajv/golden-schema drift-lock), cross-OS/Node byte-determinism, the shipped-tarball e2e across all three adapters, the additive-only git-diff audit vs `@0.2.2`, and README `## Machine-readable output` + curated CHANGELOG.
- Additive-only holds; the milestone stays a patch bump `0.2.2 -> 0.2.3`.

---
*Phase: 31-sarif-reporter*
*Completed: 2026-07-18*

## Self-Check: PASSED

- Both created spec files exist on disk (`sarif-require-graph.spec.ts`, `sarif-report.interop.spec.ts`).
- Both task commits exist in history (`3ef131f`, `6a7da23`).
- Gates green: `nx test` (521), `nx typecheck`, `nx lint` (maxWarnings:0), `nx format:check`.
