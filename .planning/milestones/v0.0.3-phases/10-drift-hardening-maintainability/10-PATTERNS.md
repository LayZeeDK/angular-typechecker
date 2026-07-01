# Phase 10: Drift-hardening & Maintainability - Pattern Map

**Mapped:** 2026-06-29
**Files analyzed:** 9 (4 new, 5 modified)
**Analogs found:** 9 / 9 (every file has a same-repo analog; one target type -- `nx:run-commands` -- has no in-repo precedent but a strong shape-analog in the existing `build` target)

## File Classification

| New/Modified File                                                                       | Role                                                   | Data Flow                                                            | Closest Analog                                                                                                                                                                 | Match Quality                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `packages/angular-typechecker/src/core/compiler-cli-types.drift.ts` (NEW)               | type-assertion module (build-time gate)                | transform (type-only, erased at emit)                                | `packages/angular-typechecker/src/core/compiler-cli-types.ts` (the shim it asserts against) + `diagnostic-codes.ts` (vendored-from-real const idiom)                           | role-match (no prior type-assertion file exists; imports the shim it guards)                               |
| `packages/angular-typechecker/tsconfig.drift.json` (NEW)                                | config (tsconfig)                                      | n/a                                                                  | `packages/angular-typechecker/tsconfig.json` (production) + `tsconfig.base.json` (the `extends` target)                                                                        | exact (sibling tsconfig; same `extends` chain)                                                             |
| `packages/angular-typechecker/src/core/compiler-cli-types.runtime.spec.ts` (NEW)        | test (Vitest integration tier, runtime `await import`) | request-response (introspects a built program + encoding round-trip) | `global-diagnostics.integration.spec.ts` (real-compiler integration; imports `diagnostic-codes.ts`) + `extended.promotion.integration.spec.ts` (fixture-driven `runTypecheck`) | exact (same tier, same `await import`/fixture conventions)                                                 |
| HARD-05 spec: `*.ts99-leak.integration.spec.ts` (NEW) OR extend `render-report.spec.ts` | test (integration tier, real `cli.formatDiagnostics`)  | request-response (diagnostics -> rendered output assertion)          | `render-report.spec.ts` (existing NG8109-through-`renderReport` case at `:74-81`) + `extended.promotion.integration.spec.ts` (real NG8101 fixture)                             | exact (the NG-code-in-output assertion already exists; HARD-05 adds the negative `not.toContain('TS-99')`) |
| `packages/angular-typechecker/src/core/compiler-cli-types.ts` (MODIFY)                  | model / type-shim (CORE)                               | transform                                                            | itself (existing vendor-comment + ambient-enum idiom) + `diagnostic-codes.ts:56` (the vendor marker line)                                                                      | exact (in-place edit of the shim)                                                                          |
| `packages/angular-typechecker/src/core/gather-diagnostics.ts` (MODIFY)                  | service (the gatherer)                                 | transform (collects diagnostics)                                     | itself (existing rich `WHY` comment block `:1-56`)                                                                                                                             | exact (comment-only edit)                                                                                  |
| `packages/angular-typechecker/project.json` (MODIFY)                                    | config (Nx targets)                                    | n/a                                                                  | the existing `build` target (`:8-41`) for `inputs`/`outputs`/`cache` shape                                                                                                     | role-match (no `nx:run-commands` target exists yet; reuse the `build`/`test` target JSON shape)            |
| `packages/angular-typechecker/tsconfig.lib.json` + `tsconfig.spec.json` (MODIFY)        | config (tsconfig)                                      | n/a                                                                  | the existing `exclude`/`include` arrays in each file                                                                                                                           | exact (add `*.drift.ts` glob to the existing lists)                                                        |
| `.github/workflows/ci.yml` (MODIFY)                                                     | config (CI workflow)                                   | event-driven (PR/push triggers)                                      | the existing `test` job (`:84-109`, the `nx run-many -t test` step)                                                                                                            | exact (fold `typecheck-drift` into the existing `run-many` target list)                                    |

## Pattern Assignments

### `compiler-cli-types.drift.ts` (NEW -- type-assertion module, build-time gate)

**Analogs:** `compiler-cli-types.ts` (the shim it asserts FROM real), `diagnostic-codes.ts` (vendored-const-from-real idiom). The RESEARCH file (`10-RESEARCH.md`) Patterns 1-3 give the VERIFIED assertion shapes -- copy those verbatim; they compiled clean against the live `@angular/compiler-cli@22.0.4` this session.

**Header-comment pattern** -- copy the WHY-block convention from `compiler-cli-types.ts:1-33` (a long block explaining the nodenext-empty-resolution reason the shim exists). The drift file's header should explain the INVERSE: why it resolves under classic-node and never ships.

**Import pattern** -- the drift file is the ONE place that imports the REAL `@angular/compiler-cli` named types (the shim deliberately does NOT, per `compiler-cli-types.ts:35` `import type * as ts from 'typescript';` only). From `10-RESEARCH.md` Pattern 1 (VERIFIED):

```typescript
import type { Program as RealProgram } from '@angular/compiler-cli';
import type { Program as ShimProgram } from './compiler-cli-types';
import type * as ts from 'typescript';

// D-03: the PlainTS helper. From extends To is the assignability constraint.
type AssertAssignable<From, To extends From> = true;
```

**Core pattern (per-member tuple)** -- the 6 diagnostic getters the shim declares at `compiler-cli-types.ts:59-79` map one-to-one to the tuple slots in `10-RESEARCH.md` Pattern 1 (`DiagnosticGetterProbe`). The getter SET to assert is exactly what `gather-diagnostics.ts:62-77` calls. LANDMINE (from RESEARCH Pitfall 1): `getTsProgram` is special-cased as `ReturnType<RealProgram['getTsProgram']> -> ts.Program`, NOT a `real -> shim` pair, because the shim widens the return to `TsProgram` (`compiler-cli-types.ts:45-47`).

**Call-site probes (D-05)** -- `10-RESEARCH.md` Pattern 2; invoke each getter at the EXACT arities `gather-diagnostics.ts` uses: `getNgSemanticDiagnostics()` (no-arg, `:69`) AND `getNgSemanticDiagnostics('x.ts')` (`:77`), plus `getTsProgram().getGlobalDiagnostics()` (`:80`). Defends the proven optional->required silent gap.

**Value-level assertions** -- `10-RESEARCH.md` Pattern 3; `const _: 500 = RealUnknown` pins `UNKNOWN_ERROR_CODE` (the literal the shim hard-codes at `compiler-cli-types.ts:100` and the infra detector compares at `run-typecheck.ts:238`), plus the 7 `EmitFlags` member pins (HARD-02). ASCII-only, no emojis (CLAUDE.md / RESEARCH constraint).

---

### `tsconfig.drift.json` (NEW -- config)

**Analog:** `packages/angular-typechecker/tsconfig.json` (`:1-8`) shows the `extends` + classic-node override shape; `tsconfig.base.json:7` already sets `moduleResolution: node` (the classic-node base the drift file needs to resolve the real barrel).

**Extends + override pattern** -- the production `tsconfig.json:1-8` is the template, but the drift tsconfig extends `tsconfig.base.json` directly (NOT the package `tsconfig.json`, whose `nodenext` would resolve the real barrel EMPTY -- the whole reason the shim exists). Copy the verified JSON from `10-RESEARCH.md` "Code Examples":

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "ignoreDeprecations": "6.0",
    "noEmit": true,
    "declaration": false,
    "types": ["node"],
    "skipLibCheck": true
  },
  "files": ["src/core/compiler-cli-types.drift.ts"]
}
```

Note (RESEARCH Pitfall 4): `ignoreDeprecations: "6.0"` is load-bearing -- the production `tsconfig.json:7` already carries it; `tsconfig.base.json` does NOT. Use `files` (singleton) not `include` per D-06.

---

### `compiler-cli-types.runtime.spec.ts` (NEW -- test, integration tier)

**Analogs:** `global-diagnostics.integration.spec.ts` (real-compiler integration that imports a CORE module + uses a fixture tsconfig) and `extended.promotion.integration.spec.ts` (fixture-path + `runTypecheck` convention). RESEARCH Pattern 4 gives the VERIFIED runtime probe shape.

**Fixture-path resolution pattern** (`extended.promotion.integration.spec.ts:1-35`, `global-diagnostics.integration.spec.ts:1-33`):

```typescript
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
const someTsConfig = join(workspaceRoot, 'fixtures', '<fixture>', 'tsconfig.app.json');
```

RESEARCH Open Question 2 recommends reusing `ng-baseline` or `extended-v13` with `gatherDiagnostics: () => []` (introspect the program shape only -- fast, deterministic).

**Imports pattern** -- import the dependency-free encoding helpers from CORE (the same `import { NG } from './diagnostic-codes'` at `extended.promotion.integration.spec.ts:7`); D-04 adds `ngCodeOf`. The spec `await import('@angular/compiler-cli')` (the executor's real load path -- allowed in the test tier, RESEARCH "Project Constraints").

**Core pattern (getter-set + encoding)** -- `10-RESEARCH.md` Pattern 4 verbatim: SUBSET containment (`expect(typeof program[name]).toBe('function')` for the 7 frozen `GATHERED_GETTERS`), the additions-review filtered diff (`expect(added).toEqual([])`), and the encoding round-trip (`expect(NG(8109)).toBe(cli.ngErrorCode(8109))`, `expect(cli.UNKNOWN_ERROR_CODE).toBe(500)`). Do NOT assert prototype EQUALITY (RESEARCH anti-pattern -- the runtime `NgtscProgram` has runtime-only extras).

---

### HARD-05 leak spec (NEW `*.ts99-leak.integration.spec.ts` OR extend `render-report.spec.ts`)

**Analogs:** `render-report.spec.ts:74-81` (the EXISTING "forwards an NG-encoded diagnostic code through to formatReport output" case -- asserts `out` contains `NG8109`) is the closest analog; HARD-05 is the same shape plus a negative assertion. `extended.promotion.integration.spec.ts` provides the real-NG8xxx fixture path (`runTypecheck({ tsConfigPath: extendedPromotedTsConfig })`).

**Existing positive assertion to mirror** (`render-report.spec.ts:74-81`):

```typescript
it('forwards an NG-encoded diagnostic code through to formatReport output', async () => {
  const out = await renderReport({ diagnostics: [diag(ERROR, 'D:/ws/proj/src/a.component.ts', NG8109)] }, { color: false });
  expect(out).toContain('NG8109');
});
```

**HARD-05 core pattern** -- `10-RESEARCH.md` Pattern 5: feed a REAL NG8xxx fixture's diagnostics (RESEARCH A3 recommends the `extended-promoted` NG8101 fixture) through `renderReport(..., { color: false })` (the ANSI-strip path, `format-report.ts:82`), then assert BOTH `out.toMatch(/NG\d{4}/)` (positive) AND `out.not.toContain('TS-99')` (negative). MUST use the real `cli.formatDiagnostics` via `renderReport` -- a `ts.formatDiagnostics` fake does NOT run `replaceTsWithNgInErrors` and would pass vacuously while leaking `TS-998101` (RESEARCH Pitfall 2; note `format-report.spec.ts:62` uses a `ts.formatDiagnostics` fake for OTHER assertions -- do NOT copy that for the TS-99 case).

**ANSI/ESC convention** (`render-report.spec.ts:9`): if asserting on control chars, build ESC via `const ESC = String.fromCharCode(0x1b);` -- never a literal control char (CLAUDE.md ASCII rule).

---

### `compiler-cli-types.ts` (MODIFY -- HARD-02 EmitFlags fix + HARD-03 vendor markers)

**Analog:** itself + `diagnostic-codes.ts:56` (the vendor-marker idiom).

**HARD-02 EmitFlags pattern** -- replace the fabricated `None = 0` (`compiler-cli-types.ts:89-91`) with the real members mirrored verbatim (D-08): `DTS=1, JS=2, Metadata=4, I18nBundle=8, Codegen=16, Default=19, All=31`. Keep the `export declare enum` form (it stays erased-at-emit; the existing comment at `:82-88` already explains the ambient-enum rationale). Do NOT touch `run-typecheck.ts:229` `emitFlags: 0 as EmitFlags` -- the CAST is load-bearing (RESEARCH correction to D-08: bare `: EmitFlags = 0` errors TS2322).

**HARD-03 vendor-marker pattern** -- copy the EXACT idiom from `diagnostic-codes.ts:56`:

```typescript
// angular-typechecker: vendored -- mirrors `@angular/compiler-cli` v22.0.4
// ErrorCode.IMPORT_GENERATION_FAILURE = 3004 (src/ngtsc/diagnostics/...:170).
```

Add ONE marker line (containing the literal token `angular-typechecker: vendored`) to each of the 6 constructs enumerated in `10-RESEARCH.md` "HARD-03 vendor-marker enumeration": `TsProgram` intersection (`:45-47`), `Program` subset interface (`:57-80`), `EmitFlags` enum (`:89-91`, post-HARD-02), `UNKNOWN_ERROR_CODE` literal (`:100`), non-optional `PerformCompilationResult.program` (`:143-146`), `ParsedConfiguration` subset (`:109-116`). A single `git grep "angular-typechecker: vendored"` must enumerate all 6 plus the existing 1 in `diagnostic-codes.ts` (>= 6 in this file; HARD-03 verification command is `git grep -c "angular-typechecker: vendored" -- packages/angular-typechecker/src/core/compiler-cli-types.ts`). Marker wording per construct is Claude's discretion (must contain the literal token).

---

### `gather-diagnostics.ts` (MODIFY -- HARD-04 documenting comment)

**Analog:** itself -- the existing rich WHY-comment block (`:1-56`) is the convention to extend.

**Pattern** -- add a documenting comment at/near the `getNgStructuralDiagnostics()` call (`:66`) marking it as a deliberately forward-compatible, no-op-tolerant retained getter (D-10). No code change beyond the comment; the getter is ALREADY in the asserted set (the HARD-01 per-member probe covers it, and `gather-diagnostics.spec.ts:53` already asserts the call). Match the existing block's `D-NN` / `RES-NN` decision-ref comment style.

---

### `project.json` (MODIFY -- add `typecheck-drift` target)

**Analog:** the existing `build` target (`:8-41`) and `test` target (`:45-54`) -- they establish the `executor`/`outputs`/`cache`/`options` JSON shape (NO in-repo `nx:run-commands` precedent exists; this is the first).

**Pattern** -- add a new key under `targets` (alongside `build`/`lint`/`test`). Copy the VERIFIED target JSON from `10-RESEARCH.md` "typecheck-drift target in project.json": `executor: "nx:run-commands"`, `cache: true`, the `inputs` array (the drift file + the shim + `tsconfig.drift.json` + `tsconfig.base.json` + the installed `@angular/compiler-cli` `index.d.ts`/`api.d.ts` -- so a compiler-cli upgrade invalidates the cache, the intended drift trigger), `options.command: "tsc --noEmit -p packages/angular-typechecker/tsconfig.drift.json"`, `cwd: "."`. OMIT `outputs` (no emit -> Nx treats it as a check). Do NOT use `@nx/js:tsc` (RESEARCH anti-pattern: it builds/emits; the drift check emits nothing and needs distinct classic-node resolution).

---

### `tsconfig.lib.json` + `tsconfig.spec.json` (MODIFY -- exclude `*.drift.ts`)

**Analog:** the existing `exclude` array in `tsconfig.lib.json:13-26` and the `include` array in `tsconfig.spec.json:13-27`.

**Pattern** -- in `tsconfig.lib.json`, add `"src/**/*.drift.ts"` to the existing `exclude` list (sits next to `src/**/*.spec.ts`). In `tsconfig.spec.json`, ensure `*.drift.ts` is NOT picked up by the `src/**/*.ts`-adjacent includes -- add an explicit `exclude` for `src/**/*.drift.ts` (the spec tsconfig has no `exclude` block today; add one). RESEARCH Pitfall 3: under nodenext (both lib and spec) the drift file's real-barrel import resolves EMPTY (TS2305) and would break `nx build`/`nx test` -- it must compile ONLY under `tsconfig.drift.json`.

---

### `ci.yml` (MODIFY -- wire `typecheck-drift`)

**Analog:** the existing `test` job (`:84-109`), specifically the run step `:109` `npx nx run-many -t test -p angular-typechecker`.

**Pattern (Option A, RESEARCH-recommended)** -- fold `typecheck-drift` into the existing `run-many` target list (minimal surface; stays inside the path-gated `test` job; matrix re-runs are cheap + cached):

```yaml
- run: npx nx run-many -t typecheck-drift test -p angular-typechecker
```

If Option B (dedicated job) is chosen instead, it MUST follow the existing CI conventions EXACTLY (see Shared Patterns below) AND be added to the `ci` aggregate's `needs: [...]` list (`:189`). Either way the target is OS-independent (depends only on the installed `@angular/compiler-cli` typings).

## Shared Patterns

### Vendored-from-real marker (HARD-03)

**Source:** `diagnostic-codes.ts:56` (the ONLY existing instance)
**Apply to:** every divergent construct in `compiler-cli-types.ts` (6 constructs)

```typescript
// angular-typechecker: vendored -- mirrors `@angular/compiler-cli` v22.0.4 <what + where>
```

Greppable via `git grep "angular-typechecker: vendored"`. The literal token is load-bearing; wording per construct is discretionary.

### NG-code encoding helpers (HARD-01 D-04, HARD-05)

**Source:** `diagnostic-codes.ts` (`NG` `:39`, `ngCodeOf` `:50`) -- dependency-free, production-importable
**Apply to:** the runtime spec (pins `NG(n) === cli.ngErrorCode(n)`) and the HARD-05 spec (`NG(8101)` sanity check). NEVER re-derive `parseInt('-99' + code)` in a spec; import the canonical helpers. Assert NG codes symbolically (`NG(8109)`), never the bare 4-digit number (it would never match the negative-encoded `ts.Diagnostic.code`).

### Integration-spec fixture-path resolution

**Source:** `extended.promotion.integration.spec.ts:1-35`, `global-diagnostics.integration.spec.ts:1-33`
**Apply to:** the runtime spec and (if standalone) the HARD-05 spec

```typescript
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceRoot = join(packageRoot, '..', '..');
```

Then `join(workspaceRoot, 'fixtures', '<name>', 'tsconfig.app.json')` and `await runTypecheck({ tsConfigPath })`.

### Real-`cli.formatDiagnostics` rendering seam (HARD-05)

**Source:** `render-report.ts:61-73` (`renderReport` loads the real `loadCompilerCli()` + private `loadTypescript()` and delegates to `formatReport`); exercised by `render-report.spec.ts:74-81`
**Apply to:** the HARD-05 spec -- go through `renderReport(..., { color: false })`, NOT a `ts.formatDiagnostics` fake (the rewrite `replaceTsWithNgInErrors` runs only inside the real `cli.formatDiagnostics` and is not exported at runtime).

### ASCII-only / ESC-from-charcode

**Source:** `format-report.ts:11` and `render-report.spec.ts:9` -- `String.fromCharCode(0x1b)`
**Apply to:** any new spec that asserts on ANSI/control chars. No emojis, no non-ASCII anywhere in source/comments/output (CLAUDE.md hard rule).

### CI job conventions (if a dedicated `typecheck-drift` job -- Option B)

**Source:** `ci.yml` (the `test`/`e2e` jobs `:84-138` + the threat-model header `:1-19`)
**Apply to:** any new CI job

- SHA-pinned actions ONLY (`actions/checkout@93cb6efe...` `:101`, `actions/setup-node@a0853c24...` `:104`).
- `persist-credentials: false` on every checkout (`:103`).
- `NX_DAEMON: false` env (`:99`).
- Top-level `permissions: contents: read` only (`:27-28`); no job re-grants write.
- Fixed target ids + flags only in run steps (no PR-metadata interpolation).
- A new job MUST be added to the `ci` aggregate `needs: [...]` (`:189`) or the merge gate will not see it.

## No Analog Found

None. Every file has a same-repo analog. The single shape with no in-repo precedent -- the `nx:run-commands` `typecheck-drift` target -- is fully specified by `10-RESEARCH.md` (VERIFIED `nx:run-commands` is built into nx 23.0.1) and uses the existing `build`/`test` target JSON shape from `project.json` as its structural template, so the planner has a concrete pattern to copy.

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/` (shim + gatherer + format/render + specs), `packages/angular-typechecker/` (tsconfigs + project.json), workspace root (`tsconfig.base.json`), `.github/workflows/` (ci.yml).
**Files scanned:** 14 read in full (CONTEXT, RESEARCH, compiler-cli-types.ts, diagnostic-codes.ts, gather-diagnostics.ts, format-report.ts, render-report.ts, 3 tsconfigs + base, project.json, ci.yml, 3 specs) + targeted greps (vendor marker, emitFlags call site, run-commands precedent).
**Pattern extraction date:** 2026-06-29
