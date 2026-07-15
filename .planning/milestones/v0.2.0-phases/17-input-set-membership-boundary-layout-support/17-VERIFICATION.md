---
phase: 17-input-set-membership-boundary-layout-support
verified: 2026-07-06T08:41:17Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
gates:
  build: pass (0 errors, exit 0)
  test: pass (311/311 tests, 40/40 files, exit 0)
  lint: pass (clean, exit 0)
deferred:
  - truth: "README Limitations still says empty/zero-root-names references 'do not change the verdict' -- now false (they yield coverage-incomplete)"
    addressed_in: "Phase 18 (SB-07 docs)"
    evidence: "Tracked pending todo .planning/todos/pending/wr-01-readme-coverage-incomplete.md (resolves_phase: 18); Phase 18 SB-07 rewrites README + changelog with the authoritative coverage-claim; v0.1.2 does not ship before Phase 18. README is a doc artifact, not phase-17 engine scope."
---

# Phase 17: Input-set-membership boundary + layout support Verification Report

**Phase Goal:** `nx typecheck` type-checks `*.stories.ts` (and the whole `.storybook/` tsconfig-declared surface) for both the per-project scaffold (Layout A) and the centralized host (Layout B) without ever silently passing a dropped diagnostic, via one boundary-filter correctness fix.
**Verified:** 2026-07-06T08:41:17Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria -- the contract)

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | A broken `*.stories.ts` FAILS the verdict and a clean one PASSES, under BOTH Layout A and Layout B | VERIFIED | Real-compiler `layout-a.integration.spec.ts` (broken TS2322 on `button.stories.ts` -> `success:false`; clean -> `outcome:'clean'`) + `layout-b.integration.spec.ts` (broken aggregated `card.stories.ts` TS2322 -> `success:false`; `layout-b-host-clean` -> clean). All pass in the 311/311 test run. |
| 2 | An aggregated external-`templateUrl` NG8002 FAILS with the `.html`/component codeframe (kill-shot) | VERIFIED | `layout-b.integration.spec.ts` asserts NG8002 (`-998002`) reported with `card.component.html` codeframe AND a `.ts` `relatedInformation` owner (`card.component.ts`). Branch 4a is implemented in `filter-diagnostics.ts:245-256` (`owningComponentTs` via public `relatedInformation`). Guarded by `external-template.integration.spec.ts` D-09.2 tripwire. |
| 3 | An imported dependency project's internal error and `node_modules` diagnostics are NOT reported (isolation) | VERIFIED | `layout-b.integration.spec.ts`: dependency `thing.ts` TS2339 is ABSENT from reported diagnostics (content isolation) yet COUNTED into `suppressedInGraphErrorCount` (never silent). `keep()` suppresses non-rootName/non-base `.ts` (`filter-diagnostics.ts:238-240`); `node_modules` segment -> `suppressedThirdParty` (quiet, `filter-diagnostics.ts:144-148,222-224`). Negative control in `dual-identity-tripwire.spec.ts`. |
| 4 | Clean Layout-B host reports `suppressedInGraph == 0`; both counts in stdout AND structured result; `suppressedInGraph > 0` yields coverage-incomplete | VERIFIED | `CoreResult` carries `suppressedThirdParty`/`suppressedInGraphErrorCount`/`suppressedInGraphWarningCount`/`suppressedInGraphFiles` (`run-typecheck.ts:65-68`); executor renders INFO + LOUD WARN (`executor.ts:120-145`); `evaluateResult` maps `suppressedInGraphErrorCount > 0` -> `coverage-incomplete` (`evaluate-result.ts:95-99`), late-bound warning gate (`:124-129`). `layout-b-host-clean` proves both counts `== 0` + `outcome:'clean'`. |
| 5 | No Layout-A regression; boundary is a pure `keep(diagnostic, inputSet, options)` shared by walk + single-leaf; `git grep` shows zero ngtsc/component-registry internals | VERIFIED | Pure `keep()` exported (`filter-diagnostics.ts:182`); both walk path (`run-typecheck.ts:310-323`, `inputTs = walk.rootNamePaths`) and direct path (`:414-427`, `inputTs = parsed.rootNames`) route through the ONE `finalize` -> `filterDiagnostics` chokepoint. Independent `git grep` for `ngtsc|componentRegistry|ComponentScopeReader|TemplateTypeChecker|getSourceFiles|NgtscProgram|@angular/compiler-cli` in `filter-diagnostics.ts` = NO MATCHES. Enforced by `filter-diagnostics.structural.spec.ts`. Layout-A regression proven by `layout-a.integration.spec.ts`. |

**Score:** 5/5 truths verified

### Deferred Items

Items not yet met but explicitly addressed in a later milestone phase.

| # | Item | Addressed In | Evidence |
| - | ---- | ------------ | -------- |
| 1 | README Limitations says empty/zero-root-names references "do not change the verdict" (now false -- coverage-incomplete) | Phase 18 (SB-07 docs) | Tracked pending todo `.planning/todos/pending/wr-01-readme-coverage-incomplete.md` (`resolves_phase: 18`); SB-07 rewrites README + changelog wholesale; v0.1.2 does not ship before Phase 18. This is 17-REVIEW.md WR-01 (a doc contradiction, not engine behavior). |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/filter-diagnostics.ts` | pure `keep()` + dual-identity inputSet + branch 4a + split `FilterResult` + `inputTs` on `FilterOptions` | VERIFIED | `keep` exported, dual-identity `isMember` (raw+full), `owningComponentTs` branch 4a, `FilterResult` 4-field split. Wired into `run-typecheck.finalize`. |
| `src/core/walk-references.ts` | `WalkResult.rootNamePaths` from each surviving leaf's declared `readConfiguration().rootNames` | VERIFIED | `rootNamePaths` accumulated in surviving-leaf tail (`:268`), after every skip/not-found/zero-root-names `continue`; never `program.getRootFileNames()` (no `.ngtypecheck.ts` shims). |
| `src/core/run-typecheck.ts` | thread `inputTs` union; `CoreResult` split-counter fields (no `suppressedCount`) | VERIFIED | `buildFinalizeFilter(..., inputTs)` shared by both paths; `FinalizeFilter.inputTs`; `CoreResult` carries the 4 split fields; guard paths return 0/[]. No `suppressedCount` remains. |
| `src/core/evaluate-result.ts` | late-bound coverage-incomplete gate + `Outcome` discriminant | VERIFIED | Ordered gate: type-error > suppressed-in-graph-error > templateCheckAborted (FM-9) > zero-root-names leaf > warnings-exceeded > late-bound suppressed-in-graph-warning > clean. Negative/NaN maxWarnings unset-equivalent. |
| `src/core/exit-codes.ts` | coverage-incomplete -> exit 1 | VERIFIED | `toExitCode` returns 1 for `suppressedInGraphErrorCount > 0` (ngc parity). Documented scaffold (no live consumer; Nx executor uses `evaluateResult`) -- see IN-01. |
| `src/executors/typecheck/executor.ts` | loud rendering of both counts + coverage-incomplete notice from pure fields | VERIFIED | `logger.info` for `suppressedThirdParty`; `logger.warn` naming `suppressedInGraphFiles`; notice is honest about the warning late-binding (WR-03 fix, commit 726a136); verdict from `evaluateResult`. |
| Fixtures (`layout-a-storybook{,-clean}`, `layout-b-host{,-clean}`, `layout-b-aggregated{,-clean}`, `layout-b-dependency`, `external-template-tripwire`, `clean-template-host`) | real Angular fixtures reaching cross-project | VERIFIED | All 9 dirs present; `layout-b-host/.storybook/tsconfig.json` `include: ["../../layout-b-aggregated/**/*.ts"]` reaches OUTSIDE the host dir; host `tsconfig.json` references only `./.storybook/tsconfig.json`; genuine planted TS2322/NG8002/TS2339. |
| Integration + tripwire specs | 5-criteria proof + D-09a tripwires + FM-9 drift probe | VERIFIED | `layout-a`(99) `layout-b`(161) `external-template`(115) `fault-isolation`(270) `dual-identity-tripwire`(121) + `filter-diagnostics`(645) `walk-references`(748). All in the 311-test green run. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `keep()` | dual-identity `inputSet` | `inputSet.has(rawF) \|\| inputSet.has(fullF)` | WIRED | `isMember` (`filter-diagnostics.ts:260-268`), called before node_modules branch. |
| branch 4a | `ts.Diagnostic.relatedInformation` owner | `owningComponentTs(diagnostic)` | WIRED | `filter-diagnostics.ts:245,275-287`; extension-only match, no message text. |
| `walk.rootNamePaths` | `buildFinalizeFilter(..., inputTs)` | in-project-leaf finalize call | WIRED | `run-typecheck.ts:316-322`. |
| `parsed.rootNames` | direct-path finalize `inputTs` | direct single-leaf finalize call | WIRED | `run-typecheck.ts:420-426`. |
| `CoreResult.suppressedInGraphErrorCount`/`templateCheckAborted`/zero-root-names | `{ success:false, outcome:'coverage-incomplete' }` | `evaluateResult` gate | WIRED | `evaluate-result.ts:95-129`; proven by `fault-isolation` FM-9 probe + `layout-b` isolation assertion. |
| `result.suppressedInGraph*`/`suppressedInGraphFiles` | `logger.warn` coverage notice | executor render step | WIRED | `executor.ts:132-145`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `layout-b.integration.spec` | `result.diagnostics`, split counters | real `runTypecheck` -> `performCompilation` over `layout-b-host` fixture | Yes (NG8002 + TS2322 + TS2339 suppression from the actual Angular compiler) | FLOWING |
| executor coverage notice | `suppressedInGraphFiles` | pure `CoreResult` field populated by `filterDiagnostics` | Yes (canonical dropped paths, e.g. `thing.ts`) | FLOWING |
| `evaluateResult` verdict | `suppressedInGraphErrorCount`/`templateCheckAborted` | `CoreResult` from `finalize` | Yes (fault-isolation fixture yields real NG3004 abort) | FLOWING |

### Behavioral Spot-Checks (authoritative gates, run in this verification)

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Whole-package type-check compiles | `NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache` | exit 0, 0 errors | PASS |
| Full test suite (unit + real-compiler integration + tripwires) | `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | exit 0, 311/311 tests, 40/40 files | PASS |
| Lint clean (maxWarnings:0) | `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | exit 0, all files pass | PASS |
| Criterion-5 structural gate (independent) | `git grep -E "ngtsc\|componentRegistry\|ComponentScopeReader\|TemplateTypeChecker\|getSourceFiles\|NgtscProgram\|@angular/compiler-cli" filter-diagnostics.ts` | NO MATCHES | PASS |
| Core purity (no `console`/`process` in non-comment core) | `git grep` core `*.ts` | only comment references | PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| SB-02 | 17-01, 17-02, 17-03, 17-07 | Pure `keep(diagnostic, inputSet, options)` on input-set membership, routed by walk + single-leaf; walk surfaces rootName paths; same canonicalizer; zero ngtsc internals; no Layout-A regression | SATISFIED | `keep()` + dual-identity + branch 4a; `walk.rootNamePaths`; shared `finalize` chokepoint; structural gate (git grep clean). |
| SB-04 | 17-01, 17-03, 17-04, 17-05 | Split `suppressedThirdParty` vs `suppressedInGraph`; surface both in stdout + structured result; `suppressedInGraph > 0` -> coverage-incomplete; symmetry-guarded | SATISFIED | Split counters on `CoreResult`; executor INFO+WARN; late-bound `evaluateResult` gate; dual-identity canonicalization symmetry. |
| SB-01 | 17-06 | `*.stories.ts` type-checked under Layout A (regression fixture + real story error/clean) | SATISFIED | `layout-a-storybook{,-clean}` fixtures + `layout-a.integration.spec.ts` (broken/clean, no regression). |
| SB-03 | 17-06, 17-07 | Aggregated Layout-B host via SB-02: broken aggregated story (incl. external `templateUrl`) fails; clean passes; dependency + node_modules isolated | SATISFIED | `layout-b-host{,-clean}` fixtures + `layout-b.integration.spec.ts` (criteria 1B/2/3/4); no Storybook-specific code. |

No orphaned requirements: REQUIREMENTS.md maps ONLY SB-01/02/03/04 to Phase 17 (SB-05 -> Phase 16; SB-06/07 -> Phase 18; SB-08 -> Phase 19). All four are claimed by plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | -- | No `TBD`/`FIXME`/`XXX` debt markers in phase-modified core/executor files | -- | Completion is auditable. |
| (none) | -- | No `TODO`/`HACK`/`PLACEHOLDER` in non-spec core/executor | -- | -- |

The two `ponytail:` comments (`exit-codes.ts:54`, and the isUnderDir undefined-base note) name intentional, documented ceilings with upgrade paths -- not debt.

### Human Verification Required

None. This is a type-check ENGINE phase: all five success criteria are proven end-to-end by passing real-compiler integration specs (cold `performCompilation` over real Angular fixtures), and the stdout notice wording is unit-tested in `executor.spec.ts`. There is no visual/UI, real-time, or external-service surface. The plans declared no deferred `<human-check>` blocks and `workflow.human_verify_mode` is unset. The full `nx add`/generator/packaged-tarball acceptance matrix (T1-T11) is out of scope by design (D-09) -- it is Phase 18 (SB-06).

### Gaps Summary

No gaps. The phase charter -- "NEVER a silent false pass" -- holds in the actual codebase:

- The pure `keep()` decision reads ONLY public `ts.Diagnostic` fields; every first-party `keep() === false` is COUNTED into `suppressedInGraphErrorCount`/`suppressedInGraphWarningCount` (with the file recorded), and any in-graph error suppression flips the verdict to `coverage-incomplete` via `evaluateResult`.
- Dual-identity membership (raw + realpath) is checked before the `node_modules` branch, so a declared rootName is never misclassified; a throwing `realpath` fails safe (KEEP), proven by the `dual-identity-tripwire` symlink/junction case.
- Branch 4a keeps an aggregated external-`templateUrl` NG8002 via public `relatedInformation` (the kill-shot); a wrong SUPPRESS still counts the `.html` as in-graph -> coverage-incomplete (never a silent drop).
- FM-9 folds the whole-program TCB-abort (NG3004) and the zero-root-names leaf into coverage-incomplete; the drift probe pins the recognized fatal-code surface to exactly NG3004.
- The boundary is a single shared `finalize` -> `filterDiagnostics` chokepoint for both the walk and the direct single-leaf path; `git grep` confirms zero ngtsc/component-registry internals.

All three authoritative gates (build/test/lint) pass. The single 17-REVIEW.md WARNING left open (WR-01, a README Limitations contradiction) is a documentation item deliberately deferred to Phase 18 (SB-07) via a tracked pending todo, and cannot reach users before Phase 18 ships.

---

_Verified: 2026-07-06T08:41:17Z_
_Verifier: Claude (gsd-verifier)_
