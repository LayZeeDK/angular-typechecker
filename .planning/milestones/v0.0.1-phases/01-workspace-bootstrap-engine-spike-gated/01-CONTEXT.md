# Phase 1: Workspace Bootstrap + Engine Spike (GATED) - Context

**Gathered:** 2026-06-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the Nx 23 / Angular 22 / TS 6 integrated Angular monorepo IN-PLACE (over the existing `.git/`, `.planning/`, `CLAUDE.md`) hosting the `angular-typechecker` plugin package, and prove the two riskiest unknowns on a real Angular 22 workspace BEFORE the engine is built for real:

- **GATE A:** the compiled executor `.js` (built with `module: node16`/`nodenext`) still contains a literal `import(` (no downlevel to `require()`), AND it actually loads ESM `@angular/compiler-cli` at runtime via Nx's `require()`-based loader without `ERR_REQUIRE_ESM`.
- **GATE B:** the custom unconditional all-getter gatherer surfaces Angular template + extended (NG8xxx) diagnostics even when a co-located TS error exists in the same program (no `ngc`-style phase short-circuit).

Requirements covered: WS-01, WS-02, WS-03, ENG-03, CMP-01, CMP-02.

This phase clarifies HOW to bootstrap + gate. The stack, dependency model, module format, test runner, and engine approach are LOCKED in PROJECT.md and are NOT re-decided here. New capabilities belong in later phases.
</domain>

<decisions>
## Implementation Decisions

### Bootstrap method
- **D-01:** Bootstrap via **move-aside + create-nx-workspace-in-temp + copy + restore** (research Mechanism B). Steps: confirm clean tree + capture HEAD; move `.planning/` + `CLAUDE.md` to a scratch dir outside the repo (root then holds only `.git/`); `create-nx-workspace@23.0.1` into a temp sibling dir with `--preset=apps`; copy generated contents (incl. dotfiles, excl. `node_modules`) into the repo root over the preserved `.git/`; restore `.planning/` + `CLAUDE.md`; `nx report` + review full `git status` before committing.
- **D-02:** Rationale: `create-nx-workspace .` in-place is a HARD ERROR (`readdirSync(cwd)` -> `DIRECTORY_EXISTS` on any non-empty dir, Nx-source-verified). CNW always generates into a named subdir and runs `git init` ONLY inside that subdir, so the pre-existing root `.git/` is provably never touched. `nx init` (the official "existing repo" tool) was rejected because it only writes `nx.json` + detected plugins and does NOT scaffold the integrated `apps/`/`libs/` + `tsconfig.base.json` baseline.
- **D-03 (execution checks):** verify the exact `23.0.1` CLI flag spelling via `--help` before the real run (`--preset=apps` may already imply integrated); pass explicit flags (`--no-interactive`, `--nxCloud=skip`, `--skipGit`) because CNW branches on AI-agent env detection; confirm `cp -R ./.` copies dotfiles on Git Bash/Windows; align `defaultBase` to the repo's actual branch (CNW 23 defaults to `main`).

### Workspace shape
- **D-04:** Preset = **`--preset=apps`** (empty integrated workspace, no forced starter app). Rejected `angular-monorepo` (force-creates a starter app with no opt-out) and `ts`/TS-solution (changes generator output via `isTsSolutionSetup`; `apps` = classic `project.json`, matches the verdaccio/sandbox references and is more predictable).
- **D-05:** Plugin package lives at **`packages/angular-typechecker/`**. Folder name is cosmetic to Nx's graph (projects discovered by `project.json`/`package.json`); `packages/` is the idiomatic 2026 convention for a publishable package and matches Analog. Generate with `nx g @nx/plugin:plugin --directory=packages/angular-typechecker --unitTestRunner=vitest` (directory is as-provided, no `libs/` auto-prefix).
- **D-06:** **Minimal Phase-1 scaffold only:** the plugin skeleton (enough to `@nx/js:tsc`-build + assert `import(`), one real `apps/ng-spike-app` Angular 22 application as the spike's type-check target, and one green Vitest test. DEFER `testing/test-nx-utils`, `testing/test-fixtures`, `fixtures/`, `e2e/`, and the reserved `src/plugin|cli|builders` subtrees to Phase 2+/6.
- **D-07:** The spike's "real Angular 22 workspace" is the first-party `apps/ng-spike-app/` (in-graph, cacheable, lint/typecheck-covered; carries forward as a green smoke sample). The Phase 6 e2e tarball-install fixtures are a SEPARATE, out-of-graph, generated/torn-down concern under `e2e/` -- do not conflate.

### Spike disposition
- **D-08:** **Tracer bullet (promote), NOT throwaway.** Build the minimal `core/` engine entry (`compiler-loader` with memoized `await import()`, unconditional all-getter gatherer, `runTypecheck`) at lean production quality; the gate assertions become real tests; Phase 2 grows this kept core. Rationale: the engine approach (Approach A) and core/adapter architecture are already locked, so there is little to "learn" that a rebuild would change -- per the Pragmatic Programmer test, "if you can't throw it away, write tracer code." Discipline note: keep it lean -- do not over-build before the gate passes GO.

### Gate scope (minimum valid gate)
- **D-09:** Prove NOW: GATE A (static `import(` token present + ESM-`require` absent on the built `.js`, + runtime load without `ERR_REQUIRE_ESM`) and GATE B (positive + differential NG8109 + TS2322) on **ONE app + ONE local library**, plus one cold-run wall-clock timing number.
- **D-10:** DEFER (NOT part of the gate): full 5-project-type matrix (Phase 2/3), out-of-project / `node_modules` filtering (Phase 3 -- orthogonal post-processing), exhaustive NG8xxx catalog (Phase 2/validation). Keep the ONE library (not app-only) because libraries are the project type most likely to expose a tsconfig/`rootNames` resolution difference that could invalidate the engine choice.

### Gate harness & the Phase-1 "executor"
- **D-11:** Build a **minimal Nx executor stub now** (default export -> `runTypecheck`, runnable via `nx run`), so GATE A's runtime half is proven end-to-end through Nx's real `require()`-based loader. This stub is the tracer-bullet seed of the Phase 4 executor; the `import(`-bearing built `.js` that criterion 2 asserts on is this executor's output. Set the plugin's `package.json` `type: "commonjs"` DELIBERATELY (per Nx #18801, `@nx/js:tsc` + `module: Node16` can mislabel the manifest).
- **D-12:** GATE A static assertion = a **Vitest test that reads the built `dist/.../executor.js`** via `fs.readFileSync` + regex: assert `/import\(/` present AND `/require\(["']@angular\/compiler-cli/` absent. Do NOT use `git grep` (`dist/` is gitignored -> silent zero matches); use `fs.readFileSync` or `rg -uu`. GATE A's runtime half is satisfied by GATE B's run (which `require()`s the built executor and executes the `await import('@angular/compiler-cli')` path); assert no `ERR_REQUIRE_ESM` and no `UNKNOWN_ERROR_CODE` in the result (a thrown ESM-load failure can masquerade as a diagnostic via `performCompilation`'s catch).

### Error-fixture placement
- **D-13:** The deliberate-error component lives in a **separate committed fixture dir with its own tsconfig** (`strictTemplates: true`, `noEmit: true`); the gate points `runTypecheck` at that tsconfig. It is EXCLUDED from the workspace project graph so `apps/ng-spike-app` stays green and reusable as a smoke sample. Do NOT use `@ts-nocheck` (the errors ARE the gate input). Ensure no workspace file imports the fixture (`exclude` does not stop type-checking of imported files -- TS #36017).

### package.json scope
- **D-14:** Author in Phase 1: `type: "commonjs"`, `@nx/devkit` pinned dependency (`23.0.1`), `@angular/compiler-cli` + `typescript` as PEER RANGES (`^22.0.0` / `>=6.0.0 <6.1.0`), `engines.node` (`^22.22.3 || ^24.15.0 || ^26.0.0`, CMP-02), and the locked version pins (CMP-01). DEFER `files`/`exports`/`keywords`/full PKG-01 to Phase 5 and the `@nx/dependency-checks` rule to Phase 3 (WS-04).
- **D-15:** Root workspace installs Angular/Nx/TS pinned **EXACT** (nx `23.0.1` / `@angular/compiler-cli` `22.0.4` / `typescript` `6.0.3`) for reproducible dev/CI. (Plugin-facing PEER ranges stay broad per D-14; this is the standard exact-dev / ranged-peer split.)

### Research-settled engine specifics (carried into planning; not re-asked)
- **D-16:** Engine = Approach A: `performCompilation({ rootNames, options, emitFlags: 0, gatherDiagnostics })` with a custom `gatherDiagnostics` calling every getter UNCONDITIONALLY (`getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, and crucially `getNgSemanticDiagnostics()` -- the one `ngc`'s `defaultGatherDiagnostics` `&&`-chain short-circuits after a TS error). The `@angular/build` `NgtscProgram` + `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)` per-file path is more code and stays DEFERRED.
- **D-17:** GATE B fixture = a single standalone component with a co-located TS error `count: number = 'not a number';` (TS2322) AND extended NG8109 `INTERPOLATED_SIGNAL_NOT_INVOKED` (`status = signal('ready')` interpolated as `{{ status }}`, not invoked). **Assert on diagnostic CODES (2322 + 8109), not severity** (extended diagnostics default to WARNING category). Differential: run `defaultGatherDiagnostics` on the SAME program and assert it returns 2322 but NOT 8109.
- **D-18:** Pin the spike to STABLE Angular `22.0.4` (the engine was previously eyeballed against `22.1.0-next.x`; re-validate `OptimizeFor`/`getNgSemanticDiagnostics`/NG8109 on stable).

### Spike go/no-go checklist (the gate)
1. [A static] built `executor.js` matches `/import\(/`, not `/require\(["']@angular\/compiler-cli/`.
2. [A runtime] `require()`-ing the built CJS executor + triggering its loader resolves `@angular/compiler-cli` named exports (no `ERR_REQUIRE_ESM`).
3. [B positive] all-getter on the fixture returns codes incl. BOTH `2322` and `8109`.
4. [B differential] `defaultGatherDiagnostics` on the same program returns `2322` but NOT `8109`.
5. [B breadth] steps 3-4 pass for one app tsconfig AND one local-library tsconfig.
6. [timing] one cold-run wall-clock recorded.
GO iff 1-6 hold; else NO-GO -> revisit engine/module decision (Phase 2 does not begin).

### Claude's Discretion
- Exact directory/file names within the minimal scaffold (e.g. `ng-spike-app`, fixture dir name), the precise Vitest config layout, and `nxCloud`/`.gitignore` merge mechanics -- planner/executor decide, consistent with the decisions above.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 1 spec + scope (this repo)
- `.planning/PROJECT.md` - locked stack, dependency model, module format, engine approach, Key Decisions.
- `.planning/REQUIREMENTS.md` - WS-01/02/03, ENG-03, CMP-01/02 (Phase 1 set).
- `.planning/ROADMAP.md` Phase 1 section - goal, success criteria, GATED note.

### Phase 1 research (this repo)
- `.planning/phases/01-workspace-bootstrap-engine-spike-gated/01-DISCUSS-RESEARCH.md` - the dedicated Phase 1 research pass (bootstrap mechanism, workspace shape, GATE A/B mechanics, gate scope), with the spike go/no-go checklist and open execution risks. **Primary planning input for this phase.**

### Project research (this repo)
- `.planning/research/SUMMARY.md` - CORRECTIONS & ADDITIONS; pitfall summary.
- `.planning/research/ARCHITECTURE.md` - core/adapter split + proposed tree. **CAVEAT:** lines ~314 and ~376 still say `nx`/`@nx/devkit` are `peerDependencies` -- this is STALE and CONTRADICTED by Correction #1 (devkit is a pinned `dependency`; `nx` is not declared). PROJECT.md / REQUIREMENTS.md are authoritative. Ignore those two ARCHITECTURE.md lines.
- `.planning/research/PITFALLS.md` - Pitfall 1 (`import()`->`require()` rewrite) is the GATE A risk; create-nx-workspace fresh-dir requirement noted in the scope note.
- `.planning/research/FOLLOWUP-FINDINGS.md` - corrections (devkit dep, `@nx/vitest:test`, node16), engine confirmation vs Angular v22 source.
- `.planning/research/DIAGNOSTIC-CATALOG.md` - NG8xxx catalog (NG8109 used by the GATE B fixture).

### External reference codebases (absolute paths, read-only; re-validate against locked versions)
- `D:/projects/github/angular/angular-cli/packages/angular/build` - the EXACT engine to model: `AngularCompilation`, `aot-compilation.ts` (`collectDiagnostics`, `DiagnosticModes`), memoized `loadCompilerCli`/`loadTypescript`, `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`.
- `D:/projects/github/angular/angular/packages/compiler-cli` - `performCompilation`, `defaultGatherDiagnostics` (`&&`-chain short-circuit = the GATE B proof), `readConfiguration`, `formatDiagnostics`, `OptimizeFor`; `package.json` `"type":"module"` (ESM-only).
- `D:/projects/github/nrwl/nx` - `create-nx-workspace` + `nx init` behavior; `@nx/plugin` generators (path/as-provided); `@nx/js` `tsc.impl.ts` (reads but does not override tsconfig `module`).
- `D:/projects/github/push-based/nx-verdaccio` - real published Nx plugin: `package.json` files/executors, `tsconfig.{json,lib,spec}`, build asset-copy, `testing/test-nx-utils` (FsTree quarantine) [package-based reference].
- `D:/projects/github/analogjs/analog` - real Angular+Nx repo hosting publishable plugins under `packages/`; Angular 22 tsconfig base.
- `D:/projects/sandbox/nx19-8-angular18-2-esbuild-playwright-storybook` - the prior prototype of THIS project (Nx 19.8 / Angular 18.2): `gatherAllDiagnostics` all-getter shape + NG8xxx fixtures + `injectMultipleErrors`. **Version-bound reference only**; its `libs/nx-plugin` placement and `module: commonjs` + static `require('@angular/compiler-cli')` are the v22 breaks Phase 1 fixes.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Prior prototype `gatherAllDiagnostics` (17-line all-getter) + NG8xxx fixture catalog (`injectMultipleErrors`, `forceExtendedDiagnosticsAsErrors`) -- shape to port and re-validate against Angular 22.
- `@angular/build` `AngularCompilation` / `aot-compilation.ts` -- the verbatim engine model (memoized `await import()`, unconditional per-file gather).

### Established Patterns
- Core (framework-agnostic, zero `@nx/devkit`/CLI imports) vs thin adapters, behind one `runTypecheck(CoreOptions): Promise<CoreResult>` (ARCHITECTURE.md). Phase 1 lays down the minimal core + a minimal executor adapter stub consistent with this split.
- `@nx/js:tsc` -> CJS `.js` + `.d.ts`, `module: node16`/`nodenext`, `executors.json` asset-copy auto-injected by the `@nx/plugin` generator.

### Integration Points
- Greenfield: the repo currently contains only `.git/`, `.planning/`, `CLAUDE.md`. Phase 1 introduces the entire Nx workspace; there is no pre-existing app code to integrate with. The integration concern is preserving tracked planning artifacts + git history during bootstrap (D-01/D-02).
</code_context>

<specifics>
## Specific Ideas

- Spike app: `apps/ng-spike-app` (standalone Angular 22, kept green).
- GATE B fixture (separate dir + own tsconfig): standalone component, `count: number = 'not a number'` (TS2322) + `status = signal('ready')` with `{{ status }}` (NG8109), `strictTemplates: true`, `noEmit: true`; assert on codes 2322 + 8109.
- GATE A: Vitest test reads `dist/.../executor.js` (regex), runtime proven via GATE B's executor run.
- Plugin at `packages/angular-typechecker/`; preset `apps`; `type: "commonjs"` set deliberately.
</specifics>

<deferred>
## Deferred Ideas

All deferrals below are roadmap-scoped to later phases (NOT new capabilities / not scope creep):
- Out-of-project + `node_modules` diagnostic filtering -> Phase 3 (OUT-02).
- Full 5-project-type matrix (buildable / publishable libs, spec tsconfig) -> Phase 2/3 + Phase 6 e2e.
- Exhaustive NG8xxx catalog assertions (v13->v22) -> Phase 2 (TEST-02).
- ESLint + Prettier + `@nx/dependency-checks` + module-boundary enforcement -> Phase 3 (WS-04).
- Full executor adapter (schema.json, normalize-options, cacheable target) -> Phase 4 (EXE-01/06/07).
- `package.json` `files`/`exports`/`keywords` + publish hardening -> Phase 5 (PKG-01..04).
- `e2e/` tarball-install fixtures + cross-OS/multi-Node CI matrix -> Phase 6 (TEST-03, CI-01).
- Execution-detail choices to settle during planning (not deferred capabilities): `nxCloud` opt-out wording, Vitest unit/int config split timing, exact Node version used for the spike run.
</deferred>

---

*Phase: 1-Workspace Bootstrap + Engine Spike (GATED)*
*Context gathered: 2026-06-27*
