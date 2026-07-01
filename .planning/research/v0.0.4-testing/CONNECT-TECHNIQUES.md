# Prior-Art Testing Techniques: angular-typecheck executor + target wiring

PRIVACY SELF-CHECK: performed -- no Connect-specific identifiers below. All project/library/scope/product/domain names, employee names, ticket ids, emails, and identifying file paths have been replaced with neutral placeholders (`my-app`, `my-lib`, `@my-org/nx`, `typecheck`). Findings are stated generically and must be re-validated on Nx 23 / Angular 22 / TS 6 / Vitest.

**Source:** three private prior-art branches of an Nx + Angular monorepo, each implementing an `angular-typecheck`-style Nx executor. Read READ-ONLY via `git show`. Branches are referred to by generic role only:

- **Impl-A** -- `performCompilation` + an unconditional all-getter diagnostic gatherer.
- **Impl-C** -- Impl-A plus a `quiet`/errors-only mode AND a per-project-type target-wiring generator.
- **Impl-B** -- `NgtscProgram` + a short-circuiting gatherer with internal/external diagnostic filtering and dependency-build ordering.

Each branch made different testing choices; the differences themselves are the most useful prior art.

---

## 1. Test tiers present (per branch)

| Tier                                                             | Impl-A | Impl-C                               | Impl-B                                                                              |
| ---------------------------------------------------------------- | ------ | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Unit (pure, mocked compiler)                                     | --     | --                                   | YES (jest.mock of `@angular/compiler-cli`)                                          |
| Integration (real compiler, temp dir, no full workspace)         | --     | --                                   | PLANNED (documented test plan: real `NgtscProgram` over `fs.mkdtemp` temp projects) |
| Generator unit (in-memory tree)                                  | --     | YES (`createTreeWithEmptyWorkspace`) | --                                                                                  |
| Executor e2e (real installed plugin in a generated Nx workspace) | YES    | YES (+ `quiet`-mode CLI subtier)     | --                                                                                  |

Key observation: **no single branch had all tiers.** The transferable target state is the UNION: generator unit tests (in-memory tree) + executor unit/integration tests (mocked or temp-dir real compiler) + a thin executor e2e (real tarball install). Pick the cheapest tier that can actually catch each class of regression.

### 1a. Unit tier (Impl-B) -- mock the compiler, assert orchestration

- **Mock seam:** `jest.mock('@angular/compiler-cli', ...)` replaces `readConfiguration`, `formatDiagnostics`, and the program constructor. The program is mocked as a CLASS (not `jest.fn()`) so `new NgtscProgram(...)` works and the constructor can capture its `rootNames` argument into a module-scoped variable for later assertion.
- **Diagnostic factory:** a `createMockDiagnostic(fileName?, category?)` helper builds a minimal `ts.Diagnostic` with a fake `SourceFile` (just `fileName` + a stub `getLineAndCharacterOfPosition`). `fileName === undefined` models a config/global diagnostic.
- **Program factory:** a `createMockProgram({ optionDiagnostics, syntacticDiagnostics, semanticDiagnostics, ngStructuralDiagnostics, ngSemanticDiagnostics })` returns an object of `jest.fn().mockReturnValue([...])` getters -- one per diagnostic phase. This lets a test inject diagnostics into exactly one phase.
- **Output capture:** `jest.spyOn(console, 'error' | 'log')` and `jest.spyOn(process.stderr, 'write')`, mocked-and-restored per test.
- **What it verifies WITHOUT a real compiler:**
  - success/failure exit for each diagnostic phase,
  - the file-path categorization logic (internal vs external by `sourceRoot` prefix),
  - that a getter is NOT called when an earlier phase short-circuits (asserted via `expect(program.getNgSemanticDiagnostics).not.toHaveBeenCalled()`),
  - that test files are filtered out of `rootNames` before the program is constructed (asserted on the captured `rootNames`),
  - output-format strings (error counts, "filtered"/"ignored" messages).
- **PITFALL (Vitest port):** this tier leans hard on Jest's `var`-hoisting of `mock`-prefixed variables inside the `jest.mock` factory. Vitest's `vi.mock` hoisting rules differ -- the equivalent must use `vi.hoisted(() => ({...}))` to share mutable state between the factory and the tests, and the compiler-cli module is ESM (`await import`), so the executor's CJS->ESM bridge must be mocked at the dynamic-`import` seam, not a static `require`. Re-design this seam for Vitest rather than transcribing.

### 1b. Generator unit tier (Impl-C) -- in-memory tree, assert config

- **Runner:** Jest (the spec used Jest), but the technique is runner-agnostic.
- **Tree:** `createTreeWithEmptyWorkspace()` from `@nx/devkit/testing` -- a fully IN-MEMORY tree. No disk, no compiler, fast.
- **What it verifies:** that the generator adds the `typecheck` target to a project's configuration, with the RIGHT shape per project type, and that an EXISTING target is preserved (idempotency).

### 1c. Executor e2e tier (Impl-A, Impl-C) -- real installed plugin, real workspace

This is the heaviest tier; details in sections 3-4.

---

## 2. Generator / target-wiring tests (the v0.0.4 generator)

This is the most directly relevant prior art for the v0.0.4 typecheck-configuration generator.

### 2a. The generator under test (generic)

A tiny generator: given a project name, read its configuration; if it already has a `typecheck` target, no-op (idempotent); otherwise add one. The target SHAPE branches on `projectType`:

```ts
// pseudo, neutral names
const target = isApplication ? { executor: '@my-org/nx:angular-typecheck', options: { tsConfig: '{projectRoot}/tsconfig.editor.json' } } : { executor: '@my-org/nx:angular-typecheck' }; // library: rely on a target default
updateProjectConfiguration(tree, projectName, { ...project, targets: { ...project.targets, typecheck: target } });
```

Note the asymmetry: APPLICATIONS get an explicit `tsConfig` option (an editor/broad-include tsconfig); LIBRARIES omit it and lean on a workspace `targetDefaults` entry (which pointed at the lib tsconfig). For v0.0.4 this is a decision point: explicit-per-project vs targetDefaults-backed.

### 2b. The testing technique (generic, transferable)

**In-memory `Tree` + read-back assertion.** No disk, no real generation of Angular files where avoidable.

Two complementary spec styles appeared:

1. **Plain table per project type.** Set up a project on an in-memory tree (a real library generator for libs; a hand-built `addProjectConfiguration(...)` stub for apps), run the generator, then `readProjectConfiguration(tree, name).targets.typecheck` and `toEqual(...)` the expected shape. Two cases per type: target ABSENT -> added; target PRESENT -> preserved unchanged (idempotency).

2. **Combinatorial `describe.each` matrix.** A nested `describe.each` over `[allProjectTypes] x [products] x [applications] x [domains]`, skipping invalid combinations via a guard predicate, asserting in each leaf that a `typecheck` target was added with the expected shape. This proves the wiring holds across EVERY project-type/placement permutation a workspace generator can produce, not just one happy path.

```ts
// pseudo
describe.each(allProjectTypes)('a "%s" library', (type) => {
  it('gets a typecheck target', async () => {
    const { projectName, tree } = await setup({ type /* ...placement axes... */ });
    expect(readProjectConfiguration(tree, projectName).targets?.typecheck).toEqual({ executor: '@my-org/nx:angular-typecheck' });
  });
});
```

**Idempotency was tested explicitly and is worth keeping:** seed a project that already has a `typecheck` target with a DIFFERENT/custom value, run the generator, assert the value is byte-for-byte unchanged. This guards the "don't clobber user config on re-run" contract.

**`skipFormat: true` in tests.** The generator calls `formatFiles(tree)` unless `skipFormat` is set; every generator test passed `skipFormat: true` so Prettier doesn't run (faster, and avoids coupling assertions to formatting). The generator schema exposed `skipFormat` (`x-priority: internal`) and a `project` arg defaulted from `argv[0]` with `x-dropdown: projects`.

### 2c. FsTree vs in-memory tree (generic)

Both tree kinds were used, for different tiers:

- **In-memory tree** (`createTreeWithEmptyWorkspace()`): the GENERATOR unit tests. Pure, fast, never touches disk.
- **`FsTree`** (the real on-disk tree): the EXECUTOR e2e tests, to MUTATE files in a real generated workspace so a real compiler run picks them up. `FsTree` was imported from a deep path (`nx/src/generators/tree`) -- isolated to ONE wrapper module with an eslint-disable, and paired with an explicit `flushChanges(tree.root, tree.listChanges())` step (FsTree buffers writes in memory until flushed). The wrapper normalized the workspace root to NATIVE separators for FsTree compatibility (Windows).

**Takeaway for v0.0.4:** test the generator with an in-memory tree (cheap, exhaustive via `describe.each`); reserve `FsTree`/disk for the executor e2e where a real `ngc` run must observe the edits. The generator should NOT need disk at all.

---

## 3. Per-project-type validation (app / local-lib / buildable-lib / publishable-lib / spec-tsconfig)

### 3a. In the GENERATOR tier

Coverage came from the `describe.each` matrix over project types (section 2b). The app vs library SHAPE difference (explicit `tsConfig` for apps; defaulted for libs) was asserted by two distinct expected-shape helpers. The matrix exercised many library placements; applications were covered by a separate hand-built stub project. There was NO separate buildable-vs-publishable-vs-spec branch in the generator -- the only fork was application vs library.

### 3b. In the EXECUTOR e2e tier

- **Application:** wired during workspace setup by writing an editor/broad-include tsconfig (`tsconfig.editor.json` with `strict: true` + a full `angularCompilerOptions` strict block + excludes for spec/stories) and adding the `typecheck` target pointing at it.
- **Library:** a separate helper wired the target at `{projectRoot}/tsconfig.lib.json`. Libraries were generated via the real Angular library generator with `--strict --standalone`.
- **Spec tsconfig / test files:** NOT type-checked as a project type. Instead, test files were EXCLUDED -- the app's editor tsconfig excluded `*.spec.ts`/`*.test.ts`/stories, and Impl-B's executor filtered `*.spec.ts`/`*.test.ts`/`jest.config.ts` out of `rootNames` programmatically (with a unit test asserting the exclusion).
- **Buildable / publishable libraries as DISTINCT shapes:** not separately validated in any branch's executor tests. The only library variant exercised at the executor tier was a standalone-component library and a library-with-a-library-dependency (for the `includeDeps` test). v0.0.4 should treat buildable/publishable/spec-tsconfig coverage as a GAP to design, not inherit.

**Transferable shape facts (re-validate on Nx 23):**

- app target tsConfig was an editor/broad-include tsconfig; lib target tsConfig was `tsconfig.lib.json`;
- the executor itself forced `noEmit: true` + `skipLibCheck: true` on top of the resolved config (Impl-B additionally set `rootDir: workspaceRoot` to avoid TS6059 when importing across project boundaries, and forced `strictTemplates: true`).

---

## 4. Mode testing: quiet/errors-only vs report-all

Only Impl-C had a mode (`quiet`, default `false`, "suppress warnings; only errors").

### 4a. The mechanism under test (generic)

In the diagnostic gatherer, when `quiet` is on, drop every diagnostic whose category is not `Error` (i.e. warnings/suggestions/messages) BEFORE formatting/logging. Errors always pass. Success is still `errorCount === 0`, independent of `quiet`.

### 4b. The testing technique (generic) -- and a key DX choice

These tests needed to assert on actual STDERR text (was a warning printed or not?), which the in-process `runExecutor` could not capture cleanly (logger output is hard to intercept in-process). So a SECOND runner was introduced:

- **`runExecutorInWorkspace`** -- runs the executor IN-PROCESS via devkit's `runExecutor`; returns only `{ success }`. Used for pass/fail assertions.
- **`runNxTargetCli`** -- shells out to the real `nx <target> <project>` CLI, maps option keys to `--kebab-case=value` flags, and CAPTURES `stdout`/`stderr`/`success` (success inferred from a thrown non-zero exit). Used for the `quiet`-mode OUTPUT assertions.

Three quiet-mode cases (the canonical matrix):

1. `quiet: false` + a warning present -> `success: true` AND `stderr` CONTAINS the warning code.
2. `quiet: true` + a warning present -> `success: true` AND `stderr` does NOT contain the warning code.
3. `quiet: true` + a warning AND an error present -> `success: false`, `stderr` contains the error text, but does NOT contain the warning code.

Case 3 is the **load-bearing one**: it proves quiet suppresses WARNINGS without also swallowing ERRORS -- the exact pitfall flagged in the research brief.

### 4c. PITFALLS for v0.0.4

- **Quiet must filter by CATEGORY, not by string/regex on the message.** The implementation keyed on `diagnostic.category !== ts.DiagnosticCategory.Error`. A naive "grep out lines containing 'warning'" would have suppressed an error whose message happened to contain that word, or missed warnings formatted differently. Test case 3 is what locks this in.
- **Extended diagnostics (NG8xxx) are EMITTED AS WARNINGS by default.** The warning fixture deliberately triggered an extended-diagnostic warning (an unnecessary-optional-chain template diagnostic) by adding a non-nullable property and using `?.` on it in the template. So "quiet mode" is precisely "hide NG8xxx-style warnings, keep hard errors." v0.0.4 must decide whether NG8xxx warnings should affect exit code at all -- here they did NOT (warnings never failed the run). The interaction of `quiet` with a future "treat warnings as errors" / `extendedDiagnostics.defaultCategory: error` mode is UNTESTED prior art and needs its own design + tests.
- **Capturing logger output is the real reason for the CLI runner.** If v0.0.4 wants to assert on emitted text (not just exit code), budget for a CLI-spawning runner or refactor the executor so diagnostics are returned/injectable for in-process assertion. Vitest can spawn a child process the same way; prefer making the diagnostic SET unit-testable (Impl-B's mock-getter approach) so most mode logic is covered without spawning.

---

## 5. Incremental / dependency-ordering & filtering tests

Two distinct "scope" concerns appeared; keep them separate in v0.0.4.

### 5a. Dependency-DIAGNOSTIC scope (`includeDeps`) -- Impl-A / Impl-C

"Should errors in a DEPENDED-ON library count against the project under check?" Default: NO (filter diagnostics to files under the project root, excluding `node_modules` and sibling projects). With `includeDeps: true`: YES.

Test technique (e2e):

1. Generate two libraries; make `dependent-lib` import a symbol from `dependency-lib` (a real cross-project import inserted via AST transform, see section 6). Wire the `typecheck` target on `dependent-lib`. Commit this as the workspace baseline.
2. Inject a type error into `dependency-lib` (the dependency).
3. Run `typecheck` on `dependent-lib` with default options -> expect `success: true` (the dependency's error is FILTERED OUT).
4. Set `includeDeps: true` on the target, re-run -> expect `success: false` (now the dependency's error counts).

The in-memory project graph had to be kept in sync when mutating `project.json` options mid-test (a helper updated both the on-disk JSON via the tree AND the in-memory `ProjectGraph` node's `targets[...].options`).

### 5b. Internal/external FILTERING + phase SHORT-CIRCUIT -- Impl-B

Impl-B categorized every diagnostic as INTERNAL (file under `sourceRoot`) or EXTERNAL (outside it), reported only internal ones, and -- crucially -- ran the diagnostic getters in PHASES, stopping early if an internal error appeared in an earlier phase (so template type-checking only runs when earlier phases are internally clean). Run succeeds if there are zero INTERNAL errors even when EXTERNAL errors exist (those are reported as "ignored").

Test technique (unit, mocked): inject a diagnostic into a single phase's getter and assert (a) overall success/failure and (b) whether a LATER phase's getter was called (`not.toHaveBeenCalled()` when an earlier internal error should short-circuit; `toHaveBeenCalled()` when only external errors exist so checking continues). This is the cleanest way to test ordering/short-circuit logic WITHOUT a real compiler, and it transfers directly to Vitest (`vi.fn()` + `expect(...).not.toHaveBeenCalled()`).

### 5c. Cache / Nx dependency-BUILD ordering

There was NO automated test asserting Nx CACHE behavior or that dependency-build ordering ran in the right sequence. The branch that cared about build ordering tested the FILTERING/short-circuit LOGIC (5b), not the Nx scheduler. **Takeaway:** Nx cache hit/miss and `dependsOn` ordering are very expensive to test end-to-end and were not attempted; if v0.0.4 needs cache-correctness coverage, design it deliberately (e.g. assert `outputs`/`inputs` config shape and a single re-run hit) rather than expecting prior art.

---

## 6. Fixtures & error injection

Three distinct fixture strategies appeared -- a useful spectrum:

### 6a. Live AST mutation of a generated workspace (Impl-A / Impl-C) -- DEFAULT for e2e

No static fixture files. Instead, a family of small `introduce*` helpers mutate the REAL generated app/lib in the e2e workspace, each targeting a SPECIFIC diagnostic getter so the test proves that getter runs:

| Helper (generic)            | Triggers                                     | How it injects the error                                                                                                  |
| --------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| TS option error             | `getTsOptionDiagnostics`                     | `updateJson` adds an invalid `compilerOptions` key to the tsconfig                                                        |
| Ng option error             | `getNgOptionDiagnostics`                     | `updateJson` sets a contradictory `angularCompilerOptions` combo (extended diagnostics on while `strictTemplates: false`) |
| TS syntactic                | `getTsSyntacticDiagnostics`                  | append malformed source (`const invalid = {;`)                                                                            |
| TS semantic                 | `getTsSemanticDiagnostics`                   | AST-insert a class property typed `string` with a numeric initializer                                                     |
| Ng structural               | `getNgStructuralDiagnostics`                 | replace a literal `templateUrl` string with a non-literal expression                                                      |
| Ng semantic (template)      | `getNgSemanticDiagnostics`                   | append a binding to a non-existent property in the template HTML                                                          |
| Ng warning (extended diag)  | `getNgSemanticDiagnostics`, category Warning | add a non-nullable prop + `?.` on it in the template                                                                      |
| Library cross-project error | dependency filtering                         | find the dependency lib's component via AST, insert a type-error property                                                 |

AST edits used `jscodeshift.withParser('ts')`; simple appends used string concat; JSON edits used devkit `updateJson`. One getter was explicitly `it.skip`-ped with a comment ("the Angular compiler is lax about this option") -- a healthy habit: record WHY a phase isn't exercised rather than silently omitting it.

The transferable principle: **one injector per diagnostic phase, each asserting that phase fires**, gives you a per-getter coverage map of the gatherer. That map is exactly what proves an "unconditional all-getter" gatherer actually calls every getter.

### 6b. Static on-disk fixture projects (Impl-B, EARLY attempt -- later abandoned)

Impl-B had a `__fixtures__/` tree with named scenario folders (`valid-project`, `internal-ts-error`, `internal-template-error`, `external-error-only`, `mixed-errors`), each a tiny standalone Angular project: a `tsconfig.json` (`noEmit`, `strict`, `strictTemplates`, explicit `files`), a component `.ts`, and where relevant a template `.html` and an `external/broken.ts` (a file OUTSIDE `src/` exporting `const x: string = 123` to model an external-dependency error). The folder NAME encodes the expected outcome.

**But the branch's own test plan explicitly DEPRECATED this approach** in favor of 6c -- reasons given: static fixtures are maintenance overhead, and the unit spec ended up mocking the compiler entirely so the fixtures went unused. Lesson: static fixtures are tempting but drift out of use once you have either AST injection (6a) or temp-dir generation (6c).

### 6c. Programmatic temp-dir projects with the REAL compiler (Impl-B, PLANNED integration tier)

The documented target approach: per test, `fs.mkdtemp` a unique dir under a gitignored `tmp/`, write tsconfig + sources from inline string templates, run the REAL program via the executor, assert, then `rmSync(..., {recursive, force})` in a `finally`. A shared `createTsConfigContent(files)` template and a `createContext(root, sourceRoot)` builder keep cases terse. Module resolution "just works" because `tmp/` sits inside the workspace, so Node walks up to the real `node_modules` (no path-mapping needed). This is the middle tier between mocked-unit and full-workspace-e2e: real compiler, no tarball install, fast-ish.

**For v0.0.4 (Vitest):** 6c is the most attractive default for executor correctness -- real `ngc` diagnostics, cross-platform temp dirs, `try/finally` cleanup, no 4-8 minute workspace bootstrap. Use 6a-style per-getter injectors as the CONTENT of those temp projects. Keep 6b (static fixtures) only if a scenario is too fiddly to express inline.

---

## 7. Differences across the 3 impls that affect TESTING strategy

| Concern           | Impl-A                                            | Impl-C                                                    | Impl-B                                                            | Testing consequence                                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compiler entry    | `performCompilation` + custom `gatherDiagnostics` | same                                                      | `new NgtscProgram` + manual getter loop                           | Impl-B's program is trivially mockable (inject getters); `performCompilation` takes a `gatherDiagnostics` CALLBACK, so unit-testing it means testing the callback in isolation OR going real-compiler. Prefer making the gatherer a pure, separately-exported function. |
| Gather strategy   | unconditional all-getters                         | unconditional all-getters                                 | phased + short-circuit on internal error                          | Short-circuit REQUIRES a test that asserts a later getter was NOT called; all-getters requires a test that EVERY getter contributes. Different assertion shapes.                                                                                                        |
| Scope/filtering   | `includeDeps` (project-root prefix filter)        | `includeDeps` + `quiet`                                   | internal/external by `sourceRoot` prefix, external always ignored | Each needs its own filtering test; `quiet` additionally needs OUTPUT (stderr) assertions, which forced a CLI-spawning runner.                                                                                                                                           |
| Output channel    | devkit `logger`                                   | devkit `logger`                                           | `console`/`process.stderr.write` + ANSI                           | `logger` output is hard to capture in-process -> CLI runner needed; raw `console`/`stderr` is trivially spied (`spyOn`). If v0.0.4 wants cheap output assertions, emit via a seam you can spy, or return diagnostics for the caller to assert.                          |
| Primary test tier | full-workspace e2e only                           | full-workspace e2e (+ quiet CLI subtier) + generator unit | mocked unit (+ planned temp-dir integration)                      | The three branches collectively cover the pyramid; NO branch had a complete pyramid. v0.0.4 should assemble all tiers intentionally.                                                                                                                                    |
| Test runner       | Jest                                              | Jest                                                      | Jest                                                              | All Jest. v0.0.4 is Vitest -> port the mock-hoisting (`vi.hoisted`), the ESM dynamic-`import` mock seam, and `spyOn` patterns; the e2e CLI-spawn and AST-injection helpers are runner-agnostic and transfer as-is.                                                      |

### Cross-cutting e2e harness facts (transferable, re-validate on Nx 23)

- **Build-then-pack-then-install the plugin as a real tarball**, install it into a freshly `create-nx-workspace`-generated workspace, and run its target -- the most faithful "does the published package work" check. Bootstrap cost was minutes (timeouts 4-8 min, longer on CI), so this tier was kept SMALL.
- **Test isolation via git, not re-bootstrap:** the configured workspace is committed once (`git add -A && git commit`); `beforeEach` does `git checkout -- .` to restore, then RECREATES the `FsTree` and re-reads the `ProjectGraph` to clear in-memory state. Sub-suites that add libraries `git commit` a NEW baseline so resets restore THOSE too.
- **Always flush the FsTree** (`flushChanges`) after edits so the real compiler sees them, and **stop the Nx daemon** in `afterAll` to release file handles before deleting the temp workspace (Windows file-locking).
- **Windows/cross-drive gotchas observed:** put the temp workspace under the OS temp dir, NOT a Dev Drive (an Nx `create-nx-workspace` bug with cross-drive `execSync` + missing env caused ENOENT); always pass `env: {...process.env, ...}` to spawned children (so `PATH`/`ComSpec` survive); add an `lmdb` resolution for Windows-arm64 support; normalize FsTree root to native separators. The dev environment for v0.0.4 is also Windows-arm64, so these are likely to recur.
- **CI specifics:** longer timeouts under `CI`, and for the Yarn-based harness, set `YARN_ENABLE_IMMUTABLE_INSTALLS=false` so the bootstrap's lockfile-mutating installs don't fail in CI. (v0.0.4 uses npm; the analogue is ensuring `npm ci` vs `npm install` semantics match the harness's intent.)

---

## Recommendations for v0.0.4 (synthesized, to re-validate on Nx 23 / Vitest)

1. **Generator:** in-memory `Tree` (`createTreeWithEmptyWorkspace`) + read-back `toEqual` on `targets.typecheck`. Cover (a) absent->added per project type via `describe.each`, (b) present->preserved (idempotency). Pass `skipFormat: true`. No disk.
2. **Executor logic:** make the diagnostic gatherer a PURE exported function and unit-test it with injected/mocked getters (Impl-B style, ported to `vi.hoisted` + ESM dynamic-import mock). Assert per-phase contribution AND any short-circuit (`not.toHaveBeenCalled()`).
3. **Executor correctness:** temp-dir integration tier (Impl-B's planned 6c) with the REAL Angular compiler -- one injector per diagnostic phase as the project content; `try/finally` cleanup.
4. **Mode tests:** filter by `DiagnosticCategory`, never by message text; include the load-bearing "quiet hides warnings but still fails on errors" case. Trigger NG8xxx warnings via an extended-diagnostic pattern. Make output assertable via a spy-able seam to avoid spawning the CLI everywhere.
5. **e2e (real tarball):** keep it THIN -- a smoke check per project type that the installed plugin's target runs and exits correctly. Reuse the git-reset isolation, FsTree-flush, daemon-stop, and Windows-arm64 mitigations. Adapt the Yarn-immutable-install workaround to npm.
6. **Known GAPS to design fresh:** buildable/publishable-lib and spec-tsconfig as distinct project shapes; Nx cache hit/miss and `dependsOn` ordering correctness; `quiet` x "warnings-as-errors" interaction. None were covered by prior art.
