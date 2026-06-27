---
gsd_state_version: 1.0
milestone: v0.0.1
milestone_name: milestone
status: executing
stopped_at: Phase 3 context gathered
last_updated: "2026-06-27T23:41:53.885Z"
last_activity: 2026-06-27
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 11
  completed_plans: 11
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-27)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 03 — filtering-modes-output-quality-gates

## Current Position

Phase: 03 (filtering-modes-output-quality-gates) — COMPLETE (all 4 plans executed)
Plan: 4 of 4
Status: Phase 03 complete -- ready for verify/secure/validate then Phase 04
Last activity: 2026-06-27 -- Phase 03 plan 04 (quality gates) executed

Progress: [██████░░░░] 3 of 6 phases (50%)

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: ~31 min
- Total execution time: ~1.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | ~92 min | ~31 min |
| 02 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: 01-01 (~22 min), 01-02 (~30 min), 01-03 (~40 min)
- Trend: steady

*Updated after each plan completion*
| Phase 01 P04 | 25 | 3 tasks | 3 files |
| Phase 03 P04 | ~12 min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Engine-before-Nx, riskiest-first phase order: a fully testable core engine exists before any Nx code; Phase 1 is a GATED spike.
- Module: CJS executor + `await import()`, compiled `.js` with `module: node16`/`nodenext` (NOT `commonjs`) -- assert emitted `.js` still contains `import(`.
- Dependency model: `@nx/devkit` pinned dependency (no `nx`); `@angular/compiler-cli` + `typescript` as peers.
- Test runner: Vitest via `@nx/vitest:test` (NOT `@nx/vite:test`).
- [01-01] Bootstrapped via Mechanism B (D-01/D-02/D-03): `create-nx-workspace@23.0.1 --preset=apps` in a temp sibling, copied dotfile-safe over the preserved root `.git/`; HEAD provably unchanged; `.planning/` + `CLAUDE.md` restored byte-identical.
- [01-01] `--preset=apps` is a minimal empty integrated workspace: CNW 23.0.1 does NOT emit `tsconfig.base.json`/`.prettierrc`/`apps/.gitkeep`. Plan 01-02 now owns creating/validating `tsconfig.base.json` when the first project is generated.
- [01-01] Root toolchain pinned EXACT (D-15): nx/@nx/* 23.0.1, typescript 6.0.3, @angular/compiler-cli 22.0.4; root workspace name `@angular-typechecker/source`.
- [01-02] Plugin tsconfig module patched commonjs -> nodenext (GATE A enabler); generated plugin build outputPath = dist/packages/angular-typechecker (Plan 04 derives the executor path from this verbatim).
- [01-02] Re-pinned all @angular/* framework+tooling deps from generator default ~21.2.0 to EXACT 22.0.4 (locked stack is Angular 22; @nx/angular generator defaulted to Angular 21 which conflicts with @angular/compiler-cli@22.0.4).
- [01-02] .npmrc legacy-peer-deps=true: @nx/angular@23.0.1 caps @angular/build / @angular-devkit/* / @schematics/angular peers at < 22.0.0; the locked Angular-22 tree legitimately exceeds it (documented reconciliation; revisit when a stable @nx/angular admits Angular 22).
- [01-02] tsconfig.base.json + .prettierrc were created by the @nx/plugin:plugin generator on first-project scaffold (resolves the Wave 1 carryover; no manual creation needed).
- [01-03] Added an isolated type-only shim (src/core/compiler-cli-types.ts) re-exporting the compiler-cli surface from the package DEEP declaration files; the barrel index.d.ts does NOT type-resolve under module:nodenext (extensionless `export *` fails strict ESM resolution -> empty namespace). Preserves the locked module:nodenext (GATE A emit) instead of retreating to module:commonjs + a Function-wrapped import.
- [01-03] GATE A static target for Plan 04 is the BUILT compiler-loader.js (it holds the literal `import('@angular/compiler-cli')`), NOT executor.js -- the `await import()` lives in core per the mandated core/adapter split; executor.js is a thin delegate carrying only the negative assertion (no `require('@angular/compiler-cli')`).
- [01-03] Angular extended diagnostic codes are encoded NEGATIVE on `ts.Diagnostic.code`: `ngErrorCode(8109) === -998109`. Plan 04 GATE B must assert on -998109 (or recover via `Math.abs(code) - 990000 === 8109`), NOT the bare 8109.
- [01-04] Spike GO/NO-GO = GO: all six checklist items pass on app + lib (all-getter [2322,-998109,-998117]; ngc default [2322]); cold-run durationMs ~296ms on Node 24.18.0. Phase 2 may begin (ROADMAP GATED note satisfied).
- [01-04] GATE A static asserts the BUILT artifacts via fs.readFileSync (dist gitignored, never git grep): positive import-call on core/compiler-loader.js, negative require-of-compiler-cli on BOTH built files (comment-stripped); dist path derived from project.json build.options.outputPath.
- [01-04] GATE B asserts the negative-encoded NG8109 (-998109), never bare 8109, with a Math.abs(c)-990000===8109 recovery helper; differential drives ng.defaultGatherDiagnostics vs gatherAllDiagnostics off the SAME parsed config with a FRESH options spread per call.
- [verify] Phase 01 VERIFIED PASSED (01-VERIFICATION.md): 4/4 success criteria, 6/6 go/no-go items GO, 6/6 requirements (WS-01/02/03, ENG-03, CMP-01/02) satisfied; verifier reproduced the gate live (no genuine gaps; all deferrals correctly roadmap-scoped).
- [code-review] Phase 01 advisory code review CLEAN (01-REVIEW.md): 0 Critical/High. Two Medium findings carried to Phase 2 (see Blockers/Concerns).
- [03-04] WS-04 boundary enforced via a files-scoped `@typescript-eslint/no-restricted-imports` override on `**/src/core/**/*.ts` (bans `nx`/`@nx/devkit`/`@angular-devkit/architect`/`yargs` + `@nx/*`/`@angular-devkit/*` families incl. type-only; `allowTypeImports` OMITTED) + `no-console` + a `process.exit` ban -- because `@nx/enforce-module-boundaries` is project/tag-granular and cannot ban a folder within one project. `@nx/dependency-checks` + `@nx/nx-plugin-checks` left untouched (D-12).
- [03-04] Resolved the 2 pre-existing `@nx/enforce-module-boundaries` errors on the nodenext deep-import shim (`compiler-cli-types.ts:15`/`:20`, owned by 03-04 per deferred-items.md) with two targeted `eslint-disable-next-line` directives -- NOT a root allow-regex widening -- so the WS-04 lint gate (`nx lint` exit 0, SC5) genuinely passes while enforcement stays intact everywhere else. The directive must sit on the line immediately before each `import` (above the leading comment block triggers "Unused eslint-disable directive").
- [03-04] Exported `filterDiagnostics`/`evaluateResult`/`formatReport` (+ option/result types) from `src/index.ts` for the Phase-4 adapter to compose. Phase-3 lint gate clean (exit 0; 2 pre-existing unused-vars WARNINGS remain, out of scope), full unit suite 15 files / 70 tests green, build green (GATE A `import(` retained).

### Pending Todos

[From .planning/todos/pending/ -- ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- [RESOLVED] Phase 1 GATED concern: the spike PROVED both unknowns -- (a) the built `compiler-loader.js` retains literal `import(` under `module:nodenext` (no `require()` downlevel; runtime loads ESM compiler-cli with no `ERR_REQUIRE_ESM`), and (b) the unconditional all-getter surfaces NG8109 (`-998109`) that ngc's `defaultGatherDiagnostics` suppresses, with a co-located TS2322, on app + lib. GO -- Phase 2 may begin.
- [Phase-2 input, code-review MD-01] `run-typecheck.ts` silently drops `ng.readConfiguration(...).errors`; a malformed/unresolvable tsconfig can yield empty `rootNames` and report `errorCount: 0` / `success: true` (false "clean" for a type-checker). The Phase-1 gate never exercises a broken config. Fold `parsed.errors` into diagnostics before counting when the real engine lands (ENG-01).
- [Phase-2 input, code-review MD-02] `warningCount = total - errorCount` conflates Warning + Suggestion + Message categories (and would miscount ngc's "Time for diagnostics" Message if a consumer sets `diagnostics: true`). Count the `Warning` category explicitly (ENG-04).
- [Phase-2 input, code-review LW-01] `gather-diagnostics.spec.ts` imports `Program` from the `@angular/compiler-cli` barrel (the import the `compiler-cli-types.ts` shim exists to avoid under `module:nodenext`) -- works only because specs are not lib-compiled. Import from `./compiler-cli-types` for consistency.
- WS-01 wrinkle: `create-nx-workspace` wants a fresh dir but the repo already has `.git` + `.planning/` -- the bootstrap must handle in-place creation without clobbering tracked files.
- Cache-correctness for non-buildable deps has tracked Nx gaps (`namedInputs` not honored for source/inlined libs; `externalDependencies` over/under-invalidation) -- treat the dependency-error-busts-cache test (Phase 4) as a correctness gate.
- pnpm-symlink + case-insensitive FS path filtering is invisible under npm/Linux -- the pnpm fixture + mixed-case assertion (Phase 6) is the backstop.
- Source note: the v0.0.1 checklist enumerates 30 distinct requirement IDs; the original "26 total" header was a miscount. All 30 are mapped (see REQUIREMENTS.md Traceability).
- [01-02 CAVEAT] The workspace now relies on `legacy-peer-deps=true` (committed `.npmrc`) because @nx/angular@23.0.1's peer ranges cap Angular tooling at < 22.0.0 while the locked stack is Angular 22. CI and all future `npm install`s inherit this. Not a blocker (both projects build green), but revisit when a stable @nx/angular release admits Angular 22 in its peers (the 23.1.x line) so the override can be dropped.
- [01-02 PROGRESS] GATE A enabling half is in place: the plugin tsconfig is patched to `module: nodenext` and the plugin builds clean under it. The remaining GATE A/B proof (built executor.js retains `import(`; unconditional gatherer surfaces NG8109 + TS2322) lands in Plans 01-03/01-04.
- [01-03 PROGRESS] GATE A/B engine validated ahead of the formal Plan 04 spec suite: `nx build angular-typechecker` succeeds and the built `compiler-loader.js` retains a literal `import('@angular/compiler-cli')` (no `require()` downlevel); `require()`-loading the built CJS executor against the fixture ran with no `ERR_REQUIRE_ESM` (GATE A runtime). A throwaway all-getter probe on both fixture tsconfigs returned `[2322, -998109, -998117]` while ngc's `defaultGatherDiagnostics` returned only `[2322]` (GATE B positive + differential; NG8109 fires on stable 22.0.4, D-18). Plan 04 turns these into the committed Vitest gate suite and records the cold-run timing.
- [01-03 CAVEAT] The compiler-cli-types.ts shim re-exports via a deep relative path into `node_modules/@angular/compiler-cli/...` -- fragile if dep hoisting changes the layout, and coupled to the package's internal `.d.ts` structure (type-only; erased at emit). Revisit when @angular/compiler-cli ships nodenext-clean typings (Angular's own @angular/build consumes these types under module:commonjs/moduleResolution:node, so the barrel is simply not nodenext-tested upstream).

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-06-27T23:40:18Z
Stopped at: Completed 03-04-PLAN.md (Phase 03 final plan -- all 4 plans executed)
Resume file: None
