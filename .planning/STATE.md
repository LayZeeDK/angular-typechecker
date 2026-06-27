---
gsd_state_version: 1.0
milestone: v0.0.1
milestone_name: milestone
status: executing
stopped_at: Plan 01-03 complete (tracer-bullet core + executor stub + out-of-graph TS2322+NG8109 fixture; nx build green; GATE A emit intact -- built compiler-loader.js retains literal import('@angular/compiler-cli'))
last_updated: "2026-06-27T16:10:10.365Z"
last_activity: 2026-06-27 -- Plan 01-03 complete (tracer-bullet core engine + executor stub + error fixture; build green; GATE A/B validated)
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 4
  completed_plans: 3
  percent: 75
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-27)

**Core value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.
**Current focus:** Phase 01 — workspace-bootstrap-engine-spike-gated

## Current Position

Phase: 01 (workspace-bootstrap-engine-spike-gated) — EXECUTING
Plan: 4 of 4 (01-01, 01-02, 01-03 complete)
Status: Executing Phase 01 — Plans 01-01/02/03 done; Plan 01-04 next (GATE A/B spec suite); engine validated, build green
Last activity: 2026-06-27 -- Plan 01-03 complete (tracer-bullet core engine + executor stub + error fixture)

Progress: [████████░░] 75%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: ~31 min
- Total execution time: ~1.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | ~92 min | ~31 min |

**Recent Trend:**

- Last 5 plans: 01-01 (~22 min), 01-02 (~30 min), 01-03 (~40 min)
- Trend: steady

*Updated after each plan completion*

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

### Pending Todos

[From .planning/todos/pending/ -- ideas captured during sessions]

None yet.

### Blockers/Concerns

[Issues that affect future work]

- Phase 1 is GATED: the engine implementation (Phase 2) must not begin until the spike proves (a) the emitted executor `.js` retains `import(` under `module: node16`, and (b) the unconditional gatherer surfaces template + extended (NG8xxx) diagnostics even with a co-located TS error on a real Angular 22 workspace. If either fails, revisit the engine approach before further investment.
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

Last session: 2026-06-27T16:09:42.288Z
Stopped at: Plan 01-03 complete (tracer-bullet core engine + thin executor stub + out-of-graph TS2322+NG8109 fixture; nx build green; GATE A emit intact and GATE A/B engine pre-validated)
Resume file: .planning/phases/01-workspace-bootstrap-engine-spike-gated/01-04-PLAN.md
