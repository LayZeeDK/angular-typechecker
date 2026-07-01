# Phase 1 Discussion Research -- Workspace Bootstrap + Engine Spike (GATED)

**Produced:** 2026-06-27 (during `/gsd-discuss-phase 1 --analyze`, on user request for phase-specific research before discussion)
**Method:** 3 parallel research agents, verified against Nx 23 / Angular 22 / TS 6 official docs + local reference clones (`nrwl/nx`, `angular/angular-cli`, `angular/angular`, `push-based/nx-verdaccio`, `analogjs/analog`, prior `sandbox/nx19-8-angular18-2` prototype) + one empirical TS 6.0.3 emit test.
**Confidence:** HIGH (most claims source-verified or empirically tested; soft spots flagged inline).

This is discussion-input research. It informs the gray-area decisions locked in `01-CONTEXT.md` and is reusable by `/gsd-plan-phase`'s researcher. It does NOT replace plan-phase research.

---

## 1. Bootstrap method (how to create the workspace in-place)

**Finding (HIGH, Nx source-verified):** `create-nx-workspace .` (in-place) is a HARD ERROR. It calls `readdirSync(cwd)` and throws `DIRECTORY_EXISTS` ("The current directory is not empty. Use 'nx init'...") the instant the dir is non-empty. CNW ALWAYS generates into a *named subdirectory* (`join(workingDir, name)`) and runs `git init` ONLY inside that subdir (`initializeGitRepo(directory)`), so a pre-existing root `.git` is provably never touched.

**Recommendation:** Mechanism B -- move-aside-and-restore:
1. Confirm clean tree; capture HEAD (`git rev-parse HEAD`).
2. Move `.planning/` + `CLAUDE.md` to a scratch dir outside the repo (root then contains only `.git/`).
3. `npx create-nx-workspace@23.0.1 <tmp-name> --preset=apps --packageManager=npm --nxCloud=skip --skipGit --no-interactive` in a temp sibling dir.
4. Copy generated contents (incl. dotfiles) into the repo root over the preserved `.git/`. Avoid copying `node_modules` (reinstall in root).
5. Restore `.planning/` + `CLAUDE.md`.
6. `npx nx report` + review full `git status` diff before committing.
7. Add plugin + Angular fixture via generators (see section 2).

**Comparison:**

| Mechanism | Works on Nx 23? | Clobber risk | True integrated monorepo? | Verdict |
|---|---|---|---|---|
| `create-nx-workspace .` in-place | NO (hard error) | n/a | n/a | Eliminated |
| (A) CNW temp dir -> copy into root, merge root files | Yes | Low-Med (blind copy can collide on generated `.gitignore`/`README`/`package.json`) | Yes | Viable fallback to B |
| (B) Move `.planning`+`CLAUDE.md` aside -> CNW temp -> copy -> restore | Yes | Lowest (`.git` never in temp; planning files physically out of the way) | Yes | **RECOMMENDED** |
| (C) `npm init` + `nx init` + generators (no CNW) | Yes | Lowest | Only after manual generators; `nx init` alone does NOT scaffold the integrated layout | Most steps, highest drift |

**Preset choice:** Use `--preset=apps` (empty integrated, the `Preset.Apps` branch returns immediately = no projects), NOT `angular-monorepo` (hard-codes a starter app in `apps/<name>` with no opt-out). Both research agents converged on this independently.

**Open risks to verify in execution:** exact `23.0.1` CLI flag spelling (`--preset=apps` may already imply integrated; run `--help` first); CNW's `isAiAgent()` env-detection may alter prompts (pass explicit flags); `cp -R ./.` dotfile semantics on Git Bash/Windows; `defaultBase` (CNW 23 = `main`; sandbox used `master` -- align to repo default).

---

## 2. Workspace shape (preset, plugin location, Phase-1 scaffold scope)

**Finding (HIGH):** `@nx/plugin:plugin` directory is "as-provided" since Nx 16 -- `projectRoot = directory` verbatim, no `libs/`/`apps/` auto-prefix. Folder name is cosmetic to Nx's graph (projects discovered by `project.json`/`package.json`). The 2026 integrated-monorepo convention favors `packages/`; Analog (a real Angular+Nx repo) ships its publishable Nx plugins under `packages/`.

**Recommendations:**
- **Preset:** `--preset=apps` (or `ts` only if you want the TS-solution `tsconfig.base.json` pre-wired -- but `apps` = classic `project.json`, matches the verdaccio/sandbox references and is more predictable; `ts`/TS-solution setup changes generator output via `isTsSolutionSetup`).
- **Plugin location:** `packages/angular-typechecker/` (idiomatic, matches Analog + ARCHITECTURE.md; generated with `--directory=packages/angular-typechecker`).
- **Single workspace hosts both:** One integrated workspace cleanly hosts the publishable plugin (`packages/`) AND real Angular app/lib projects (`apps/`, `libs/`) -- proven by Analog. Watch: plugin's `tsconfig.lib.json` sets `module: node16`/`nodenext` independently of Angular projects' `bundler` resolution; install `@angular/compiler-cli` as a root devDependency so spike apps resolve it while it stays a plugin peer.
- **`executors.json` asset copy:** The Nx 23 `@nx/plugin` generator auto-injects the correct `@nx/js:tsc` asset globs (`executors.json` -> `.`, `src/**/!(*.ts)` + `**/*.d.ts`). Use generator output as-is.

**Proposed Phase-1 directory tree (minimal; annotated now vs defer):**

```
angular-typechecker/                          [now]
|-- apps/
|   '-- ng-spike-app/                          [now]  real Angular 22 app = spike type-check target
|-- packages/
|   '-- angular-typechecker/                   [now]  the published plugin
|       |-- src/
|       |   |-- index.ts                       [now]  export surface (asserts await import() bridge)
|       |   |-- executors/angular-typecheck/   [now]  executor.ts + schema.json + schema.d.ts (skeleton)
|       |   |-- core/                          [now]  MINIMAL performCompilation spike entry only
|       |   |-- internal/ plugin/ cli/ builders/  [defer]  do NOT scaffold in Phase 1
|       |-- executors.json                     [now]
|       |-- package.json                       [now]  type:commonjs, devkit dep, compiler-cli+ts peers
|       |-- project.json                       [now]  @nx/js:tsc build + @nx/vitest:test
|       |-- tsconfig.json / .lib.json / .spec.json  [now]  module node16/nodenext
|       '-- *.spec.ts                          [now]  one green Vitest test
|-- testing/ fixtures/                          [defer]  -> Phase 2+
|-- e2e/angular-typechecker-e2e/                [defer]  -> Phase 6 tarball matrix
|-- nx.json / tsconfig.base.json / package.json (root) / eslint.config.mjs  [now]
```

**Spike workspace placement:** the spike's "real Angular 22 workspace" should be a first-party `apps/ng-spike-app/` (in-graph, cacheable, lint/typecheck-covered; carries forward as a smoke sample). The Phase 6 e2e tarball-install fixtures are a SEPARATE, out-of-graph, generated/torn-down-per-run concern under `e2e/` -- do not conflate.

**Open risks:** `isTsSolutionSetup` divergence between `apps` and `ts` presets (different `tsconfig.base.json` + asset paths); CJS-executor -> ESM compiler-cli bridge under `node16` (assert in the Phase 1 test); `@nx/vitest:test` `await import` of ESM-only compiler-cli without transform/interop error; `@nx/dependency-checks` must not flag the peer compiler-cli as missing.

---

## 3. Spike gate mechanics (GATE A, GATE B, gate scope)

### GATE A -- `await import()` survives CJS emit under `module: node16`/`nodenext`

**EMPIRICALLY VERIFIED (TS 6.0.3, this session):**

| `module` / `moduleResolution` | emitted call | verdict |
|---|---|---|
| `commonjs` / `node10` | `await Promise.resolve().then(() => __importStar(require(...)))` | DOWNLEVELED -> FAIL |
| `node16` / `node16` | `await import(...)` (literal) | PASS |
| `nodenext` / `nodenext` | `await import(...)` (literal) | PASS |

`@angular/compiler-cli@22` is ESM-only (`package.json` `"type":"module"`), so a downleveled `require()` throws `ERR_REQUIRE_ESM`. The prior prototype shipped `module: commonjs` + a STATIC import that compiled to a bare `require("@angular/compiler-cli")` -- worked only because Angular 18's compiler-cli was still CJS-requireable. That exact line is the v22 regression Phase 1 must prove fixed.

**`@nx/js:tsc` wrinkle: NONE (verified).** `tsc.impl.ts` only READS `tsConfig.options.module` (to label packaging); it never reassigns it for compilation. `module: node16` in `tsconfig.lib.json` reaches emit untouched. (The only `module =` write in `@nx/js` is in the library *generator*, not the build executor.)

**Assertion mechanism (two-tier, both required for a valid gate):**
1. **Static token gate (primary):** a postbuild check (prefer a Vitest test that `fs.readFileSync`s the built `dist/.../executor.js`) asserting `/import\(/` present AND `/require\(["']@angular\/compiler-cli/` absent. NOTE: `dist/` is gitignored -- do NOT use `git grep` (silent zero matches); use `rg -uu` or `fs.readFileSync` + regex.
2. **Runtime smoke (required):** the token can be present yet still fail at load. GATE B's run already `require()`s the built executor and executes the `await import('@angular/compiler-cli')` path -- make that linkage explicit so GATE A's runtime half is proven for free. Assert no `ERR_REQUIRE_ESM` and no `UNKNOWN_ERROR_CODE` in the result (a thrown ESM-load failure can masquerade as a diagnostic via `performCompilation`'s catch block).

### GATE B -- unconditional NG8xxx gather (the differentiator)

**Engine (LOCKED Approach A, confirmed smallest faithful repro):** `performCompilation({ rootNames, options, emitFlags: 0, gatherDiagnostics })` where `gatherDiagnostics` calls EVERY getter unconditionally on the `Program`: `getTsOptionDiagnostics`, `getNgOptionDiagnostics`, `getTsSyntacticDiagnostics`, `getTsSemanticDiagnostics`, `getNgStructuralDiagnostics`, and crucially `getNgSemanticDiagnostics()` (the one `ngc` skips -- it routes through `NgtscProgram` -> `NgCompiler.getDiagnostics()` -> `getTemplateDiagnostics()` + `runAdditionalChecks()` for all NG8xxx, gated on `strictTemplates`).

**The short-circuit, proven (read from v22 `perform_compile.ts`):** `defaultGatherDiagnostics` chains `checkOtherDiagnostics = checkOtherDiagnostics && checkDiagnostics(...)`. After a TS semantic ERROR, `checkOtherDiagnostics` is `false`, so `getNgSemanticDiagnostics()` (next `&&` term) is NEVER evaluated -- template + extended NG8xxx are silently dropped. The custom all-getter pushes every getter unconditionally, so NG8xxx survive a co-located TS error.

**Approach A vs `@angular/build`'s `NgtscProgram` + `getDiagnosticsForFile(sf, OptimizeFor.WholeProgram)`:** both surface NG8xxx; Approach A is ~6 getter calls (vs reimplementing the `aot-compilation.ts` loop + `analyzeAsync` + affected-file bookkeeping). For a go/no-go gate, fewer moving parts = more trustworthy. Approach A's `getNgSemanticDiagnostics()` runs whole-program (exactly what a complete no-emit typecheck wants) -- faithful, not a shortcut. The `NgtscProgram` per-file/incremental path stays DEFERRED.

**Minimal fixture (one standalone component, triggers BOTH):**
- Co-located TS error TS2322: `count: number = 'not a number';`
- Extended NG8109 `INTERPOLATED_SIGNAL_NOT_INVOKED` (verified present in v22): `status = signal('ready');` + template `{{ status }}` (referenced, not invoked). Most reliable easy trigger (single signal property + one interpolation, no extra imports). NG8107 `OPTIONAL_CHAIN_NOT_NULLABLE` also works but needs more setup.
- Required tsconfig: `angularCompilerOptions.strictTemplates: true` (extended checks gated on it); set explicitly so the fixture is self-contained. Extended diagnostics default to WARNING category -- **assert on diagnostic CODE (8109), not on errorCount/severity**, so the gate proves "the diagnostic was produced" independent of severity policy. `noEmit: true` + `emitFlags: 0`.

**Differential assertion (load-bearing):** all-getter on the fixture returns codes including BOTH `2322` and `8109`; `defaultGatherDiagnostics` on the SAME program returns `2322` but NOT `8109`. The second half proves the all-getter does something `ngc` does not.

**Cold-run timing (minimal):** one `performance.now()` wall-clock around the first `performCompilation` call, logged once. No statistics/profiling for the gate.

### GATE SCOPE -- minimum-valid-gate

**Prove NOW (go/no-go):**
- GATE A: static token + ESM-`require` absent on the real Nx-built `.js`, AND runtime load without `ERR_REQUIRE_ESM` (satisfied by GATE B's run).
- GATE B: positive + differential on ONE app + ONE local library, using the single co-located-error fixture.
- One cold-run wall-clock recorded.

**DEFER (NOT part of the gate):**
- Full 5-type project matrix (buildable/publishable libs, spec tsconfigs) -> Phase 2/3. They differ in tsconfig wiring / `checkForPrivateExports`, not in the gather mechanism -- they do not change the go/no-go bit.
- Out-of-project / `node_modules` filtering -> Phase 3/6 (a post-processing filter, orthogonal to whether the engine produces diagnostics).
- Exhaustive NG8xxx catalog -> Phase 2/validation (gate needs exactly ONE code to prove the principle).

**Rationale:** the gate answers "does the locked engine (node16 `import()` bridge + unconditional all-getter) work on real Angular 22, or do we fall back?" That is fully answered by GATE A + GATE B on one app + one lib. Breadth/filtering assume the engine works -- Phase 2/3/6 scope. Keep the one library (not app-only) because libraries are the project type most likely to expose a tsconfig/`rootNames` resolution difference that could invalidate the engine choice.

### Spike checklist (go/no-go)
1. [GATE A static] Built `executor.js` matches `/import\(/`, does NOT match `/require\(["']@angular\/compiler-cli/`.
2. [GATE A runtime] `require()`-ing the built CJS executor + triggering its loader resolves `@angular/compiler-cli` named exports with no `ERR_REQUIRE_ESM`.
3. [GATE B positive] All-getter on the co-located-error fixture returns codes including BOTH `2322` and `8109`.
4. [GATE B differential] `defaultGatherDiagnostics` on the SAME program returns `2322` but NOT `8109`.
5. [GATE B breadth] Steps 3-4 pass for one app tsconfig AND one local-library tsconfig.
6. [timing] One cold-run wall-clock recorded.
GO iff 1-6 hold; otherwise NO-GO -> revisit engine/module decision.

**Open risks:** GATE A runtime on the REAL `@nx/js:tsc` build (emit test used raw `tsc`; confirm Nx + tslib `importHelpers` + `type:"commonjs"` still yield literal `import(`); extended-diagnostic severity is WARNING (assert on codes); `strictTemplates` must survive the `extends` chain merge in `readConfiguration`; pin spike to stable `22.0.4` (engine was eyeballed against `22.1.0-next.x`).

---

## Decision-readiness summary (feeds the discussion)

| Gray area | Research recommendation | Confidence |
|---|---|---|
| Bootstrap method | Mechanism B (move-aside + CNW temp `--preset=apps` + copy + restore); `.git` provably safe | HIGH |
| Workspace shape | `--preset=apps`; plugin at `packages/angular-typechecker/`; minimal Phase-1 scaffold; spike app in `apps/` | HIGH |
| Spike disposition | Spike = Approach A engine entry in `core/` (PROMOTE, not throwaway -- it IS the locked engine); spike app carries forward as smoke sample | HIGH |
| Gate scope | GATE A + GATE B on one app + one lib + one timing number; defer matrix/filtering/full catalog | HIGH |
