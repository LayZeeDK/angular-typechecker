# Phase 9: Resilience (per-file fault isolation + boundary robustness) - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 8 (3 MODIFY engine, 3 NEW test/fixture, 2 EXTEND spec)
**Analogs found:** 8 / 8 (every change has an exact in-repo analog)

This is a HARDENING phase on an existing, complete engine. There are NO greenfield
production files. Every "new" artifact is a test or fixture, and every analog already
exists in the repo. The planner/executor MUST replicate the established conventions
(fixture-root layout, integration-spec scaffolding, the `NG()` helper, the cold-compiler
timeout, the `vi.mock('./compiler-loader')` idiom, the injected-realpath idiom, the
pure-core eslint constraints) rather than inventing new shapes.

All five paths below resolve from a spec at `packages/angular-typechecker/src/core/`:

```ts
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..'); // -> repo root
// fixtures live at <workspaceRoot>/fixtures/<name>/  (NOT under the package)
```

## File Classification

| New/Modified File                                                                   | Role                                | Data Flow                                 | Closest Analog                                                                 | Match Quality            |
| ----------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| `packages/angular-typechecker/src/core/gather-diagnostics.ts` (MODIFY, RES-02 :34)  | service (engine gatherer)           | transform (Program -> diagnostics)        | its own current body + COR-02 `getGlobalDiagnostics` (:35)                     | exact (self)             |
| `packages/angular-typechecker/src/core/filter-diagnostics.ts` (MODIFY, RES-03 :127) | service (boundary filter)           | transform (paths -> kept/suppressed)      | its own `createCanonicalizer` (:115-136)                                       | exact (self)             |
| `packages/angular-typechecker/src/core/run-typecheck.ts` (MODIFY, RES-04 :105)      | service (engine orchestrator)       | request-response (tsconfig -> CoreResult) | its own `readConfiguration` call (:105)                                        | exact (self)             |
| RES-01 spike probe (NEW throwaway, e.g. `res-01-spike.probe.spec.ts`)               | test (probe, not shipped)           | event-driven (run-once, emit GO artifact) | `run-typecheck.integration.spec.ts` + `global-diagnostics.integration.spec.ts` | role-match (integration) |
| `fault-isolation.integration.spec.ts` (NEW, RES-02)                                 | test (real-compiler integration)    | request-response (fixture -> CoreResult)  | `run-typecheck.integration.spec.ts`, `extended.promotion.integration.spec.ts`  | exact                    |
| `fixtures/fault-isolation/` (NEW dir, RES-02)                                       | fixture (multi-file Angular)        | file-I/O (source on disk)                 | `fixtures/sibling-import/`, `fixtures/gate-b-error/`                           | exact                    |
| `filter-diagnostics.spec.ts` (EXTEND, RES-03)                                       | test (pure unit, injected realpath) | transform                                 | its own lines 88-106 (injected-realpath idiom)                                 | exact (self)             |
| `run-typecheck.spec.ts` + `infra-failure.spec.ts` (EXTEND/analog, RES-04)           | test (readConfiguration spy)        | request-response (mocked)                 | `infra-failure.spec.ts` `vi.mock('./compiler-loader')` idiom                   | exact                    |

## Pattern Assignments

### `gather-diagnostics.ts` (MODIFY, RES-02, line 34)

**Analog:** its own current body (the single whole-program `getNgSemanticDiagnostics()` at
:34, with COR-02's `getTsProgram().getGlobalDiagnostics()` at :35 that STAYS).

**Current body** (the exact line 34 the loop replaces; line 35 is untouched):

```ts
export function gatherAllDiagnostics(program: Program): readonly ts.Diagnostic[] {
  const all: ts.Diagnostic[] = [];

  all.push(...program.getTsOptionDiagnostics());
  all.push(...program.getNgOptionDiagnostics());
  all.push(...program.getTsSyntacticDiagnostics());
  all.push(...program.getTsSemanticDiagnostics());
  all.push(...program.getNgStructuralDiagnostics());
  all.push(...program.getNgSemanticDiagnostics()); // <== RES-02 REPLACE (:34)
  all.push(...program.getTsProgram().getGlobalDiagnostics()); // COR-02 / D-04   <== STAYS (:35)

  return all;
}
```

**SIMPLE shape** (only if RES-01 positively proves no file-less non-template diagnostics; D-02):

```ts
for (const sf of program.getTsProgram().getSourceFiles()) {
  if (sf.isDeclarationFile) {
    continue;
  }

  all.push(...program.getNgSemanticDiagnostics(sf.fileName));
}
```

**HYBRID shape** (default on inconclusive, D-03 -- keep the residual whole-program
non-template call AND add the per-file loop; `sortAndDeduplicateDiagnostics` in `finalize`
removes the per-file template duplicates):

```ts
all.push(...program.getNgSemanticDiagnostics()); // whole-program: file-less-safe non-template set
for (const sf of program.getTsProgram().getSourceFiles()) {
  if (sf.isDeclarationFile) {
    continue;
  }

  all.push(...program.getNgSemanticDiagnostics(sf.fileName)); // per-file: isolated template/extended
}
```

**Shim already supports it** (`compiler-cli-types.ts:76-79`) -- NO shim widening (D-04):

```ts
getNgSemanticDiagnostics(
  fileName?: string,
  cancellationToken?: ts.CancellationToken,
): readonly ts.Diagnostic[];
```

**Constraints carried from the analog:**

- The block-blank-line style (blank line before `return`) is already present; keep it inside the loop bodies too (CLAUDE.md JS/TS style: braces always, blank line around control flow).
- Determinism is guaranteed downstream by `ts.sortAndDeduplicateDiagnostics` (`run-typecheck.ts:347`) -- do NOT add a manual dedup (D-06).
- Use `OptimizeFor.WholeProgram` implicitly via the `fileName` overload; NEVER `SingleFile` (D-07).

---

### `filter-diagnostics.ts` (MODIFY, RES-03, line 127)

**Analog:** its own `createCanonicalizer` body (`:115-136`).

**Current** (the bare call at :127 that throws-propagates today):

```ts
function createCanonicalizer(options: Pick<FilterOptions, 'useCaseSensitiveFileNames' | 'realpath'>): (filePath: string) => string {
  const cache = new Map<string, string>();

  return (filePath: string): string => {
    const cached = cache.get(filePath);

    if (cached !== undefined) {
      return cached;
    }

    const real = options.realpath(filePath).replace(/\\/g, '/'); // <== RES-03 EDIT (:127)
    const canonical = options.useCaseSensitiveFileNames ? real : real.toLowerCase();

    cache.set(filePath, canonical);

    return canonical;
  };
}
```

**RES-03 / D-08 shape** (wrap ONLY the `realpath()` call in try/catch; fall back to raw
`filePath`, then STILL `\\`->`/` normalize + case-fold; cache + happy path unchanged;
SILENT -- no logging, pure core):

```ts
let resolved: string;

try {
  resolved = options.realpath(filePath);
} catch {
  // D-08: a throwing realpath (EACCES / broken junction / permission-denied symlink)
  // must not abort the pass. Fall back to the UNRESOLVED raw path; still normalize +
  // case-fold so it classifies consistently. Silent -- core is PURE.
  resolved = filePath;
}

const real = resolved.replace(/\\/g, '/');
```

**Constraint (eslint pure-core, `packages/angular-typechecker/eslint.config.mjs:16-63`):**
the `**/src/core/**/*.ts` override bans `no-console` and `process.exit` -- the fallback
must be a SILENT empty `catch {}` (no logging, no `process`). Verified live.

---

### `run-typecheck.ts` (MODIFY, RES-04, line 105)

**Analog:** its own `readConfiguration` call (`:105`).

**Current:**

```ts
const parsed = ng.readConfiguration(options.tsConfigPath); // <== RES-04 EDIT (:105)
```

**RES-04 / D-09 shape** (matches `@angular/build` `angular-compilation.ts:51` @ v22.0.4):

```ts
const parsed = ng.readConfiguration(options.tsConfigPath, {
  suppressOutputPathCheck: true,
});
```

**Shim already supports it** (`compiler-cli-types.ts:155-158`) -- NO shim change (D-09);
`ts.CompilerOptions` has an index signature so the extra key type-checks:

```ts
readConfiguration(
  project: string,
  existingOptions?: ts.CompilerOptions,
): ParsedConfiguration;
```

**Caveat RESOLVED by research:** the output-path check fires inside `createProgram` gated
by `!noEmit && !suppressOutputPathCheck` (typescript.js:129892), NOT in `readConfiguration`;
`noEmit: true` (already in the override at `:166-186`) ALONE suppresses it. The second-arg
placement is belt-and-suspenders `@angular/build` parity. Safe under `noEmit: true`.

---

### RES-01 spike probe (NEW, throwaway)

**Analogs:** `run-typecheck.integration.spec.ts` (the real-compiler `runTypecheck`-against-
fixture scaffolding) + `global-diagnostics.integration.spec.ts` (single-fixture shape).
This is THROWAWAY probe code (`*.probe.spec.ts` or `.spike.ts`) that emits the GO artifact,
NOT shipped engine code (D-03 / Open Q2). It reaches the live `api.Program` to inspect
`d.file` on the whole-program `getNonTemplateDiagnostics` output vs the per-file union.

**Spec scaffolding to copy** (from `global-diagnostics.integration.spec.ts:25-33`):

```ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runTypecheck } from './run-typecheck';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const fixtureTsConfig = join(workspaceRoot, 'fixtures', '<spike-fixture>', 'tsconfig.app.json');
```

To inspect `d.file`, the probe needs the live `program` -- it can call `runTypecheck` for a
smoke pass, but to read the raw non-template set it likely reaches the compiler via the same
`loadCompilerCli()` + `performCompilation` path the engine uses (see `run-typecheck.ts:102-193`).
The GO artifact (SIMPLE | HYBRID + the file-less finding + v22.0.4 citations) is recorded as
a durable file the phase verifier checks (research recommends a committed `RES-01-SPIKE.md` or
a recorded decision block in the plan SUMMARY).

---

### `fault-isolation.integration.spec.ts` (NEW, RES-02)

**Analogs:** `run-typecheck.integration.spec.ts` (the `NG()` helper, the `diagnosticsOnFile`
helper, the `describe`/`it` real-compiler shape) and `extended.promotion.integration.spec.ts`
(single-fixture single-tsconfig shape).

**Header + path scaffolding** (copy verbatim, adjust fixture name):

```ts
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runTypecheck } from './run-typecheck';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const faultIsolationTsConfig = join(workspaceRoot, 'fixtures', 'fault-isolation', 'tsconfig.app.json');
```

**The `NG()` helper** (Pitfall 4 -- Angular extended codes are NEGATIVE; copy from
`run-typecheck.integration.spec.ts:17`; an alternative is `import { NG } from './diagnostic-codes'`
as `extended.promotion.integration.spec.ts:7` does):

```ts
// Angular encodes extended codes negative: ngErrorCode(8109) = -998109. Assert
// via the NG() helper, never the bare 8109 (PITFALL E / L-4). TS codes are raw.
const NG = (code: number): number => -990000 - code;
```

**The `diagnosticsOnFile` helper** (per-file diagnostic counting -- copy from
`run-typecheck.integration.spec.ts:54-65`; the survivor-error-survives assertion is exactly
its `.toHaveLength(0)` -> `>= 1` shape):

```ts
function diagnosticsOnFile(diagnostics: readonly { file?: { fileName: string } }[], absolutePath: string): readonly { file?: { fileName: string } }[] {
  // CoreResult fileNames are absolute + forward-slash; the join() path uses the
  // OS separator, so compare on the normalized forward-slash form.
  const normalized = absolutePath.replace(/\\/g, '/');

  return diagnostics.filter((diagnostic) => diagnostic.file?.fileName === normalized);
}
```

**Cold-compiler timeout:** inherited from `vitest.config.mts:24-25` (`testTimeout: 30000`,
`hookTimeout: 30000`). Do NOT add per-file timeouts (Pitfall 5).

**The failing-then-passing differentiator:** pre-change the survivor component's diagnostic
vanishes (`diagnosticsOnFile(B)` length 0); post-change it survives (`>= 1`), while A's single
Fatal-derived diagnostic is present in both.

---

### `fixtures/fault-isolation/` (NEW dir, RES-02)

**Analogs:** `fixtures/sibling-import/` (multi-file, `paths`, multiple components) and
`fixtures/gate-b-error/` (a deliberate-error component + external `.html` template +
`tsconfig.app.json` with `strictTemplates: true`).

**Fixture tsconfig convention** (copy from `fixtures/gate-b-error/tsconfig.app.json`; the
fixtures extend the workspace-root `tsconfig.base.json` via `../../tsconfig.base.json`, which
EXISTS):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "target": "es2022",
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "emitDecoratorMetadata": false,
    "experimentalDecorators": false
  },
  "angularCompilerOptions": {
    "strictTemplates": true
  },
  "files": ["tcb-poison.component.ts", "survivor.component.ts"]
}
```

**Component convention** (copy from `fixtures/gate-b-error/error.component.ts` + its `.html`):

- Standalone `@Component`, external `templateUrl: './<name>.component.html'` (gate-b style) OR
  inline `template:` (sibling-import `main.component.ts` style). Either is established.
- The deliberate-error comment block is MANDATORY -- every fixture component carries the
  "OUT OF the project graph / kept out of the plugin build by tsconfig.lib.json's
  include: [src/**/*.ts] scope / Do NOT add @ts-nocheck -- the errors ARE the input" note
  (verbatim shape in `error.component.ts:3-7`, `main.component.ts:11-14`,
  `dependency.ts:1-9`).

**Component A (TCB-poison):** template references a non-exported / local-only symbol ->
`IMPORT_GENERATION_FAILURE` Fatal during TCB generation (Pitfall 2 / A1; the planner must
VERIFY the poison diagnostic comes from the template path, i.e. it is absent from the
whole-program NON-template set).

**Component B (survivor):** a PLAIN template error -- e.g. interpolated un-invoked signal
(NG8109, the exact `gate-b-error` shape: `status = signal('ready')` + `<p>{{ status }}</p>`)
or a TS2322 template-bound type error. Today it vanishes when A poisons the whole-program
pass; after RES-02 it survives.

`gate-b-error/error.component.ts` is the literal NG8109+TS2322-in-one-component model:

```ts
@Component({
  selector: 'gate-b-error',
  standalone: true,
  templateUrl: './error.component.html',
})
export class GateBErrorComponent {
  count: number = 'not a number'; // TS2322: string is not assignable to number

  status = signal('ready'); // interpolated un-invoked in the template -> NG8109
}
```

---

### `filter-diagnostics.spec.ts` (EXTEND, RES-03)

**Analog:** its OWN injected-realpath idiom (`:88-106`) and the `diag()` literal builder
(`:14-23`). The RES-03 case is PURE -- NO compiler, NO fixture: inject a throwing `realpath`
into `FilterOptions` and assert an in-project diagnostic is still kept (no throw escapes).

**The `diag()` builder to reuse** (`:14-23`):

```ts
function diag(fileName: string | undefined, code = 2322): ts.Diagnostic {
  return {
    category: 0 /* ts.DiagnosticCategory.Error */,
    code,
    file: fileName === undefined ? undefined : ({ fileName } as ts.SourceFile),
    start: 0,
    length: 1,
    messageText: 'x',
  } as ts.Diagnostic;
}
```

**The injected-realpath idiom to mirror** (`:88-106` -- replace the resolving stub with a
throwing one):

```ts
it('RES-03: a throwing realpath is caught; the in-project diagnostic is still kept', () => {
  const realpath = (): string => {
    throw new Error('EACCES');
  };

  const result = filterDiagnostics([diag('/ws/proj/src/a.component.ts')], {
    basePath: '/ws/proj',
    useCaseSensitiveFileNames: true,
    realpath,
    includeDeps: false,
  });

  expect(result.kept).toHaveLength(1);
  expect(result.suppressedCount).toBe(0);
});
```

The `base` object at `:26-30` (`basePath`/`useCaseSensitiveFileNames`/`realpath`) is the
shared fixture; spread `...base` and override `realpath` per the existing tests' pattern.

---

### `run-typecheck.spec.ts` (EXTEND) + `infra-failure.spec.ts` (analog, RES-04)

**Analog for the `readConfiguration` spy:** `infra-failure.spec.ts` (`:24-50`) -- the
`vi.hoisted` + `vi.mock('./compiler-loader')` idiom that stubs the loaded
`@angular/compiler-cli` namespace. This is the established compiler-cli mock idiom; the
RES-04 unit asserts `runTypecheck` passes `suppressOutputPathCheck: true` as the SECOND ARG
to `readConfiguration`.

**The hoisted-stub + mock to mirror** (`infra-failure.spec.ts:24-50`):

```ts
const compilerCliStub = vi.hoisted(() => {
  return {
    readConfiguration: vi.fn(() => ({
      project: '/virtual/tsconfig.json',
      options: {},
      rootNames: ['/virtual/error.component.ts'],
      errors: [],
      emitFlags: 0,
    })),
    performCompilation: vi.fn(),
  };
});

vi.mock('./compiler-loader', () => {
  return {
    loadCompilerCli: vi.fn(
      async (): Promise<CompilerCli> =>
        ({
          readConfiguration: compilerCliStub.readConfiguration,
          performCompilation: compilerCliStub.performCompilation,
          defaultGatherDiagnostics: vi.fn(() => []),
          EmitFlags: { None: 0 },
          UNKNOWN_ERROR_CODE,
        }) as unknown as CompilerCli,
    ),
  };
});
```

**The RES-04 spy assertion** (add `performCompilation` returning a `fakeProgram()` so the
non-infra path completes -- the `fakeProgram` helper is at `infra-failure.spec.ts:67-73`):

```ts
const result = await runTypecheck({ tsConfigPath: '/virtual/tsconfig.json' });

expect(compilerCliStub.readConfiguration).toHaveBeenCalledWith('/virtual/tsconfig.json', { suppressOutputPathCheck: true });
```

**The `fakeProgram()` helper to reuse** (`infra-failure.spec.ts:67-73` -- the non-500 path
reads `program.getTsProgram().useCaseSensitiveFileNames()`):

```ts
function fakeProgram(): unknown {
  return {
    getTsProgram: () => ({
      useCaseSensitiveFileNames: () => true,
    }),
  };
}
```

**RES-04 integration (no-nuisance, research-recommended option (a)):** a `*.integration.spec.ts`
on a fixture with a colliding `outDir`/`rootDir` shape asserting NO TS5055 / overwrite-class
diagnostic surfaces (TS codes RAW, no `NG()`). Copy the `no-emit-override.integration.spec.ts`
`.not.toContain(<raw TS code>)` shape:

```ts
const codes = result.diagnostics.map((diagnostic) => diagnostic.code);

expect(codes).not.toContain(TS5055);
```

## Shared Patterns

### Integration-spec path scaffolding (workspace-root fixtures)

**Source:** `run-typecheck.integration.spec.ts:21-23`, `global-diagnostics.integration.spec.ts:25-33`,
`extended.promotion.integration.spec.ts:27-35`
**Apply to:** RES-01 probe, RES-02 integration spec, RES-04 integration spec

```ts
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const fixtureTsConfig = join(workspaceRoot, 'fixtures', '<name>', 'tsconfig.app.json');
```

### NG() negative-code helper (Pitfall 4)

**Source:** `run-typecheck.integration.spec.ts:17` (local const) OR `diagnostic-codes.ts:39` (`import { NG }`)
**Apply to:** any spec asserting an Angular extended (NG8xxx) code. TS codes (TS2322, TS5055,
TS6304, TS2318) are asserted RAW (positive).

```ts
const NG = (code: number): number => -990000 - code; // NG(8109) === -998109
```

### Cold-compiler timeout (Pitfall 5)

**Source:** `vitest.config.mts:24-25`
**Apply to:** every new `*.integration.spec.ts` -- inherited automatically; do NOT add
per-file `testTimeout`.

```ts
testTimeout: 30000,
hookTimeout: 30000,
```

### Fixture deliberate-error comment block

**Source:** `fixtures/gate-b-error/error.component.ts:3-7`, `fixtures/sibling-import/main.component.ts:11-14`
**Apply to:** every NEW `fixtures/fault-isolation/*.component.ts`

> OUT OF the project graph: kept out of the plugin build by tsconfig.lib.json's
> `include: ["src/**/*.ts"]` scope (fixtures live at the workspace root). Do NOT add
> `@ts-nocheck` -- the errors ARE the fixture input.

### Pure-core eslint constraints (silent fallback)

**Source:** `packages/angular-typechecker/eslint.config.mjs:16-63`
**Apply to:** RES-03 (and any `**/src/core/**` edit)

- `no-console: error`, `process.exit` banned, `@nx/*` / `@angular-devkit/*` import ban.
- RES-03's `catch {}` MUST be silent (no logging, no `process`).

### compiler-cli mock idiom (the only justified engine mock)

**Source:** `infra-failure.spec.ts:24-73`
**Apply to:** RES-04 unit (the `readConfiguration` spy). `vi.hoisted` + `vi.mock('./compiler-loader')`

- `fakeProgram()`. Real-compiler integration specs are preferred elsewhere; mock only the
  `readConfiguration` arg-passing assertion.

## No Analog Found

None. Every file in this phase has an exact in-repo analog (self-analog for the three
engine MODIFYs; established integration-spec / fixture / unit-spec analogs for the
NEW/EXTEND test artifacts).

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/**` (all 18 spec files + the
3 engine edit-point files + the shim), `fixtures/**` (workspace-root fixture tree),
`vitest.config.mts`, `eslint.config.mjs` (root + package), `tsconfig.base.json` (confirmed
present at workspace root).
**Files scanned:** ~22 (engine: gather/filter/run-typecheck/compiler-cli-types; specs:
filter-diagnostics, run-typecheck, gather-diagnostics, infra-failure, run-typecheck.integration,
global-diagnostics.integration, no-emit-override.integration, extended.promotion.integration,
diagnostic-codes; fixtures: gate-b-error/{ts,html,tsconfig.app}, sibling-import/{main,dependency,tsconfig.lib};
config: vitest.config.mts, both eslint.config.mjs).
**Pattern extraction date:** 2026-06-29
