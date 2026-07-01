# v0.0.4 Testing Audit + Nx 23 Generator Authoring/Testing Research

**Researched:** 2026-06-30
**Repo:** `D:\projects\github\LayZeeDK\angular-typechecker` (Nx 23.0.1 / Angular 22.0.4 / TS 6 / Vitest 4)
**Scope:** Part A current-repo audit (read-only) + Part B Nx 23 generator best-practices + Part C web prior art on NG8xxx test organization.
**Overall confidence:** HIGH for Part A (read direct from tracked source) and the Nx API facts (verified against installed `nx@23.0.1`); MEDIUM for the web prior-art patterns (official docs + Angular source-layout, cross-checked but not exhaustively browsed).

---

## PART A -- Current-repo testing audit

### A.1 Test inventory by tier

Counts are from `git ls-files`-tracked source under `packages/angular-typechecker/src/` and `e2e/`.

**Unit specs (`*.spec.ts`, jsdom env, fast; pure functions or mocked seams) -- 14 files:**

| File (relative to `packages/angular-typechecker/src/`)  | Covers                                                                                                                                                                           |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/compiler-cli-types.runtime.spec.ts`               | Runtime sanity that `NG()` encoding matches the compiler's `ngErrorCode()` for 8001/8109/3004 (negative encoding contract).                                                      |
| `core/evaluate-result.spec.ts`                          | Verdict policy: errorCount/maxWarnings -> `{ success }`.                                                                                                                         |
| `core/exit-codes.spec.ts`                               | `toExitCode` (2 infra / 1 errors / 0 clean).                                                                                                                                     |
| `core/filter-diagnostics.spec.ts`                       | Boundary/dependency filtering pure logic.                                                                                                                                        |
| `core/format-report.spec.ts`                            | Report shaping (pure).                                                                                                                                                           |
| `core/gate-b.spec.ts`                                   | Differential all-getter vs ngc default gatherer (uses real compiler against `gate-b-error` fixture -- effectively integration despite `.spec.ts` name; asserts TS2322 + NG8109). |
| `core/gather-diagnostics.spec.ts`                       | The unconditional all-getter gatherer against hand-built `ts.Program` stubs.                                                                                                     |
| `core/infra-failure.spec.ts`                            | Infra-500 classification + `TypecheckInfrastructureError` (mocked; asserts TS2322/TS5012 contrast).                                                                              |
| `core/render-report.spec.ts`                            | Rendered output (pure; builds `diagnostic(code)` literals).                                                                                                                      |
| `core/run-typecheck.spec.ts`                            | Sorting/shaping over literal diagnostics (NG8109/NG3001/NG3003/NG3004 as data, NOT real-compiler-emitted).                                                                       |
| `executors/angular-typecheck/executor.spec.ts`          | Adapter composition + error handling (mocked four seams + `@nx/devkit` logger).                                                                                                  |
| `executors/angular-typecheck/gate-a-static.spec.ts`     | Static schema/registration gate.                                                                                                                                                 |
| `executors/angular-typecheck/normalize-options.spec.ts` | Option normalization (pure).                                                                                                                                                     |
| `executors/angular-typecheck/schema-parity.spec.ts`     | `schema.json` keys == `schema.d.ts` interface keys.                                                                                                                              |
| `package-manifest.spec.ts`                              | Published `package.json` deps/peers/engines/files/exports/keywords contract.                                                                                                     |

**Real-compiler integration specs (`*.integration.spec.ts`, jsdom env, cold `performCompilation`) -- 11 files:**

| File                                            | Covers (decision proven end-to-end)                                                                                         |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `core/baseline.angular13.integration.spec.ts`   | TS2339 (template missing member) + NG8001 (unknown element).                                                                |
| `core/extended.angular13.integration.spec.ts`   | NG8101 default WARNING category.                                                                                            |
| `core/extended.promotion.integration.spec.ts`   | NG8101 promoted to Error via `defaultCategory: "error"` + D-01 count invariant.                                             |
| `core/config-resolution.integration.spec.ts`    | Planted TS2322 with rootNamesCount > 0; TS18003 not a gate signal.                                                          |
| `core/fault-isolation.integration.spec.ts`      | TCB-poison NG3004 (`NG(3004)`) survivor keeps its TS2322; no infra-500 collapse; checks `NG(8001)` absence.                 |
| `core/global-diagnostics.integration.spec.ts`   | Global TS2318 surfaced via the global getter.                                                                               |
| `core/no-emit-override.integration.spec.ts`     | Override neutralizes TS5053/TS6304/TS6379.                                                                                  |
| `core/run-typecheck.integration.spec.ts`        | ENG-02 TS2322 + NG8109 in one pass; dependency boundary filter; TS6059 neutralized; runs app + lib tsconfigs via `it.each`. |
| `core/suppress-output-path.integration.spec.ts` | No TS5055 in no-emit flow.                                                                                                  |
| `core/ts99-leak.integration.spec.ts`            | No TS99/internal-code leak; asserts `NG(8101)` present symbolically.                                                        |
| `core/extended.promotion.integration.spec.ts`   | (listed above)                                                                                                              |

**E2E / tarball specs (`*.int.spec.ts`, node env, fully serialized) -- 7 files across 3 Nx projects:**

| Project / file                                   | Covers                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `install-e2e/install-smoke.int.spec.ts`          | Pack the dist tarball -> clean tmp install (no peer override) -> green run exit 0 + injected-TS2322 non-zero + no `ERR_REQUIRE_ESM`. |
| `install-e2e/tarball-audit.int.spec.ts`          | `publint --strict` + `attw --pack --profile node16` + file-set / no-install-scripts / no-`@fixtures`-leak gates.                     |
| `install-e2e/release-hygiene.int.spec.ts`        | Release-artifact hygiene checks.                                                                                                     |
| `matrix-e2e/matrix-5types.int.spec.ts`           | Installed tarball executor across all 5 project types via `it.each`.                                                                 |
| `matrix-e2e/pnpm-symlink.int.spec.ts`            | pnpm `.pnpm/` layout resolution.                                                                                                     |
| `cache-e2e/executor-parity.int.spec.ts`          | Executor parity (cached vs cold).                                                                                                    |
| `cache-e2e/cache-busts-on-dep-error.int.spec.ts` | Nx cache invalidation on dependency source change.                                                                                   |

**Build-time drift "test" (not a Vitest spec):** `core/compiler-cli-types.drift.ts` compiled by the `typecheck-drift` Nx target (`tsc --noEmit -p tsconfig.drift.json`). Asserts the real `@angular/compiler-cli` `Program` stays assignable to the vendored shim.

### A.2 `executor.spec.ts` organization -- mock seam analysis

**Seam used: `runTypecheck` (the core composition boundary), NOT the compiler-cli.** `executor.spec.ts:33-53` mocks the four core seams (`runTypecheck`, `renderReport`, `evaluateResult`, `normalizeOptions`) plus `@nx/devkit`'s `logger`, while preserving the real `TypecheckInfrastructureError` class via `importOriginal` + spread so the executor's `instanceof` catch still works (`executor.spec.ts:33-41`). The unit-under-test is re-imported INSIDE each `it` (`const { default: executor } = await import('./executor')`) so the hoisted `vi.mock` registrations apply.

**What it asserts (composition + error classification, never compiler behavior):**

- errorCount 0 -> `{ success: true }`, errorCount > 0 -> `{ success: false }` (delegated to `evaluateResult`).
- Report written via `process.stdout.write`, NOT `logger.info` (D-04).
- `templateCheckAborted` (RES-02) -> a loud `logger.warn` naming the file + `NG3004` + `SUPPRESSED`, advisory-not-verdict (abort + errorCount 0 still `{ success: true }`).
- `TypecheckInfrastructureError` -> `logger.error` ("infrastructure error" token) + `{ success: false }`; a plain `Error` is re-thrown, never swallowed, never mis-classified as infra.

**Comparison to a sandbox-style in-memory variant (gaps):** This is a CLASSIC mock-the-seam unit test -- it deliberately does NOT exercise an `ExecutorContext` against a real or in-memory workspace, and it does NOT read a real `project.json`/`tsconfig` off any Tree. A "sandbox-style in-memory variant" (running the executor against a `createTreeWithEmptyWorkspace`-seeded project, or a real-disk fixture workspace) would additionally prove: (1) the executor resolves `context.root` + the `tsConfig` option to a real on-disk path; (2) `normalizeOptions` against a real `project.json` target; (3) the executor binds under its PUBLISHED id. Today (1) and (3) are covered ONLY at the e2e tier (`install-smoke` / `matrix-5types`), and (2) only via the pure `normalize-options.spec.ts`. There is no mid-tier "executor against an in-memory/real workspace" spec -- the jump is mocked-unit -> full-tarball-e2e with nothing in between. This gap is the natural home for the FsTree substrate decision (see Part B / Recommendation), because the NEW generator will need exactly that mid-tier substrate and the executor could reuse it.

### A.3 Integration-spec organization -- version split + NG8xxx coverage map

**Organization: PARTIALLY by Angular introduction-version, NOT collapsed, but only two version-files exist.** The naming convention `<topic>.angularNN.integration.spec.ts` is established (`baseline.angular13.integration.spec.ts`, `extended.angular13.integration.spec.ts`) and `DIAGNOSTIC-CATALOG.md:60-62` explicitly prescribes "Mirror the sandbox's per-introduction-version split (`executor.angularNN.integration.spec.ts`) so adding a future Angular major's diagnostics is a drop-in file." But TODAY only the **v13** introduction set has dedicated files; v14-v22 have NO `angularNN` integration files. The third extended file was deliberately RENAMED from `extended.angular17.integration.spec.ts` to `extended.promotion.integration.spec.ts` (`extended.promotion.integration.spec.ts:20-25`) precisely because its `angular17` signal was FALSE -- it carries no v17-specific code. So the version-split scaffolding exists but is unpopulated beyond v13.

**Does the suite assert EVERY NG8xxx code in the catalog? NO -- it is the major gap of v0.0.4.** Grepping every plugin spec for NG-coded assertions, the ONLY real-compiler-emitted NG codes asserted by any spec are:

| Catalog NG8xxx code                         | Asserted by real compiler? | Where                                                                                                               |
| ------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| NG8101 invalidBananaInBox                   | YES                        | `extended.angular13.integration.spec.ts`, `extended.promotion.integration.spec.ts`, `ts99-leak.integration.spec.ts` |
| NG8109 interpolatedSignalNotInvoked         | YES                        | `run-typecheck.integration.spec.ts`, `gate-b.spec.ts`                                                               |
| NG8102 nullishCoalescingNotNullable         | **MISSING**                | --                                                                                                                  |
| NG8103 missingControlFlowDirective          | **MISSING**                | --                                                                                                                  |
| NG8104 textAttributeNotBinding              | **MISSING**                | --                                                                                                                  |
| NG8105 missingNgForOfLet                    | **MISSING**                | --                                                                                                                  |
| NG8106 suffixNotSupported                   | **MISSING**                | --                                                                                                                  |
| NG8107 optionalChainNotNullable             | **MISSING**                | --                                                                                                                  |
| NG8108 skipHydrationNotStatic               | **MISSING**                | --                                                                                                                  |
| NG8111 uninvokedFunctionInEventBinding      | **MISSING**                | --                                                                                                                  |
| NG8113 unusedStandaloneImports              | **MISSING**                | --                                                                                                                  |
| NG8114 unparenthesizedNullishCoalescing     | **MISSING**                | --                                                                                                                  |
| NG8115 uninvokedTrackFunction               | **MISSING**                | --                                                                                                                  |
| NG8116 missingStructuralDirective           | **MISSING**                | --                                                                                                                  |
| NG8117 uninvokedFunctionInTextInterpolation | **MISSING**                | --                                                                                                                  |
| NG8021 deferTriggerMisconfiguration         | **MISSING**                | --                                                                                                                  |

So **2 of 16** documented extended diagnostics are asserted by exact code; **14 are missing**. (The `NG()` helper is the assertion idiom -- `core/diagnostic-codes.ts`; counting is by `.category`, never code sign, per L-4.)

**Baseline (non-extended) NG codes:** only NG8001 (`baseline.angular13.integration.spec.ts`) and NG3004 (fault-isolation, as a TCB-fatal control code) are real-compiler-asserted. The catalog's other baseline codes (NG2003/NG2005/NG2007/NG2009/NG1001/NG3003/NG6100/NG8002/NG8004) are NOT asserted against the real compiler (NG3001/NG3003 appear only as LITERAL data in `run-typecheck.spec.ts`'s sorting test, not compiler-emitted). The TypeScript side is well covered (TS2322/TS2339/TS2318/TS5012/TS5053/TS5055/TS6059/TS6304/TS6379/TS18003).

### A.4 CI job coverage (`.github/workflows/ci.yml`)

| Job              | Runs on                                                       | What it runs                                                                                                              | Notes                                                                                                 |
| ---------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `changes`        | ubuntu-latest                                                 | `dorny/paths-filter` (`predicate-quantifier: every`)                                                                      | Sets `code` output; heavy jobs gate on `code != 'false'`. Planning/docs-only PRs skip the matrix.     |
| `test`           | 6-cell matrix: ubuntu {22,24,26}, windows {24,26}, macos {24} | `npx nx run-many -t typecheck-drift test -p angular-typechecker`                                                          | The plugin unit + integration specs + drift gate, every cell. `fail-fast: false`, `NX_DAEMON: false`. |
| `e2e`            | ubuntu-latest, Node 24 ONLY (Linux-only by design, RD-03)     | `npx nx run-many -t test -p angular-typechecker-install-e2e angular-typechecker-cache-e2e angular-typechecker-matrix-e2e` | pnpm via `pnpm/action-setup`. The 3 serialized e2e projects, explicit list.                           |
| `fallow`         | ubuntu-latest                                                 | `npx fallow audit --format human --base origin/main`                                                                      | new-only code-quality gate; `fetch-depth: 0`.                                                         |
| `act-compat`     | ubuntu-latest                                                 | `tools/act/act-compat.sh`                                                                                                 | `act --validate` + `act -n` per trigger.                                                              |
| `lint-workflows` | ubuntu-latest                                                 | `actionlint`                                                                                                              | Static workflow validation.                                                                           |
| `ci`             | ubuntu-latest                                                 | aggregate gate, `if: always()`                                                                                            | The required-status-check name. Fails on `failure`/`cancelled`; tolerates intentional `skipped`.      |

**Where a new generator + tests wire into CI:**

- **Generator unit + integration specs** (`@nx/vitest:test` on `angular-typechecker`): land AUTOMATICALLY in the `test` job's 6-cell matrix the moment they match `vitest.config.mts`'s include glob (`{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`). NO ci.yml change needed for in-plugin specs.
- **NG8xxx catalog integration specs** (`*.integration.spec.ts` under `src/core/`): same -- already in the `test` job glob.
- **Generator e2e** (if a NEW Nx e2e project, e.g. `angular-typechecker-generator-e2e`): MUST be added by name to the `e2e` job's explicit `-p ...` list in ci.yml (line 142-143). The explicit list is intentional (RD-03 "consistent gate meaning"), so a new e2e project is invisible to CI until added there. Also needs `implicitDependencies: ["angular-typechecker"]` in its `project.json` so the fresh tarball is built/packed first.
- **Drift gate for a new internal import** (the FsTree `nx/src/generators/tree` quarantine): if the bespoke `createFsTree` route is chosen, the existing `typecheck-drift` mechanism is the template for a tripwire on that internal import (see A.5 / Recommendation). A new drift file would need its path added to the `typecheck-drift` target `inputs` in `project.json` (lines 48-55) and is then covered by the same `test` job run-many.

### A.5 The FsTree documentation-drift (cite)

**Confirmed: `createFsTree` / `flushFsTreeChanges` and any `src/testing/` (or `testing/test-nx-utils`) directory do NOT exist in tracked source** -- `git grep -E "createFsTree|flushFsTreeChanges"` and `git grep -E "src/testing|/testing/|createTreeWithEmptyWorkspace"` over `:!.planning/**` both return ZERO matches. They exist ONLY in `.planning/` prose. The drift is now _correctly acknowledged_ (it is no longer a false claim of delivery):

- **`.planning/PROJECT.md:96`**: "Test helpers `createFsTree()` / `flushFsTreeChanges()` ... PLANNED as a v0.0.1 deliverable but NOT delivered to source (no generator consumer existed); authored for real in v0.0.4 with the `typecheck-configuration` generator..."
- **`.planning/PROJECT.md:135`**: catalog row marked "[DEFERRED] Planned v0.0.1, NOT delivered (no generator to test); scheduled for v0.0.4..."
- **`.planning/PROJECT.md:166`**: "...Corrected the FsTree documentation-drift (`createFsTree`/`flushFsTreeChanges` were planned in v0.0.1 but never delivered -- they land in v0.0.4...)"

**Stale/aspirational references that still describe the helpers as if designed (architecture intent, not delivery claims):**

- **`.planning/research/ARCHITECTURE.md:9, 140, 180, 358`**: describes a sibling `testing/test-nx-utils` project as the quarantine home for `createFsTree`/`flushFsTreeChanges` (modeled on nx-verdaccio's `testing/test-nx-utils/src/lib/utils/tree.ts`). This is the architectural design, not a delivered artifact.
- **`.planning/research/FOLLOWUP-FINDINGS.md:30` + `.planning/research/SUMMARY.md:155`**: verify the internal import `import { FsTree, flushChanges } from 'nx/src/generators/tree'` IS still exported on Nx 23.0.1.

**Independently re-verified against the INSTALLED `nx@23.0.1` (this session):** `node_modules/nx/dist/src/generators/tree.d.ts:89` declares `export declare class FsTree implements Tree`, and `:124` declares `export declare function flushChanges(...)`. The internal-path capture stands. There is therefore NO drift-gate (tripwire) on this internal import in source today, because the helper itself was never written.

---

## PART B -- Nx 23 devkit generator authoring + testing (verified)

All API names below were verified against the INSTALLED `nx@23.0.1` / `@nx/devkit@23.0.1` type declarations, not just docs.

### B.1 Generator authoring

**Function shape:** A generator is `async function (tree: Tree, options: SchemaInterface): Promise<void | GeneratorCallback>`. It may return a callback (e.g. `() => installPackagesTask(tree)`) that runs after the Tree is flushed to disk. (`@nx/devkit` Overview; Tooling Plugin tutorial.)

**Verified exported APIs from `@nx/devkit` (`nx/dist/src/devkit-exports.d.ts` + `@nx/devkit/dist/public-api.d.ts`):**

- `addProjectConfiguration`, `readProjectConfiguration`, `updateProjectConfiguration`, `removeProjectConfiguration`, `getProjects` (line 60).
- `readProjectsConfigurationFromProjectGraph` (line 117, with `createProjectGraphAsync` / `readCachedProjectGraph`).
- `joinPathFragments`, `normalizePath` (line 105).
- `generateFiles`, `formatFiles`, `OverwriteStrategy` (via `public-api.d.ts` -> `nx/dist/src/generators/utils/generate-files.d.ts`: `export declare enum OverwriteStrategy` at line 5; `export declare function generateFiles(...)` at line 42, with an `overwriteStrategy?: OverwriteStrategy` option at line 17).
- `OverwriteStrategy` members: `Overwrite` (default), `KeepExisting`, `ThrowIfExisting` -- the idempotency control for a config-injecting generator.

**For THIS generator (`typecheck-configuration` -- adds an `angular-typecheck` target to an existing project), the idiomatic shape:**

```
export default async function typecheckConfigurationGenerator(
  tree: Tree,
  options: TypecheckConfigurationGeneratorSchema,
): Promise<void> {
  const project = readProjectConfiguration(tree, options.project); // throws if absent
  // idempotency guard: skip / merge if target already exists
  project.targets ??= {};
  project.targets['angular-typecheck'] = {
    executor: 'angular-typechecker:angular-typecheck',
    options: { tsConfig: joinPathFragments(project.root, 'tsconfig.lib.json') },
  };
  updateProjectConfiguration(tree, options.project, project);
  await formatFiles(tree);
}
```

This generator MODIFIES an existing `project.json` -- it does NOT call `addProjectConfiguration` (that creates a new project) and likely does NOT need `generateFiles` (no template files to emit) unless it also scaffolds a `tsconfig`. Use `generateFiles` only if shipping template files under a `files/` dir; use EJS `<%= name %>` substitutions and `__name__`-style filename variables, with `OverwriteStrategy.KeepExisting` for idempotency.

**Registration (`generators.json` + `package.json`):**

- Add a `generators.json` at the package root:
  ```
  { "$schema": "...", "generators": {
    "typecheck-configuration": {
      "factory": "./src/generators/typecheck-configuration/generator",
      "schema": "./src/generators/typecheck-configuration/schema.json",
      "description": "Add the angular-typecheck target to a project."
  } } }
  ```
- Add `"generators": "./generators.json"` to the published `package.json` (sibling to the existing `"executors": "./executors.json"`).
- **CI/build wiring:** the build target's `assets` in `project.json` must glob `generators.json` into the output (mirror the existing `executors.json` asset block at `project.json:34-38`), and `schema.json` files are non-`.ts` so they already match the existing `**/!(*.ts)` asset glob (`project.json:20-23`). Add `generators.json` to `files` in `package.json` so it ships.
- `schema.json` uses `"cli": "nx"`, `properties`, `required`, and `$default` (`{ "$source": "argv", "index": 0 }`) for the positional `project` arg. Hand-author a matching `schema.d.ts` interface; an existing `schema-parity.spec.ts` pattern can be extended to gate generator schema.json/d.ts parity too.

### B.2 Generator testing -- in-memory `createTreeWithEmptyWorkspace` (idiomatic)

**Verified:** `createTreeWithEmptyWorkspace(opts?: { layout?: "apps-libs" })` is exported from `@nx/devkit/testing` (re-export chain: `@nx/devkit/dist/testing.d.ts` -> `nx/src/devkit-testing-exports` -> `nx/dist/src/generators/testing-utils/create-tree-with-empty-workspace`). The `@nx/devkit/testing` subpath export exists in `@nx/devkit@23.0.1`'s `package.json` exports map.

**Canonical unit-test pattern (official + community-confirmed):**

```
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, readProjectConfiguration } from '@nx/devkit';

describe('typecheck-configuration generator', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // SEED the target project, because this generator UPDATES an existing project
    // (it does not create one). Without a seeded project, readProjectConfiguration throws.
    addProjectConfiguration(tree, 'demo-lib', {
      root: 'libs/demo-lib', sourceRoot: 'libs/demo-lib/src', targets: {},
    });
  });

  it('adds the angular-typecheck target with the right executor', async () => {
    await generator(tree, { project: 'demo-lib' });
    const config = readProjectConfiguration(tree, 'demo-lib');
    expect(config.targets['angular-typecheck'].executor)
      .toBe('angular-typechecker:angular-typecheck');
  });

  it('is idempotent (running twice yields the same config)', async () => {
    await generator(tree, { project: 'demo-lib' });
    const first = readProjectConfiguration(tree, 'demo-lib');
    await generator(tree, { project: 'demo-lib' });
    expect(readProjectConfiguration(tree, 'demo-lib')).toEqual(first);
  });
});
```

**What to assert:** the updated `project.json` target (executor id + options), idempotency (run twice -> equal config), and error on a missing project. `toMatchSnapshot()` of `readProjectConfiguration(...)` is the community-preferred way to lock the full target shape.

**Known Vitest pitfalls (from nrwl/nx issues):**

1. Importing from `@nx/devkit` transitively loads nx NATIVE bindings + a pseudo-terminal; open handles can keep the runner alive (nx#26346). The repo already runs `NX_DAEMON: false` in CI, which helps; if hangs appear, raise `testTimeout` and consider `pool`/`poolOptions`. The plugin config already sets `testTimeout: 30000` (`vitest.config.mts:24`).
2. Generator unit tests can accidentally pick up the REAL workspace instead of `/virtual` (nx#32588) -- a correctness hazard. Mitigation: always seed via `addProjectConfiguration` against the empty tree and assert against `/virtual`-rooted paths; never read `process.cwd()`.
3. CI flake on newer Nx when generators call OTHER nx generators under the hood (nx#27816) -- not applicable here since `typecheck-configuration` is a pure config-edit generator that calls no sub-generators.

### B.3 Generator e2e (Nx 23)

Two viable routes, in increasing fidelity:

1. **In-plugin integration spec (cheap, in-memory):** the `createTreeWithEmptyWorkspace` tests above, in the `test` job's matrix. Proves the Tree transformation. Does NOT prove the generator resolves from an installed package.
2. **Real-tarball e2e (full fidelity, Linux-only):** mirror the existing `install-smoke` harness -- `npm pack` the freshly-built dist, install into an isolated `mkdtempSync` workspace, then `execSync('npx nx g angular-typechecker:typecheck-configuration <proj>', { cwd, env })` and assert the resulting on-disk `project.json` (and that `nx run <proj>:angular-typecheck` then runs). This reuses the repo's exact `buildCleanEnv` / nested-nx env-strip / empty-`.npmrc` honesty pattern (`install-smoke.int.spec.ts:57-96`).
   - The Nx-canonical helper for route 2 is `createTestProject()` + Verdaccio local registry (`tools/scripts/start-local-registry.ts` wired into global setup, plugin published with the `@e2e` tag, installed via `npx nx add <plugin>@e2e`). BUT this repo deliberately does NOT use Verdaccio -- it uses direct `npm pack` + tmp install (simpler, already proven for the executor). Recommendation: extend the EXISTING tarball harness rather than introduce Verdaccio, to keep one e2e mechanism.
   - **Windows caveat:** the generated Verdaccio `start-local-registry.ts` `execFileSync(nx, ...)` is known to fail on Windows -- another reason to prefer the repo's existing `npm pack` route over the scaffolded Verdaccio path. (The repo's e2e is Linux-only in CI anyway.)

---

## PART C -- Web prior art: organizing NG8xxx diagnostic-assertion test suites

**Angular's own compiler-cli is the authoritative prior art**, and its structure is a clean two-layer split worth mirroring:

1. **Source: one file/dir per check.** Each extended diagnostic lives at `packages/compiler-cli/src/ngtsc/typecheck/extended/checks/<snake_case_name>/` exporting a `factory` with a `name` (e.g. `invalid_banana_in_box`, `nullish_coalescing_not_nullable`, `missing_control_flow_directive`). Three central files coordinate: `diagnostics/src/error_code.ts` (codes), `extended_template_diagnostic_name.ts` (config name map), and the `extended/index.ts` factory registry.
2. **Per-check UNIT spec, co-located.** When the feature was introduced (PR #42984), the pattern was a separate `<check>_spec.ts` per check (e.g. `invalid_banana_in_box_spec.ts`) testing the check factory in isolation. These live under `extended/test/checks/`.
3. **Centralized INTEGRATION spec.** A single `packages/compiler-cli/test/ngtsc/extended_template_diagnostics_spec.ts` exercises diagnostics end-to-end through the compiler (`NgtscTestEnvironment.setup(testFiles); env.tsconfig({ strictTemplates: true })`), and `template_typecheck_spec.ts` covers config-validation (e.g. errors when `strictTemplates: false` but `extendedDiagnostics` is configured; unknown check/category names).

**Idiomatic assertion pattern in Angular's tests:** find the diagnostic by EXACT code, assert its `.category` and message presence -- exactly what this repo's `extended.angular13.integration.spec.ts:36-44` already does (`result.diagnostics.find(d => d.code === NG(8101))` -> `expect(banana?.category).toBe(ts.DiagnosticCategory.Warning)`). The repo's `NG()` helper + category-not-sign counting is already aligned with Angular's idiom.

**Patterns worth adopting for the v0.0.4 catalog:**

- **A centralized per-introduction-version integration spec, NOT one-file-per-code.** Angular uses ONE `extended_template_diagnostics_spec.ts` with many `it`s, plus per-check unit specs at a different layer (where the unit-under-test is the check factory). This repo has no access to the internal check factories (it runs the public `performCompilation`), so the per-check-unit layer does NOT apply. The right analogue is the catalog's own prescription (`DIAGNOSTIC-CATALOG.md:60`): per-introduction-version integration files (`extended.angularNN.integration.spec.ts`) each containing one `it` per code introduced in that major. This keeps "add a future major" a drop-in file (matching the existing v13 files) while grouping by the catalog's derived taxonomy.
- **Fixture-per-diagnostic, asserted by exact code + count** (catalog `:62`). Each NG8xxx needs a minimal component+template fixture that triggers exactly that check under `strictTemplates`. Angular's `NgtscTestEnvironment` writes in-memory test files; this repo uses committed `fixtures/<scenario>/` dirs. Given the repo runs the real `performCompilation` against real tsconfigs, committed fixtures are the right substrate (consistent with `fixtures/extended-v13/`). Consider a `fixtures/extended-vNN/` per major or a single `fixtures/extended-catalog/` with per-code component files.
- **Config-validation coverage** (Angular's `template_typecheck_spec.ts` layer): assert promotion via `defaultCategory: "error"` (already done for NG8101 in `extended.promotion.integration.spec.ts`) generalizes to any code; and the WARNING-default vs promoted-Error contrast is the portable, version-independent mechanism test.

---

## DELIVERABLES

### (1) Technique matrix vs prior art (sandbox + Connect + nx)

> Connect specifics are NOT reproduced here per the hard memory rule; "Connect" column reflects only the generic, non-proprietary technique class the prior-art notes describe.

| Technique                                                       | This repo TODAY                                         | sandbox / catalog prior art                 | nx / nx-verdaccio prior art                      | Status                        |
| --------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------ | ----------------------------- |
| Pure-unit specs (mocked seams)                                  | PRESENT (`executor.spec.ts`, `normalize-options`, etc.) | n/a                                         | standard                                         | PRESENT                       |
| Real-compiler integration specs                                 | PRESENT (11 files)                                      | sandbox `ANGULAR-COMPILER-ERRORS` fixtures  | n/a                                              | PRESENT                       |
| Tarball/install e2e (npm pack + tmp install)                    | PRESENT (`install-smoke`, `tarball-audit`, matrix)      | n/a                                         | nx uses Verdaccio + `createTestProject`          | PRESENT (different mechanism) |
| Per-introduction-version integration files                      | PARTIAL (only v13; scaffold prescribed)                 | sandbox `executor.angularNN.spec` split     | n/a                                              | PARTIAL                       |
| EVERY NG8xxx asserted by exact code/count                       | MISSING (2/16 extended; many baseline NG missing)       | catalog goal (TEST-02)                      | n/a                                              | MISSING                       |
| Generator (`typecheck-configuration`)                           | MISSING (no generator in repo)                          | n/a                                         | nx generator pattern                             | MISSING                       |
| `generators.json` + `generators` package field                  | MISSING                                                 | n/a                                         | nx-verdaccio ships both                          | MISSING                       |
| FsTree test utilities (`createFsTree`/`flushFsTreeChanges`)     | MISSING (drift: planned v0.0.1, never delivered)        | bespoke real-disk wrapper (sandbox/Connect) | nx-verdaccio `testing/test-nx-utils/.../tree.ts` | MISSING                       |
| In-memory generator unit tests (`createTreeWithEmptyWorkspace`) | MISSING                                                 | n/a                                         | nx canonical                                     | MISSING                       |
| Generator e2e (`execSync nx g` against installed tarball)       | MISSING                                                 | n/a                                         | nx `createTestProject` + Verdaccio               | MISSING                       |
| Mid-tier "executor against a workspace substrate"               | MISSING (mocked-unit jumps straight to tarball-e2e)     | sandbox in-memory variant                   | n/a                                              | MISSING (gap)                 |
| Drift tripwire on an nx-internal import                         | n/a (no internal import yet)                            | n/a                                         | quarantine + eslint-disable                      | N/A-until-FsTree              |
| Schema.json/d.ts parity gate                                    | PRESENT for executor (`schema-parity.spec.ts`)          | n/a                                         | n/a                                              | EXTEND to generator           |

### (2) RECOMMENDATION on the FsTree substrate decision

**Recommendation: use the PUBLIC in-memory `createTreeWithEmptyWorkspace()` from `@nx/devkit/testing` as the DEFAULT substrate for the `typecheck-configuration` generator's unit/integration tests, and DEFER the bespoke real-disk `createFsTree`/`flushFsTreeChanges` quarantine unless a concrete need for real-disk semantics appears.**

Reasoning specific to THIS repo:

- **The generator under test is a pure `project.json` config-edit.** Its entire observable behavior is a Tree transformation: `readProjectConfiguration` -> mutate `targets` -> `updateProjectConfiguration` -> `formatFiles`. The in-memory Tree captures 100% of that. There is no behavior that requires real disk (no `tsc`/`ngc`/`nx` subprocess reads the Tree mid-generation; the executor that consumes the target is tested separately at the e2e tier).
- **`createTreeWithEmptyWorkspace` is public, version-stable, and zero-quarantine.** It is exported from `@nx/devkit/testing` (verified in `nx@23.0.1`) and needs no `eslint-disable`, no internal-import drift tripwire, and no new `testing/` project. Adopting the bespoke `createFsTree` (over `nx/src/generators/tree`'s `FsTree`/`flushChanges`) would add: an internal-import quarantine file, an eslint-disable, AND a new drift gate to maintain -- all to gain real-disk fidelity the generator does not need.
- **The prior-art lean toward real-disk (`PROJECT.md:34`) was motivated by "stay faithful to the prior art," not by a test that fails on an in-memory Tree.** The catalog/sandbox real-disk wrapper exists because THOSE suites drive generators whose downstream steps read disk. This repo's generator has no such downstream-on-disk step inside the generator boundary -- the real-disk proof already lives in the tarball e2e tier (`install-smoke`/`matrix-5types`), which exercises the FULL on-disk path end-to-end.
- **Real-disk fidelity, where actually needed, is better bought at the e2e tier.** If v0.0.4 wants to prove "the generator writes a target that then RUNS," do it with `execSync('npx nx g ...')` against the installed tarball (Part B.3 route 2) -- that is higher fidelity than a real-disk `FsTree` AND reuses the existing harness, with no new internal-import surface.

**Decision posture (HIGH-IMPACT / decide deliberately):** This is a hard-to-fully-reverse choice (it shapes the test-utils layer and a possible new `testing/` project). The in-memory default is the lower-risk, lower-maintenance path and matches the Nx-canonical recommendation. KEEP the bespoke `createFsTree` as a documented fallback to be authored ONLY IF a concrete generator behavior emerges that the in-memory Tree cannot model (e.g. a future generator that shells out to read its own emitted files mid-run). If authored, quarantine it exactly as `PROJECT.md`/`ARCHITECTURE.md` already prescribe (one file, eslint-disable, drift tripwire on `nx/src/generators/tree`).

### (3) Candidate requirement areas (grouped)

**Generator:**

- A `typecheck-configuration` generator under `src/generators/typecheck-configuration/` (`generator.ts`, `schema.json`, `schema.d.ts`) that adds an `angular-typecheck` target to a named project via `readProjectConfiguration` + `updateProjectConfiguration` + `formatFiles`, idempotently (skip/merge if the target already exists).
- `generators.json` at package root; `"generators": "./generators.json"` in `package.json`; `generators.json` added to `files`; build `assets` glob for `generators.json` (mirror `executors.json` block).
- Schema: positional `project` arg (`$default`/argv), optional `tsConfig` / `targetName` overrides; `additionalProperties: false`.

**FsTree utilities:**

- DEFAULT: NONE bespoke -- consume the public `createTreeWithEmptyWorkspace` from `@nx/devkit/testing`. (Removes the v0.0.1 carry-over deliverable; resolves the documentation drift by closing it as "superseded by the public helper" rather than authoring the bespoke wrapper.)
- FALLBACK (only if a real-disk need surfaces): bespoke `createFsTree`/`flushFsTreeChanges` quarantine file over `nx/src/generators/tree`, with eslint-disable + a `typecheck-drift`-style tripwire on that internal import.

**Generator unit tests:**

- `src/generators/typecheck-configuration/generator.spec.ts`: seed-project-then-assert-target, executor-id assertion, options shape, idempotency (run-twice-equal), error on missing project, snapshot of the resulting `project.json`. Runs in the existing `test` matrix (no ci.yml change).
- A schema-parity gate for the generator's `schema.json`/`schema.d.ts` (extend the existing `schema-parity.spec.ts` idiom).

**Generator e2e:**

- Extend the EXISTING tarball harness (NOT Verdaccio): a spec (in `install-e2e` or a new `generator-e2e` project) that packs+installs the tarball, runs `npx nx g angular-typechecker:typecheck-configuration <proj>`, then asserts the on-disk `project.json` and that `nx run <proj>:angular-typecheck` executes. If a NEW e2e project: `implicitDependencies: ["angular-typechecker"]` + add it by name to ci.yml's `e2e` job `-p` list.

**NG8xxx catalog coverage + organization:**

- Assert the 14 MISSING extended diagnostics (NG8102-NG8108, NG8111, NG8113-NG8117, NG8021) by exact code + category, plus the missing baseline NG codes (NG2003/2005/2007/2009, NG1001, NG3003, NG6100, NG8002, NG8004) as scoped by the catalog.
- Organize as per-introduction-version integration files (`extended.angularNN.integration.spec.ts` / `baseline.angularNN.integration.spec.ts`) per `DIAGNOSTIC-CATALOG.md:60`, each with one `it` per code; back each code with a minimal triggering fixture under `fixtures/extended-vNN/` (or a per-code component). Mirror Angular's exact-code + `.category` assertion idiom (already the repo's `NG()` pattern).
- VERIFY each code/name against installed `@angular/compiler-cli@22.0.4` `error_code.d.ts` + `extended_template_diagnostic_name.d.ts` on implementation (per catalog's VERIFY-ON-IMPLEMENTATION note).

**In-memory executor variant (mid-tier gap):**

- Optional but recommended: a mid-tier spec running the executor against a `createTreeWithEmptyWorkspace`-seeded (or real-disk fixture) workspace + an `ExecutorContext`, to cover `context.root` -> `tsConfig` path resolution and `normalizeOptions` against a real `project.json` -- the layer currently jumped over between mocked-unit and full-tarball-e2e. (This is where the FsTree substrate choice is reused.)

**Drift-gate negative test:**

- IF (and only if) the bespoke `createFsTree` is authored: a drift tripwire on `import { FsTree, flushChanges } from 'nx/src/generators/tree'` (modeled on `typecheck-drift` + `compiler-cli-types.drift.ts`), added to the `typecheck-drift` target `inputs`. With the in-memory default, NO new drift gate is needed (the public `@nx/devkit/testing` export carries no internal-path risk).

**CI jobs:**

- In-plugin generator + catalog specs: covered AUTOMATICALLY by the `test` 6-cell matrix (glob match) -- no ci.yml edit.
- New e2e project (if created): MUST be added by name to the `e2e` job `-p` list.
- New drift file (if FsTree authored): path added to `typecheck-drift` `inputs`; covered by the same `test` run-many.

---

## Sources

- Local tracked source (read-only, HIGH): `packages/angular-typechecker/src/**`, `e2e/**`, `fixtures/**`, `.github/workflows/ci.yml`, `nx.json`, `project.json`, `vitest.config.mts`, `package.json`, `executors.json`, `.planning/codebase/TESTING.md`, `.planning/research/DIAGNOSTIC-CATALOG.md`, `.planning/PROJECT.md`, `.planning/research/{ARCHITECTURE,FOLLOWUP-FINDINGS,SUMMARY}.md`.
- Installed deps verified this session (HIGH): `node_modules/nx/dist/src/generators/tree.d.ts` (`FsTree` L89, `flushChanges` L124); `node_modules/nx/dist/src/generators/testing-utils/create-tree-with-empty-workspace.d.ts` (`createTreeWithEmptyWorkspace`); `node_modules/nx/dist/src/devkit-exports.d.ts` (project-configuration + path + project-graph re-exports); `node_modules/nx/dist/src/generators/utils/generate-files.d.ts` (`OverwriteStrategy` enum L5, `generateFiles` L42); `node_modules/@nx/devkit/dist/{testing,public-api,index}.d.ts`; `node_modules/@nx/devkit/package.json` exports map (`./testing`).
- [Creating Files with a Generator | Nx](https://nx.dev/docs/extending-nx/creating-files) -- MEDIUM (docs): `generateFiles`/`OverwriteStrategy`/EJS + `__var__` filename substitution.
- [@nx/devkit Overview | Nx](https://nx.dev/docs/reference/devkit) -- MEDIUM: generator function signature + utility list.
- [Integrate a New Tool with a Tooling Plugin | Nx](https://nx.dev/docs/extending-nx/tooling-plugin) -- MEDIUM: `createTestProject` + `execSync('npx nx add ...@e2e')` + `execSync('npx nx g ...')` e2e flow.
- [generateFiles | Nx](https://nx.dev/docs/reference/devkit/generateFiles) -- MEDIUM: signature + substitutions.
- [addProjectConfiguration | Nx](https://nx.dev/nx-api/devkit/documents/addProjectConfiguration) -- MEDIUM.
- [Testing local generators which only update existing files (nrwl/nx Discussion #19945)](https://github.com/nrwl/nx/discussions/19945) -- MEDIUM: seed via `addProjectConfiguration` before testing an update-only generator.
- [Unit tests pick up actual workspace instead of /virtual (nrwl/nx #32588)](https://github.com/nrwl/nx/issues/32588) -- MEDIUM: `/virtual` leakage hazard.
- [Default plugin tests hang because of handles in NX 19 (nrwl/nx #26346)](https://github.com/nrwl/nx/issues/26346) -- MEDIUM: native-binding open handles under the runner.
- [Vitest fails on CI with workspace generators >19.0.0 (nrwl/nx #27816)](https://github.com/nrwl/nx/issues/27816) -- MEDIUM: CI flake when generators call sub-generators.
- [Faithful E2E Testing of Nx Preset Generators (chiubaka)](https://dev.to/chiubaka/faithful-e2e-testing-of-nx-preset-generators-m5a) -- MEDIUM: Verdaccio `start-local-registry.ts` + Windows `execFileSync(nx)` caveat.
- [@push-based/nx-verdaccio (GitHub)](https://github.com/push-based/nx-verdaccio) -- MEDIUM: `testing/test-nx-utils` quarantine pattern reference.
- [Extended template checks PR (angular/angular #42984)](https://github.com/angular/angular/pull/42984) -- MEDIUM: one-file-per-check source + per-check `_spec` unit-test introduction.
- [angular/compiler-cli/test/ngtsc/template_typecheck_spec.ts](https://github.com/angular/angular/blob/main/packages/compiler-cli/test/ngtsc/template_typecheck_spec.ts) -- MEDIUM: centralized integration + config-validation spec layer.
- [Extended Diagnostics Overview | Angular](https://angular.dev/extended-diagnostics) + [NG8101 | Angular](https://angular.dev/extended-diagnostics/NG8101) -- MEDIUM: per-code docs + exact-code assertion idiom.
