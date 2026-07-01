---
phase: 03-filtering-modes-output-quality-gates
plan: 04
subsystem: testing
tags: [eslint, no-restricted-imports, module-boundary, nx-plugin, typescript, barrel-exports]

# Dependency graph
requires:
  - phase: 03-01
    provides: filterDiagnostics + FilterOptions/FilterResult (project-boundary filter)
  - phase: 03-02
    provides: evaluateResult + EvaluateOptions (pass/fail verdict, --max-warnings gate)
  - phase: 03-03
    provides: formatReport + FormatOptions (formatDiagnostics human output)
provides:
  - 'ESLint core/** module-boundary override (@typescript-eslint/no-restricted-imports) banning nx/@nx/devkit/@angular-devkit/architect/yargs + @nx/* / @angular-devkit/* families, including type-only imports'
  - 'core/** purity rules: no-console + no-restricted-properties (process.exit ban)'
  - 'Public package entry-point exports of the three Phase-3 pure functions + their option/result types for the Phase-4 adapter to compose'
  - 'Clean lint gate (nx lint exits 0) -- the pre-existing @nx/enforce-module-boundaries errors on the nodenext deep-import shim are resolved'
affects: [phase-4-nx-executor-adapter, phase-5-packaging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Lint-time framework-agnostic core boundary via a files-scoped @typescript-eslint/no-restricted-imports override (the @nx/enforce-module-boundaries rule is project/tag-granular and cannot ban a folder within one project)'
    - 'Type-only imports are also banned (allowTypeImports OMITTED -- verified default in @typescript-eslint@8.62.0)'
    - 'Targeted, documented eslint-disable directives for the two intentional exceptions (the nodenext deep-import shim; a deliberate GATE B timing console.log in a spec)'

key-files:
  created:
    - .planning/phases/03-filtering-modes-output-quality-gates/03-04-SUMMARY.md
  modified:
    - packages/angular-typechecker/src/index.ts
    - packages/angular-typechecker/eslint.config.mjs
    - packages/angular-typechecker/src/core/compiler-cli-types.ts
    - packages/angular-typechecker/src/core/gate-b.spec.ts

key-decisions:
  - 'Resolved the 2 pre-existing @nx/enforce-module-boundaries errors (owned by 03-04 per deferred-items.md / WS-04) with two targeted eslint-disable-next-line directives on the documented nodenext deep-import shim, NOT by widening the root allow regex -- keeps enforcement intact everywhere else'
  - "Kept the D-11 override scope at the plan's exact **/src/core/**/*.ts (which includes spec files); exempted the one legitimate GATE B timing console.log in gate-b.spec.ts with a targeted no-console disable rather than narrowing the scope to non-spec files"

patterns-established:
  - 'Specifier ban over folder boundary: use @typescript-eslint/no-restricted-imports (paths + patterns) scoped by a files glob to enforce an intra-project folder boundary that @nx/enforce-module-boundaries cannot express'
  - 'Pure-core lint contract: core/** carries no-console + a process.exit ban so the verdict/format functions stay pure and the adapter owns all I/O + exit'

requirements-completed: [WS-04, TEST-01]

# Metrics
duration: 12min
completed: 2026-06-27
---

# Phase 3 Plan 04: Quality Gates Summary

**Machine-enforced framework-agnostic core boundary: a files-scoped `@typescript-eslint/no-restricted-imports` ban on `core/**`(Nx/Angular-CLI families +`yargs`, incl. type-only) plus `no-console`/`process.exit`purity rules, with the three Phase-3 pure functions exported from the package entry point and a clean`nx lint` gate.\*\*

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-27T23:28:00Z
- **Completed:** 2026-06-27T23:40:18Z
- **Tasks:** 2
- **Files modified:** 4 (1 entry point, 1 ESLint config, 2 core files for the two documented exceptions)

## Accomplishments

- Exported `filterDiagnostics`/`evaluateResult`/`formatReport` (values) + `FilterOptions`/`FilterResult`/`EvaluateOptions`/`FormatOptions` (types) from `src/index.ts` so the Phase-4 Nx adapter can compose the full core contract.
- Added the D-11 `core/**` ESLint override (after the `...baseConfig` spread): `@typescript-eslint/no-restricted-imports` banning `nx`, `@nx/devkit`, `@angular-devkit/architect`, `yargs` (exact) and `@nx/*` / `@angular-devkit/*` (patterns) -- `allowTypeImports` OMITTED so type-only imports are also banned -- plus `no-console` and a `no-restricted-properties` `process.exit` ban. Scoped ONLY to `**/src/core/**/*.ts` so the future Phase-4 adapter (which legitimately imports `@nx/devkit`) is not hit.
- Left the existing `@nx/dependency-checks` (`**/*.json`) and `@nx/nx-plugin-checks` (`**/package.json`) blocks untouched (D-12).
- Resolved the 2 pre-existing `@nx/enforce-module-boundaries` errors on the nodenext deep-import shim (`compiler-cli-types.ts:15`/`:20`) that 03-04 owns per `deferred-items.md`, making the WS-04 lint gate (SC5) genuinely pass: `nx lint angular-typechecker` exits 0.
- Verified the integrated Phase-3 contract end-to-end on the main checkout (real `node_modules`): lint clean (exit 0), full unit suite green (15 files / 70 tests), build green (GATE A `import('@angular/compiler-cli')` retained), `prettier --check` clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Export the new pure functions + types from the package entry point** - `8bf3951` (feat)
2. **Task 2: Add the core/** module-boundary ESLint override (D-11) and prove lint clean + suite green\*\* - `8fa9083` (feat)

**Plan metadata:** (this commit) `docs(03-04): complete quality-gates plan`

## Files Created/Modified

- `packages/angular-typechecker/src/index.ts` - Added the three Phase-3 value re-exports + their type re-exports; preserved the existing value/type-export split and grouped ordering.
- `packages/angular-typechecker/eslint.config.mjs` - New `**/src/core/**/*.ts` override (no-restricted-imports paths+patterns, no-console, process.exit ban). Prettier-normalized the whole file to the repo's single-quote / 2-space style (existing block rule content unchanged; D-12 honored).
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` - Two targeted `eslint-disable-next-line @nx/enforce-module-boundaries` directives on the documented nodenext deep-import statements (type-only; erased at emit).
- `packages/angular-typechecker/src/core/gate-b.spec.ts` - One targeted `eslint-disable-next-line no-console` on the deliberate Phase-1 GATE B timing surface (test instrumentation, not a core-source boundary leak).

## Decisions Made

- **Boundary-error resolution via targeted eslint-disable, not allow-regex widening.** The deferred-items log assigns the 2 `@nx/enforce-module-boundaries` errors on `compiler-cli-types.ts` to this plan and names "an allow/override OR an eslint-disable" as the fix. I chose the two scoped `eslint-disable-next-line` directives (the documented nodenext deep-import workaround) over broadening the root config `allow` regex, because the disable is surgical to exactly two lines and does not weaken boundary enforcement for any other file. The directives sit on the line immediately preceding each `import` (an initial attempt that placed them above the leading comment block produced "Unused eslint-disable directive" warnings + the original errors -- corrected).
- **Kept the plan's exact `**/src/core/**/\*.ts` override scope (spec files included).** The new `no-console` rule surfaced one genuine match: a deliberate `console.log` timing surface in `gate-b.spec.ts` (Phase-1 GATE B instrumentation). Rather than narrow the scope to non-spec source (which would deviate from the plan's stated must_have/threat-model scope), I exempted that single line with a targeted `no-console` disable, consistent with the plan's "fix the offending file, do not weaken the rule" directive. The RESEARCH lint-cleanliness watch-out had anticipated the specs' `import type`/`await import` usage (not banned) but not this `console.log`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Resolved 2 pre-existing `@nx/enforce-module-boundaries` errors so the WS-04 lint gate passes**

- **Found during:** Task 2 (lint gate verification)
- **Issue:** The base tree carried 2 `@nx/enforce-module-boundaries` ERRORS on the nodenext deep-import shim (`compiler-cli-types.ts:15`/`:20`). `nx lint angular-typechecker` exited non-zero because of them, so SC5 ("lint passes clean") could not be met by adding the new override alone. The plan's task-2 action focuses on the override; `deferred-items.md` and the orchestrator brief explicitly assign resolution of these errors to 03-04 (WS-04 owner).
- **Fix:** Added two targeted `eslint-disable-next-line @nx/enforce-module-boundaries` directives (one per deep-import statement) with a reference to the file header's nodenext rationale.
- **Files modified:** `packages/angular-typechecker/src/core/compiler-cli-types.ts`
- **Verification:** `nx lint angular-typechecker` now exits 0 (0 errors; 2 pre-existing unused-vars WARNINGS remain, out of scope per `deferred-items.md`, and warnings do not affect the exit code -- no `--max-warnings` configured).
- **Committed in:** `8fa9083` (Task 2 commit)

**2. [Rule 3 - Blocking] Exempted a deliberate GATE B timing `console.log` from the new `no-console` rule**

- **Found during:** Task 2 (lint gate verification)
- **Issue:** The new `**/src/core/**/*.ts`-scoped `no-console` rule flagged `gate-b.spec.ts:99` -- a deliberate Phase-1 GATE B cold-run timing surface. This is legitimate test instrumentation in a spec, not a core-source purity leak; the D-11 intent is core SOURCE purity.
- **Fix:** Added a targeted `eslint-disable-next-line no-console` with an explanatory comment, preserving the plan's exact override scope.
- **Files modified:** `packages/angular-typechecker/src/core/gate-b.spec.ts`
- **Verification:** `nx lint angular-typechecker` exits 0; `nx test angular-typechecker` 70/70 green (the timing line still logs during the run).
- **Committed in:** `8fa9083` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking the WS-04/SC5 clean-lint gate). Both were explicitly within 03-04's declared ownership (the `compiler-cli-types.ts` boundary errors are assigned to this plan by `deferred-items.md`; the spec console.log is a direct, expected consequence of the plan's own new rule). No scope creep: the 2 pre-existing unused-vars warnings were left untouched (SCOPE BOUNDARY).
**Impact on plan:** Necessary to satisfy SC5 (lint exits 0) and the TEST-01 meta-gate. No structural change to the planned override or exports.

## Issues Encountered

- **eslint-disable directive placement.** The first attempt placed the `@nx/enforce-module-boundaries` disables above a multi-line comment block, so the directive targeted the comment (ESLint reported "Unused eslint-disable directive") while the import errors re-surfaced on their shifted line numbers. Resolved by moving each `eslint-disable-next-line` to the line immediately preceding its `import` statement.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Phase-3 core contract is complete and machine-enforced: `filterDiagnostics` + `evaluateResult` + `formatReport` are exported from the package entry point and the `core/**` framework-agnostic boundary (no Nx/Angular-CLI imports, no `console`/`process.exit`) is locked at lint time. Phase 4 can build the sub-50-line `angular-typecheck` Nx executor adapter that composes these pure functions; the adapter legitimately imports `@nx/devkit` and is intentionally NOT in the `core/**` override scope.
- `@nx/dependency-checks` remains enabled and untouched (D-12) -- it will keep the published deps honest when Phase 5 packages the plugin (the adapter's future `@nx/devkit` import is a legitimately-declared dependency).
- No blockers. The remaining 2 lint WARNINGS (`no-unused-vars` on `config-resolution.integration.spec.ts:30` and `executor.ts:16`) are pre-existing, out of scope, and tracked in `deferred-items.md`.

---

_Phase: 03-filtering-modes-output-quality-gates_
_Completed: 2026-06-27_

## Self-Check: PASSED

- FOUND: `.planning/phases/03-filtering-modes-output-quality-gates/03-04-SUMMARY.md`
- FOUND commit `8bf3951` (Task 1), FOUND commit `8fa9083` (Task 2)
- FOUND all 4 modified files (`src/index.ts`, `eslint.config.mjs`, `src/core/compiler-cli-types.ts`, `src/core/gate-b.spec.ts`)
