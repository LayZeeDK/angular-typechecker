# Testing Patterns

**Analysis Date:** 2026-06-30

This project is a type-checking tool, so test correctness is the product. Tests fall into
three tiers: fast pure-unit specs, real-`@angular/compiler-cli` integration specs (in the
plugin), and tarball/install/matrix e2e specs (under `e2e/`). Verify type-check behavior
via the test runner (`nx test`), never the editor LSP.

## Test Framework

**Runner:**

- Vitest, run through the Nx executor `@nx/vitest:test` (Nx 23's dedicated Vitest package,
  NOT `@nx/vite:test`). Configured per project via a `vitest.config.mts` file.
- Plugin config: `packages/angular-typechecker/vitest.config.mts`.
- Vitest version: `~4.1.0`; coverage via `@vitest/coverage-v8` `~4.1.0` (root devDeps).

**Assertion Library:**

- Vitest built-in `expect` (Jest-compatible matchers + `expect.stringContaining`,
  `toHaveBeenCalledWith`, `rejects.toThrow`, etc.).

**Run Commands:**

```bash
npx nx test angular-typechecker                          # plugin unit + integration specs
npx nx run-many -t typecheck-drift test -p angular-typechecker   # CI plugin gate (drift + test)
npx nx run-many -t test -p angular-typechecker-install-e2e \
  angular-typechecker-cache-e2e angular-typechecker-matrix-e2e   # the three e2e projects
npx nx test angular-typechecker --skip-nx-cache          # bypass Nx cache for a clean run
```

Note: the plugin `test` target `dependsOn: ["build"]` (`packages/angular-typechecker/
project.json`), so a build runs first. The e2e projects `implicitDependencies:
["angular-typechecker"]` and pack/install the freshly built tarball.

## Test File Organization

**Location:**

- Co-located with source under `packages/angular-typechecker/src/` (unit + integration).
- E2E specs live in separate Nx projects under `e2e/` with their own fixtures.

**Naming:**

- Unit (pure / mocked): `<module>.spec.ts` -- e.g. `exit-codes.spec.ts`,
  `gather-diagnostics.spec.ts`, `executor.spec.ts`, `package-manifest.spec.ts`,
  `schema-parity.spec.ts` (26 plugin `.spec.ts` files).
- Real-compiler integration (in the plugin): `<name>.integration.spec.ts` -- e.g.
  `run-typecheck.integration.spec.ts`, `fault-isolation.integration.spec.ts`
  (8 `.integration.spec.ts` files).
- E2E (tarball/install/matrix): `<name>.int.spec.ts` -- e.g. `tarball-audit.int.spec.ts`,
  `matrix-5types.int.spec.ts` (7 e2e `.int.spec.ts` files).

**Structure (Vitest include globs):**

```
packages/angular-typechecker/
  src/core/*.spec.ts                  # pure unit + real-compiler integration (same dir)
  src/core/*.integration.spec.ts
  src/executors/angular-typecheck/*.spec.ts
  src/package-manifest.spec.ts
e2e/angular-typechecker-install-e2e/src/*.int.spec.ts
e2e/angular-typechecker-cache-e2e/src/*.int.spec.ts
e2e/angular-typechecker-matrix-e2e/src/*.int.spec.ts
fixtures/<scenario>/                  # real Angular component + tsconfig fixtures
```

The plugin config includes `{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`;
each e2e config narrows to `src/**/*.int.spec.ts`. `tsconfig.spec.json` lists the spec/test
globs and types `["vitest/globals", "vitest/importMeta", "vite/client", "node", "vitest"]`;
it EXCLUDES `src/**/*.drift.ts`. `tsconfig.lib.json` excludes all `*.spec`/`*.test`/`*.drift`
so tests never ship.

## Test Structure

**Suite Organization** (from `src/core/exit-codes.spec.ts`):

```typescript
import { describe, expect, it } from 'vitest';

import { toExitCode } from './exit-codes';
import { TypecheckInfrastructureError } from './run-typecheck';

describe('toExitCode (COR-04 / D-07)', () => {
  it('returns 2 for an infrastructure error', () => {
    expect(toExitCode(new TypecheckInfrastructureError('boom'))).toBe(2);
  });

  it('returns 1 when errorCount > 0', () => {
    expect(toExitCode({ errorCount: 3 })).toBe(1);
  });

  it('returns 0 when clean (errorCount 0)', () => {
    expect(toExitCode({ errorCount: 0 })).toBe(0);
  });
});
```

**Patterns:**

- `globals: true` is set in every Vitest config, so `describe`/`it`/`expect`/`vi` are
  globally available -- but specs STILL explicitly `import` them from `'vitest'` (the
  type imports keep the spec self-documenting and lint-clean).
- `it` titles are full sentences that name the requirement/decision id under test
  (`'ENG-02: the unconditional gatherer surfaces TS2322 AND NG8109 ...'`). Keep this --
  the ids cross-reference `.planning/` requirements.
- Parameterized cases use `describe.each` / `it.each` (e.g.
  `run-typecheck.integration.spec.ts` runs the same assertions against the app and lib
  tsconfigs; `matrix-5types.int.spec.ts` iterates the five project types).
- `beforeEach`/`afterEach`/`beforeAll`/`afterAll` for setup/teardown (see below).

## Mocking

**Framework:** Vitest `vi` (`vi.mock`, `vi.hoisted`, `vi.fn`, `vi.spyOn`,
`vi.clearAllMocks`, `vi.restoreAllMocks`). Used in only TWO plugin specs
(`executor.spec.ts`, `infra-failure.spec.ts`) -- mocking is reserved for isolating the
adapter's COMPOSITION/error-handling logic from the real compiler.

**Pattern** (from `src/executors/angular-typecheck/executor.spec.ts`):

```typescript
// Hoisted mock handles so each test drives the composed core deterministically.
const mocks = vi.hoisted(() => ({
  runTypecheck: vi.fn(),
  renderReport: vi.fn(async () => 'RENDERED REPORT'),
  evaluateResult: vi.fn(),
  normalizeOptions: vi.fn(() => ({
    /* ... */
  })),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

// Keep the REAL TypecheckInfrastructureError so the executor's instanceof catch works;
// only stub runTypecheck.
vi.mock('../../core/run-typecheck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/run-typecheck')>();
  return { ...actual, runTypecheck: mocks.runTypecheck };
});

vi.mock('@nx/devkit', () => ({
  logger: { error: mocks.loggerError, info: mocks.loggerInfo, warn: mocks.loggerWarn },
  joinPathFragments: (...parts: string[]) => parts.join('/'),
}));
```

- Re-import the unit under test INSIDE each `it` (`const { default: executor } = await
import('./executor');`) so the hoisted mocks apply after `vi.mock` registration.
- `vi.spyOn(process.stdout, 'write').mockImplementation(() => true)` to assert raw stdout
  writes without polluting test output.
- `vi.clearAllMocks()` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach`.

**What to Mock:**

- The four core seams of the executor adapter (`runTypecheck`, `renderReport`,
  `evaluateResult`, `normalizeOptions`) and `@nx/devkit`'s `logger` -- to test composition,
  verdict mapping, and error classification without a real compiler load.
- Preserve REAL error classes when an `instanceof` check depends on them (use
  `importOriginal` and spread `...actual`).

**What NOT to Mock:**

- The Angular compiler in integration specs. `*.integration.spec.ts` and the e2e specs run
  the REAL `@angular/compiler-cli performCompilation` against real fixture projects --
  that end-to-end proof is the whole point of a type-checking tool.
- `gatherAllDiagnostics`/diagnostic-shaping pure functions test against tiny hand-built
  `ts.Program`/`ts.SourceFile` stubs (`{ ... } as unknown as Program`), not `vi.mock`.

## Fixtures and Factories

**Test Data:**

- Real Angular fixture projects live under `fixtures/<scenario>/` (each has component
  `.ts`/`.html` + a leaf `tsconfig.*.json`). Scenarios encode specific diagnostic
  conditions: `gate-b-error` (TS2322 + NG8109 in one program), `sibling-import`
  (in-project vs out-of-project boundary), `fault-isolation` (TCB-generation poison +
  survivor), `solution-style` (references-only zero-rootNames guard), `composite-triangle`,
  `extended-promoted`, `extended-v13`, `global-diagnostics`, `config-broken`,
  `no-emit-message`, `ts-baseline`, `ng-baseline`.
- E2E fixtures are full consumer workspaces:
  `e2e/angular-typechecker-install-e2e/fixtures/consumer-app/` and
  `e2e/angular-typechecker-matrix-e2e/fixtures/consumer-workspace/` (app + local/buildable/
  publishable libs + spec tsconfig).
- Small factory helpers build literal result/diagnostic objects in-spec (e.g.
  `coreResult(errorCount)`, `abortedCoreResult(fileName)`, `diagnostic(code)`,
  `sourceFile(fileName, isDeclarationFile)`) rather than shared fixture modules.

**Location:** `fixtures/` (workspace root) for the plugin integration tier; each e2e
project's own `fixtures/` for the install/matrix tier. Fixtures resolve their paths from
the spec's own location via `fileURLToPath(import.meta.url)` + `join(...)` so runs are
cwd-independent.

## Coverage

**Requirements:** no enforced threshold. Coverage is collected (v8 provider) but not gated.

- Plugin: `reportsDirectory: '../../coverage/packages/angular-typechecker'`, `provider:
'v8'` (`vitest.config.mts`); the `test` target `outputs` the reports dir.

**View Coverage:**

```bash
npx nx test angular-typechecker --coverage   # report under coverage/packages/angular-typechecker
```

## Test Types

**Unit Tests** (`*.spec.ts`, jsdom env, fast):

- Pure-function policy/shaping: `exit-codes.spec.ts`, `evaluate-result.spec.ts`,
  `filter-diagnostics.spec.ts`, `format-report.spec.ts`, `gather-diagnostics.spec.ts`,
  `normalize-options.spec.ts`.
- Contract/manifest specs that read files but load no compiler: `package-manifest.spec.ts`
  (asserts the published `package.json` deps/peers/engines/files/exports/keywords),
  `schema-parity.spec.ts` (schema.json keys == schema.d.ts interface keys).
- Composition/error-handling with mocks: `executor.spec.ts`, `infra-failure.spec.ts`.

**Integration Tests** (`*.integration.spec.ts`, jsdom env, real compiler):

- Call `runTypecheck` directly against a `fixtures/` tsconfig and assert off `CoreResult`
  (codes via `diagnostics.map(d => d.code)`, `errorCount`, `suppressedCount`,
  `templateCheckAborted`). Each spec proves one decision end-to-end (boundary filter,
  no-emit override neutralizing TS6059/TS5055, global diagnostics, fault isolation,
  config resolution, zero-rootNames guard).
- These run a COLD `performCompilation` (ESM load + whole-program check), so the plugin
  config raises `testTimeout`/`hookTimeout` to `30000` (default 5000 flakes on slower
  hardware like Windows arm64).

**E2E / Tarball Tests** (`*.int.spec.ts`, node env, fully serialized):

- `angular-typechecker-install-e2e`: `install-smoke` (pack + install the tarball into a
  tmp consumer, run the executor green + injected-error), `tarball-audit` (build fresh
  dist, `npm pack`, run `publint --strict` + `attw --pack --profile node16` + file-set /
  no-install-scripts / no-`@fixtures`-leak gates), `release-hygiene`.
- `angular-typechecker-matrix-e2e`: `matrix-5types` runs the installed tarball's executor
  across all five project types via `it.each`; `pnpm-symlink` covers pnpm `.pnpm/` layout.
- `angular-typechecker-cache-e2e`: `executor-parity`, `cache-busts-on-dep-error` (Nx cache
  correctness).
- These shell out via `execSync` to real `nx`/`npm`/`tar`/`publint`/`attw`. Their configs
  set `pool: 'forks'`, `singleFork: true`, `fileParallelism: false`,
  `sequence.concurrent: false`, `environment: 'node'`, and `testTimeout: 300000` because
  the harness builds + packs + installs (parallel workers would race on the shared dist +
  `.tgz`). They strip `NX_*` runner env vars (`buildCleanEnv`) so the nested `nx`/`npm`
  invocations are clean top-level runs.

**Build-time drift "test"** (not a Vitest spec): `compiler-cli-types.drift.ts` is a
type-only tripwire compiled by the `typecheck-drift` Nx target
(`tsc --noEmit -p tsconfig.drift.json`, classic `moduleResolution: node`). It asserts the
real `@angular/compiler-cli` `Program` stays assignable to the vendored shim; a
removed/renamed/signature-changed getter fails the build. Run in CI alongside `test`.

## Common Patterns

**Async Testing:**

```typescript
it('maps errorCount === 0 to { success: true }', async () => {
  mocks.runTypecheck.mockResolvedValue(coreResult(0));
  mocks.evaluateResult.mockReturnValue({ success: true });

  const { default: executor } = await import('./executor');
  const result = await executor(options, context);

  expect(result).toEqual({ success: true });
});
```

- `mockResolvedValue` / `mockRejectedValue` for promise-returning seams; `await import(...)`
  for the unit under test after mocks are registered.

**Error Testing:**

```typescript
it('RE-THROWS a non-infrastructure error (never swallows an unknown failure)', async () => {
  mocks.runTypecheck.mockRejectedValue(new Error('unexpected boom'));
  const { default: executor } = await import('./executor');

  await expect(executor(options, context)).rejects.toThrow('unexpected boom');
  expect(mocks.loggerError).not.toHaveBeenCalled();
});
```

- Assert the negative path too (`.not.toHaveBeenCalled()`, `rejects.not.toBeInstanceOf(...)`)
  so an infra failure can never be mis-reported as clean and a plain error is never
  mis-classified as infrastructure.

**Diagnostic-code assertions:**

- TypeScript codes are raw positive ints (`const TS2322 = 2322`). Angular extended codes
  are negative-encoded -- assert via the `NG()` helper (`const NG = (code) => -990000 -
code;`), NEVER the bare positive code. Detect special codes (500 infra, NG3004 TCB
  fatal) BY CODE ONLY, never by `source`/message text.

---

_Testing analysis: 2026-06-30_
