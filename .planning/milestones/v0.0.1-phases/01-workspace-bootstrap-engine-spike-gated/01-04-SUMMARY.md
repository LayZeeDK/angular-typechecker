---
phase: 01-workspace-bootstrap-engine-spike-gated
plan: 04
subsystem: testing
tags: [gate-a, gate-b, vitest, performCompilation, all-getter, ng8109, nodenext, esm-cjs-bridge, differential, go-no-go]

# Dependency graph
requires:
  - phase: 01-03
    provides: "tracer-bullet core (loadCompilerCli memoized await import, gatherAllDiagnostics 6-getter, runTypecheck->CoreResult); thin CJS executor stub; out-of-graph TS2322+NG8109 fixture (app+lib tsconfigs); built dist (compiler-loader.js retains literal import('@angular/compiler-cli')); compiler-cli-types nodenext shim; project.json build.options.outputPath=dist/packages/angular-typechecker"
provides:
  - "GATE A static spec (gate-a-static.spec.ts): reads BUILT dist core/compiler-loader.js + executor.js via fs.readFileSync; positive /import\\(/ on compiler-loader.js, negative /require\\([\"']@angular\\/compiler-cli/ on BOTH (comment-stripped); dist path derived from project.json outputPath"
  - 'GATE B spec (gate-b.spec.ts): describe.each([app,lib]) positive (2322 + -998109, no 500) + differential (default 2322 not -998109) + runtime resolution guard + cold-run durationMs'
  - 'GREEN full suite: nx build angular-typechecker && nx test angular-typechecker (4 files, 12 tests, all pass)'
  - 'Explicit GO verdict against all 6 go/no-go checklist items with reproduced diagnostic-code evidence'
affects: [phase-2-core-engine, phase-3-filtering, phase-4-executor, phase-6-e2e]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'GATE A static: derive dist path from project.json build.options.outputPath at runtime (no hard-coded literal); fs.readFileSync (dist is gitignored -> never git grep); strip //-comment lines before regex (a comment naming the package must not false-pass positive nor false-fail negative)'
    - "GATE A core/adapter split: positive /import\\(/ asserted on core/compiler-loader.js (where the await import lives), not executor.js; negative require-call asserted on BOTH built files"
    - 'GATE B differential: drive ng.defaultGatherDiagnostics vs gatherAllDiagnostics off the SAME parsed config, spreading a FRESH { ...options, noEmit: true } per performCompilation call (no shared mutable noEmit)'
    - "GATE B code assertions on encoded values: TS2322 raw (2322); NG8109 negative-encoded (-998109 = parseInt('-99'+8109)); recovery helper Math.abs(c)-990000===8109; NG8117 (-998117) expected companion; UNKNOWN_ERROR_CODE 500 MUST be absent"
    - 'describe.each([app,lib]) parameterizes the breadth gate (one app + one local-library tsconfig) in a single spec'

key-files:
  created:
    - 'packages/angular-typechecker/src/executors/angular-typecheck/gate-a-static.spec.ts (GATE A static; reads built artifacts)'
    - 'packages/angular-typechecker/src/core/gate-b.spec.ts (GATE B positive + differential + breadth + runtime guard + timing)'
    - '.planning/phases/01-workspace-bootstrap-engine-spike-gated/deferred-items.md (pre-existing lint findings, out-of-scope; WS-04/Phase 3)'
  modified: []

key-decisions:
  - 'GATE B asserts the NEGATIVE-ENCODED NG8109 value -998109 (NOT bare 8109, which never appears on ts.Diagnostic.code), plus a self-documenting Math.abs(c)-990000===8109 recovery assertion (RESEARCH-ADDENDUM-WAVE3 Finding 3 / D-17).'
  - 'GATE A positive targets the BUILT core/compiler-loader.js (the await import lives in core per the core/adapter split, Finding 2), not executor.js; the negative require-call assertion covers BOTH built files with comment-stripping (executor.js names the package in a JSDoc comment).'
  - 'Spike GO/NO-GO = GO: all six checklist items pass against reproduced evidence (app + lib all-getter [2322,-998109,-998117]; ngc default [2322]); Phase 2 may begin.'

patterns-established:
  - 'Gate assertions are committed Vitest tests, not throwaway probes; the build precedes the static read via the full-suite command nx build && nx test'
  - 'Out-of-scope lint findings logged to phase deferred-items.md rather than fixed (scope boundary; ESLint enforcement is WS-04/Phase 3)'

requirements-completed: [WS-02, WS-03, ENG-03]

# Metrics
duration: ~25min
completed: 2026-06-27
---

# Phase 01 Plan 04: Gate Specs + Full Suite + GO/NO-GO Decision Summary

**The six-item spike go/no-go checklist is now an automated Vitest suite: GATE A static reads the built `dist` `core/compiler-loader.js` and asserts the literal `import(` survived `module: nodenext` emit (no `require('@angular/compiler-cli')` in either built file), and GATE B drives the unconditional all-getter against both the app and local-library fixture tsconfigs and proves it surfaces TS2322 AND the negative-encoded NG8109 (`-998109`) where `ngc`'s `defaultGatherDiagnostics` returns only `[2322]` -- `nx build && nx test` is green (4 files, 12 tests), the cold-run wall-clock is recorded, and the explicit verdict is GO.**

## SPIKE VERDICT: GO

All six go/no-go checklist items (CONTEXT.md "Spike go/no-go checklist") PASS against reproduced evidence. Per the ROADMAP GATED note, **Phase 2 (the real engine) may begin.**

### GO / NO-GO ledger (all six items)

| #   | Checklist item                                                                                                                        | Verdict | Evidence (this session)                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **[A static]** built `compiler-loader.js` matches `/import\(/`; neither built file matches `/require\(["']@angular\/compiler-cli/`    | **GO**  | `gate-a-static.spec.ts` 3 tests pass against the freshly-built dist; `compiler-loader.js:19` holds `yield import('@angular/compiler-cli')`, `executor.js` names the package only in a JSDoc comment (comment-stripped negative).                                                           |
| 2   | **[A runtime]** `require()`-ing the built CJS executor + triggering the loader resolves compiler-cli (no `ERR_REQUIRE_ESM`, no `500`) | **GO**  | `gate-b.spec.ts` awaits `loadCompilerCli()` -> `performCompilation` and asserts `not.toContain(500)`; both runs resolve (a failed `await import()` would reject). The Plan 03 end-to-end `require()`-load of the built executor against the fixture already ran with no `ERR_REQUIRE_ESM`. |
| 3   | **[B positive]** all-getter returns codes incl. BOTH `2322` and NG8109 (`-998109`)                                                    | **GO**  | app + lib all-getter codes = `[2322, -998109, -998117]`. `toContain(2322)`, `toContain(-998109)`, and `Math.abs(c)-990000===8109` all pass.                                                                                                                                                |
| 4   | **[B differential]** `defaultGatherDiagnostics` on the same config returns `2322` but NOT `-998109`                                   | **GO**  | app + lib ngc default codes = `[2322]`. `toContain(2322)` + `not.toContain(-998109)` pass -- the &&-chain short-circuit the all-getter overcomes is proven.                                                                                                                                |
| 5   | **[B breadth]** items 3-4 hold for one app tsconfig AND one local-library tsconfig                                                    | **GO**  | `describe.each([['app tsconfig', ...], ['local-library tsconfig', ...]])` -- identical arrays for both variants (table above).                                                                                                                                                             |
| 6   | **[timing]** one cold-run wall-clock recorded                                                                                         | **GO**  | `[GATE B timing] cold-run durationMs = 296.82` (logged once from a `runTypecheck` call on the lib fixture).                                                                                                                                                                                |

**GO iff 1-6 all hold -> they do -> GO.**

### Exact diagnostic-code arrays observed

| fixture tsconfig                          | all-getter (`gatherAllDiagnostics`) | ngc default (`defaultGatherDiagnostics`) |
| ----------------------------------------- | ----------------------------------- | ---------------------------------------- |
| `fixtures/gate-b-error/tsconfig.app.json` | `[2322, -998109, -998117]`          | `[2322]`                                 |
| `fixtures/gate-b-error/tsconfig.lib.json` | `[2322, -998109, -998117]`          | `[2322]`                                 |

Encoding (confirmed at runtime): `ngErrorCode(8109) = -998109` (NG8109 INTERPOLATED_SIGNAL_NOT_INVOKED), `ngErrorCode(8117) = -998117` (NG8117 UNINVOKED_FUNCTION_IN_TEXT_INTERPOLATION, the expected `{{ status }}`-signal companion), `UNKNOWN_ERROR_CODE = 500` (absent from both sets). TS2322 is raw (not offset).

### Spike-run environment

- **Node:** v24.18.0 (in-range `^24.15.0`).
- **Toolchain:** `@angular/compiler-cli` 22.0.4, `typescript` 6.0.3, `nx` 23.0.1, `vitest` 4.1.9.
- **Cold-run durationMs:** 296.82 (one `runTypecheck` cold run on the lib fixture; not a pass/fail threshold in Phase 1, recorded per gate item 6).

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-27T16:29:54Z
- **Completed:** 2026-06-27T16:34:31Z
- **Tasks:** 3 (Task 1, Task 2 authored specs; Task 3 ran the suite + recorded the verdict)
- **Files created:** 3 (2 spec files + deferred-items.md); 0 modified

## Accomplishments

- GATE A static is a committed Vitest spec reading the BUILT `dist` artifacts (path derived from `project.json` `build.options.outputPath`, never hard-coded; `fs.readFileSync`, never `git grep` on gitignored `dist`).
- GATE B is a committed `describe.each([app,lib])` spec proving positive (2322 + -998109), differential (ngc 2322 not -998109), breadth, the runtime no-500 guard, and a recorded cold-run timing.
- `npx nx build angular-typechecker && npx nx test angular-typechecker` is GREEN (4 test files, 12 tests; WS-03 satisfied with many green tests).
- An explicit GO verdict against all six checklist items is documented with reproduced diagnostic-code arrays.

## Task Commits

Each task committed atomically (files staged by name; no `git add .`; normal commits with hooks, no `--no-verify`):

1. **Task 1: Author the GATE A static spec** - `a904281` (test)
2. **Task 2: Author the GATE B spec (positive + differential + breadth + runtime + timing)** - `0291b67` (test)
3. **Task 3: Run the full suite + record GO/NO-GO** - no source change; the verdict + evidence live in this SUMMARY (deferred-items.md committed with the plan metadata).

**Plan metadata:** (final commit) (docs: complete plan -- SUMMARY.md + STATE.md + ROADMAP.md + deferred-items.md)

## Files Created/Modified

- `packages/angular-typechecker/src/executors/angular-typecheck/gate-a-static.spec.ts` - GATE A static: reads built `core/compiler-loader.js` (positive `/import\(/`) + `executor.js` (negative require-call), comment-stripped, path derived from `project.json` outputPath.
- `packages/angular-typechecker/src/core/gate-b.spec.ts` - GATE B: `codesFor(tsConfigPath, useDefault)` helper, `describe.each([app,lib])` positive + differential, GATE A runtime no-500 guard, cold-run `durationMs` log.
- `.planning/phases/01-workspace-bootstrap-engine-spike-gated/deferred-items.md` - pre-existing `nx lint` findings (out-of-scope; WS-04/Phase 3).

## Decisions Made

- **Asserted the negative-encoded NG8109 `-998109`, not the bare `8109`** (which never appears on `ts.Diagnostic.code`). Added the self-documenting `Math.abs(c)-990000===8109` recovery assertion so the magic number's meaning is explicit. (RESEARCH-ADDENDUM-WAVE3 Finding 3 / D-17.) Followed the verified Wave 4 gate-spec contract verbatim; did NOT regress to the pre-correction `toContain(8109)` form that still appears in the PLAN Task 2 prose.
- **GATE A positive targets the BUILT `core/compiler-loader.js`** (the `await import()` lives in core under the mandated core/adapter split, Finding 2), not `executor.js`; the negative require-call assertion covers BOTH built files with comment-stripping (the executor names the package only in a JSDoc comment, so a bare `not.toContain('@angular/compiler-cli')` would false-fail; T-01-11 mitigated).
- **Followed the corrected PLAN frontmatter `must_haves` + RESEARCH-ADDENDUM-WAVE3 "Wave 4 Gate-Spec Contract"** over the (pre-correction) `<task>` action prose that still said `8109` -- the objective/`verified_gate_spec_contract` and the must_haves are authoritative and agree on `-998109`.

## Deviations from Plan

### Auto-fixed Issues

None that changed code behavior. The two gate specs were authored exactly to the corrected contract. One in-spec cleanup (Rule 1, trivial): an initial `// eslint-disable-next-line no-console` on the timing `console.log` was a stale directive (the `no-console` rule is not active here) that lint flagged as an "unused eslint-disable directive"; it was removed before committing `gate-b.spec.ts`, so the committed spec adds zero lint findings.

### Out-of-scope discoveries (logged, NOT fixed)

`nx lint angular-typechecker` surfaces 3 PRE-EXISTING findings unrelated to this plan (and `nx lint` is not part of this plan's verification gate, which is `nx build && nx test`; ESLint enforcement is WS-04/Phase 3): 2 `@nx/enforce-module-boundaries` errors on Plan 03's deliberate `compiler-cli-types.ts` nodenext shim (deep `node_modules/...` relative imports), and 1 `no-unused-vars` warning on Plan 03's executor stub `_context`. Logged to `deferred-items.md` per the scope boundary. The two new gate spec files add zero lint findings.

---

**Total deviations:** 0 behavioral; 1 trivial in-spec lint cleanup (stale eslint-disable removed pre-commit).
**Impact on plan:** Plan executed to the corrected contract. No scope creep; no new capabilities; locked decisions (D-08/D-09/D-10/D-12/D-16/D-17/D-18, `module:nodenext`) all intact. The PLAN Task 2 action prose retained the pre-correction `8109` wording; the specs correctly assert `-998109` per the authoritative must_haves + addendum.

## Issues Encountered

- Confirming the exact code arrays for the evidence ledger required running a throwaway probe with `@angular/compiler-cli` resolvable. The scratchpad has no `node_modules`, so the probe was run from the repo root (`__probe-codes.mjs`) and then DELETED -- `git status` confirms no stray probe artifact remains (only the two intended spec files appeared untracked before they were committed). The committed `gate-b.spec.ts` already proves these arrays via assertions; the probe only quoted them verbatim for this SUMMARY.

## Threat model dispositions

- **T-01-10 (masked ESM-load failure / code 500 mistaken for a pass):** MITIGATED. GATE B asserts `not.toContain(500)` and both runs resolve (no `ERR_REQUIRE_ESM`).
- **T-01-11 (comment containing `import(` false-passes; bare package-string negative false-fails):** MITIGATED. GATE A strips `//`/JSDoc comment lines and asserts the specific `require('@angular/compiler-cli')` CALL regex (not a bare substring) on BOTH built files.
- **T-01-12 (a NO-GO silently advanced to Phase 2):** MITIGATED. This SUMMARY records an explicit per-item GO/NO-GO ledger; the verdict is GO, so advancement is justified by reproduced evidence.
- **T-01-SC (supply-chain install during tests):** N/A -- no packages installed; tests resolve from the locked lockfile.

## Known Stubs

None. The two gate specs are complete, committed, and green. The Phase-1 deferrals (full 5-type matrix, out-of-project filtering, exhaustive NG8xxx catalog, full executor schema validation, ESLint/dependency-checks enforcement) are roadmap-scoped to Phases 2/3/4 per D-10 / CONTEXT.md "Deferred Ideas" -- not stubs blocking this plan's goal.

## Next Phase Readiness

- **GATE PASSED (GO).** The two riskiest unknowns are proven on a real Angular 22 workspace: (A) the literal `import(` survives `module: nodenext` emit and the ESM compiler-cli loads with no `ERR_REQUIRE_ESM`; (B) the unconditional all-getter surfaces NG8109 (and NG8117) where ngc's default gatherer short-circuits -- for both an app and a local-library tsconfig. Phase 2 may build the real engine on this kept tracer-bullet core.
- Carry-forward caveats (unchanged from Plan 03): the `compiler-cli-types.ts` nodenext shim's deep relative imports (revisit when Angular ships nodenext-clean typings; surfaces as 2 module-boundary lint errors to resolve under WS-04/Phase 3); `legacy-peer-deps=true` for the Angular-22-over-`@nx/angular@23.0.1`-peers reconciliation.

## Self-Check: PASSED

- Files verified present: `gate-a-static.spec.ts`, `gate-b.spec.ts`, `deferred-items.md`.
- Commits verified present: `a904281` (Task 1), `0291b67` (Task 2).
- Functional gates: `nx build angular-typechecker` succeeds; `nx test angular-typechecker` -> 4 files, 12 tests, all pass; all six go/no-go items GO; cold-run timing recorded; throwaway probe removed (clean `git status`).

---

_Phase: 01-workspace-bootstrap-engine-spike-gated_
_Completed: 2026-06-27_
