# FACTS — testing-strategy board (facts only)

This document states verified facts for advising on a testing strategy. It contains no
recommendations. Read it together with the four research reports in
`.planning/research/v0.0.4-testing/` (`SANDBOX-TECHNIQUES.md`, `CONNECT-TECHNIQUES.md`,
`NX-FSTREE-INTERNALS.md`, `CURRENT-AUDIT-AND-GENERATOR.md`) and the source it cites.

Two prior-art codebases are referenced. One ("sandbox") is a personal prototype on an older
stack. One ("Connect") is a private monorepo whose details are reported here only in generic,
de-identified form; do not seek or infer its proprietary identifiers.

## 1. Subject of the decision

A testing strategy for the next milestone of the `angular-typechecker` Nx plugin. The milestone's
named scope is a `typecheck-configuration` Nx generator plus testing work.

## 2. Product and code

- `angular-typechecker` is an Nx plugin. It currently ships one executor, `angular-typecheck`,
  and no generator. `package.json` has an `executors` field and no `generators` field.
- Stack: Nx 23.0.1, Angular 22.0.4, TypeScript 6.0.x, Vitest 4, Node 22/24/26.
- The executor is a CommonJS adapter over a framework-agnostic core module `runTypecheck`. The
  core `await import()`s ESM `@angular/compiler-cli`, runs a whole-program no-emit compilation,
  and gathers TypeScript + Angular template + extended (NG8xxx) diagnostics unconditionally.
- The core returns a structured `CoreResult` holding the diagnostics (each with a numeric `code`),
  `errorCount`, `warningCount`, `suppressedCount`, and `templateCheckAborted`. A pure `toExitCode`
  maps a result to `0`/`1`/`2`. The Nx executor maps the result to `{ success: boolean }`.
- Production source: ~1,777 LOC across 15 non-test `.ts` files; a vendored compiler-cli type shim
  guarded by a build-time drift target (see §4).
- The planned `typecheck-configuration` generator does not yet exist in this repo. Its intended
  behavior (per milestone scope): add/update the `angular-typecheck` target in a project's
  configuration.

## 3. Existing tests

Counts: 14 unit `*.spec.ts`, 11 `*.integration.spec.ts`, 7 e2e `*.int.spec.ts` (across three e2e
projects: `angular-typechecker-install-e2e`, `angular-typechecker-cache-e2e`,
`angular-typechecker-matrix-e2e`). Runner: Vitest via `@nx/vitest:test`.

- Unit specs: pure functions (`exit-codes`, `evaluate-result`, `filter-diagnostics`,
  `format-report`, `gather-diagnostics`, `normalize-options`); contract specs (`package-manifest`
  asserts the published manifest; `schema-parity` asserts schema.json keys equal the schema.d.ts
  interface); composition specs (`executor.spec.ts`, `infra-failure.spec.ts`) that `vi.mock` the
  four core seams (`runTypecheck`, `renderReport`, `evaluateResult`, `normalizeOptions`) and the
  `@nx/devkit` logger. No real compiler, no workspace, no Tree.
- Integration specs (`*.integration.spec.ts`): call `runTypecheck` against committed
  `fixtures/<scenario>/` tsconfigs with the real `@angular/compiler-cli`; assert exact diagnostic
  `code` values (Angular codes via an `NG()` negative-encoding helper), `errorCount`,
  `suppressedCount`, `templateCheckAborted`. They run a cold `performCompilation`; `testTimeout`
  and `hookTimeout` are set to 30000.
- e2e specs (`*.int.spec.ts`): `install-e2e` packs the build (`npm pack`), installs the tarball
  into a temp consumer, and runs the executor on a clean project and on an injected-error project;
  `tarball-audit` runs `publint`/`attw` and file-set checks; `cache-e2e` asserts
  dependency-error-busts-cache; `matrix-e2e` runs the installed executor across five project types
  via `it.each` and a pnpm-symlink layout. They `execSync` real `nx`/`npm`; configs set
  `pool:'forks'`, `singleFork:true`, serialized, node env, `testTimeout:300000`, and strip `NX_*`
  env vars.
- Build-time drift target `typecheck-drift`: compiles `compiler-cli-types.drift.ts`
  (`tsc --noEmit -p tsconfig.drift.json`), asserting the real `api.Program` stays assignable to a
  vendored shim and pinning NG error-code encoding. Runs in CI alongside `test`.
- Mocking is confined to the two composition specs; integration and e2e use the real compiler.
- Fixtures present (`fixtures/`): `composite-triangle`, `config-broken`, `extended-promoted`,
  `extended-v13`, `fault-isolation`, `gate-b-error`, `global-diagnostics`, `ng-baseline`,
  `no-emit-message`, `sibling-import`, `solution-style`, `ts-baseline`. Fixtures are committed
  (not generated at test time). Paths resolve via `fileURLToPath(import.meta.url)`.

## 4. Diagnostic coverage facts

- `@angular/compiler-cli@22.0.4` exports an enum `ExtendedTemplateDiagnosticName` (annotated
  `@publicApi`) with 18 members (verified by reading
  `node_modules/@angular/compiler-cli/src/ngtsc/diagnostics/src/extended_template_diagnostic_name.d.ts`):
  invalidBananaInBox, nullishCoalescingNotNullable, optionalChainNotNullable,
  missingControlFlowDirective, missingStructuralDirective, textAttributeNotBinding,
  uninvokedFunctionInEventBinding, missingNgForOfLet, suffixNotSupported, skipHydrationNotStatic,
  interpolatedSignalNotInvoked, controlFlowPreventingContentProjection, unusedLetDeclaration,
  uninvokedTrackFunction, unusedStandaloneImports, unparenthesizedNullishCoalescing,
  uninvokedFunctionInTextInterpolation, deferTriggerMisconfiguration.
- `.planning/research/DIAGNOSTIC-CATALOG.md` lists NG-code mappings for these names but (a) labels
  16 of them as the "documented" set and (b) labels `unusedLetDeclaration` (NG8112) and another
  code as "undocumented", and does not list `controlFlowPreventingContentProjection`. The enum
  above (18 members) is the value verified against the installed compiler-cli. The exact NG-code
  for each of the 18 names is in the compiler-cli `ErrorCode` enum (to be read during work).
- The current plugin specs reference, by exact code: NG8101 (invalidBananaInBox), NG8109
  (interpolatedSignalNotInvoked), NG8117 (uninvokedFunctionInTextInterpolation); plus baseline
  NG8001, NG3001, NG3003, and the TCB-fatal NG3004 (grep over `packages/angular-typechecker`).
  The remaining `ExtendedTemplateDiagnosticName` members are not referenced by code in the specs.
- The catalog also lists baseline TS/NG codes (e.g. TS2322, TS2339, NG2003, NG2005, NG2007,
  NG2009, NG1001, NG3003, NG6100, NG8001, NG8002, NG8004) intended for coverage.

## 5. CI facts (`.github/workflows/ci.yml`)

- `permissions: contents: read`; single required aggregate check named `ci`.
- `changes` job: `dorny/paths-filter` (`predicate-quantifier: every`) sets `code=false` for
  planning/docs-only diffs; heavy jobs gate on it.
- `test` job: matrix `{ubuntu:22,24,26; windows:24,26; macos:24}` (6 cells), `NX_DAEMON:false`,
  runs `npx nx run-many -t typecheck-drift test -p angular-typechecker`. In-plugin unit +
  integration specs run here. A new `*.spec.ts`/`*.integration.spec.ts` under
  `packages/angular-typechecker` runs in this job with no `ci.yml` change.
- `e2e` job: `ubuntu-latest`, Node 24, `NX_DAEMON:false`, runs
  `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e
angular-typechecker-matrix-e2e` — an explicit project list. A new e2e project runs only if added
  to this list by name.
- `fallow`, `act-compat`, `lint-workflows` jobs also exist.
- `ci` aggregate `needs: [changes, test, e2e, fallow, act-compat, lint-workflows]`,
  `if: always()`, fails if any needed job result is `failure` or `cancelled` (`skipped` is
  accepted). Job id and name are exactly `ci`.

## 6. Nx facts (verified at tag 23.0.1 / installed nx@23.0.1)

- The `Tree` interface and `FileChange` are re-exported as TYPES by `@nx/devkit`. `FsTree`
  (class), `flushChanges`, `printChanges` are exported from `nx/src/generators/tree`. They are not
  in the `@nx/devkit` public barrel; that path is not listed in `@nx/devkit`'s documented public
  API. In the installed `nx@23.0.1`, `require('nx/src/generators/tree')` resolves to
  `node_modules/nx/dist/src/generators/tree.js` and returns `{ FsTree, flushChanges, printChanges }`.
- `createTree` and `createTreeWithEmptyWorkspace` are public via `@nx/devkit/testing`; both
  construct `new FsTree('/virtual')` (an in-memory tree: disk reads miss). `FsTree` is the only
  `Tree` implementation that touches the real filesystem; it records changes in memory until
  `flushChanges(root, listChanges())` writes them to disk.
- In the nx repo, 452 generator spec files import `createTreeWithEmptyWorkspace`; one spec
  (`packages/nx/src/generators/tree.spec.ts`) constructs `FsTree` against a real temp directory
  (with `flushChanges` + `readFileSync` assertions). Generator specs assert via
  `tree.exists`/`readJson`/`readProjectConfiguration`; they do not flush or tear down.
- The `nx/src/generators/tree` module is byte-identical between tags 23.0.1 and 23.1.0-beta.4.
- `@nx/plugin/testing` exports e2e utilities (`ensureNxProject`, `newNxProject`,
  `runNxCommand`/`runNxCommandAsync`, `uniq`, `tmpProjPath`, `checkFilesExist`, `updateFile`,
  `expectTestsPass`, …). Nx's own plugin e2e starts a local Verdaccio registry in a Jest
  globalSetup (`@nx/js:verdaccio`), publishes packages, and installs into a temp workspace.
- The `@nx/plugin` scaffolders emit starter specs: the generator/executor unit-test templates use
  `createTreeWithEmptyWorkspace` + `mock-project-graph` + `setCwd`; the executor-impl template
  constructs an `ExecutorContext` literal and asserts `{ success }`.

## 7. Prior-art facts

### 7a. Sandbox (Nx 19.8 / Angular 18.2; personal prototype)

- Generator `typecheck-configuration`: 33 lines; `readProjectConfiguration` +
  `updateProjectConfiguration` + `formatFiles`; writes a `typecheck` target defaulting `tsConfig`
  to `<root>/tsconfig.lib.json`; no `generateFiles`, no project-type detection. Its spec uses
  `createTreeWithEmptyWorkspace` (in-memory). A real-disk `createFsTree` helper appears in a
  sandbox planning document but not in the sandbox's committed test code.
- Executor unit spec: `vi.mock`s `@angular/compiler-cli` and constructs an in-memory
  `ExecutorContext` literal.
- Integration: nine files `executor.angular13..21.integration.spec.ts`, one per Angular
  introduction major, calling a shared `registerAngularTypecheckSuite` harness; errors injected
  programmatically (jscodeshift AST edits, JSON edits) into CLI-generated fixtures in a real
  temp dir (`fs` + `execSync`); assertions are `expect(result.success).toBe(false)` (pass/fail,
  not exact code). Single-worker, fixture-build lock + ready-flag, `NX_DAEMON:false`.
- e2e (`nx-plugin-e2e`): build → `npm pack` → publish to a local registry (`--tag e2e`) →
  `create-nx-workspace` consumer → generate + run; asserts a sentinel template-error token in
  stdout. `fs` + `execSync`. No `FsTree`.
- No GitHub Actions CI.

### 7b. Connect (3 branches; private; de-identified; older Nx)

- Branch roles: Impl-A (performCompilation + unconditional all-getter); Impl-C (adds a
  quiet/errors-only mode, per-project-type target wiring, and a generator); Impl-B (a gather
  short-circuit + dependency build ordering).
- Generator unit spec (Impl-C): `createTreeWithEmptyWorkspace` (in-memory) + read-back assertions
  on the written target config + idempotency. A separate target-wiring unit spec asserts config
  objects; no fs/Tree.
- Executor unit spec (Impl-B): `jest.mock`/`jest.fn` + an `ExecutorContext` literal (in-memory).
- Executor e2e (Impl-A and Impl-C): a single de-identified helper file does
  `createFsTree(workspaceRoot) = new FsTree(path.normalize(workspaceRoot), false)` over a real
  generated workspace (the one file importing `nx/src/generators/tree`, with an
  `eslint-disable @nx/enforce-module-boundaries`), and
  `flushFsTreeChanges(tree) = flushChanges(tree.root, tree.listChanges())`. Coverage of that e2e:
  - clean application project → `success === true`;
  - one error per gather phase, injected via an `introduce<Phase>Error(tree, project)` helper, then
    flushed, then run: TS option, TS syntactic, TS semantic, NG structural, NG semantic →
    `success === false`;
  - dependency boundary: wire the typecheck target onto a dependent library via the Tree + flush;
    inject a type error in a dependency library → run → `success === true` by default; run with
    `includeDeps` → `success === false`.
  - Assertions are `result.success` true/false (not exact codes/counts).
  - Harness helpers: `get-test-workspace-root`/`setup-test-workspace` (`create-nx-workspace` +
    `tmpdir` + `execSync`), `run-executor-in-workspace`, `git-reset` isolation, `stop-nx-daemon`,
    `build-plugin-package`, lmdb resolution, package-manager selection. Platform mitigations for
    Windows-arm64 are present.
- Impl-B has no e2e tier (only the mocked executor unit spec).
- Files `runtime-type-checking.spec.ts` and `type-checking-runtime.store.ts` exist on these
  branches; they are unrelated project-specific runtime data-validation code, not the
  angular-typecheck executor/generator.

## 8. Constraints and context

- `main` is PR-only (an active ruleset with an empty bypass list). The single required status
  check is `ci`.
- Versioning: `nx release` with conventional commits, pre-1.0 (`adjustSemverBumpsForZeroMajorVersion`
  in effect): `feat` → patch bump (0.0.3 → 0.0.4); `fix` → patch; `test`/`ci`/`chore`/`docs` → no
  bump.
- Primary development environment is Windows on arm64. The existing e2e harness sets `NX_DAEMON:false`,
  `singleFork`, long timeouts, and strips `NX_*` env.
- The stated purpose of the tool (PROJECT.md): a fast, complete static type-check for AI coding
  agents and CI pipelines, decoupled from building or testing.

## 9. Open decisions (state your position on each)

- D1 — Test substrate. Options present in prior art / Nx: (a) public in-memory
  `createTreeWithEmptyWorkspace`; (b) real-disk `FsTree` via `nx/src/generators/tree`; (c) Node
  `fs` + `execSync` against a generated workspace. Which substrate for which test tier? Should
  `createFsTree`/`flushFsTreeChanges` helpers be authored in this repo, and if so, used where?
- D2 — Diagnostic coverage. How to organize coverage of the 18 `ExtendedTemplateDiagnosticName`
  members and the baseline TS/NG codes (e.g. one file per Angular introduction version; a single
  data-driven table; another structure), how to produce the error conditions (committed fixtures;
  programmatic injection), and what to assert (code; category; count; severity-promotion via
  `extendedDiagnostics.defaultCategory`).
- D3 — Executor-against-workspace test. Whether to add a test that runs the executor against a
  constructed `ExecutorContext`/workspace, positioned between the seam-mocked unit specs and the
  tarball e2e.
- D4 — Generator e2e. Whether and how to test the generator end-to-end (extend an existing e2e
  project; add a new e2e project; local registry; real-disk Tree edits).
- D5 — CI mapping. How any new tests/tiers map to the CI jobs in §5 (the 6-cell `test` matrix; the
  Linux-only `e2e` job with its explicit `-p` list; the single required `ci` check).
- D6 — Scope. Whether the `typecheck-configuration` generator belongs in this milestone, and the
  overall scope of the testing work.

## 10. Output contract (this round)

For each of D1–D6: your position, the facts it rests on, any facts you are missing (that I can
verify), and the specific fact that would change your position. End with a machine-readable block:

```
POSITIONS
D1: <one-line position>
D2: <one-line position>
D3: <one-line position>
D4: <one-line position>
D5: <one-line position>
D6: <one-line position>
FACTS-NEEDED: <comma-separated, or "none">
WOULD-CHANGE-MIND: <per-decision trigger, or "none">
```
