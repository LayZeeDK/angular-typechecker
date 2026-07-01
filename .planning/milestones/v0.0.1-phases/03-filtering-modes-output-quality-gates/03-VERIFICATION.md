---
phase: 03-filtering-modes-output-quality-gates
verified: 2026-06-28T00:00:00Z
status: passed
score: 5/5 ROADMAP success criteria verified; 20/20 plan must-have truths verified; 8/8 Phase-3 requirements satisfied (6 at the composable-core level; CLI/executor wiring correctly deferred to Phase 4)
overrides_applied: 0
mode_note: >-
  ROADMAP declares mode: mvp, but the phase goal is an engineering-deliverable
  statement ("The core contract is complete -- project-boundary filtering,
  report-all/fail-fast modes, --max-warnings, and formatDiagnostics human output
  all work on the structured result -- and lint/format quality gates enforce the
  framework-agnostic core-vs-adapter boundary"), NOT an "As a ... I want ... so
  that ..." User Story (user-story.validate returned false). There are no
  user-facing flows to trace: the sole consumer of the three new pure functions
  (filterDiagnostics, evaluateResult, formatReport) is the Phase-4 Nx executor
  adapter, which is explicitly out of scope here (REQUIREMENTS OUT-03 exit
  wiring, CONTEXT D-03/D-08, ROADMAP Phase-4 SC1). Following the precedent set by
  the Phase-1 and Phase-2 VERIFICATION.md files, this was verified goal-backward
  against the five explicit ROADMAP Success Criteria plus the 20 plan-frontmatter
  must-have truths, rather than refusing under the MVP User Story guard. The User
  Flow Coverage table is N/A for a composable-core / quality-gates phase.
re_verification:
  is_re_verification: false
---

# Phase 3: Filtering, Modes, Output + Quality Gates Verification Report

**Phase Goal:** The core contract is complete -- project-boundary filtering, report-all/fail-fast modes, `--max-warnings`, and `formatDiagnostics` human output all work on the structured result -- and lint/format quality gates enforce the framework-agnostic core-vs-adapter boundary.

**Verified:** 2026-06-28
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

This phase completes the framework-agnostic CORE CONTRACT on top of the Phase-2
engine. The deliverable is three pure, composable `core/` functions
(`filterDiagnostics`, `evaluateResult`, `formatReport`), the `CoreOptions`/
`CoreResult` extension that wires the filter + sort into `runTypecheck`, and a
machine-enforced lint boundary locking the core/adapter split. Every Success
Criterion and every plan must-have was confirmed against the ACTUAL source files
(read in full, not trusted from SUMMARY) and against three live gates the
verifier ran independently on the main checkout with real `node_modules`:
`npx nx lint angular-typechecker` (exit 0), `npx nx build angular-typechecker`
(GATE A `import(` confirmed in the built bytes), and `npx nx test
angular-typechecker` (70/70 across 15 files). A negative-control lint probe
proved the core/\*\* import ban is live (not dead config).

**Scope boundary (assessed per the verification brief):** the ROADMAP goal text
says modes/filtering/`--max-warnings`/output "all work on the structured result"
-- i.e. at the composable-core level. The Phase-3 success criteria are worded for
core behaviors ("the core reports ALL diagnostics", "filtered on absolute
realpath-normalized `fileName`"). The pieces that imply USER-FACING wiring -- the
`nx run <project>:angular-typecheck` surface, the `{ success }` -> `process.exit`
mapping, `pathBase` <- `context.root` -- are deliberately, traceably deferred to
Phase 4 (ROADMAP Phase-4 SC1; REQUIREMENTS maps EXE-01/06/07 to Phase 4; CONTEXT
D-03/D-08; deferred-items.md). The core SUPPLIES the `{ success }` boolean
(`evaluateResult`) and the rendered string (`formatReport`); the adapter owns
stdout + exit. This is a correct architectural seam, not a missed deliverable.
Each such item is recorded under "Deferred Items" below, not as a gap.

### Observable Truths (ROADMAP Success Criteria)

| #    | Truth (Success Criterion)                                                                                                                                                                                                                                                                                | Status   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | By default the core reports ALL diagnostics (matches `tsc --noEmit`); opt-in fail-fast returns on the first error; errors always fail and `--max-warnings=<n>` (0 = fail on any warning) gates warnings while project-configured diagnostic categories are respected                                     | VERIFIED | Report-all: `formatReport` renders the full sorted set; `failFast` is a REPORTING-only `slice(0, firstError+1)` over the already-sorted input (`format-report.ts:69-77`) -- never a gather short-circuit (the all-getter still runs every getter, ENG-02 from Phase 2 untouched). Verdict: `evaluateResult` (`evaluate-result.ts:40-59`) returns `{ success: false }` when `errorCount > 0` BEFORE the warning gate (errors always fail); gates warnings only when `maxWarnings` is finite & >= 0; `maxWarnings: 0` fails on any warning. 9/9 `evaluate-result.spec.ts` cases + 5 fail-fast/report-all `format-report.spec.ts` cases green. Categories respected: counts read by the verdict were bucketed by `ts.DiagnosticCategory` upstream in `finalize` (Phase-2 D-01, proven in Phase-2 SC-4). NOTE: the literal `--max-warnings` CLI flag parse + the `{ success }` -> exit mapping are Phase-4 (the CORE verdict function is complete here). |
| SC-2 | Out-of-project + `node_modules` diagnostics are excluded by default (opt-in `includeDeps`), filtered on absolute realpath-normalized `fileName` via the host `getCanonicalFileName` + `realpath` (pnpm-symlink and case-insensitive-FS safe) -- not a naive string-prefix comparison                     | VERIFIED | `filter-diagnostics.ts`: realpath FIRST (`createCanonicalizer` :112-127), then `\\`->`/`, then case-fold ONLY when `useCaseSensitiveFileNames` is false (Pitfall 3 order). `node_modules` by path-SEGMENT test (`split('/').includes`, :135-137) NOT substring; containment by segment-bounded `dir + '/'` prefix (:143-153) NOT bare `startsWith`. `includeDeps: true` folds back, `suppressedCount` -> 0 (:64-66). Wired in `run-typecheck.ts:185-200` against `parsed.options.basePath` (NOT `rootDir`) + the live `result.program.getTsProgram().useCaseSensitiveFileNames()` + `ts.sys.realpath`. 7/7 `filter-diagnostics.spec.ts` cases (incl. `node_modules-tools` kept, symlink-under-base kept, case-fold) + 4 REAL-compiler `sibling-import` integration cases (default suppress `suppressedCount>=1`; `includeDeps` folds back `suppressedCount:0`; sorted-by-file; no TS6059) all green.                                                 |
| SC-3 | Default human output is `@angular/compiler-cli` `formatDiagnostics` (NG codes + template codeframes; superset of `tsc`), output is deterministic and idempotent (agent-ready) with a clear non-zero exit on diagnostics, and CI annotation paths are emitted workspace-root-relative (normalized to `/`) | VERIFIED | `formatReport` renders via the INJECTED `Pick<CompilerCli, 'formatDiagnostics'>` (`format-report.ts:80`); spec proves an NG code appears in output. Determinism: OUR `FormatDiagnosticsHost` (`makeFormatHost` :92-108) forces `getNewLine: () => '\n'`, NON-identity `getCanonicalFileName`, and ABSOLUTE paths via the `/__atc_absolute__` sentinel when `pathBase` unset (NOT cwd-relative); idempotency case asserts byte-identical repeat render via the REAL `ts.formatDiagnostics`. CI paths: `pathBase` set -> workspace-root-relative, `/`-normalized (no `\\`, no absolute prefix) -- asserted end-to-end. ANSI stripped iff `color: false` (D-10). 11/11 `format-report.spec.ts` cases green. The "clear non-zero exit on diagnostics" half is the adapter's job (Phase-4 OUT-03 split, CONTEXT D-08/D-10); the CORE produces the rendered string + the `{ success }` verdict that drives it.                                             |
| SC-4 | Unit tests (Vitest, mocking `@angular/compiler-cli`) cover the gatherer, project-boundary filtering, tsconfig resolution, modes, and `--max-warnings` logic                                                                                                                                              | VERIFIED | Live full suite: 70 tests / 15 files green. Pure unit tier with hand-built `ts.Diagnostic[]` + injected deps (D-13, NO compiler mock): `filter-diagnostics.spec.ts` (7, boundary filter), `evaluate-result.spec.ts` (9, modes + `--max-warnings`), `format-report.spec.ts` (11, output + fail-fast), `gather-diagnostics.spec.ts` (2, gatherer). tsconfig resolution covered by `config-resolution.integration.spec.ts` (5, Phase 2). Every Phase-3 behavior has automated coverage. (REQUIREMENTS.md already marks TEST-01 Complete.)                                                                                                                                                                                                                                                                                                                                                                                                               |
| SC-5 | ESLint + Prettier are configured (Prettier `singleQuote: true`) including `@nx/dependency-checks` and module-boundary enforcement that forbids `core/` from importing `@nx/devkit`/CLI/architect, and lint passes clean                                                                                  | VERIFIED | `eslint.config.mjs`: a `files: ['**/src/core/**/*.ts']` override with `@typescript-eslint/no-restricted-imports` (paths: nx, @nx/devkit, @angular-devkit/architect, yargs; patterns: @nx/_, @angular-devkit/_) -- `allowTypeImports` OMITTED -- plus `no-console` + `no-restricted-properties` process.exit ban. `@nx/dependency-checks` (`**/*.json`) + `@nx/nx-plugin-checks` (`**/package.json`) blocks present and unchanged (D-12). `.prettierrc` = `{ "singleQuote": true }`; `prettier --check` on all phase files clean. Live `npx nx lint angular-typechecker` exits 0 (2 pre-existing unused-vars WARNINGS only; no errors; no `--max-warnings` so warnings do not fail). NEGATIVE CONTROL: a temp `core/` file with `import type { ExecutorContext } from '@nx/devkit'` produced TWO no-restricted-imports ERRORS (exact-path + `@nx/*` pattern) and a non-zero `nx lint` exit -- the ban is live AND catches type-only imports.          |

**Score:** 5/5 ROADMAP success criteria verified.

### Plan Must-Have Truths

| #   | Plan     | Truth                                                                                                                     | Status   | Evidence                                                                                                                                                                                                                                     |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 03-01    | By default, out-of-project + node_modules diagnostics are excluded; opt-in includeDeps surfaces them                      | VERIFIED | `filter-diagnostics.ts:64-98`; default-suppress + includeDeps-folds-back proven in both the pure spec and the REAL sibling-import integration.                                                                                               |
| 2   | 03-01    | A `node_modules-tools` dir is NOT misclassified as node_modules (segment test)                                            | VERIFIED | `isNodeModulesPath` uses `split('/').includes('node_modules')` (:135-137); `filter-diagnostics.spec.ts` "node_modules-tools kept" case green.                                                                                                |
| 3   | 03-01    | File-less diagnostics (config errors, zero-rootNames guard) are NEVER filtered                                            | VERIFIED | `filter-diagnostics.ts:77-81` keeps `file === undefined`; guard path in `run-typecheck.ts:115-128` omits the filter entirely. Spec "file-less always kept" green.                                                                            |
| 4   | 03-01    | runTypecheck returns FILTERED + SORTED diagnostics + a `suppressedCount` scalar; counts POST-filter                       | VERIFIED | `finalize` (`run-typecheck.ts:265-308`) filters, then `ts.sortAndDeduplicateDiagnostics` (:288), then counts Error/Warning on the post-filter sorted set; `suppressedCount` on `CoreResult` (:50). Integration asserts `suppressedCount>=1`. |
| 5   | 03-01    | includeDeps: true folds suppressed diagnostics back and resets suppressedCount to 0                                       | VERIFIED | `filter-diagnostics.ts:64-66`; integration `includeDeps:true` case asserts the sibling diagnostic returns + `suppressedCount: 0`.                                                                                                            |
| 6   | 03-02    | Errors ALWAYS fail the verdict regardless of maxWarnings                                                                  | VERIFIED | `evaluate-result.ts:44-46` short-circuits `errorCount > 0` before the warning gate; spec "fails on errors even when warnings within threshold" green.                                                                                        |
| 7   | 03-02    | With no maxWarnings, warnings never fail on their own                                                                     | VERIFIED | `evaluate-result.ts:48-58`; spec "passes when no errors and no maxWarnings" green.                                                                                                                                                           |
| 8   | 03-02    | warningCount > maxWarnings fails; maxWarnings:0 fails on ANY warning; at-threshold passes                                 | VERIFIED | `evaluate-result.ts:54`; three spec cases (over-threshold fails, maxWarnings:0 fails on any, at-threshold passes) green.                                                                                                                     |
| 9   | 03-02    | A negative or NaN maxWarnings is treated defensively as unset                                                             | VERIFIED | `evaluate-result.ts:49-52` `Number.isFinite && >= 0`; spec negative + NaN cases both assert success true.                                                                                                                                    |
| 10  | 03-03    | Default human output via formatDiagnostics (NG codes + template codeframes)                                               | VERIFIED | `format-report.ts:80` renders via injected `ng.formatDiagnostics`; spec asserts NG code in output.                                                                                                                                           |
| 11  | 03-03    | Output deterministic + idempotent, absolute paths by default (not cwd-relative)                                           | VERIFIED | `makeFormatHost` sentinel + `getNewLine:'\n'` (`format-report.ts:92-108`); idempotency + absolute-path cases use the REAL `ts.formatDiagnostics`.                                                                                            |
| 12  | 03-03    | color:false strips ANSI (CI/agents/pipes); color:true preserves it                                                        | VERIFIED | `format-report.ts:82` `color ? rendered : rendered.replace(ANSI_PATTERN,'')`; strip + keep spec cases green.                                                                                                                                 |
| 13  | 03-03    | Fail-fast truncates the REPORTED list at the first Error; NEVER a gather short-circuit                                    | VERIFIED | `format-report.ts:69-77` `findIndex(Error)` + `slice(0,i+1)`; comment + plan emphasize gather is untouched. Three fail-fast spec cases (truncate at first error, unset renders all, no-error renders all) green.                             |
| 14  | 03-03    | CompilerCli widened with formatDiagnostics (type-only) for the Pick injection                                             | VERIFIED | `compiler-cli-types.ts:32,59` adds `formatDiagnostics` to the deep `perform_compile` import + the interface; build green (resolves under nodenext).                                                                                          |
| 15  | 03-04    | ESLint forbids core/\*\* from importing @nx/devkit, nx, @angular-devkit/architect (+ families) and yargs, incl. type-only | VERIFIED | `eslint.config.mjs:16-53`; negative-control probe produced 2 errors on a TYPE-ONLY @nx/devkit import (proves allowTypeImports omitted).                                                                                                      |
| 16  | 03-04    | ESLint forbids console and process.exit in core/\*\*                                                                      | VERIFIED | `eslint.config.mjs:54-63` `no-console` + `no-restricted-properties` process.exit ban.                                                                                                                                                        |
| 17  | 03-04    | @nx/dependency-checks remains enabled and unchanged                                                                       | VERIFIED | `eslint.config.mjs:66-82` `@nx/dependency-checks` block present, unchanged (D-12).                                                                                                                                                           |
| 18  | 03-04    | The three new pure functions are exported from the package entry point                                                    | VERIFIED | `index.ts:2-7` re-exports `evaluateResult`/`filterDiagnostics`/`formatReport` + their types; existing exports preserved. Build resolves all symbols.                                                                                         |
| 19  | 03-04    | Lint passes clean and the full unit suite is green                                                                        | VERIFIED | Live `nx lint` exit 0; `nx test` 70/70 across 15 files.                                                                                                                                                                                      |
| 20  | 03-01/03 | The kept set is sorted + deduped via ts.sortAndDeduplicateDiagnostics before counting/formatting (D-09)                   | VERIFIED | `run-typecheck.ts:288`; integration D-09 "sorted-by-file" case green; `formatReport` does NOT re-sort (input already sorted).                                                                                                                |

**Score:** 20/20 plan must-have truths verified.

### Deferred Items

Items implied by the goal/SC phrasing but TRACEABLY scoped to a later milestone phase -- not actionable Phase-3 gaps (per Step 9b filtering against the ROADMAP).

| #   | Item                                                                                                     | Addressed In | Evidence                                                                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The `--max-warnings` CLI flag parse + `{ success }` -> non-zero exit mapping (the user-runnable verdict) | Phase 4      | Phase-4 SC1: "sub-50-line adapter: ExecutorContext -> CoreOptions -> runTypecheck -> { success }"; REQUIREMENTS maps EXE-01/06/07 to Phase 4; CONTEXT D-03. The CORE `evaluateResult` (the verdict function) is complete in Phase 3. |
| 2   | "Clear non-zero exit on diagnostics" (OUT-03 exit half)                                                  | Phase 4      | CONTEXT D-08/D-10: "The clear non-zero EXIT on diagnostics is the adapter's responsibility (Phase 4)." The CORE produces the rendered report (`formatReport`) + the `{ success }` verdict that drives the exit.                      |
| 3   | `pathBase` populated from `context.root`; `color` from `process.stdout.isTTY`                            | Phase 4      | CONTEXT D-08: "The Phase-4 adapter fills `pathBase` from `context.root`; the core never reads it." `pathBase`/`color` are accepted parameters on `formatReport`/`CoreOptions` today (forward-reference, NOT a stub).                 |
| 4   | `nx run <project>:angular-typecheck` user-runnable surface                                               | Phase 4      | ROADMAP Phase-4 goal: "the first user-runnable surface"; the three Phase-3 pure functions are exported (`index.ts`) precisely so the Phase-4 adapter can compose them.                                                               |
| 5   | pnpm-symlink + mixed-case path realpath/case-fold cross-OS backstop                                      | Phase 6 e2e  | 03-VALIDATION.md "Manual-Only Verifications"; CONTEXT deferred list. The Phase-3 unit tier covers realpath-first + case-fold via INJECTED realpath/case-sensitivity (no live FS matrix).                                             |

### Required Artifacts

| Artifact                                            | Expected                                                                              | Status   | Details                                                                                                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/filter-diagnostics.ts`                    | Pure `filterDiagnostics` (realpath-first + segment containment)                       | VERIFIED | 154 lines; type-only `import type ts`; exports `filterDiagnostics`/`FilterOptions`/`FilterResult`; memoized canonicalizer; segment node_modules + segment-bounded containment. WIRED -> run-typecheck.ts, index.ts. Data flows from real compiler in integration.     |
| `src/core/evaluate-result.ts`                       | Pure `evaluateResult(result,{maxWarnings})->{success}`                                | VERIFIED | 59 lines; type-only `import type { CoreResult }`; errors-always-fail short-circuit + finite-non-negative maxWarnings gate. Exported from index.ts.                                                                                                                    |
| `src/core/format-report.ts`                         | Pure `formatReport(diagnostics,ng,ts_,opts)->string`                                  | VERIFIED | 108 lines; type-only `import type ts` + `CompilerCli`; injected renderer; deterministic host; fail-fast slice; ANSI gate. No console/process.exit/module-scope compiler import. Exported from index.ts.                                                               |
| `src/core/compiler-cli-types.ts`                    | CompilerCli widened with formatDiagnostics (type-only)                                | VERIFIED | `formatDiagnostics: typeof formatDiagnostics` added to the deep import + interface; build resolves under nodenext.                                                                                                                                                    |
| `src/core/run-typecheck.ts`                         | includeDeps/pathBase on CoreOptions; suppressedCount on CoreResult; filter+sort wired | VERIFIED | `CoreOptions.includeDeps`/`pathBase` (:18,23); `CoreResult.suppressedCount` (:50); `finalize` calls `filterDiagnostics` (:277) + `ts.sortAndDeduplicateDiagnostics` (:288) on the normal path; `basePath` not `rootDir`; guard path keeps `suppressedCount: 0`.       |
| `src/index.ts`                                      | Re-exports the 3 new pure functions + types                                           | VERIFIED | `evaluateResult`/`filterDiagnostics`/`formatReport` + `EvaluateOptions`/`FilterOptions`/`FilterResult`/`FormatOptions`; existing exports intact.                                                                                                                      |
| `eslint.config.mjs`                                 | core/\*\* import ban + no-console + process.exit ban; dependency-checks unchanged     | VERIFIED | `files:['**/src/core/**/*.ts']` override (:16-64); dependency-checks/nx-plugin-checks blocks unchanged.                                                                                                                                                               |
| `src/core/*.spec.ts` (3 new)                        | Pure-function unit coverage (no compiler mock)                                        | VERIFIED | filter (7) + evaluate (9) + format (11) cases; all green; D-13 honored (hand-built ts.Diagnostic[] / injected ng+ts).                                                                                                                                                 |
| `fixtures/sibling-import/{main-lib,dependency-lib}` | main-lib imports dependency-lib via paths alias, both with deliberate TS2322          | VERIFIED | `dependency.ts` (out-of-project TS2322), `main.component.ts` (in-project TS2322 + paths import), `tsconfig.lib.json` (paths alias, files list). Deliberate errors are the fixture INPUT (documented), not stubs. Under `fixtures/` (discovered dir, not Nx-excluded). |
| `run-typecheck.integration.spec.ts`                 | sibling-import boundary-filter proof (4 cases)                                        | VERIFIED | default-suppress, includeDeps-folds-back, sorted-by-file, no-TS6059 -- all green against the REAL Angular 22 compiler.                                                                                                                                                |

### Key Link Verification

| From               | To                                                 | Via                                                                                     | Status | Details                                                                                                             |
| ------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| run-typecheck.ts   | filter-diagnostics.ts                              | `import { filterDiagnostics }` + call in `finalize`                                     | WIRED  | `:8` import, `:277` call on the normal path.                                                                        |
| run-typecheck.ts   | ts.sortAndDeduplicateDiagnostics                   | sort the kept set before counting                                                       | WIRED  | `:288`; D-09 integration case proves alphabetical-by-file order.                                                    |
| run-typecheck.ts   | live program host basePath                         | `parsed.options.basePath` + `result.program.getTsProgram().useCaseSensitiveFileNames()` | WIRED  | `:192-196`; uses basePath NOT rootDir (verified in source + comment).                                               |
| evaluate-result.ts | run-typecheck.ts                                   | type-only `import type { CoreResult }` (Pick errorCount/warningCount)                   | WIRED  | `:23`; `Pick<CoreResult,'errorCount'\|'warningCount'>` signature.                                                   |
| format-report.ts   | @angular/compiler-cli formatDiagnostics (injected) | `ng.formatDiagnostics([...toRender], host)`                                             | WIRED  | `:80`; injected `Pick<CompilerCli,'formatDiagnostics'>`, proven with both vi.fn fake and real ts.formatDiagnostics. |
| eslint.config.mjs  | src/core/\*_/_.ts                                  | files-scoped no-restricted-imports override                                             | WIRED  | `:16`; negative-control probe confirmed the rule fires (2 errors on a banned type-only import).                     |
| index.ts           | core/{filter,evaluate,format}                      | re-export of functions + types                                                          | WIRED  | `:2-7`; build resolves all symbols.                                                                                 |

### Data-Flow Trace (Level 4)

| Artifact              | Data Variable                                         | Source                                                                                                                                                                   | Produces Real Data                                                                                                                                           | Status  |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| run-typecheck.ts      | `CoreResult.diagnostics` / `suppressedCount` / counts | REAL `@angular/compiler-cli@22.0.4` `performCompilation` over the committed sibling-import + gate-b fixtures, then `filterDiagnostics` + `sortAndDeduplicateDiagnostics` | Yes -- live integration: default `suppressedCount>=1` with the in-project diag kept; `includeDeps` folds back `suppressedCount:0`; sorted-by-file; no TS6059 | FLOWING |
| format-report.spec.ts | rendered report string                                | REAL `ts.formatDiagnostics` over hand-built diagnostics (absolute/relative-path + idempotency cases)                                                                     | Yes -- absolute path emitted when pathBase unset; workspace-root-relative `/`-normalized when set; byte-identical on repeat                                  | FLOWING |

The boundary filter is exercised end-to-end against the REAL Angular compiler
over committed fixtures with genuine type errors -- no hardcoded diagnostic
arrays in the production path. The pure functions are additionally unit-tested
with hand-built diagnostics (D-13).

### Behavioral Spot-Checks

| Behavior                                        | Command                                                                                 | Result                                                                                                              | Status |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------ |
| Lint gate clean (WS-04 SC5)                     | `npx nx lint angular-typechecker --skip-nx-cache`                                       | exit 0; 2 pre-existing warnings, 0 errors                                                                           | PASS   |
| Build gate / GATE A                             | `npx nx build angular-typechecker --skip-nx-cache`                                      | Successfully ran target build                                                                                       | PASS   |
| GATE A `import(` retained                       | read built `compiler-loader.js` bytes                                                   | literal `yield import('@angular/compiler-cli')`; NO `require('@angular/compiler-cli')` anywhere in dist (rg exit 1) | PASS   |
| Full unit + integration suite                   | `npx nx test angular-typechecker --skip-nx-cache`                                       | 15 files, 70 tests, all pass                                                                                        | PASS   |
| core/\*\* import ban is live (negative control) | temp `core/` file with type-only `@nx/devkit` import -> `nx lint`                       | 2 no-restricted-imports ERRORS (exact + pattern), non-zero exit                                                     | PASS   |
| Prettier singleQuote compliance                 | `npx prettier --check` on phase files                                                   | All matched files use Prettier code style                                                                           | PASS   |
| No debt markers in phase source                 | `git grep -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` on the 6 modified source files | no matches (exit 1)                                                                                                 | PASS   |

### Probe Execution

No project probes declared for this phase (`scripts/*/tests/probe-*.sh` absent;
no PLAN/SUMMARY probe references). The phase's runnable verification is the
`nx lint` / `nx build` / `nx test` gate triad, executed live above. N/A.

### Requirements Coverage

| Requirement | Source Plan  | Description                                                                                    | Status                 | Evidence                                                                                                                          |
| ----------- | ------------ | ---------------------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| EXE-03      | 03-03        | Report-all default; opt-in fail-fast (return on first error)                                   | SATISFIED (core level) | `formatReport` fail-fast slice; report-all default; SC-1. The CLI flag wiring is Phase-4 (deferred item 1).                       |
| EXE-04      | 03-01        | Excludes out-of-project + node_modules by default; opt-in includeDeps                          | SATISFIED              | `filterDiagnostics` + integration; SC-2.                                                                                          |
| EXE-05      | 03-02        | `--max-warnings` (0=fail on any); errors always fail; categories respected                     | SATISFIED (core level) | `evaluateResult`; SC-1. The `--max-warnings` CLI parse is Phase-4 (deferred item 1).                                              |
| OUT-01      | 03-03        | Default human output via compiler-cli formatDiagnostics                                        | SATISFIED              | `formatReport` injected renderer; SC-3.                                                                                           |
| OUT-02      | 03-01, 03-03 | Filtered on absolute realpath-normalized fileName; CI annotation paths workspace-root-relative | SATISFIED              | Filter half (03-01) + path-emission half (03-03); SC-2 + SC-3. Cross-OS pnpm/case backstop deferred to Phase 6 (deferred item 5). |
| OUT-03      | 03-03        | Clear non-zero exit on diagnostics; deterministic, idempotent output                           | SATISFIED (core level) | Deterministic/idempotent output proven (SC-3); the non-zero EXIT is the Phase-4 adapter's job (deferred item 2).                  |
| TEST-01     | 03-01..04    | Unit tests cover gatherer/filtering/resolution/modes/max-warnings                              | SATISFIED              | SC-4; 70/70 suite; REQUIREMENTS marks Complete.                                                                                   |
| WS-04       | 03-04        | ESLint + Prettier + dependency-checks + module-boundary enforcement                            | SATISFIED              | SC-5; live lint exit 0 + negative-control probe; REQUIREMENTS marks Complete.                                                     |

All 8 Phase-3 requirement IDs declared across the four plans' `requirements`
frontmatter (EXE-03, EXE-04, EXE-05, OUT-01, OUT-02, OUT-03, TEST-01, WS-04) map
to Phase 3 in REQUIREMENTS.md. No orphaned requirements: REQUIREMENTS.md maps
exactly these 8 to Phase 3 and all appear in plan frontmatter. (REQUIREMENTS.md
still lists EXE-03/04/05 + OUT-01/02/03 as "Pending" -- the milestone audit
closes statuses post-verification; WS-04 + TEST-01 already marked Complete. This
status lag is not a phase-goal gap.) The three "core level" notes reflect the
documented Phase-3/Phase-4 seam, not partial implementation: the composable core
deliverable each requirement scopes to Phase 3 is fully present.

### Anti-Patterns Found

| File                                    | Line | Pattern                                                                      | Severity | Impact                                                                                                                                                          |
| --------------------------------------- | ---- | ---------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| config-resolution.integration.spec.ts   | 30   | `'NG' assigned but never used` (`@typescript-eslint/no-unused-vars` WARNING) | Info     | Pre-existing (Phase 2 02-02), logged in deferred-items.md. Warning only; does not affect lint exit (no `--max-warnings`). Not a Phase-3 file.                   |
| executors/angular-typecheck/executor.ts | 16   | `'_context' defined but never used` (WARNING)                                | Info     | Pre-existing (Phase 1), logged in deferred-items.md. Intentional thin-stub signature; resolved when the Phase-4 adapter consumes `context`. Not a Phase-3 file. |

No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in any phase-modified source. No empty
implementations, no hardcoded-empty data feeding rendering, no console/process in
core production source. The two documented `eslint-disable-next-line
@nx/enforce-module-boundaries` directives on the `compiler-cli-types.ts` nodenext
deep-import shim and the one `no-console` disable on the GATE-B timing `console.log`
in `gate-b.spec.ts` are intentional, documented exceptions (03-04 SUMMARY +
file-header rationale), not anti-patterns. No blocking anti-patterns.

### Human Verification Required

None. This is a composable-core + quality-gates deliverable whose entire contract
is automatable and was reproduced live by the verifier (lint exit 0 + a
negative-control ban probe, build + GATE A bytes, 70/70 tests including the
real-compiler boundary-filter integration, Prettier, debt-marker scan). No
visual / UX / real-time / external-service surface exists. The cross-OS
pnpm/mixed-case path backstop is intentionally deferred to the Phase-6 e2e matrix
(03-VALIDATION.md Manual-Only table), not a Phase-3 human-check item. The
PLAN files declare no `<verify><human-check>` blocks to harvest.

### Gaps Summary

No genuine gaps. All five ROADMAP Success Criteria are VERIFIED, all 20 plan
must-have truths are VERIFIED, and all eight Phase-3 requirements are SATISFIED at
the composable-core level the phase scopes -- each confirmed against the actual
source (read in full), the built `dist/` GATE-A bytes, and three live gates the
verifier ran independently (lint exit 0 + a live negative-control ban probe;
build green with `import(` retained; 70/70 tests across 15 files, including
real-compiler boundary-filter integration over committed fixtures with genuine
type errors).

The load-bearing claims hold empirically:

1. The project-boundary filter excludes out-of-project + node_modules diagnostics
   by default (realpath-first + path-SEGMENT classification, avoiding all three
   prior-art naive-filter landmines) and `includeDeps: true` folds them back --
   proven against the REAL Angular 22 compiler on a sibling-import fixture.
2. The pure verdict (`evaluateResult`) makes errors always fail and gates warnings
   by `maxWarnings` (0 = fail on any), defensive against negative/NaN.
3. The pure formatter (`formatReport`) renders via compiler-cli `formatDiagnostics`
   with deterministic, idempotent, absolute-by-default / workspace-root-relative-
   when-`pathBase`-set, TTY-gated output and reporting-only fail-fast.
4. The core/adapter boundary is MACHINE-enforced: a type-only `@nx/devkit` import
   in a core file produces lint errors and a non-zero gate (negative control), and
   `@nx/dependency-checks` remains enabled.

The items the goal text implies but that are user-facing wiring (the
`--max-warnings`/`includeDeps` CLI parse, the `{ success }` -> non-zero exit, the
`nx run :angular-typecheck` surface, `pathBase` <- `context.root`) are traceably
deferred to Phase 4 per the ROADMAP/REQUIREMENTS/CONTEXT, recorded under Deferred
Items -- a correct architectural seam, not a missed Phase-3 deliverable. The
cross-OS pnpm/mixed-case realpath backstop is deferred to the Phase-6 e2e matrix.

Phase 3 may proceed to Phase 4.

---

_Verified: 2026-06-28_
_Verifier: Claude (gsd-verifier)_
