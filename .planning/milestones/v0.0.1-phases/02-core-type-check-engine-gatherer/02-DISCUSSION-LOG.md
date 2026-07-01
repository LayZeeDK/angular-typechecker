# Phase 2: Core Type-Check Engine + Gatherer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 2-core-type-check-engine-gatherer
**Mode:** default + `--analyze` (trade-off tables) + `research_before_questions` (config: true)
**Areas discussed:** CoreResult contract, Solution-style tsconfig, No-emit override set, TEST-02 fixtures + scope, tsConfigPath resolution ownership, Infra-failure vs diagnostic, Result observability fields

---

## Process notes

- User invoked with `--analyze` + the instruction "Perform phase-specific research before starting discussion." Per `research_before_questions: true`, real research was run BEFORE the decision questions (initial attempt to jump straight to questions was corrected at the user's direction).
- Four `gsd-advisor-researcher` agents ran in parallel (one per initial gray area), reading the local Angular `compiler-cli` / `@angular/build` source, the Nx `@nx/js` generator templates, and the sandbox prototype; each returned a source-cited comparison table + recommendation.
- The 3 additional gray areas (resolution ownership, infra-failure, observability) were grounded by direct source verification of `perform_compile.ts` (not a web search), since they are internal-contract decisions.

---

## CoreResult contract

| Option           | Description                                                                                                       | Selected |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| Approach A       | Explicit Error/Warning counts by category; keep diagnostics[] + durationMs; drop codes[]; force diagnostics:false | [x]      |
| Full breakdown   | Approach A + suggestionCount + messageCount (sum === length)                                                      |          |
| Keep codes[] too | Approach A but retain codes[] in the public result                                                                |          |

**User's choice:** Approach A.
**Notes:** Research (research-coreresult) confirmed the MD-02 conflation bug is real -- a Suggestion-category diagnostic can reach the gather path. During clarification the user challenged the cited example: the agent claimed NG8101 was the Suggestion. Verified against `error_code.ts` -- NG8101 (`INVALID_BANANA_IN_BOX`) is a WARNING; the real Suggestion-in-gather proof is NG10002 (`SUGGEST_SUBOPTIMAL_TYPE_INFERENCE`, strictTemplates-off advisory). Correction folded into CONTEXT.md D-01.

---

## Solution-style / zero-rootNames tsconfig

| Option               | Description                                                                                                                                    | Selected |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Return errors        | Prepend parsed.errors; synthesize Error diag on rootNames===0 + skip performCompilation; never throw; gate on rootNames.length===0 not TS18003 | [x]      |
| Throw on hard errors | Return for empty-rootNames; throw for unparseable/missing tsconfig                                                                             |          |
| Throw on any zero    | Throw whenever rootNames empty                                                                                                                 |          |

**User's choice:** Return errors (fail-loud, returned not thrown).
**Notes:** research-tsconfig source-verified that TS suppresses TS18003 when `references` is present (the Nx root tsconfig shape), so detection must gate on empty rootNames. Reference-expansion confirmed a code-level dead end (ngtsc never consults projectReferences). Resolves Phase-1 MD-01.

---

## No-emit override set

| Option                   | Description                                                                                                                                                                   | Selected |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Deliberate normalization | Force full emit-neutralizing set (composite/declaration/declarationMap/emitDeclarationOnly false + incremental false + buildinfo/sourcemap undefined); keep semantics options | [x]      |
| Lean triangle-only       | Clear only the conflict set; leave inert sourcemap/declarationDir                                                                                                             |          |

**User's choice:** Deliberate normalization.
**Notes:** research-noemit found the minimal `{...parsed.options, noEmit:true}` BREAKS on Nx 23 TS-solution workspaces -- their base sets composite + emitDeclarationOnly on every project (incl. spec), producing bogus TS5053 that the unconditional getTsOptionDiagnostics() reports as errors. Mirrors angular-cli's own normalization. emitFlags:0 remains the load-bearing emit suppressor.

---

## TEST-02 fixtures + Phase-2 coverage scope

| Option                    | Description                                                                                                                                               | Selected |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Static + subset           | Static hand-authored fixtures; ~6-8 differentiator codes incl. one multi-error fixture; app+lib+spec; per-version split; direct runTypecheck; NG() helper | [x]      |
| Static + full catalog now | Static fixtures, all ~28 codes in Phase 2                                                                                                                 |          |
| Programmatic injection    | jscodeshift-style injection on clean fixtures, subset scope                                                                                               |          |

**User's choice:** Static + subset.
**Notes:** research-fixtures: injection silently no-ops on AST drift across majors (false green); static breaks loudly. Criterion 4's "across the v13->v22 catalog" is satisfied by per-introduction-version file ORGANIZATION (catalog = "coverage taxonomy, not a matrix"); growth is additive. Buildable/publishable libs deferred to Phase 6.

---

## tsConfigPath resolution ownership

| Option                   | Description                                                                                | Selected |
| ------------------------ | ------------------------------------------------------------------------------------------ | -------- |
| Core requires absolute   | Core never touches cwd; Phase-4 executor resolves vs context.root; tests pass path.resolve | [x]      |
| Core resolves vs cwd     | Convenience; accepts cwd dependency                                                        |          |
| Explicit basePath option | Relative path + explicit base                                                              |          |

**User's choice:** Core requires absolute.
**Notes:** Keeps the framework-agnostic core pure/reproducible; directory paths still pass through to readConfiguration's tsconfig.json auto-append.

---

## Infra-failure vs diagnostic

| Option                       | Description                                                                                                             | Selected |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| Detect & re-throw            | loadCompilerCli failures propagate; re-throw a returned UNKNOWN_ERROR_CODE so CoreResult holds only genuine diagnostics | [x]      |
| Flag in result, don't throw  | Mark infra failures via a field/boolean; keep returning a value                                                         |          |
| Treat uniformly (status quo) | Leave the 500 as an Error diagnostic in the array                                                                       |          |

**User's choice:** Detect & re-throw.
**Notes:** Source-verified that performCompilation swallows internal crashes into a single UNKNOWN_ERROR_CODE Error diag (file:undefined) at perform_compile.ts:314-327; a compiler-cli load failure throws outside performCompilation. Re-throwing keeps errorCount == real type errors (agent-ready). Throw-to-exit mapping is a Phase-4 executor concern.

---

## Result observability fields

| Option                    | Description                                                        | Selected |
| ------------------------- | ------------------------------------------------------------------ | -------- |
| Add minimal               | Echo resolved tsConfigPath + rootNamesCount; skip full rootNames[] | [x]      |
| Lean (status quo)         | diagnostics[] + counts + durationMs only                           |          |
| Full resolved-config echo | path + basePath + full rootNames[]                                 |          |

**User's choice:** Add minimal.
**Notes:** rootNamesCount:0 visibly reinforces the solution-style guard; full rootNames[] left to the reporter layer.

---

## Claude's Discretion

- Exact fixture directory/file names + shared-base tsconfig layout; Vitest unit-vs-integration config split; the private synthesized-diagnostic code value/namespace (e.g. ATC1001); exact throw type for D-06 + its Phase-4 executor mapping; module-level memoization reuse across runTypecheck calls (already correct).
- Re-verify exact NG code numbers/names against the Angular 22 clone on implementation (NG8116 docs-lag; NG8110/NG8112 not documented extended diagnostics).

## Deferred Ideas

- All deferrals are roadmap-scoped (Phase 3 filtering/modes/output/quality-gates + unit/mock tier; Phase 4 executor adapter/cacheable target; Phase 6 buildable/publishable libs + full matrix; full v13->v22 catalog growth additive). No discussion drifted outside the Phase 2 boundary. See CONTEXT.md `<deferred>`.
