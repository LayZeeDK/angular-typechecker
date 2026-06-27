# Phase 2: Core Type-Check Engine + Gatherer - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Grow the Phase-1 tracer-bullet `core/` into the real framework-agnostic engine: `runTypecheck(options)` loads ESM `@angular/compiler-cli` lazily (memoized), resolves a SINGLE tsconfig (full `extends` chain + Angular no-emit overrides), runs `@angular/compiler-cli` whole-program no-emit, gathers ALL diagnostics UNCONDITIONALLY (TS option/syntactic/semantic + Angular template type-check + extended NG8xxx), and returns a structured result -- with ZERO `@nx/devkit`/CLI imports so every deferred surface stays cheap.

Requirements covered: ENG-01, ENG-02, ENG-04, EXE-02, TEST-02.

This phase clarifies HOW to build the core contract. The engine approach (Approach A), the gatherer getter-order, the memoized `await import()` loader, the core/adapter split, and `module: nodenext` + the `compiler-cli-types` shim are LOCKED in PROJECT.md and Phase-1 CONTEXT and are NOT re-decided here. Filtering, modes, `--max-warnings`, `formatDiagnostics` output (Phase 3), the executor adapter / cacheable target (Phase 4), packaging (Phase 5), and the full e2e matrix (Phase 6) are OUT of scope.
</domain>

<decisions>
## Implementation Decisions

All decisions below are research-backed (four parallel `gsd-advisor-researcher` passes against the local Angular `compiler-cli` / `@angular/build` source, the Nx generator templates, and the sandbox prototype). Source citations are in `<canonical_refs>`.

### CoreResult contract (ENG-04) -- resolves Phase-1 review MD-02

- **D-01: Approach A result shape.** Count `errorCount` and `warningCount` EXPLICITLY by `ts.DiagnosticCategory` (NOT `total - errorCount`, the MD-02 bug). Keep the full `diagnostics[]` and `durationMs`. DROP `codes: number[]` from the PUBLIC contract -- it is a test affordance; specs derive it via `.map(d => d.code)`. Documented invariant: `errorCount + warningCount <= diagnostics.length` (Suggestion + Message categories stay inspectable in the array but are NOT counted in the scalars).
- **D-02: Force `diagnostics: false` in the options spread** (alongside the no-emit overrides). A consumer tsconfig that sets `diagnostics: true` would otherwise inject a "Time for diagnostics" Message (category Message) into the diagnostics array (`perform_compile.ts:295-300`). Forcing it false keeps counts and output clean.
- Consolidated final shape (after D-04 / D-06 / D-07 below):
  ```ts
  interface CoreResult {
    tsConfigPath: string;                    // resolved absolute path actually checked (D-07b)
    rootNamesCount: number;                  // input file count; 0 => the D-03 guard fired
    diagnostics: readonly ts.Diagnostic[];   // GENUINE compiler diagnostics only (D-06)
    errorCount: number;                      // category === Error
    warningCount: number;                    // category === Warning (explicit, not total - errors)
    durationMs: number;
  }
  ```
- **Category facts the planner MUST encode correctly** (verified against Angular 22 `error_code.ts`):
  - Extended NG8xxx diagnostics default to category **Warning** -> they land in `warningCount`. If a consumer sets `extendedDiagnostics.defaultCategory: "error"`, category-based counting auto-promotes them to `errorCount` for free.
  - **NG8101 = `INVALID_BANANA_IN_BOX` is a WARNING**, not a suggestion (corrects an error in the CoreResult research summary; verified at `error_code.ts:496`).
  - The genuine **Suggestion**-category diagnostic that can reach the gather path via `getNgSemanticDiagnostics()` is **NG10002 = `SUGGEST_SUBOPTIMAL_TYPE_INFERENCE`** (`error_code.ts:724`; pushed as `ts.DiagnosticCategory.Suggestion` at `oob.ts:259-268`) -- it fires when a structural directive supports advanced type inference but `strictTemplates` is OFF. This is the proof that the MD-02 category-conflation fix is real, not theoretical.
  - Negative NG code encoding (`ngErrorCode = parseInt('-99' + code)`, e.g. NG8109 -> -998109) affects DISPLAY only; counting is by `.category` and is independent of the code sign. Do NOT bucket by code sign.

### tsconfig resolution + zero-rootNames guard (ENG-01, EXE-02, success criterion 3) -- resolves Phase-1 review MD-01

- **D-03: Fail loud, errors RETURNED (never thrown) for config problems.** (1) Always prepend `parsed.errors` (from `ng.readConfiguration`) to the diagnostics before counting -- this closes the dropped-errors half of MD-01 (covers nonexistent/malformed/unreadable tsconfig). (2) If `rootNames.length === 0`, SHORT-CIRCUIT (skip `performCompilation`) and synthesize ONE `ts.Diagnostic` (category **Error**, private code in an `angular-typechecker` namespace e.g. `ATC1001`, `file: undefined`) with an actionable message; tailor "solution-style / references-only -- point at a leaf tsconfig (tsconfig.app.json / tsconfig.lib.json / tsconfig.spec.json)" vs "empty project" using `parsed.projectReferences?.length`. (3) Returning (not throwing) mirrors compiler-cli's own `exitCodeFromResult` contract and gives agents/CI a deterministic non-zero exit.
- **D-03a: Detection gates on `rootNames.length === 0`, NEVER on TS18003.** TypeScript deliberately SUPPRESSES TS18003 ("No inputs were found") when a config has a `references` array (`canJsonReportNoInputFiles = !hasProperty(raw,"files") && !hasProperty(raw,"references")`), and the Nx-generated root `tsconfig.json` is exactly `{ files:[], include:[], references:[...] }` -- so TS18003 will NOT fire for the most common silent-lie input. The empty-rootNames signal is the reliable gate.
- **D-03b: Reference-expansion is a CONFIRMED dead end** -- ngtsc never consults `parsed.projectReferences` (pass-through field only; absent from `program.ts` / `entry_points.ts`). This is the code-level proof of PROJECT.md's "Angular lacks TypeScript project-references support." The core type-checks ONE leaf tsconfig; it does NOT implement `tsc -b` solution traversal.
- **D-04: The core requires an ABSOLUTE `tsConfigPath`.** The core never touches `process.cwd()`. The Phase-4 executor resolves `options.tsConfig` against `context.root`; tests pass `path.resolve(...)`. A directory path still passes through to `readConfiguration` -> `calcProjectFileAndBasePath`, which auto-appends `tsconfig.json` (free behavior; documented). Keeping resolution out of the core preserves framework-agnostic purity and reproducibility.

### No-emit override set (ENG-01, success criterion 1)

- **D-05: Deliberate normalization (NOT the minimal `{ ...parsed.options, noEmit: true }`).** The minimal override is BROKEN on modern Nx 23 TS-solution workspaces: their `tsconfig.base.json` sets `composite: true` + `emitDeclarationOnly: true` on EVERY project (app, lib, AND spec), and `noEmit` + either of those produces a bogus **TS5053** option-diagnostic that the unconditional `getTsOptionDiagnostics()` reports as an error -- failing every project for the wrong reason. Apply the full emit-neutralizing override, keeping all semantics-defining options untouched:
  ```ts
  const options: ts.CompilerOptions = {
    ...parsed.options,
    noEmit: true,
    // Break the composite/declaration/emitDeclarationOnly triangle (TS5053 / TS6304).
    composite: false,
    declaration: false,
    declarationMap: false,
    emitDeclarationOnly: false,
    // Idempotency / determinism: no builder program, no .tsbuildinfo, no maps.
    incremental: false,
    tsBuildInfoFile: undefined,
    sourceMap: undefined,
    inlineSourceMap: undefined,
    inlineSources: undefined,
    declarationDir: undefined,
    mapRoot: undefined,
    sourceRoot: undefined,
  };
  ```
- **D-05a: `emitFlags: 0` stays the load-bearing emit suppressor** (`perform_compile.ts:302-309` -- emit is gated by `emitFlags`, not `noEmit`). `noEmit: true` is belt-and-suspenders + intent signal.
- **D-05b: KEEP verbatim** (changing them changes the type-check result, violating "honor configured diagnostics"): `module`, `moduleResolution`, `target`, `lib`, `paths`, `customConditions`, `strictTemplates`, and every `angularCompilerOptions.extended*`. Do NOT copy angular-cli's `module`->ES2022 bump (that is for bundling, not type-checking).
- **D-05c:** Spec tsconfigs (`tsconfig.spec.json`) inherit the same TS-solution base, so they ALSO carry `composite`/`emitDeclarationOnly` and need the same normalization -- do not assume specs are emit-clean.

### Infrastructure-failure vs diagnostic (ENG-04, agent-ready determinism)

- **D-06: Detect and RE-THROW infrastructure failures so `CoreResult` holds ONLY genuine compiler diagnostics.** (1) `loadCompilerCli()` failures (ESM load of `@angular/compiler-cli`) already throw OUTSIDE `performCompilation` -- let them propagate (true environment/install error). (2) `performCompilation` swallows any internal crash (in `createProgram`, the host, or a gatherer getter) into a single Error diagnostic with `code: api.UNKNOWN_ERROR_CODE`, `file: undefined` (`perform_compile.ts:314-327`); detect a returned `UNKNOWN_ERROR_CODE` and re-throw it as an internal error rather than counting it as "1 type error." This keeps `errorCount` meaning ONLY real type errors. The Phase-4 executor catches the throw and maps it to a distinct failure message/exit.

### Diagnostic gatherer (ENG-02) -- carried from Phase 1, minor fix

- The unconditional all-getter `gatherAllDiagnostics` (getter order locked by D-16) is correct as-built and is the ENG-02 differentiator (no `ngc`-style phase short-circuit). No re-design.
- **Resolve Phase-1 review LW-01:** import `Program` from `./compiler-cli-types` (the nodenext-safe shim), NOT the `@angular/compiler-cli` barrel, in `gather-diagnostics.spec.ts` and anywhere else. Settled fix, not a gray area.

### Integration tests + fixtures (TEST-02, success criterion 4)

- **D-07: Static hand-authored broken fixtures, representative-subset scope.** Each fixture is a minimal standalone-component source file with its own committed `tsconfig.*.json` (extending a shared base, `strictTemplates: true`), the broken source committed AS-IS. Reject programmatic injection (jscodeshift-style) -- AST transforms silently no-op on node-shape drift across Angular majors -> FALSE GREEN; static fixtures break loudly when a code stops firing.
- **D-07a: Coverage scope = representative subset (~6-8 differentiator fixtures), NOT the full ~28-code catalog now.** Criterion 4's "across the v13->v22 catalog (organized by introduction version)" is satisfied by the per-introduction-version FILE ORGANIZATION (`executor.angularNN.integration.spec.ts`), not by exhaustively asserting all 28 codes -- the catalog itself states "coverage taxonomy, not a multi-version matrix," all on Angular 22. Differentiator set: a TS baseline (TS2322 + a template-driven TS2339), an NG baseline (e.g. NG8001 unknown element + NG2003 missing injection token), extended NG8xxx spanning the range (NG8101 v13 early + a late one e.g. NG8109 v17 or NG8021 v21, proving negative-encoding + `defaultCategory:"error"` promotion), and -- the single most valuable fixture -- ONE multi-error fixture (a plain TS error AND a template/extended error in the same program) proving the no-short-circuit gatherer (ENG-02). Full-catalog growth is then purely ADDITIVE (drop-in `angularNN/` files).
- **D-07b: Project-type tsconfigs in Phase 2 = application + local (non-buildable) library + `tsconfig.spec.json`.** The spec tsconfig is the named differentiator vs a build check (criterion 3) and MUST be present. Buildable + publishable libraries are deferred to Phase 6 e2e (tarball/Verdaccio tier).
- **D-07c: Engine path = call `runTypecheck({ tsConfigPath })` DIRECTLY** against committed fixture tsconfigs (REAL compiler, per TEST-02). One `performCompilation` per fixture, MULTIPLE assertions per program. Do NOT share one program across fixtures (per-fixture `extendedDiagnostics` promotion differs; the fresh-options spread guards the noEmit-mutation footgun). Reserve the heavy `runExecutor` / `createProjectGraphAsync` machinery for ONE executor-wiring smoke test (the sandbox proved this path forces 60s timeouts + lock gymnastics).
- **D-07d: Assert EXACT codes + counts** via a `const NG = (c: number) => -990000 - c;` helper (so NG8109 -> assert `-998109`); recover human codes via `Math.abs(code) - 990000`. Drop the sandbox's success-boolean-only assertions -- they do not meet TEST-02. Be explicit per fixture about whether an extended diagnostic is asserted as a Warning (default category, present in `codes`) or promoted to Error via `extendedDiagnostics.defaultCategory: "error"` -- otherwise a test can fail for the wrong reason.

### Claude's Discretion
- Exact fixture directory/file names and the shared-base tsconfig layout; precise Vitest unit-vs-integration config split; the private synthesized-diagnostic code value/namespace (e.g. `ATC1001`); the exact throw type for D-06 infra failures and how the Phase-4 executor maps it (Phase 4 concern); module-level memoization of `loadCompilerCli`/`loadTypescript` is already correct and reused across multiple `runTypecheck` calls in one process.
- Re-verify exact NG code numbers + names against the Angular 22 clone on implementation (the catalog flags this at its top; e.g. NG8116 shipped 19.2.0 despite docs lag; NG8110/NG8112 are NOT documented extended diagnostics -- do not author fixtures for them).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 spec + scope (this repo)
- `.planning/PROJECT.md` -- locked stack, dependency model, module format, engine approach (Approach A), Key Decisions.
- `.planning/REQUIREMENTS.md` -- ENG-01, ENG-02, ENG-04, EXE-02, TEST-02 (the Phase 2 set).
- `.planning/ROADMAP.md` Phase 2 section -- goal + 4 success criteria.

### Phase 1 carry-forwards (this repo) -- MUST read; these decisions are built on Phase 1
- `.planning/phases/01-workspace-bootstrap-engine-spike-gated/01-CONTEXT.md` -- D-16 (gatherer getter-order), D-17/D-18 (GATE B fixture + stable 22.0.4), engine specifics.
- `.planning/STATE.md` Accumulated Context -- the three Phase-2 code-review inputs: MD-01 (dropped `readConfiguration` errors -> resolved by D-03), MD-02 (warning-count conflation -> resolved by D-01), LW-01 (barrel import -> resolved in gatherer section).
- `.planning/research/DIAGNOSTIC-CATALOG.md` -- the v13->v22 catalog + per-introduction-version test organization + provenance method (`git tag --contains` over docs-diff). Primary input for D-07.

### Project research (this repo)
- `.planning/research/ARCHITECTURE.md` -- core/adapter split + proposed tree. CAVEAT (from 01-CONTEXT): lines ~314 / ~376 stale on dep classification; PROJECT.md is authoritative.
- `.planning/research/FOLLOWUP-FINDINGS.md` -- engine confirmation vs Angular v22 source; `@nx/vitest:test`; node16.
- `.planning/research/PITFALLS.md` -- `import()`->`require()` rewrite (GATE A, now proven); fresh-options-per-call.

### Current tracer-bullet core (this repo) -- the code Phase 2 grows
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- current `runTypecheck` + `CoreResult` (the minimal `{...parsed.options, noEmit:true}` to REPLACE per D-05; the `warningCount = total - errorCount` to FIX per D-01; the dropped `parsed.errors` to FIX per D-03).
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- the unconditional all-getter (keep; ENG-02).
- `packages/angular-typechecker/src/core/compiler-loader.ts` -- memoized `await import('@angular/compiler-cli')` (keep; ENG-03).
- `packages/angular-typechecker/src/core/compiler-cli-types.ts` -- nodenext-safe type shim (import `Program` from HERE per LW-01; widen as the engine grows).

### External reference codebases (absolute paths, read-only; re-validate against locked Angular 22.0.4 / TS 6.0.3)
- `D:/projects/github/angular/angular/packages/compiler-cli/src/perform_compile.ts` -- `readConfiguration` (75-181), `calcProjectFileAndBasePath` (62), `performCompilation` outer try/catch + `UNKNOWN_ERROR_CODE` synth (255-327, esp. 314-327), emit gated by `emitFlags` (302-309), `options.diagnostics` Message (295-300), `exitCodeFromResult`/`hasErrors` (244-253), `ParsedConfiguration` (53-60).
- `D:/projects/github/angular/angular/packages/compiler-cli/src/ngtsc/program.ts` -- plain `ts.createProgram` (82-84); confirms no builder/incremental program on this path; `getTsOptionDiagnostics` -> options diagnostics; `emitFlags & JS` gate (293).
- `D:/projects/github/angular/angular/packages/compiler-cli/src/ngtsc/diagnostics/src/error_code.ts` -- `INVALID_BANANA_IN_BOX = 8101` (496), `INTERPOLATED_SIGNAL_NOT_INVOKED = 8109` (586), `SUGGEST_SUBOPTIMAL_TYPE_INFERENCE = 10002` (724), `DEFER_TRIGGER_MISCONFIGURATION = 8021` (447).
- `D:/projects/github/angular/angular/packages/compiler-cli/src/ngtsc/diagnostics/src/util.ts` -- `ngErrorCode = parseInt('-99' + code)` (26-28).
- `D:/projects/github/angular/angular/packages/compiler-cli/src/ngtsc/typecheck/src/oob.ts` -- NG10002 Suggestion push in the gather path (259-268).
- `D:/projects/github/angular/angular/packages/compiler-cli/test/perform_compile_spec.ts` + `test/ngtsc/extended_template_diagnostics_spec.ts` + `.../typecheck/extended/test/checks/invalid_banana_in_box/invalid_banana_in_box_spec.ts` -- Angular's own idiom for asserting EXACT codes (`ngErrorCode(ErrorCode.X)`, `env.driveDiagnostics()`, `path.resolve` real-FS) -- the assertion pattern to mirror for D-07.
- `D:/projects/github/angular/angular-cli/packages/angular/build` -- `src/tools/esbuild/angular/compiler-plugin.ts:697-758` (option normalization: `composite:false`, sourcemap clearing, incremental handling -- the model for D-05); `src/tools/angular/compilation/{angular-compilation.ts,aot-compilation.ts}` (diagnostic bucketing + the real EMIT path that DOES write `.tsbuildinfo`, contrast vs our no-emit path).
- `D:/projects/github/nrwl/nx` -- `@nx/js` generator templates: `.../generators/init/files/ts-solution/tsconfig.base.json__tmpl__` (composite/declarationMap/emitDeclarationOnly true workspace-wide -- the reason D-05 is mandatory) and `.../generators/library/files/tsconfig-lib/{ts-solution,non-ts-solution}/tsconfig.lib.json__tmpl__`; the generated solution-style root `tsconfig.json` shape (the D-03 silent-lie input).
- `D:/projects/github/push-based/nx-verdaccio` -- real Nx plugin structure: integration fixtures + Vitest layout reference.
- `D:/projects/sandbox/nx19-8-angular18-2-esbuild-playwright-storybook` -- prior prototype (Angular 18.2, version-bound): `gatherAllDiagnostics` shape, NG8xxx fixtures, `injectMultipleErrors` (the anti-pattern D-07 improves on), `executor.angularNN.integration.spec.ts` split, `INTEGRATION-TESTING-LEARNINGS.md` (Nx discovery-exclusion + lock pitfalls; Vitest-over-Jest ESM rationale).

### External issue references (option-conflict provenance for D-05)
- TS5053 (`noEmit` + `composite` / `emitDeclarationOnly`): microsoft/TypeScript#36917, #32380. TS6304 ("Composite projects may not disable declaration emit"): ionic-team/stencil#2349, TypeStrong/ts-node#656.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- The entire Phase-1 tracer-bullet `core/` (`run-typecheck.ts`, `gather-diagnostics.ts`, `compiler-loader.ts`, `compiler-cli-types.ts`) is the promoted seed; Phase 2 grows it in place (NOT a rewrite). `runTypecheck` + `CoreResult` already exist with `codes`/`errorCount`/`warningCount`/`durationMs` and the fresh-options-per-call guard.
- `gatherAllDiagnostics` is the production-ready ENG-02 gatherer as-is.
- The sandbox's NG8xxx fixture shapes + per-version spec split are portable structure (re-validate sources on Angular 22).

### Established Patterns
- Core is framework-agnostic with ZERO `@nx/devkit`/CLI imports; value-imports `@angular/compiler-cli` only via the single memoized `await import()` in `compiler-loader.ts`; everywhere else uses `import type` through the `compiler-cli-types` shim (nodenext-safe). Phase 2 keeps this invariant absolutely (module-boundary enforcement lands in Phase 3 / WS-04).
- `@nx/js:tsc` -> CJS `.js` + `.d.ts` under `module: nodenext`; the built `compiler-loader.js` must retain literal `import(` (GATE A, proven Phase 1).

### Integration Points
- `runTypecheck(CoreOptions): Promise<CoreResult>` is the sole core seam. The Phase-4 executor adapter (sub-50-line) is the first consumer: it resolves `tsConfig` -> absolute path (D-04), calls `runTypecheck`, catches D-06 throws, and maps `{ errorCount }` -> `{ success }`. Phase 3 filtering/modes/`--max-warnings`/`formatDiagnostics` also consume `CoreResult` (diagnostics[] + counts).
</code_context>

<specifics>
## Specific Ideas

- Final `CoreResult` interface fields and order are specified verbatim in D-01.
- The exact no-emit override object is specified verbatim in D-05.
- The zero-rootNames guard message must name the leaf tsconfigs explicitly: `tsconfig.app.json` / `tsconfig.lib.json` / `tsconfig.spec.json` (D-03).
- The `NG(c) => -990000 - c` assertion helper and the multi-error ENG-02 fixture are the named must-haves for the test suite (D-07).
</specifics>

<deferred>
## Deferred Ideas

All deferrals below are roadmap-scoped to later phases (NOT new capabilities / not scope creep):
- Out-of-project + `node_modules` diagnostic filtering (absolute realpath-normalized `fileName`) -> Phase 3 (OUT-02).
- Report-all/fail-fast modes + `--max-warnings=<n>` + deterministic/idempotent `formatDiagnostics` human output + non-zero exit semantics -> Phase 3 (EXE-03/04/05, OUT-01/02/03). The D-06 throw-to-exit mapping and the D-01 count fields are the inputs these consume.
- Unit tests that MOCK `@angular/compiler-cli` (gatherer/filtering/tsconfig-resolution/modes/`--max-warnings`) -> Phase 3 (TEST-01). Phase 2 owns the REAL-compiler integration tier (TEST-02) only.
- ESLint + Prettier + `@nx/dependency-checks` + module-boundary enforcement of `core/` vs adapters -> Phase 3 (WS-04).
- The Nx executor adapter, schema.json/normalize-options, cacheable target inputs, and the dependency-error-busts-cache test -> Phase 4 (EXE-01/06/07, TEST-04). `tsConfig`->absolute resolution (D-04) and the D-06 throw mapping are realized here.
- Buildable + publishable library fixtures and the full 5-project-type matrix + pnpm/mixed-case assertions -> Phase 6 e2e (TEST-03, CI-01).
- Full v13->v22 catalog assertions beyond the D-07a differentiator subset -> additive growth in later passes (drop-in per-version files).
- `NgtscProgram` per-file migration / incremental / `--watch` -> deferred milestone (REP-02).

None of the discussion drifted outside the Phase 2 boundary.
</deferred>

---

*Phase: 2-Core Type-Check Engine + Gatherer*
*Context gathered: 2026-06-27*
