# Testing Patterns

**Analysis Date:** 2026-07-09

This project is a type-checking tool, so test correctness is the product. Tests are
organized into three tiers (unit, real-compiler integration, tarball/verdaccio e2e) plus a
set of always-run regression GUARD specs. All tiers use Vitest; Jest is deferred because
`@angular/compiler-cli` is ESM-only.

## Test Framework

**Runner:**

- Vitest `~4.1.0` via the Nx `@nx/vitest:test` executor (the dedicated Nx 23 package, NOT
  `@nx/vite:test`).
- Per-project config: `packages/angular-typechecker/vitest.config.mts`,
  `libs/test-util/vitest.config.mts`, and one per e2e project under `e2e/*/vitest.config.mts`.
- `vitest.workspace.ts` at the root globs `**/vitest.config.{mjs,js,ts,mts}`.
- Every config uses `defineConfig`, `nxViteTsPaths()` (tsconfig path resolution) and
  `nxCopyAssetsPlugin(...)`, with `watch: false` and `globals: true`.

**Assertion Library:**

- Vitest built-in `expect` with `describe` / `it` (globals enabled; also imported explicitly
  in specs for clarity: `import { describe, expect, it, vi } from 'vitest';`).

**Run Commands:**

```bash
npx nx test angular-typechecker                              # plugin unit + integration tier
npx nx run-many -t test -p angular-typechecker test-util     # what the CI `test` job runs (with typecheck-drift)
npx nx run-many -t test \
  -p angular-typechecker-install-e2e \
     angular-typechecker-cache-e2e \
     angular-typechecker-matrix-e2e --parallel=1             # the e2e gate (MUST be serial; see below)
npx nx scoped-name-guard angular-typechecker                 # always-run regression guard (cache:false)
```

- The plugin `test` target `dependsOn: ["build"]` (`packages/angular-typechecker/project.json`).
- CI sets `NX_DAEMON: false` for every test job.

## Test File Organization

**Location:** Co-located with source. Unit + integration specs sit directly beside the
module they test (e.g. `src/core/run-typecheck.ts` <-> `src/core/run-typecheck.spec.ts` +
`src/core/run-typecheck.integration.spec.ts`). E2e specs live in `e2e/<project>/src/`.

**Naming (tier is encoded in the suffix):**

- `*.spec.ts` -- unit tier. Mocked, fast, jsdom, parallel.
- `*.integration.spec.ts` -- integration tier. Runs the REAL `@angular/compiler-cli`
  `performCompilation` against a `fixtures/` project.
- `*.int.spec.ts` -- e2e tier. `execSync` real toolchain (`nx build` / `npm pack` /
  install / `nx run`), node env, fully serialized.

**Structure:**

```
packages/angular-typechecker/src/
  core/*.spec.ts                 # unit + *.integration.spec.ts (real compiler)
  executors/typecheck/*.spec.ts  # executor + normalize-options + schema-parity
  generators/*/*.spec.ts         # generator unit + schema-parity
  *.spec.ts                      # top-level guards (scoped-name-guard, ci-e2e-coverage-guard, package-manifest, storybook-docs)
libs/test-util/src/lib/*.spec.ts # shared test-helper unit tests
e2e/<project>/src/*.int.spec.ts  # tarball/verdaccio e2e
fixtures/                        # hand-authored Angular projects the integration tier checks
```

## Test Structure

**Suite Organization:**

```typescript
describe('gatherAllDiagnostics', () => {
  it('calls all the unconditional getters in order ...', () => {
    // arrange a minimal stub program, act, assert on ordered call log
    expect(calls).toEqual([...]);
    expect(result.map((diagnostic) => diagnostic.code)).toEqual([...]);
  });
});
```

**Patterns:**

- Parameterized suites via `describe.each([...])` (e.g. app-tsconfig vs lib-tsconfig matrix
  in `run-typecheck.integration.spec.ts`).
- Common assertion styles: `toEqual`, `toContain`, `toBeDefined`, `toBeUndefined`,
  `not.toThrow`, `toHaveBeenCalledOnce`, `toHaveBeenCalledWith`, `.toBe(true)` with a
  descriptive message as the second `expect(...)` arg for guard specs.
- Angular extended diagnostic codes are asserted through the negative-encoding helper
  `const NG = (code) => -990000 - code;` -- NEVER the bare positive code. Raw TypeScript
  codes (e.g. `2322`) are asserted directly.

## Mocking

**Framework:** Vitest `vi` (`vi.fn`). No heavy `vi.mock` module mocking in the unit tier.

**Patterns:**

```typescript
// Hand-build a minimal compiler stub and cast through unknown to the shim type.
const program = {
  getTsOptionDiagnostics: vi.fn(() => []),
  getNgSemanticDiagnostics: vi.fn((fileName?: string) => [diagnostic(8109)]),
  getTsProgram: () => ({ getGlobalDiagnostics: () => [], getSourceFiles: () => [] }),
} as unknown as Program;
```

**What to Mock:**

- The compiler `Program` surface in the unit tier -- stub only the getters under test, cast
  `as unknown as Program`. Tiny builders (`diagnostic(code)`, `sourceFile(name, isDecl)`)
  keep loops exercised without a real compiler.
- Record call order into a `string[]` to prove the unconditional all-getter ordering.

**What NOT to Mock:**

- The `@angular/compiler-cli` compiler itself in the integration tier -- those specs run the
  REAL cold `performCompilation` against a fixture so behavior is proven end-to-end.
- The real toolchain in e2e -- those specs shell out to `nx` / `npm` / `pnpm` / `yarn` via
  `execSync`.

## Fixtures and Factories

**Test Data:**

- Real Angular project fixtures live in `fixtures/` (`gate-b-error`, `sibling-import`,
  `config-broken`, `solution-style`, `extended-batch-*`, etc.) with their own
  `tsconfig.*.json` and `.component.ts` / `.html`. Integration specs resolve them by
  `join(findWorkspaceRoot(...), 'fixtures', '<name>')`.
- Some fixture templates are `.prettierignore`d because reflow changes which NG diagnostics
  fire and would break exact-count assertions.
- E2e consumer workspaces live under `e2e/<project>/fixtures/`.

**Location / helpers:**

- Shared helpers are the `@workspace/test-util` lib (`libs/test-util/src/index.ts`):
  `findWorkspaceRoot` (walks up to `nx.json`, so every spec is cwd-independent),
  `buildCleanEnv`, `run`, `sh`, `commandSucceeds`, `removeTmpDir`, and fixture/env helpers.
- Specs resolve their own location with `dirname(fileURLToPath(import.meta.url))` then
  `findWorkspaceRoot(...)` -- never a relative `../../` climb.

## Coverage

**Requirements:** No enforced threshold. Provider is v8 (`@vitest/coverage-v8`), output to
`coverage/<project>/` (`reportsDirectory` in each vitest config + the `test` target).

**View Coverage:**

```bash
npx nx test angular-typechecker --coverage
```

## Test Types

**Unit Tests (`*.spec.ts`):**

- Scope: pure core functions and the executor/generator adapters with stubbed compiler.
- Environment `jsdom`, `globals: true`, run in PARALLEL.
- `testTimeout` / `hookTimeout` raised to `30000` in the plugin config -- the co-resident
  `*.integration.spec.ts` cold-compiler runs can exceed the 5000ms default on slow hardware
  (Windows arm64), producing a rotating timeout flake. This changes patience only, not semantics.

**Integration Tests (`*.integration.spec.ts`):**

- Scope: real `@angular/compiler-cli` `performCompilation` against a `fixtures/` project,
  asserting off the structured `CoreResult`. Run in the SAME plugin vitest project as the
  unit tier (same jsdom config, same 30000ms timeout).

**E2e Tests (`*.int.spec.ts`):**

- Three dedicated projects: `angular-typechecker-install-e2e` (verdaccio publish/install +
  tarball audit + `nx add` on npm/pnpm/yarn + generators + storybook), `-cache-e2e` (nx cache
  correctness + executor parity), `-matrix-e2e` (5 project-type matrix + pnpm symlink).
- Environment `node` (NOT jsdom -- an execSync/pack harness needs node).
- FULLY SERIALIZED per project: `pool: 'forks'`, `poolOptions.forks.singleFork: true`,
  `fileParallelism: false`, `sequence.concurrent: false`.
- Long timeouts: `180000` (cache-e2e) to `300000` (install/matrix-e2e), because a real
  `nx build` + `npm pack` + install + `nx run` is slow.

## Common Patterns

**Async Testing:**

- Integration + core specs `await runTypecheck(coreOptions)` directly and assert on the
  resolved `CoreResult`. Vitest awaits returned promises from `it(async () => ...)`.

**Error Testing:**

```typescript
expect(() =>
  execSync(`npx publint "${tgz}" --strict`, { cwd: distDir, env, encoding: 'utf8' }),
).not.toThrow();          // execSync throws on non-zero exit -> the assertion IS the gate
```

- Core error classification is asserted by diagnostic CODE, never message text.

## Verdaccio / Tarball E2e (the install-e2e project)

- `globalSetup: ['./src/global-setup.ts']` stands up the toolchain ONCE per project run:
  `startLocalRegistry` (first-party `@nx/js` helper) on the numeric IPv4 loopback
  `127.0.0.1` (load-bearing -- fixes a `localhost` dual-stack ECONNREFUSED flake in yarn 4),
  mints a REAL couchdb bearer token (a dummy token 401s on Verdaccio 6), builds dist ONCE,
  strips CI-only provenance from the dist manifest, and publishes ONCE via the real
  `nx release publish --first-release --excludeTaskDependencies`.
- The setup `provide`s `verdaccioUrl` + `verdaccioToken` to specs (typed via a
  `declare module 'vitest'` `ProvidedContext` augmentation).
- A SAFETY gate refuses to publish to any non-`http://127.0.0.1:` registry.
- `buildCleanEnv({ stripAllNpmConfig: true })` strips inherited `npm_config_*` (an inherited
  `npm_config_registry` outranks `--registry` and would leak the publish to the public registry).
- The tarball-audit spec (`src/tarball-audit.int.spec.ts`) packs the shared dist, extracts it
  under a RELATIVE dir (GNU-vs-BSD `tar` + Windows drive-letter portability), and gates on
  `publint --strict`, `attw --pack --profile node16` (problems empty), a required-files
  positive set, a spec/fixture/`@fixtures` leak-negative set, and no install-lifecycle scripts.

**CRITICAL -- shared tarball, run `--parallel=1`:**

All three e2e projects `npm pack` the SAME dist artifact
(`dist/packages/angular-typechecker/angular-typechecker-<ver>.tgz`) in `beforeAll` and
`rmSync` it in `afterAll`. Vitest serializes WITHIN a project, but `nx run-many` defaults to
PARALLEL, so without `--parallel=1` a sibling project's `afterAll rmSync` deletes the tarball
mid-`pnpm add` (ENOENT flake; pnpm 11's supply-chain check widened the window). The flag is
load-bearing and is guarded by `GUARD-01b` in
`packages/angular-typechecker/src/ci-e2e-coverage-guard.spec.ts`.

## Regression Guard Specs (always run)

- `scoped-name-guard.spec.ts` -- runs via a dedicated `cache: false` `nx:run-commands` target
  on EVERY PR (even docs-only) so a stray scoped ref in the shipped README never ships green.
- `ci-e2e-coverage-guard.spec.ts` (GUARD-01/01b/01c) -- asserts the ci.yml `e2e` job's `-p`
  list equals the `e2e/*` project set, that it passes `--parallel=1`, and that every e2e
  project defines + runs `typecheck-e2e`. Reads `ci.yml` + `project.json` with regex, no YAML
  parser dependency.
- `schema-parity.spec.ts` (executor + both generators) -- keeps `schema.json` and the
  hand-authored `schema.d.ts` interface in sync.
- `*.drift.ts` files + `typecheck-drift` target -- `tsc --noEmit` tripwires that fail when the
  vendored `@angular/compiler-cli` type shims drift from the installed compiler.

---

*Testing analysis: 2026-07-09*
