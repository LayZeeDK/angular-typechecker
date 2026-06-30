# Phase 8: Correctness & Completeness Fixes - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 9 (4 source edits, 1 new source file, 4 spec edits/creations, 1 new fixture pair)
**Analogs found:** 9 / 9 (every change has an in-repo analog; no RESEARCH-only fallback needed)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/run-typecheck.ts` (MODIFY, COR-01) | core/orchestrator | transform | self -- existing 500 scan `:171-179` | exact (in-file twin) |
| `src/core/gather-diagnostics.ts` (MODIFY, COR-02) | core/gatherer | transform | self -- existing 6 `all.push(...)` `:20-25` | exact (in-file twin) |
| `src/core/filter-diagnostics.ts` (MODIFY, COR-03) | core/policy (pure) | transform | self -- existing file-less guard `:77` | exact (in-file twin) |
| `src/core/exit-codes.ts` (CREATE, COR-04) | core/policy (pure) | request-response | `src/core/evaluate-result.ts` | role-match (pure verdict sibling) |
| `src/core/exit-codes.spec.ts` (CREATE, COR-04) | test (unit, pure) | request-response | `src/core/evaluate-result.spec.ts` | exact |
| `src/core/infra-failure.spec.ts` (EXTEND, COR-01 unit) | test (unit, mocked loader) | transform | self + the existing 500 case | exact |
| `src/core/config-resolution.integration.spec.ts` (EXTEND, COR-01 integration) | test (integration, real compiler) | transform | self + `run-typecheck.integration.spec.ts` | exact |
| `src/core/gather-diagnostics.spec.ts` (EXTEND, COR-02 unit) | test (unit, stub program) | transform | self -- the 6-getter stub | exact |
| `src/core/filter-diagnostics.spec.ts` (EXTEND, COR-03 unit) | test (unit, pure) | transform | self -- the `diag(undefined)` file-less case | exact |
| `fixtures/global-diagnostics/` (CREATE, COR-02 fixture) | fixture | file-I/O | `fixtures/config-broken/` + `fixtures/ts-baseline/` | role-match |
| `src/executors/angular-typecheck/executor.spec.ts` (OPTIONAL tighten, COR-04 D-08) | test (unit, mocked seams) | request-response | self -- the `:141-154` infra case | exact (already present) |

**Note on the executor (`executor.ts`):** per RESEARCH Open Question 2, the D-08 infra
catch (`executor.ts:51-58`) is ALREADY correct and the assertion ALREADY exists
(`executor.spec.ts:141-154`). Do NOT wire `toExitCode` into the executor's return -- that
contradicts D-08 (Nx maps `{ success }` to 0/1). The only optional change is tightening the
existing spec's `logger.error` message assertion. No `executor.ts` source edit is required.

---

## Pattern Assignments

### `src/core/run-typecheck.ts` (core/orchestrator, transform) -- COR-01

**Analog:** itself -- the existing post-`performCompilation` 500 scan at `run-typecheck.ts:168-179`.

**The exact in-file twin to mirror** (`:168-179`, KEEP unchanged for D-02 defense-in-depth):
```typescript
// D-06 / V-3 / L-3: detect a returned UNKNOWN_ERROR_CODE (500) by CODE only --
// never by `source === 'angular'` (the synthesized diagnostic sets no source).
// Re-throw so the infra failure is never counted as a type error.
const infrastructureFailure = result.diagnostics.find(
  (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
);

if (infrastructureFailure !== undefined) {
  throw new TypecheckInfrastructureError(
    ts.flattenDiagnosticMessageText(infrastructureFailure.messageText, '\n'),
  );
}
```

**Insertion point** (after `:105` `const parsed = ng.readConfiguration(...)`, BEFORE the
`configDiagnostics` spread `:110` and the zero-rootNames guard `:117`). `ts` is already
loaded at `:103`, so `ts.flattenDiagnosticMessageText` is in scope. New code to add (a
structural twin scanning `parsed.errors` instead of `result.diagnostics`):
```typescript
// COR-01 / D-01..D-03: a config-resolution crash surfaces here as a code-500
// (UNKNOWN_ERROR_CODE) in parsed.errors. Detect by CODE only (D-02) and re-throw
// BEFORE the zero-rootNames guard -- the 500 case has rootNames: [], so a late
// scan would be swallowed by the guard and mis-counted as a type error.
const configInfrastructureFailure = parsed.errors.find(
  (diagnostic) => diagnostic.code === ng.UNKNOWN_ERROR_CODE,
);

if (configInfrastructureFailure !== undefined) {
  throw new TypecheckInfrastructureError(
    ts.flattenDiagnosticMessageText(
      configInfrastructureFailure.messageText,
      '\n',
    ),
  );
}
```

**Reused assets (no new machinery):**
- `TypecheckInfrastructureError` class is already defined `:70`.
- `ng.UNKNOWN_ERROR_CODE` (the `500` sentinel) is on the loaded namespace (typed in
  `compiler-cli-types.ts:100,170`).
- `ts.flattenDiagnosticMessageText` is already used at `:177`.

**Critical ordering (D-01 / RESEARCH Pitfall 2):** the new scan MUST precede the
`if (parsed.rootNames.length === 0)` guard at `:117` -- the 500 path returns `rootNames: []`.

**Style (per CLAUDE.md JS/TS rules):** blank line before/after each `if` and each `throw`,
braces on every body (the existing `:175-179` block already follows this).

---

### `src/core/gather-diagnostics.ts` (core/gatherer, transform) -- COR-02

**Analog:** itself -- the existing six `all.push(...program.getX())` calls at `:20-25`.

**The exact in-file pattern** (`:18-27`):
```typescript
const all: ts.Diagnostic[] = [];

all.push(...program.getTsOptionDiagnostics());
all.push(...program.getNgOptionDiagnostics());
all.push(...program.getTsSyntacticDiagnostics());
all.push(...program.getTsSemanticDiagnostics());
all.push(...program.getNgStructuralDiagnostics());
all.push(...program.getNgSemanticDiagnostics());

return all;
```

**Edit (COR-02 / D-04):** add a 7th push before `return all;`. Placement is irrelevant --
`finalize`'s `ts.sortAndDeduplicateDiagnostics` (`run-typecheck.ts:320`) orders + dedups any
overlap with `getTsSemanticDiagnostics`:
```typescript
all.push(...program.getTsProgram().getGlobalDiagnostics()); // COR-02 / D-04
```

**Type-checkability (verified, no shim edit needed):** `program.getTsProgram()` returns
`TsProgram = ts.Program & {...}` (`compiler-cli-types.ts:45-47`), and
`getGlobalDiagnostics(): readonly ts.Diagnostic[]` is on the public `ts.Program` interface
(`typescript.d.ts:6037`). Do NOT edit `compiler-cli-types.ts` for COR-02 (that drift-getter
assertion is Phase 10 HARD-01 / D-05).

**Update the JSDoc** (`:5-14`): the current header says "six getter"-flavored prose ("the
phase short-circuit", "Calling `getNgSemanticDiagnostics()` unconditionally"). Add a sentence
that the 7th call gathers global/location-less TS diagnostics (e.g. TS2318) the per-file
`getTsSemanticDiagnostics` never emits, and that ordering is safe via the downstream
sort+dedup.

---

### `src/core/filter-diagnostics.ts` (core/policy, transform, PURE) -- COR-03

**Analog:** itself -- the file-less guard at `:74-81`.

**The exact in-file guard to extend** (`:74-81`):
```typescript
for (const diagnostic of diagnostics) {
  // D-03: NEVER filter a file-less diagnostic (config error / zero-rootNames
  // guard) -- it has no path to classify and dropping it is a false PASS.
  if (diagnostic.file === undefined) {
    kept.push(diagnostic);

    continue;
  }
  // ... existing isNodeModulesPath / isUnderDir classification ...
}
```

**Edit (COR-03 / D-06):** widen the boolean and update the comment so a maintainer knows
an empty `fileName` is the synthesized-diagnostic edge:
```typescript
  // D-03 + COR-03/D-06: NEVER filter a file-less diagnostic -- file === undefined
  // OR a present-but-empty fileName (a synthesized diagnostic). Both have no path
  // to classify; dropping one is a false PASS. (An empty fileName canonicalizes
  // to '' and isUnderDir('', base) === false, so without this it is suppressed.)
  if (diagnostic.file === undefined || diagnostic.file.fileName === '') {
    kept.push(diagnostic);

    continue;
  }
```

**Why:** today `canonicalize('')` -> `''`, `isUnderDir('', base) === false` -> suppressed
(a false negative). One boolean is the entire fix; do not touch the canonicalizer or the
node_modules segment test.

**JSDoc:** the module header's D-03 paragraph (`:26-28`) describes file-less handling; extend
it to mention the present-but-empty `fileName` synthesized-diagnostic case.

---

### `src/core/exit-codes.ts` (core/policy, request-response, PURE) -- COR-04 (NEW)

**Analog:** `src/core/evaluate-result.ts` -- the existing pure verdict sibling. `toExitCode`
is the exit-code counterpart of `evaluateResult`: same `core/`-pure constraints, same
`Pick<CoreResult, ...>` input idiom, same "no compiler, no process, 2-field literal in tests"
testability.

**Structural template from `evaluate-result.ts` (the shape to copy):**
- File-leading block comment explaining the policy + its consumers (lines `:1-23`).
- A value import of the type it reads: `import type { CoreResult } from './run-typecheck';`
  (`evaluate-result.ts:23`). For `exit-codes.ts` ALSO add a *value* import of
  `TypecheckInfrastructureError` (needed for `instanceof`):
  `import { TypecheckInfrastructureError } from './run-typecheck';`.
- `Pick<CoreResult, 'errorCount'>` input (mirrors `evaluate-result.ts:41`'s
  `Pick<CoreResult, 'errorCount' | 'warningCount'>`).
- Pure early-return branches with a blank line before/after each `if`/`return`
  (`evaluate-result.ts:44-58`).

**Recommended implementation** (discriminated union; planner may choose overloads per D
discretion). ngc-parity 0/1/2 (`exitCodeFromResult`, verified in the installed bundle):
```typescript
import type { CoreResult } from './run-typecheck';
import { TypecheckInfrastructureError } from './run-typecheck';

/**
 * Pure, framework-agnostic exit-code policy (COR-04 / D-07). Single source of
 * truth for all surfaces: 0 = clean, 1 = type errors, 2 = infrastructure failure
 * (ngc-parallel: @angular/compiler-cli exitCodeFromResult). NO process side
 * effects -- the standalone CLI (deferred) owns process.exit(toExitCode(...));
 * the Nx executor maps {success} to 0/1 and uses this only for classification.
 */
export function toExitCode(
  input: Pick<CoreResult, 'errorCount'> | TypecheckInfrastructureError,
): 0 | 1 | 2 {
  if (input instanceof TypecheckInfrastructureError) {
    return 2;
  }

  if (input.errorCount > 0) {
    return 1;
  }

  return 0;
}
```

**Purity boundary (eslint, `eslint.config.mjs:16-63`):** `**/src/core/**/*.ts` bans `@nx/*`,
`@angular-devkit/*`, `nx`, `yargs`, `no-console`, and `process.exit`. `exit-codes.ts` imports
ONLY from `./run-typecheck` (same `core/` folder) and touches no process -- it passes the
boundary. The value import of `TypecheckInfrastructureError` is permitted (intra-`core/`).

**Layering:** `toExitCode` is a leaf consumed by adapters; `run-typecheck.ts` must NOT import
`exit-codes.ts` (no cycle, keeps the engine unaware of the policy).

---

### `src/core/exit-codes.spec.ts` (test, unit, pure) -- COR-04 (NEW)

**Analog:** `src/core/evaluate-result.spec.ts` -- the matching pure-verdict unit spec.

**Template (copy this scaffolding shape exactly):**
```typescript
import { describe, expect, it } from 'vitest';

import { evaluateResult } from './evaluate-result';

describe('evaluateResult', () => {
  it('fails when errorCount > 0 ... (EXE-05 / D-03: errors always fail)', () => {
    expect(evaluateResult({ errorCount: 1, warningCount: 0 }).success).toBe(
      false,
    );
  });
  // ... one `it` per branch, 2-field literals, no compiler ...
});
```

**COR-04 cases to write** (from RESEARCH Code Examples; note the EXTRA import of
`TypecheckInfrastructureError` for the infra branch -- `evaluate-result.spec.ts` does NOT
need it, `exit-codes.spec.ts` does):
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

---

### `src/core/infra-failure.spec.ts` (test, unit, mocked loader) -- COR-01 unit (EXTEND)

**Analog:** itself -- the single justified `./compiler-loader` mock and the existing
500-on-`result.diagnostics` case (`:77-92`). The COR-01 unit twin stubs `readConfiguration`
to return a code-500 in `parsed.errors` + `rootNames: []`.

**The existing mock scaffolding to extend** (`:20-47`): `vi.hoisted` handle +
`vi.mock('./compiler-loader', ...)` returning `loadCompilerCli` -> a `CompilerCli` stub with
`readConfiguration`, `performCompilation`, `UNKNOWN_ERROR_CODE`. The current
`readConfiguration` stub returns non-empty `rootNames`; the COR-01 test needs a variant that
returns the real 500 shape:
```typescript
// COR-01 unit twin: stub readConfiguration so parsed.errors carries a code-500
// AND rootNames: [] (the real shape), proving the scan fires BEFORE the
// zero-rootNames guard. Mirror the file's existing UNKNOWN_ERROR_CODE = 500 const.
readConfiguration: vi.fn(() => ({
  project: '/virtual/tsconfig.json',
  options: {},
  rootNames: [],                       // the real 500 shape has rootNames: []
  errors: [
    {
      category: 1, code: UNKNOWN_ERROR_CODE, source: 'angular',
      file: undefined, start: undefined, length: undefined,
      messageText: "Error: ENOENT: no such file or directory, lstat '...'",
    },
  ],
  emitFlags: 0,
})),
// assertion (mirror the existing :89-91):
//   await expect(runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' }))
//     .rejects.toBeInstanceOf(TypecheckInfrastructureError);
```

**Contrast case (D-03 boundary):** a `code: 5012` (or `18003`) entry in `parsed.errors`
must NOT throw and must be counted/returned -- mirror the existing "does NOT throw on a
normal TS2322" passing case (`:94-114`), asserting `errorCount >= 1` instead.

**`errorDiagnostic(code, message)` helper** (`:49-58`) is reusable for building the contrast
`parsed.errors` entries.

---

### `src/core/config-resolution.integration.spec.ts` (test, integration, real compiler) -- COR-01 integration (EXTEND)

**Analog:** itself -- the `workspaceRoot`-join idiom + the malformed-config "does NOT throw"
case. (NEW `config-resolution-500.integration.spec.ts` is an alternative home, but extending
this file is preferred since the D-03 contrast assertions already live here.)

**The exact `workspaceRoot` join idiom to reuse** (`:32-52`):
```typescript
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');

const malformedTsConfig = join(
  workspaceRoot, 'fixtures', 'config-broken', 'tsconfig.malformed.json',
);
```

**New COR-01 case (nonexistent-path 500 -- RESEARCH-recommended, zero new fixture files):**
```typescript
it('re-throws TypecheckInfrastructureError for a config-resolution 500 (nonexistent tsconfig)', async () => {
  const { TypecheckInfrastructureError } = await import('./run-typecheck');
  const missing = join(
    workspaceRoot, 'fixtures', 'config-broken', 'tsconfig.does-not-exist.json',
  );

  await expect(runTypecheck({ tsConfigPath: missing }))
    .rejects.toBeInstanceOf(TypecheckInfrastructureError);
});
```

**Do NOT regress the D-03 boundary** (`:91-97`): the EXISTING malformed fixture (which
`extends` a nonexistent target -> code 5012, NOT 500) must still `resolves.toBeDefined()`
with `errorCount >= 1`. RESEARCH Pitfall 1: a *nonexistent extends target* is 5012, a
*nonexistent tsconfig PATH* (ENOENT) is the 500 -- they are different cases and both must
hold. The existing `tsconfig.malformed.json` (`extends: "./tsconfig.does-not-exist.json"`) is
the 5012 fixture; the COR-01 500 fixture is a path that does not exist on disk.

---

### `src/core/gather-diagnostics.spec.ts` (test, unit, stub program) -- COR-02 unit (EXTEND)

**Analog:** itself -- the 6-getter stub at `:23-30` (the "calls all six getters" test).

**The exact stub-program idiom to extend** (`:9-30`): a `diagnostic(code)` factory + a
`program` object literal cast `as unknown as Program` whose getters are `vi.fn`s. Add a
`getTsProgram` stub returning `getGlobalDiagnostics`:
```typescript
const program = {
  getTsOptionDiagnostics: () => [], getNgOptionDiagnostics: () => [],
  getTsSyntacticDiagnostics: () => [], getTsSemanticDiagnostics: () => [],
  getNgStructuralDiagnostics: () => [], getNgSemanticDiagnostics: () => [],
  getTsProgram: () => ({ getGlobalDiagnostics: () => [diagnostic(2318)] }),
} as unknown as Program;

expect(gatherAllDiagnostics(program).map((d) => d.code)).toContain(2318);
```

**Update the existing "calls all six getters ... in order" test** (`:14-45`): it currently
asserts `calls` equals exactly the six names and codes `[1, 2, 3, 2322, 5, 8109]`. After
COR-02 the gatherer makes a 7th call. Either (a) add `getTsProgram` to that test's stub and
extend the expected codes, or (b) keep that test focused on the six-in-order property and add
a SEPARATE `it` for the global-diagnostics push (cleaner; mirrors the existing second `it` at
`:47-66` that isolates the no-short-circuit property). Code 2318 is a raw TS code (positive) --
do NOT route it through any `NG()` helper (RESEARCH Pitfall 5).

---

### `src/core/filter-diagnostics.spec.ts` (test, unit, pure) -- COR-03 unit (EXTEND)

**Analog:** itself -- the `diag(undefined)` file-less case at `:53-61` and the `diag(fileName)`
helper at `:14-23` (which ALREADY accepts a string, so `diag('')` needs no helper change).

**The exact file-less idiom to mirror** (`:53-61`):
```typescript
it('keeps a file-less diagnostic (file === undefined) ALWAYS (D-03)', () => {
  const result = filterDiagnostics([diag(undefined)], {
    ...base, includeDeps: false,
  });

  expect(result.kept).toHaveLength(1);
  expect(result.suppressedCount).toBe(0);
});
```

**New COR-03 case (the failing-then-passing one):**
```typescript
it('keeps a diagnostic whose file.fileName is present-but-empty (COR-03/D-06)', () => {
  const result = filterDiagnostics([diag('')], { ...base, includeDeps: false });

  expect(result.kept).toHaveLength(1);
  expect(result.suppressedCount).toBe(0);
});
```
Pre-fix this asserts `kept.length === 0` (suppressed) -- the failing case. `base` is the
shared fixture object at `:26-30` (`basePath: '/ws/proj'`, `useCaseSensitiveFileNames: true`,
identity `realpath`).

---

### `fixtures/global-diagnostics/` (fixture, file-I/O) -- COR-02 (NEW)

**Analog:** `fixtures/config-broken/` and `fixtures/ts-baseline/` -- the committed
leaf-tsconfig + source-file fixture pattern the integration specs read via the
`workspaceRoot`-join idiom.

**Existing fixture shape to mirror** (`fixtures/config-broken/tsconfig.malformed.json`):
```jsonc
{
  "compilerOptions": { "noEmit": true, "target": "es2022", "module": "preserve",
    "moduleResolution": "bundler", "strict": true },
  "files": ["error.component.ts"]
}
```

**New files (from RESEARCH Code Examples -- TS2318 via `noLib`):**
```jsonc
// fixtures/global-diagnostics/tsconfig.json
{
  "compilerOptions": { "noLib": true, "types": [], "skipLibCheck": false, "noEmit": true },
  "files": ["global-error.ts"]
}
```
```typescript
// fixtures/global-diagnostics/global-error.ts
export const x: number = 1;
export function f() { return [1, 2, 3]; } // uses Array -> TS2318 "Cannot find global type 'Array'"
```

**Integration assertion** (extend `run-typecheck.integration.spec.ts`, or a new
`global-diagnostics.integration.spec.ts`, reusing its `workspaceRoot` join at `:21-23`):
```typescript
it('COR-02: surfaces a global TS2318 the per-file path never emits', async () => {
  const result = await runTypecheck({
    tsConfigPath: join(workspaceRoot, 'fixtures', 'global-diagnostics', 'tsconfig.json'),
  });

  expect(result.diagnostics.map((d) => d.code)).toContain(2318);
});
```
Pre-fix the 6-getter gatherer returns `[]`; post-fix `getGlobalDiagnostics()` returns the
file-less TS2318 set, kept by the boundary filter (COR-02 + COR-03 cooperate -- the globals
are file-less, so they are never suppressed).

---

### `src/executors/angular-typecheck/executor.spec.ts` (test, unit, mocked seams) -- COR-04 D-08 (OPTIONAL tighten)

**Analog:** itself -- the existing infra-catch assertion at `:141-154`.

**The existing D-08 assertion (already passes -- verify, do not rewrite)** (`:141-154`):
```typescript
it('catches a TypecheckInfrastructureError -> logger.error + { success: false } (D-01)', async () => {
  const { TypecheckInfrastructureError } = await import('../../core/run-typecheck');
  mocks.runTypecheck.mockRejectedValue(
    new TypecheckInfrastructureError('simulated internal crash'),
  );

  const { default: executor } = await import('./executor');
  const result = await executor(options, context);

  expect(result).toEqual({ success: false });
  expect(mocks.loggerError).toHaveBeenCalledOnce();
});
```

**Optional tightening (D-08 distinct-message lock):** assert the `logger.error` argument
contains `"infrastructure error"` to lock the DISTINCT operator message vs a plain
type-error verdict. The mock seam is `mocks.loggerError` (`executor.spec.ts:32,62-66`):
```typescript
  expect(mocks.loggerError).toHaveBeenCalledWith(
    expect.stringContaining('infrastructure error'),
  );
```
This matches `executor.ts:53-54`'s message verbatim. No `executor.ts` source change.

---

## Shared Patterns

### Pure `core/` policy (no process, no framework)
**Source:** `src/core/evaluate-result.ts` (template) + `eslint.config.mjs:16-63` (enforcer).
**Apply to:** `src/core/exit-codes.ts` (COR-04). Pure function over a `Pick<CoreResult, ...>`
input (+ a typed-error branch for `toExitCode`), no `process.exit`, no `@nx/*` /
`@angular-devkit/*` / `nx` / `yargs` imports, no `console`. The adapter (executor now, CLI
later) owns all I/O and exit.
```typescript
// evaluate-result.ts:40-43 -- the Pick<CoreResult,...> pure-input idiom to copy
export function evaluateResult(
  result: Pick<CoreResult, 'errorCount' | 'warningCount'>,
  options: EvaluateOptions = {},
): { success: boolean } {
```

### Code-only `UNKNOWN_ERROR_CODE` (500) detection
**Source:** `src/core/run-typecheck.ts:171-179` (the existing `result.diagnostics` scan).
**Apply to:** the COR-01 `parsed.errors` scan. Detect by `=== ng.UNKNOWN_ERROR_CODE` ONLY --
never `source` or message text (D-02). Re-throw `TypecheckInfrastructureError` with
`ts.flattenDiagnosticMessageText(messageText, '\n')`. Both scans coexist (defense-in-depth).

### Negative-NG vs raw-TS code assertion
**Source:** `config-resolution.integration.spec.ts:30` and `run-typecheck.integration.spec.ts:17`
-- `const NG = (code) => -990000 - code;`.
**Apply to:** any COR fixture asserting codes. COR-02's TS2318 is a RAW positive TS code --
use `2318` directly, NOT `NG(...)` (RESEARCH Pitfall 5). Reach for `NG()` only if a mixed
fixture also asserts an Angular extended (NG8xxx) code.

### `workspaceRoot`-join real-compiler integration fixture access
**Source:** `config-resolution.integration.spec.ts:32-52`,
`run-typecheck.integration.spec.ts:21-23`.
**Apply to:** COR-01 (nonexistent-path) + COR-02 (global-diagnostics) integration specs.
```typescript
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const tsConfig = join(workspaceRoot, 'fixtures', '<dir>', 'tsconfig.json');
```

### Single-justified `compiler-loader` mock (the only sanctioned core mock)
**Source:** `infra-failure.spec.ts:20-47` (`vi.hoisted` + `vi.mock('./compiler-loader', ...)`).
**Apply to:** the COR-01 unit test (stub `readConfiguration` -> code-500 in `parsed.errors`).
This is the ONE place a compiler-loader mock is justified for the engine; the real-compiler
proof lives in the integration spec.

### `as unknown as Program` stub-getter idiom
**Source:** `gather-diagnostics.spec.ts:23-30`, `filter-diagnostics.spec.ts:14-23`.
**Apply to:** the COR-02 gatherer wiring unit test (stub `getTsProgram().getGlobalDiagnostics`).
Object literal of `vi.fn`/arrow getters cast `as unknown as Program`; only the called members
need declaring.

### CLAUDE.md JS/TS style (control-flow spacing + mandatory braces)
**Apply to:** every new/edited `.ts`. Blank line before/after each `if`/`else`/`for`/`return`/
`throw`; braces on every control-flow body even one-liners. All four target files and their
specs already follow this -- match it (e.g. `run-typecheck.ts:175-179`,
`evaluate-result.ts:44-58`).

---

## No Analog Found

None. Every Phase-8 file maps to an in-repo analog (most to an in-file twin). No file needs to
fall back to RESEARCH.md-only patterns.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | -- |

---

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/`,
`packages/angular-typechecker/src/executors/angular-typecheck/`, `fixtures/`,
`packages/angular-typechecker/eslint.config.mjs`.
**Files scanned (read in full):** `run-typecheck.ts`, `gather-diagnostics.ts`,
`filter-diagnostics.ts`, `evaluate-result.ts`, `compiler-cli-types.ts`, `executor.ts`,
`infra-failure.spec.ts`, `gather-diagnostics.spec.ts`, `filter-diagnostics.spec.ts`,
`evaluate-result.spec.ts`, `config-resolution.integration.spec.ts`,
`run-typecheck.integration.spec.ts`, `executor.spec.ts`, `eslint.config.mjs`,
`fixtures/config-broken/tsconfig.malformed.json`.
**Locked stack honored:** Nx 23.0.1, Angular 22.0.4, TypeScript 6.0.3, Vitest 4. Core stays
PURE (eslint bans `@nx/*` / `@angular-devkit/*` / `process.exit` in `src/core/**`).
**Pattern extraction date:** 2026-06-29
