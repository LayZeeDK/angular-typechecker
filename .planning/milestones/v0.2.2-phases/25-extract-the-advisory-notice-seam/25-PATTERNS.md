# Phase 25: Extract the advisory-notice seam - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 4 (3 CREATE, 1 MODIFY)
**Analogs found:** 4 / 4

All analogs are IN THIS CODEBASE (`packages/angular-typechecker/src/**`). No
external/reference-plugin patterns needed. This is a mechanical verbatim lift, so
the "primary source" for the new advisory module is the existing `executor.ts`
helper bodies themselves -- copied byte-for-byte.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/logger.ts` | type-only contract module | (none -- pure interface) | `src/core/run-typecheck.ts` `TemplateCheckAborted` (149-156) + `diagnostic-codes.ts` doc-header (1-26) | shape-match |
| `src/core/emit-advisory-notices.ts` | pure-core utility (render-behind-injected-sink) | transform / event-emit (side effects via injected `Logger`) | `src/executors/typecheck/executor.ts` five `warn*` helpers (98-264) -- VERBATIM source | exact (same code, moving) |
| `src/core/emit-advisory-notices.spec.ts` | unit test (pure core, mock collaborator) | request-response (call pure fn, assert stub calls) | `src/core/evaluate-result.spec.ts` (direct call) + `src/executors/typecheck/executor.spec.ts` (logger `vi.fn()` capture + `coreResult()` factory) | role-match (composite) |
| `src/executors/typecheck/executor.ts` | Nx executor adapter | request-response | self (in-place edit) | n/a |

## Pattern Assignments

### `src/core/logger.ts` (type-only contract, imports nothing)

No existing `src/core/*.ts` imports literally nothing, but two established
conventions define the shape exactly:

**Analog 1 -- small named interface with a doc comment** (`src/core/run-typecheck.ts` lines 142-156):
```typescript
/**
 * RES-02: details of a detected TCB-generation Fatal that suppressed surviving
 * files' Angular template/extended diagnostics. ...
 */
export interface TemplateCheckAborted {
  code: number;
  fileName: string | undefined;
}
```
`SkippedReference` (`src/core/walk-references.ts` lines 76-101) is the same convention: a
`export interface` carrying a doc block explaining the seam. Copy this shape for
`Logger`.

**Analog 2 -- the "dependency-free core module" doc convention** (`src/core/diagnostic-codes.ts` lines 1-26, and `src/core/exit-codes.ts` lines 1-24): both open with a block comment that states purity ("intentionally DEPENDENCY-FREE", "PURITY (D-07 / eslint `**/src/core/**`): ... NO process side effects"). `logger.ts` should carry the same one-paragraph rationale (it is the seam contract every adapter injects; imports nothing so it can never reach nx/console/process -- the D-11 boundary).

**Target content (from RESEARCH.md Code Examples, D-01/D-03):**
```typescript
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void; // D-03: reserved for the CLI infra path (Phase 26)
}
```
`error` is part of the contract even though the five advisories use only `info`/`warn`.

---

### `src/core/emit-advisory-notices.ts` (pure-core utility, injected `Logger`)

**Primary analog / source:** `src/executors/typecheck/executor.ts` lines 88-264 --
the five `warn*` helpers PLUS `skippedReferenceVerdictNote`. These MOVE VERBATIM.
Per helper, the ONLY edit is the signature: append `, logger: Logger`. No string,
no `+` concatenation, no `${...}` interpolation changes. Do a literal cut-paste,
never retype (Pitfall 1: a dropped boundary space is a byte-diff that still passes
the substring assertions in `executor.spec.ts`).

**Exact emission order (D-05 -- byte-identical rests on this):** the public entry
calls the five in this fixed sequence, mirroring executor.ts lines 53-57:
```typescript
import type { Logger } from './logger';
import type { CoreResult } from './run-typecheck';
import type { SkippedReference } from './walk-references';

export function emitAdvisoryNotices(result: CoreResult, logger: Logger): void {
  warnTemplateCheckAborted(result, logger);   // (1)
  warnSkippedReferences(result, logger);       // (2) one warn PER reference
  warnSuppressed(result, logger);              // (3) info THEN warn (two streams)
  warnNotTypeChecked(result, logger);          // (4)
  warnBundlerQueryImports(result, logger);     // (5)
}
```
All three imports are type-only + core-internal, so the D-11 boundary permits them.

**Helper 1 -- `warnTemplateCheckAborted`** (executor.ts 98-114). Guard `=== undefined`;
`.fileName ?? 'an unknown file'`; single `logger.warn`. Signature after move:
```typescript
function warnTemplateCheckAborted(result: CoreResult, logger: Logger): void {
```

**Helper 2 -- `warnSkippedReferences`** (executor.ts 127-139) + its sibling
`skippedReferenceVerdictNote` (executor.ts 152-171, MOVES ALONGSIDE). This is a
per-reference LOOP -- ONE `logger.warn` per skipped reference, NOT one joined
message (Pitfall 3; pinned by executor.spec.ts "one warn per skipped reference"):
```typescript
function warnSkippedReferences(result: CoreResult, logger: Logger): void {
  if (!result.skippedReferences?.length) {
    return;
  }

  for (const skipped of result.skippedReferences) {
    logger.warn(
      `angular-typechecker: tsconfig '${skipped.referencePath}' was skipped ` +
        `or reclassified (reason: ${skipped.reason}). ` +
        skippedReferenceVerdictNote(skipped.reason),
    );
  }
}
```
`skippedReferenceVerdictNote(reason: SkippedReference['reason']): string` switches
on `'not-found'` and `'zero-root-names'`; every other reason hits the default
advisory tail. Keep it a private sibling function.

**Helper 3 -- `warnSuppressed`** (executor.ts 189-213). The ONLY two-stream helper:
`logger.info` (node_modules third-party count) THEN, in a separate `if`, `logger.warn`
(in-graph coverage-incomplete). Preserve BOTH independent `if` blocks in this order
-- info first, warn second (Pitfall 2: folding them or reordering changes stream
routing). Verbatim:
```typescript
function warnSuppressed(result: CoreResult, logger: Logger): void {
  if (result.suppressedThirdParty > 0) {
    logger.info(
      `angular-typechecker: ${result.suppressedThirdParty} node_modules diagnostic(s) ` +
        `suppressed (expected; pass includeDeps to include them).`,
    );
  }

  if (
    result.suppressedInGraphErrorCount > 0 ||
    result.suppressedInGraphWarningCount > 0
  ) {
    logger.warn(
      `angular-typechecker: this run's coverage is INCOMPLETE -- ` +
        `${result.suppressedInGraphErrorCount} error(s) and ` +
        `${result.suppressedInGraphWarningCount} warning(s) on first-party files were ` +
        `dropped by the project boundary. ...` +
        `${result.suppressedInGraphFiles.join(', ')}.`,
    );
  }
}
```

**Helper 4 -- `warnNotTypeChecked`** (executor.ts 225-237). Guard `?.length`; single
`logger.warn` interpolating `.length` + `.join(', ')`.

**Helper 5 -- `warnBundlerQueryImports`** (executor.ts 252-264). Guard `?.length`;
single `logger.warn` interpolating `.length` + `.join(', ')`.

**Info-vs-warn routing summary:** ONLY `warnSuppressed`'s node_modules-count line uses
`logger.info`. Every other emission across all five helpers uses `logger.warn`.
`logger.error` is NOT used by any advisory (it stays in the executor's catch block).

**Purity-convention analog** for the module doc header + no-I/O discipline:
`src/core/detect-bundler-query-imports.ts` and `src/core/exit-codes.ts` -- pure
functions over structured input, doc comment stating "PURE ... no `console`/`process`".

---

### `src/core/emit-advisory-notices.spec.ts` (unit, mock `Logger`)

Composite of two existing conventions:

**Analog A -- direct-call pure-core spec, no `vi.mock`** (`src/core/evaluate-result.spec.ts` lines 1-11):
```typescript
import { describe, expect, it } from 'vitest';

import { evaluateResult } from './evaluate-result';

describe('evaluateResult', () => {
  it('fails as type-error when errorCount > 0 ...', () => {
    expect(evaluateResult({ errorCount: 1, warningCount: 0 })).toEqual({
      success: false,
      outcome: 'type-error',
    });
  });
```
`detect-bundler-query-imports.spec.ts` is the same shape (build a synthetic input,
call the pure fn directly, assert the result -- no module mocking).

**Analog B -- logger stub as plain `vi.fn()` object + `CoreResult` factory** (`src/executors/typecheck/executor.spec.ts`). The logger mock (lines 26-29, 56-65):
```typescript
loggerError: vi.fn(),
loggerInfo: vi.fn(),
loggerWarn: vi.fn(),
// ...
vi.mock('@nx/devkit', () => {
  return {
    logger: { error: mocks.loggerError, info: mocks.loggerInfo, warn: mocks.loggerWarn },
    joinPathFragments: (...parts: string[]) => parts.join('/'),
  };
});
```
For the new spec there is NO `vi.mock('@nx/devkit')` -- the seam is injected, so
build the stub as a plain object and pass it in (RESEARCH Code Examples):
```typescript
function mockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}
```

**The `CoreResult` fixture factory** -- copy `coreResult()` verbatim from
`executor.spec.ts` lines 67-80. It encodes the required-vs-optional asymmetry the
mock spec must respect: the four `suppressed*` fields are ALWAYS present (set to
`0`/`[]`); the four advisory fields (`templateCheckAborted`, `skippedReferences`,
`notTypeCheckedDeclaredFiles`, `bundlerQueryImports`) are optional and omitted when
clean:
```typescript
function coreResult(errorCount: number): CoreResult {
  return {
    tsConfigPath: '/ws/libs/x/tsconfig.lib.json',
    rootNamesCount: 1,
    diagnostics: [],
    errorCount,
    warningCount: 0,
    suppressedThirdParty: 0,
    suppressedInGraphErrorCount: 0,
    suppressedInGraphWarningCount: 0,
    suppressedInGraphFiles: [],
    durationMs: 1,
  };
}
```
The per-advisory override factories in `executor.spec.ts` (`abortedCoreResult` 84-89,
`skippedRefsCoreResult` 95-102, `suppressedCoreResult` 108-123) are ready-made
override shapes to reuse.

**D-09 assertions:** per notice assert (a) EXACT message text (copy each string
byte-for-byte from the moved helper -- stronger than executor.spec's substring
checks; this spec is the byte-exact anchor) and (b) stream routing (`logger.info` for
node_modules-suppressed count; `logger.warn` for everything else). Cover a clean
`CoreResult` emitting nothing (`expect(logger.info/warn/error).not.toHaveBeenCalled()`).

---

### `src/executors/typecheck/executor.ts` (MODIFY)

**Edit 1 -- swap the call site** (lines 53-57). Replace the five `warn*(result)` calls
with one call, keeping the surrounding comment intent:
```typescript
// current 53-57:
    warnTemplateCheckAborted(result);
    warnSkippedReferences(result);
    warnSuppressed(result);
    warnNotTypeChecked(result);
    warnBundlerQueryImports(result);
// becomes:
    emitAdvisoryNotices(result, logger);
```

**Edit 2 -- add the import** near line 4-5 (relative core import, same style as the
existing `evaluateResult`/`renderReport` imports):
```typescript
import { emitAdvisoryNotices } from '../../core/emit-advisory-notices';
```

**Edit 3 -- delete lines 88-264** (the five helper definitions + `skippedReferenceVerdictNote`
+ their doc blocks). They now live in the new module.

**Edit 4 -- delete the now-unused type imports** (Pitfall 4 -- `maxWarnings:0` lint gate):
- line 6: `import type { CoreResult } from '../../core/run-typecheck';`
- line 11: `import type { SkippedReference } from '../../core/walk-references';`

Verify the SURVIVING imports are still referenced (they are): `ExecutorContext` +
`logger` (`@nx/devkit`), `evaluateResult`, `renderReport`, `runTypecheck` +
`TypecheckInfrastructureError`, `normalizeOptions`, `TypecheckExecutorOptions`.

**Edit 5 -- DO NOT TOUCH the infra catch** (lines 75-82, D-08). The
`logger.error(...)` over a thrown `TypecheckInfrastructureError` is adapter
error-handling, not an advisory over a `CoreResult` -- it STAYS:
```typescript
  } catch (error) {
    if (error instanceof TypecheckInfrastructureError) {
      logger.error(
        `angular-typechecker: the Angular compiler failed to run (infrastructure error, not a type error): ${error.message}`,
      );
      return { success: false };
    }
    throw error;
  }
```

**DO NOT** add `vi.mock('../../core/emit-advisory-notices')` to `executor.spec.ts`
(Pitfall 5): the real `emitAdvisoryNotices` must keep running against the mocked
`@nx/devkit` logger so the existing notice assertions remain the byte-identical
regression guard (D-10).

## Shared Patterns

### `src/core/**` purity boundary (D-11 -- auto-enforced, no new rule)
**Source:** `packages/angular-typechecker/eslint.config.mjs` lines 16-64.
**Applies to:** both new core files (`logger.ts`, `emit-advisory-notices.ts`).
The block scoped to `**/src/core/**/*.ts` bans (including type-only imports --
`allowTypeImports` omitted): `nx`, `@nx/devkit`, `@nx/*`, `@angular-devkit/*`,
`yargs`; plus `no-console: error` and `process.exit` via `no-restricted-properties`.
Consequence: a `import type { Logger } from '@nx/devkit'` in the new module is a
lint error -- the homegrown `Logger` is the only legal shape (there is also no named
`Logger` type exported by `@nx/devkit` anyway; `logger` is an anonymous const).

### TS/JS style (AGENTS.md + CLAUDE.md)
**Applies to:** all three new files.
- Blank line before/after `if`/`for`/`return` (except first/last line in a block).
  The moved helper bodies ALREADY follow this (see executor.ts 99-101, 128-130) --
  the verbatim move preserves it; do not reformat.
- Always braces for control-flow bodies (the helpers already comply).
- ASCII-only; `"singleQuote": true`. Template literals stay as-is (byte-identical).

### Detection(core)-vs-rendering(adapter) split (documented convention)
**Source:** doc blocks in `run-typecheck.ts` (CoreResult 54-140) and
`walk-references.ts` (17-40, 76-101).
**Applies to:** `emit-advisory-notices.ts`. Core COUNTS/records the structured
fields; the module renders them but performs NO I/O of its own -- the caller owns the
concrete logger. This phase moves the RENDERING into core-but-pure (behind the
injected `Logger`); the split holds because the module takes no sink of its own.

## No Analog Found

None. Every file has a concrete in-repo analog.

## Metadata

**Analog search scope:** `packages/angular-typechecker/src/core/**` (55 files),
`packages/angular-typechecker/src/executors/typecheck/**`,
`packages/angular-typechecker/eslint.config.mjs`.
**Files scanned:** executor.ts, executor.spec.ts, run-typecheck.ts, walk-references.ts,
evaluate-result.spec.ts, detect-bundler-query-imports.spec.ts, exit-codes.ts,
diagnostic-codes.ts, eslint.config.mjs.
**Line-number verification:** all RESEARCH.md line anchors (executor 53-57 call site,
88-264 helpers, 152-171 verdict-note, 75-85 catch, imports 6+11; coreResult factory
67-80) match the working tree at map time.
**Pattern extraction date:** 2026-07-16
