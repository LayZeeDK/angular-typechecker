---
phase: 13-engine-solution-tsconfig-reference-walking
verified: 2026-07-01T19:40:00Z
status: passed
score: 26/26 must-haves verified
overrides_applied: 0
requirements_decision:
  WALK-01: "SATISFIED -- mark Complete. Spans plans 13-01/13-02/13-03/13-04/13-05; the walk engine, three-way split, module-boundary guard, fold-and-count, D-04 dedupe, fixtures, and real-compiler proofs are all present and green in the codebase. REQUIREMENTS.md still lists it Pending (executors deferred the flip because it spans plans); it should now be marked Complete."
  WALK-02: "SATISFIED -- mark Complete. nx.json swaps production->default on both executor keys (outputs:[], tsconfig glob, ^default retained); cache-e2e proves a spec-only edit busts the coarse single-target cache; README documents the single-target walk recipe with caching guidance."
---

# Phase 13: Engine Solution-tsconfig Reference Walking Verification Report

**Phase Goal:** The `angular-typecheck` engine type-checks a project's solution / references-only `tsconfig.json` by walking its in-project referenced leaves (lib/app + spec) in ONE `runTypecheck` call -- union + dedupe by value identity, module-boundary-guarded, coarse-cached -- superseding the D-03a solution-style short-circuit, so a single target pointed at `tsconfig.json` yields the complete, duplicate-free diagnostic set for the whole project.
**Verified:** 2026-07-01T19:40:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

The phase goal is observably TRUE in the codebase. A single `runTypecheck({ tsConfigPath: <solution tsconfig.json> })` call now walks the in-project referenced leaves, unions their raw diagnostics into ONE `finalize` (single `ts.sortAndDeduplicateDiagnostics`, explicit `DiagnosticCategory` counts), guards the module boundary (path-containment reusing the shipped `isUnderDir`), and supersedes the old D-03a short-circuit with a three-way split. All four authoritative signals pass, and the real-compiler integration specs prove every locked decision (SC1-5, D-04, D-05, cross-leaf TCB) end-to-end.

### Observable Truths

| # | Truth (source) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | createCanonicalizer + isUnderDir exported from filter-diagnostics.ts; single implementation, isNodeModulesPath stays private (13-01) | VERIFIED | `filter-diagnostics.ts:128 export function createCanonicalizer`, `:184 export function isUnderDir`, `:173 function isNodeModulesPath` (private). walk-references.ts imports both; no duplicate canonicalizer. |
| 2 | solution-style references app+spec leaves, each with a DISTINCT planted TS2322 (13-02) | VERIFIED | `fixtures/solution-style/tsconfig.json` references `./tsconfig.app.json` + `./tsconfig.spec.json`; `error.component.ts:20 count: number = 'not-a-number'`; `error.component.spec.ts:14 const specOnly: number = 'also-not-a-number'`; no `{{`. |
| 3 | solution-style-overlap: lib+spec both include ONE shared source w/ one error (13-02) | VERIFIED | `tsconfig.lib.json` + `tsconfig.spec.json` both list `shared.component.ts`; `shared.component.ts:19 'shared-not-a-number'`. |
| 4 | solution-style-oop references ONLY a resolvable leaf outside the fixture dir (13-02) | VERIFIED | `solution-style-oop/tsconfig.json` references `../solution-style/tsconfig.app.json` (resolves, outside dir). |
| 5 | solution-style-empty has files:[] and NO references (13-02) | VERIFIED | `solution-style-empty/tsconfig.json` = extends + `files:[]`, no `references` key. |
| 6 | solution-style-broken-ref references a real leaf + a nonexistent path (13-02) | VERIFIED | references `./tsconfig.app.json` + `./tsconfig.missing.json`; `tsconfig.missing.json` genuinely ABSENT on disk; `error.component.ts:18 'broken-ref-not-a-number'`. |
| 7 | solution-style-selfref references itself + a leaf twice (13-02) | VERIFIED | references `./tsconfig.json` (self) + `./tsconfig.app.json` x2; `error.component.ts` plants `'selfref-not-a-number'`. |
| 8 | walkReferences resolves direct references[] one level, canonicalizes+dedupes, skips self-ref (13-03) | VERIFIED | `walk-references.ts:112-137` single-level loop, canonicalize + `seenCanonicalLeaves` dedupe + self-reference skip. Pure (0 console/process/@nx/devkit). |
| 9 | Out-of-project leaf skipped with reason:'out-of-project', never compiled (13-03) | VERIFIED | `walk-references.ts:144-151` `!isUnderDir(...) -> push reason:'out-of-project'; continue`. Unit spec proves performCompilation not invoked. |
| 10 | Nonexistent leaf PATH -> synthesized COUNTED 90002 Error, survivors still walk (13-03) | VERIFIED | `walk-references.ts:163-172` detect `code === ng.UNKNOWN_ERROR_CODE`, push 90002, continue. `synthesizeReferenceNotFoundDiagnostic` file-less Error, code 90002. |
| 11 | Zero-rootNames leaf skipped with reason:'zero-root-names' (13-03) | VERIFIED | `walk-references.ts:176-183`. |
| 12 | rawDiagnostics = raw pre-filter/pre-dedupe union + 90002; rootNamesCount = SUM (13-03) | VERIFIED | `walk-references.ts:213-217` pushes RAW `result.diagnostics`, `rootNamesCount += parsed.rootNames.length`; no filter/dedupe inside walk. |
| 13 | runTypecheck walks refs + >=1 in-project leaf, feeds union into the SINGLE finalize (13-04) | VERIFIED | `run-typecheck.ts:218-254` `await walkReferences(...)` then existing `finalize` over `[...configDiagnostics, ...walk.rawDiagnostics]`; exactly ONE `sortAndDeduplicateDiagnostics` call (`:504`). |
| 14 | refs + 0 in-project -> synthesized 90001 none-in-project message (13-04) | VERIFIED | `run-typecheck.ts:257-269` synthesizeZeroRootNamesDiagnostic (references-present branch); message branch at `:419-424`. |
| 15 | no references -> unchanged empty-project 90001 (13-04) | VERIFIED | `run-typecheck.ts:272-285` synthesizes empty-project 90001; message branch `:425-428`. |
| 16 | rootNames > 0 direct-leaf path + COR-01 direct 500 scan/rethrow byte-unchanged (13-04) | VERIFIED | COR-01 scan `run-typecheck.ts:180-191` intact; direct-path override `:294-321` intact; SUMMARY + REVIEW confirm git diff shows split confined to the `rootNames.length === 0` branch. COR-01 pinning test `config-resolution.integration.spec.ts:103-125` present. |
| 17 | CoreResult carries optional skippedReferences (D-02); executor renders via logger.warn advisory-only (13-04) | VERIFIED | `run-typecheck.ts:83 skippedReferences?`, threaded non-empty-only `:222-225`; `executor.ts:73-85` per-entry logger.warn gated on non-empty. |
| 18 | SkippedReference publicly re-exported (13-04) | VERIFIED | `index.ts:16 export type { SkippedReference } from './core/walk-references'`. |
| 19 | Real-compiler walk of solution-style reports two distinct-file TS2322 (13-05) | VERIFIED | `walk-references.integration.spec.ts:65-104` asserts errorCount===2, two code===2322 in distinct files; PASSED in the 214-test run. |
| 20 | Overlap shared-source diagnostic collapses to ONE across Programs (13-05) | VERIFIED | `walk-references.integration.spec.ts:107-132` asserts sharedTs2322 length 1, errorCount===1; PASSED. |
| 21 | Out-of-project ref skipped (error never reported) + reason:'out-of-project' (13-05) | VERIFIED | `:134-166` asserts codes NOT contain TS2322, 90001 present, skippedReferences reason 'out-of-project'; PASSED. |
| 22 | Broken-ref RESOLVES with one counted 90002 + survivor TS2322 (fold-and-count) (13-05) | VERIFIED | `:213-261` asserts exactly one 90002, survivor TS2322, RESOLVES not rejects TypecheckInfrastructureError; PASSED. |
| 23 | config-resolution solution-style block asserts the walk; COR-01 :100-121 byte-unchanged (13-05) | VERIFIED | `config-resolution.integration.spec.ts:127-166` asserts walk; COR-01 pinning `:103-125` unchanged (`rejects.toBeInstanceOf(TypecheckInfrastructureError)`); TS18003-independence `:168-177` retained. |
| 24 | detectTemplateCheckAborted fires on TCB Fatal in synthesized cross-leaf union (13-05) | VERIFIED | `run-typecheck.spec.ts` has cross-leaf union unit (detectTemplateCheckAborted referenced x13); PASSED in the 214-test run. |
| 25 | Executor logs skippedReferences via logger.warn only when non-empty (13-05) | VERIFIED | `executor.spec.ts` asserts per-entry warn on non-empty, no warn on undefined, verdict unchanged (advisory-only); PASSED. |
| 26 | angular-typecheck targetDefaults inputs use 'default' NOT 'production'; outputs:[]/glob/^default retained; spec-edit busts cache; README recipe (13-06) | VERIFIED | `nx.json` both executor keys use `default` (no `production`), `outputs:[]`, `{projectRoot}/tsconfig*.json`, `^default`; cache-e2e `cache-busts-on-spec-edit.int.spec.ts` PASSED (9 tests); README `:9-70` single-target walk recipe + caching guidance. |

**Score:** 26/26 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/angular-typechecker/src/core/filter-diagnostics.ts` | createCanonicalizer + isUnderDir exported | VERIFIED | Both exported; isNodeModulesPath private; reused by walk. WIRED. |
| `packages/angular-typechecker/src/core/walk-references.ts` | Pure walk module (walkReferences + WalkResult + SkippedReference + 90002 synth), 80+ lines | VERIFIED | 242 lines, pure, all exports present; imported by run-typecheck.ts. WIRED. |
| `packages/angular-typechecker/src/core/walk-references.spec.ts` | Pure unit proofs (5 behaviors) | VERIFIED | All four reasons + by-code 500 + fold-and-count survivor + it.each reason table; PASSED (part of 214). |
| `packages/angular-typechecker/src/core/run-typecheck.ts` | Three-way split invoking walkReferences; union -> single finalize; skippedReferences threaded | VERIFIED | `:210-285` split; single finalize; non-empty-only spread. WIRED. |
| `packages/angular-typechecker/src/index.ts` | Public SkippedReference re-export | VERIFIED | `:16`. WIRED. |
| `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` | logger.warn render gated on non-empty | VERIFIED | `:73-85`. WIRED. |
| `walk-references.integration.spec.ts` | Real-compiler SC1/SC2/SC3/D-04/D-05 proofs | VERIFIED | 9 tests, PASSED. |
| `config-resolution.integration.spec.ts` | Solution-style rewritten to walk; COR-01 byte-unchanged | VERIFIED | Walk block `:127-177`; COR-01 pinning `:103-125` intact. |
| `nx-target-defaults.spec.ts` | Manifest assertion on nx.json shape | VERIFIED | FOUND; asserts both walk-target keys; PASSED. |
| `e2e/.../cache-busts-on-spec-edit.int.spec.ts` | Spec-edit cache-miss proof | VERIFIED | 3-signal defense-in-depth + R1 pre-flight + anti-lying differential; PASSED (9 cache-e2e tests). |
| `nx.json` | default input on both keys, outputs:[]/glob/^default | VERIFIED | `:41-72`. |
| `README.md` | Single-target walk recipe + caching guidance | VERIFIED | `:9-70`. |
| Fixtures: solution-style (+overlap/oop/empty/broken-ref/selfref) | Exact reference/leaf/planted-error shapes | VERIFIED | All 6 present with required substrate; missing-path genuinely absent. |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| walk-references.ts | filter-diagnostics.ts | `import { createCanonicalizer, isUnderDir }` | WIRED (`:10`, used `:97, :144`) |
| walk-references.ts | gather-diagnostics.ts | `gatherAllDiagnostics` passed to performCompilation | WIRED (`:11`, `:210`) |
| run-typecheck.ts | walk-references.ts | `await walkReferences(ng, ts, parsed, options.tsConfigPath)` at D-03a split | WIRED (`:11`, `:218`) |
| executor.ts | result.skippedReferences | logger.warn gated on non-empty array | WIRED (`:73-85`) |
| index.ts | SkippedReference | public type re-export | WIRED (`:16`) |
| nx.json angular-typecheck inputs | spec source hashing | `default` named input includes *.spec.ts | WIRED (cache-e2e R1 pre-flight confirms spec IS an input) |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| CoreResult.diagnostics (walk branch) | union of per-leaf `performCompilation` diagnostics | real `@angular/compiler-cli` cold compile per leaf | Yes (integration specs assert real TS2322 in distinct files) | FLOWING |
| CoreResult.skippedReferences | walk's recorded skips | real path-containment + readConfiguration on committed fixtures | Yes (oop/broken-ref/selfref specs assert real reasons) | FLOWING |
| cache-e2e cache key | Nx input hash of spec source | real Nx CLI + project graph on `typecheck-walk-consumer` | Yes (spec-edit -> real cache MISS + real TS2322) | FLOWING |

### Behavioral Spot-Checks (authoritative commands, run live)

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Unit + integration + drift tripwire | `NX_DAEMON=false npx nx run-many -t typecheck-drift test -p angular-typechecker --skip-nx-cache` | 27 files, 214 tests passed | PASS |
| WALK-02 spec-edit cache-miss proof | `NX_DAEMON=false npx nx test angular-typechecker-cache-e2e --skip-nx-cache` | 3 files, 9 tests passed | PASS |
| Lint | `NX_DAEMON=false npx nx lint angular-typechecker --skip-nx-cache` | 0 errors, 2 pre-existing warnings (compiler-cli-types.drift.ts / extended-catalog.drift.ts, Phase 12, out of scope) | PASS |
| Build | `NX_DAEMON=false npx nx build angular-typechecker --skip-nx-cache` | Compiles clean | PASS |

Note: the two lint warnings match the expected pre-existing-from-Phase-12 signal. The WR-01/WR-02 dead-`NG`-helper warnings the code review flagged in the two integration specs are GONE -- confirmed by `git grep` (0 `const NG =` in both files) and by the clean lint run -- so those two REVIEW warnings are resolved in the codebase.

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| WALK-01 | 13-01, 13-02, 13-03, 13-04, 13-05 | Engine walks in-project referenced leaves in one call; union+dedupe; boundary guard; three-way split; rewritten spec + upgraded fixtures | SATISFIED | Truths 1-25 all VERIFIED; integration specs green. REQUIREMENTS.md still shows Pending -- see decision below. |
| WALK-02 | 13-06 | targetDefaults `default` input; outputs:[]/glob/^default retained; cache busts on leaf/dep change; README recipe | SATISFIED | Truth 26 VERIFIED; nx.json manifest + cache-e2e green. REQUIREMENTS.md still shows Pending. |

**Requirement-flip decision (per verifier instructions):** Both WALK-01 and WALK-02 are FULLY satisfied in the codebase. The executors intentionally left WALK-01 `Pending` in REQUIREMENTS.md because it spans plans 13-01..13-05 and no single plan could responsibly flip it. Determined from the codebase: WALK-01 is complete (all supporting truths verified against the real compiler; the D-03a short-circuit is superseded). **Recommendation: mark WALK-01 and WALK-02 `Complete` in REQUIREMENTS.md as part of the milestone audit's 3-source cross-reference.** No blocking gap -- the Pending status is a bookkeeping lag, not missing work.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| README.md | 1-7 | Stock Nx boilerplate ("AtcTemp", "Your new, shiny Nx workspace is ready") retained above the walk-recipe section | Info | Cosmetic; out of Phase 13 scope (WALK-02 required only the walk-recipe + caching section, which is present and correct). Not a goal blocker. Recommend a later docs pass to replace the boilerplate header. |
| walk-references.ts | 122-151 | Duplicate/out-of-project repeated leaf recorded as reason:'self-reference' (REVIEW IN-01/IN-02) | Info | Advisory-label precision only; verdict unchanged (leaf never compiled). Accepted fold; the `SkippedReference.reason` union intentionally has no 'duplicate' member. |
| executor.ts | 78-84 | `... was not-found and was skipped ...` reads awkwardly (REVIEW IN-04) | Info | Notice grammar only; substring the spec asserts is preserved; verdict unchanged. |

No debt markers (TBD/FIXME/XXX) found in phase-modified source. No stubs: every artifact is substantive and wired; all dynamic data flows from the real compiler / real Nx graph.

### Human Verification Required

None. The one PLAN-designated manual item (README walk-recipe prose correctness, 13-VALIDATION.md "Manual-Only Verifications") was inspected directly during verification: `README.md:9-70` correctly documents pointing ONE target at the solution `tsconfig.json`, the walk over lib/app + spec leaves in one run, and the WALK-02 caching inputs (`default`, `outputs:[]`, `{projectRoot}/tsconfig*.json`, `^default`), with no Phase 14 generator content. It reads correctly and matches the shipped behavior. No `<verify><human-check>` blocks were declared on `auto` tasks in any 13-*-PLAN.md. All engine/behavioral criteria (SC1-5, D-04, D-05, cross-leaf TCB) have automated proofs that ran green.

### Gaps Summary

None. The phase goal is achieved: a single `runTypecheck` on a solution / references-only `tsconfig.json` walks the in-project referenced leaves (lib/app + spec), unions and dedupes their diagnostics by value identity in one finalize, guards the module boundary, and supersedes the D-03a short-circuit -- producing the complete, duplicate-free diagnostic set for the whole project. All 26 must-haves across the 6 plans verified; all 5 ROADMAP success criteria hold against the real compiler; both requirement IDs (WALK-01, WALK-02) satisfied. All four authoritative signals pass live. The only findings are three Info-level cosmetics (stock README header, advisory-label fold, notice grammar), none of which affect the goal, the verdict, counts, or any data flow. Both code-review WARNINGS (WR-01/WR-02 dead `NG` helpers) are confirmed fixed in the codebase.

---

_Verified: 2026-07-01T19:40:00Z_
_Verifier: Claude (gsd-verifier)_
