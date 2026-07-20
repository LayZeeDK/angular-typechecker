# Phase 25: Extract the advisory-notice seam - Research

**Researched:** 2026-07-16
**Domain:** Internal TypeScript refactor -- lift five Nx-executor advisory helpers into a pure, logger-injected `core/` module (CLI-04)
**Confidence:** HIGH (every claim grounded in this repo's own source + lint config; no web research required)

## Summary

This is a mechanical, byte-identical extraction, not a design problem. The five
advisory `warn*` helpers already live in `executor.ts` as pure functions over
`CoreResult` whose ONLY impurity is referencing the module-level `@nx/devkit`
`logger`. Moving them into a new `core/emit-advisory-notices.ts` and adding a
`logger: Logger` parameter is a copy-paste + parameterize. Because the identifier
inside each helper body is already `logger`, the message strings and control flow
do not change at all -- the only edit per helper is the signature. That verbatim
move is what makes "byte-identical" trivially true.

Two facts de-risk the whole phase. (1) `@nx/devkit`'s `logger` is structurally
assignable to the locked `Logger` shape -- verified against
`node_modules/nx/dist/src/utils/logger.d.ts`: `warn(...v: any[])`, `error(s: any)`,
`info(s: any)`, all bivalently accept a single `string`, so the executor passes
`logger` in with zero adapter. (2) The existing `executor.spec.ts` already drives
all five notices against a mocked `@nx/devkit` logger; as long as the planner does
NOT mock the new `emit-advisory-notices` module in that spec, the real notice
rendering keeps running against the mock logger and the guard survives unchanged.

**Primary recommendation:** Create `core/logger.ts` (the structural `Logger`
interface, imports nothing) and `core/emit-advisory-notices.ts` (the five helpers
moved verbatim + `skippedReferenceVerdictNote` + a public
`emitAdvisoryNotices(result, logger)` that calls them in the current order). In
`executor.ts`, delete the five helpers + `skippedReferenceVerdictNote`, delete the
now-unused `CoreResult` and `SkippedReference` type imports, and replace lines
53-57 with one `emitAdvisoryNotices(result, logger)` call. Add
`core/emit-advisory-notices.spec.ts` asserting exact message text + stream routing
against a mock `Logger`. Do not touch the builder, the barrel, or any string.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Logger seam**
- **D-01:** Add a new `core/logger.ts` exporting a **structural** `Logger`
  interface: `{ info(message: string): void; warn(message: string): void;
  error(message: string): void }`. It imports nothing (satisfies the existing
  `src/core/**` D-11 lint boundary: no `nx`/`@nx/*`/`@angular-devkit/*`, no
  `console`, no `process.exit`). Do NOT reuse or import `@nx/devkit`'s `Logger`
  type -- that would violate the boundary.
- **D-02:** `@nx/devkit`'s `logger` is **structurally assignable** to this
  `Logger` (it already has `info`/`warn`/`error`), so the executor passes
  `logger` in directly with zero adapter/wrapper. A dedicated file (vs an inline
  type in the advisory module) is chosen so Phase 26's console logger and `run()`
  can import `Logger` without pulling in `emit-advisory-notices.ts` or
  `CoreResult`.
- **D-03:** `Logger.error` is part of the contract now even though the five
  advisories use only `info`/`warn` -- it is the seam the CLI's infrastructure
  path routes through in Phase 26. Including it here freezes the full seam shape
  once (this Logger type is the contract every adapter inherits).

**Module contract**
- **D-04:** `core/emit-advisory-notices.ts` exports
  `emitAdvisoryNotices(result: CoreResult, logger: Logger): void` -- synchronous,
  returns void.
- **D-05:** It preserves the **exact current emission order** (the byte-identical
  requirement rests on order + strings): (1) templateCheckAborted, (2)
  skippedReferences -- one notice per reference, (3) suppressed -- third-party
  `logger.info` THEN the in-graph coverage-incomplete `logger.warn`, (4)
  notTypeChecked, (5) bundlerQueryImports. Each fires only under its current
  guard; a clean run stays silent.
- **D-06:** The five current private helpers move into the new module as private
  functions (each `(result, logger)`), and `skippedReferenceVerdictNote` moves
  with `warnSkippedReferences`. All message strings are copied **byte-for-byte**
  -- no rewording, no whitespace change. (Internal helper names are Claude's
  discretion; the message text and routing are what is locked.)

**Executor swap**
- **D-07:** `executor.ts` replaces its five inline `warn*(result)` calls
  (currently lines 53-57) with a single `emitAdvisoryNotices(result, logger)`
  call, importing `emitAdvisoryNotices` from `../../core/emit-advisory-notices`
  and passing the already-imported `@nx/devkit` `logger`. The five helper
  functions AND `skippedReferenceVerdictNote` are DELETED from `executor.ts`.
- **D-08:** The infrastructure-error path stays in the executor: the `catch`
  block's `logger.error(...)` over a thrown `TypecheckInfrastructureError` is
  adapter error-handling, not an advisory over a `CoreResult`, so it does NOT
  move into the seam. (`Logger.error` exists for the CLI's future infra routing,
  not for this phase.)

**Verification**
- **D-09:** Add `core/emit-advisory-notices.spec.ts` (unit, `test` tier) that
  drives `emitAdvisoryNotices` against a **mock `Logger`** recording
  `info`/`warn`/`error` calls, asserting per notice: (a) exact message text and
  (b) stream routing -- advisories/errors via `warn`, the node_modules-suppressed
  count via `info`. Cover a clean `CoreResult` emitting nothing.
- **D-10:** The existing executor + builder specs are the **byte-identical
  regression guard** (criterion 2: "all existing executor and builder tests stay
  green with no behavioral diff"). No new snapshot/golden fixture -- the notice
  output is already asserted there.

### Claude's Discretion
- Internal private-helper names inside the new module (keep
  `warnTemplateCheckAborted` etc., or rename -- message text is what is fixed).
- Whether `emitAdvisoryNotices` calls the five helpers in a straight sequence or
  iterates a small internal list (observably identical).
- Whether `Logger` lives in `core/logger.ts` as its own file vs a `core/logger.ts`
  that also later grows a console impl -- keep it type-only for this phase.

### Deferred Ideas (OUT OF SCOPE)
- Console `Logger` implementation + stdout/stderr routing (CLI-03) -- Phase 26.
- Wiring `Logger.error` to the CLI infrastructure path + `toExitCode` -- Phase 26.
- The CLI itself, `run()`, exit-code wiring, `parse-args` -- Phase 26.
- The generator/schematic `logger.info` notices (`NO_CACHING_NOTICE` /
  `NO_ANGULAR_JSON_NOTICE`) -- generator/schematic UX, not executor advisories,
  untouched by CLI-04.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-04 | The five advisory `warn*` helpers are extracted to a pure `core/emit-advisory-notices.ts` behind an injected structural `Logger`; the Nx executor injects its logger with byte-identical observable behavior (additive/internal, no public-API change). | Helper inventory + verbatim-move strategy (Architecture Patterns), `Logger` structural-assignability proof (Standard Stack / Code Examples), CoreResult field map (below), byte-diff risk catalog (Common Pitfalls), and the regression-guard + new-spec map (Validation Architecture). |

Also honored: **CLI-03 boundary** (the `src/core/**` lint block that auto-enforces
both new files are nx/console/process-free -- see Architecture Patterns) and
**ADD-01** (no public-API change -- the barrel `src/index.ts` is NOT touched; the
executor's observable output is unchanged; verified below).
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Advisory message rendering (the 5 notices) | Pure core (`core/emit-advisory-notices.ts`) | -- | Moving FROM the Nx adapter INTO pure-core-behind-a-logger is the whole point: the CLI (Phase 26) must render notices without importing `executor.ts`/`@nx/devkit`/`chalk`. The `core/**` lint boundary physically guarantees purity. |
| Logger contract (the seam type) | Pure core (`core/logger.ts`) | -- | A structural interface owned by core so every adapter (Nx executor now; CLI `run()` + console logger in Phase 26) inherits ONE contract without a shared runtime dependency. |
| Concrete logger instance | Nx executor adapter (`executor.ts`) | Angular CLI builder (transitively) | The adapter owns I/O: it holds `@nx/devkit`'s `logger` and injects it. Core never constructs a logger. |
| Infrastructure-error routing (`logger.error` in catch) | Nx executor adapter (`executor.ts`) | -- | D-08: this is adapter error-handling over a *thrown* `TypecheckInfrastructureError`, not an advisory over a `CoreResult`. It STAYS in the executor; only `Logger.error`'s *existence* is added to the seam for Phase 26. |
| Detection (the structured advisory fields) | Pure core (`run-typecheck.ts`, `walk-references.ts`, `detect-*.ts`) | -- | UNCHANGED. Core already only COUNTS/records; this phase moves the RENDERING half into core-but-pure. The detection/rendering split is preserved because the module still performs no I/O of its own. |

## Standard Stack

**No new packages.** This phase adds zero runtime or dev dependencies (consistent
with ADD-01 and the milestone's "zero new dependency" charter). It uses only what
is already installed and pinned:

| Tool | Version | Role in this phase | Provenance |
|------|---------|--------------------|------------|
| `typescript` | `6.0.3` (peer `>=6.0.0 <6.1.0`) | Type-checks the two new `.ts` files against the current `CoreResult` | [VERIFIED: repo `CLAUDE.md` locked stack + peer range] |
| `@nx/vitest` (`@nx/vitest:test`) / `vitest` | `23.0.1` / `4.x` | Runs the new unit spec on the `test` tier | [VERIFIED: `packages/angular-typechecker/project.json` targets + `vitest.config.mts`] |
| `@nx/devkit` `logger` | `23.0.1` | The concrete logger the executor injects; structurally assignable to `Logger` | [VERIFIED: `node_modules/nx/dist/src/utils/logger.d.ts`] |

### `@nx/devkit` logger structural-assignability proof (D-02)

`@nx/devkit` re-exports `nx`'s `logger`. Its declared shape
(`node_modules/nx/dist/src/utils/logger.d.ts`, verified this session):

```ts
export declare const logger: {
    warn: (...v: any[]) => void;
    error: (s: any) => void;
    info: (s: any) => void;
    log: (...s: any[]) => void;
    debug: (...s: any[]) => void;
    fatal: (...s: any[]) => void;
    verbose: (...s: any[]) => void;
};
```

The locked `Logger` (D-01) requires `info(message: string): void`,
`warn(message: string): void`, `error(message: string): void`. Each nx method is
assignable to the corresponding `Logger` method: a `(s: any) => void` /
`(...v: any[]) => void` accepts a single `string` argument (parameter bivariance +
rest-param widening), and both return `void`. So the concrete `logger` object is
structurally assignable to `Logger` -- `emitAdvisoryNotices(result, logger)`
type-checks with no wrapper. [VERIFIED: node_modules type def]

Note two things for the planner:
1. `@nx/devkit` exports NO named `Logger` *type* -- `logger` is an anonymous
   object const. So D-01's "define our own `Logger`" is not merely a boundary
   choice; there is no devkit type to reuse even if the boundary allowed it.
2. The `src/core/**` lint boundary bans `@nx/devkit`/`@nx/*` imports **including
   type-only imports** (`allowTypeImports` is omitted -- see `eslint.config.mjs`
   lines 8-9 comment). So a `import type { ... } from '@nx/devkit'` inside the new
   core module would be a lint error at `maxWarnings:0`. The homegrown `Logger` is
   the only legal shape. [VERIFIED: `eslint.config.mjs`]

## Package Legitimacy Audit

**Not applicable -- this phase installs zero external packages.** No slopcheck /
registry verification needed. All imports in the two new files are relative
core-internal modules (`./logger`, `./run-typecheck`, `./walk-references`) plus the
already-present Vitest test globals.

## CoreResult field inventory for the seam (research Q3)

Every field the five helpers read, its type, and its optionality on the current
`CoreResult` (from `core/run-typecheck.ts`). Because `emit-advisory-notices.ts`
imports `CoreResult` as a **type-only** import from `./run-typecheck` (allowed --
core-internal), the moved module type-checks against the live shape automatically;
no structural adaptation is needed.

| Field | Type | Optional? | Read by | How read |
|-------|------|-----------|---------|----------|
| `templateCheckAborted` | `TemplateCheckAborted` (`{ code: number; fileName: string \| undefined }`) | **optional** (`?`) | `warnTemplateCheckAborted` | `=== undefined` guard; `.fileName ?? 'an unknown file'` |
| `skippedReferences` | `readonly SkippedReference[]` | **optional** (`?`) | `warnSkippedReferences` | `?.length` guard; loop `.referencePath`, `.reason`; `.reason` -> `skippedReferenceVerdictNote` |
| `suppressedThirdParty` | `number` | **required** | `warnSuppressed` | `> 0` guard; interpolated count (`logger.info`) |
| `suppressedInGraphErrorCount` | `number` | **required** | `warnSuppressed` | `> 0` guard (OR); interpolated count (`logger.warn`) |
| `suppressedInGraphWarningCount` | `number` | **required** | `warnSuppressed` | `> 0` guard (OR); interpolated count (`logger.warn`) |
| `suppressedInGraphFiles` | `readonly string[]` | **required** | `warnSuppressed` | `.join(', ')` in the warn body |
| `notTypeCheckedDeclaredFiles` | `readonly string[]` | **optional** (`?`) | `warnNotTypeChecked` | `?.length` guard; `.length` + `.join(', ')` |
| `bundlerQueryImports` | `readonly string[]` | **optional** (`?`) | `warnBundlerQueryImports` | `?.length` guard; `.length` + `.join(', ')` |

**Asymmetry the mock-Logger spec must respect:** the four `suppressed*` fields are
**always present** (required, defaulting to `0` / `[]`), while the other four
advisory fields are **optional** (core maps empty `[]` / absent -> `undefined`). So
a "clean" `CoreResult` fixture must set the four suppressed fields explicitly to
`0`/`[]` and may omit the optional four. The existing `coreResult(errorCount)`
factory in `executor.spec.ts` (lines 67-80) already encodes exactly this shape and
is the template to copy.

`SkippedReference['reason']` union (from `walk-references.ts`, used by
`skippedReferenceVerdictNote`'s switch): `'out-of-project' | 'zero-root-names' |
'self-reference' | 'duplicate' | 'not-found'`. The note branches on `'not-found'`
and `'zero-root-names'`; every other reason falls to the default advisory tail.
[VERIFIED: `walk-references.ts` lines 95-100, `executor.ts` lines 152-171]

## Architecture Patterns

### Seam structure (data flow)

```
runTypecheck(coreOptions)              [core, pure]
        |
        v  CoreResult (structured advisory fields, already detected)
        |
   executor.ts (Nx adapter)
        |  holds @nx/devkit `logger`
        v
   emitAdvisoryNotices(result, logger)  [core/emit-advisory-notices.ts, PURE]
        |   \--- imports Logger from ./logger  [core/logger.ts, PURE, imports nothing]
        |
        v  in fixed order, each self-gated:
        |    (1) warnTemplateCheckAborted -> logger.warn?
        |    (2) warnSkippedReferences    -> logger.warn* (one per reference)
        |    (3) warnSuppressed           -> logger.info? THEN logger.warn?
        |    (4) warnNotTypeChecked       -> logger.warn?
        |    (5) warnBundlerQueryImports  -> logger.warn?
        v
   logger.info / logger.warn  (concrete @nx/devkit sink; Nx chrome + stderr routing)

   [Phase 26 CLI: run() injects a CONSOLE logger into the SAME emitAdvisoryNotices]
```

The diagram is the contract: `emit-advisory-notices.ts` performs NO I/O -- it only
calls the injected `logger`. The concrete sink is chosen by the caller. That is why
the CLI can reuse it without ever reaching `@nx/devkit`.

### Recommended new files

```
packages/angular-typechecker/src/core/
├── logger.ts                    # NEW: structural Logger interface (imports nothing)
├── emit-advisory-notices.ts     # NEW: emitAdvisoryNotices + 5 private helpers + skippedReferenceVerdictNote
└── emit-advisory-notices.spec.ts# NEW: unit spec, mock Logger, exact strings + routing
```

### Pattern 1: Verbatim move + parameterize (the byte-identical mechanism)

**What:** Cut each helper body from `executor.ts` unchanged; add `, logger: Logger`
to its signature. The body already uses the identifier `logger`, so nothing inside
the body -- no string, no `+` concatenation, no `${...}` interpolation -- changes.

**When to use:** This is the whole phase. Do not "tidy" anything.

**Example (before -> after, `warnTemplateCheckAborted`):**
```ts
// BEFORE (executor.ts, module-level `logger` from @nx/devkit)
function warnTemplateCheckAborted(result: CoreResult): void {
  if (result.templateCheckAborted === undefined) { return; }
  const offendingFile = result.templateCheckAborted.fileName ?? 'an unknown file';
  logger.warn(`angular-typechecker: a fatal template-compilation error ...`);
}

// AFTER (core/emit-advisory-notices.ts, injected `logger: Logger`)
function warnTemplateCheckAborted(result: CoreResult, logger: Logger): void {
  if (result.templateCheckAborted === undefined) { return; }
  const offendingFile = result.templateCheckAborted.fileName ?? 'an unknown file';
  logger.warn(`angular-typechecker: a fatal template-compilation error ...`); // string UNCHANGED
}
```

### Pattern 2: Public entry preserving order (D-05)

```ts
export function emitAdvisoryNotices(result: CoreResult, logger: Logger): void {
  warnTemplateCheckAborted(result, logger);
  warnSkippedReferences(result, logger);
  warnSuppressed(result, logger);
  warnNotTypeChecked(result, logger);
  warnBundlerQueryImports(result, logger);
}
```
(A `for` loop over `[warnTemplateCheckAborted, ...]` is observably identical and is
Claude's discretion -- but a straight sequence is the laziest and reads 1:1 against
executor lines 53-57.)

### Anti-Patterns to Avoid
- **Rewording or reflowing any message string during the move.** Any character
  change is a byte-diff. The strings are copied, never retyped.
- **Adding an adapter/wrapper around `@nx/devkit`'s `logger`.** D-02: it is already
  assignable; wrapping is dead code.
- **Mocking `emit-advisory-notices` in `executor.spec.ts`.** That would sever the
  real notice rendering from the regression guard (see Validation Architecture).
- **Exporting `Logger` / `emitAdvisoryNotices` from `src/index.ts`.** Not needed;
  the executor (and Phase 26's CLI) reach them by relative import, exactly as the
  executor reaches `evaluate-result` / `render-report` today. Touching the barrel
  would be an unnecessary public-API surface change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A logger abstraction | A class, a factory, a `createLogger`, or an nx-wrapper | A 3-method `interface Logger` (D-01) | One interface with structural assignability is the entire seam. A class/factory is speculative Phase-26 work and violates the "type-only for this phase" discretion note. |
| Byte-identical fixtures | A new snapshot/golden file | The existing `executor.spec.ts` assertions + a verbatim copy | D-10: notice output is already asserted; the copy-paste is what guarantees identity. |
| A test double for the logger | A mock library or a `vi.mock('@nx/devkit')` | A plain object literal `{ info: vi.fn(), warn: vi.fn(), error: vi.fn() }` passed directly | The seam is injected, so the spec just constructs the mock and calls the pure function -- the repo's pure-core spec convention (e.g. `detect-bundler-query-imports.spec.ts`). |

**Key insight:** The seam's value is that it is *thin*. The lazy version -- an
interface + a verbatim function move + a plain-object mock -- is also the correct
version. There is nothing to abstract.

## Runtime State Inventory

This is a pure source-movement refactor (extract functions within one package). No
runtime state is renamed, migrated, or re-registered.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None -- verified: no datastore, key, or ID references the moved code. | None |
| Live service config | None -- verified: no external service configuration references these helpers. | None |
| OS-registered state | None -- verified: no Task Scheduler / pm2 / systemd entry involved. | None |
| Secrets/env vars | None -- verified: the helpers read only `CoreResult` fields; no secret/env name changes. | None |
| Build artifacts | Stale `dist/packages/angular-typechecker` after adding two source files. | `nx build angular-typechecker` (the `test`/`integration` targets already `dependsOn: build`, so a normal test run rebuilds). No package reinstall needed -- internal file addition only. |

**Barrel note:** `src/index.ts` is NOT changed (see Anti-Patterns), so there is no
published-API artifact drift and no `@nx/dependency-checks` impact.

## Common Pitfalls

### Pitfall 1: Silent whitespace / concatenation byte-diff
**What goes wrong:** The messages are multi-line `+`-concatenated template strings
where each segment carries a trailing space before the line break (e.g.
`` `...aborted Angular template type-check-block ` + `generation. Surviving files' ` ``).
Dropping or adding one space, or joining two segments, changes the rendered bytes
while still passing the substring (`stringContaining`) assertions in
`executor.spec.ts`.
**Why it happens:** Editors/formatters can collapse or re-wrap long string
concatenations; a manual retype loses a boundary space.
**How to avoid:** Do a literal cut-paste of the helper bodies -- never retype them.
After the move, `git diff` the moved lines: the ONLY change per helper must be the
signature (`+ , logger: Logger`). Prettier will not reflow string *contents*, so a
clean move shows zero interior changes.
**Warning signs:** A diff that touches any character between the backticks.

### Pitfall 2: `warnSuppressed` emits TWO notices in a fixed sub-order
**What goes wrong:** `warnSuppressed` fires `logger.info` (node_modules third-party
count) THEN, separately, `logger.warn` (in-graph coverage-incomplete). Both can fire
in the same call. Reordering them, or folding them into one branch, changes stream
routing (info vs warn) and order.
**How to avoid:** Preserve the two independent `if` blocks in their current order
(info block first, warn block second -- `executor.ts` lines 190-212).
**Warning signs:** A single combined guard, or the warn emitted before the info.

### Pitfall 3: `warnSkippedReferences` is a per-reference loop, not one message
**What goes wrong:** Collapsing the `for (const skipped of result.skippedReferences)`
loop into a single joined `logger.warn`. The current behavior is ONE `logger.warn`
per skipped reference (the `executor.spec.ts` "one warn per skipped reference (two
entries -> two warns)" test at lines 288-326 pins this).
**How to avoid:** Keep the loop verbatim; keep `skippedReferenceVerdictNote` as a
sibling private function moved alongside it.

### Pitfall 4: Leaving unused type imports in `executor.ts`
**What goes wrong:** After deleting the helpers, `executor.ts`'s
`import type { CoreResult }` (line 6) and `import type { SkippedReference }`
(line 11) become unused. ESLint (`maxWarnings:0`) will flag them.
**How to avoid:** Delete both type imports in the same edit. Verify the remaining
executor imports (`evaluateResult`, `renderReport`, `runTypecheck` +
`TypecheckInfrastructureError`, `normalizeOptions`, `logger`, `ExecutorContext`,
`TypecheckExecutorOptions`) are all still referenced -- they are.

### Pitfall 5: Accidentally mocking the new module in the executor spec
**What goes wrong:** If a plan adds `vi.mock('../../core/emit-advisory-notices')` to
`executor.spec.ts` "for isolation", the real notice rendering stops running and the
byte-identical guard evaporates (the mock swallows every `logger` call).
**How to avoid:** Leave `executor.spec.ts`'s mock list exactly as-is (it mocks
`run-typecheck`, `render-report`, `evaluate-result`, `normalize-options`, and
`@nx/devkit` -- NOT `emit-advisory-notices`). The real `emitAdvisoryNotices` then
runs against the mocked `@nx/devkit` logger, and all existing notice assertions keep
firing.

## Code Examples

### `core/logger.ts` (D-01) -- structural interface, imports nothing
```ts
// core/ is framework-agnostic (D-11 lint boundary): this file imports NOTHING, so
// it can never reach nx/@nx/@angular-devkit/console/process. It is the ONE seam
// contract every adapter (Nx executor now; the Phase-26 CLI run()/console logger)
// injects a concrete logger against.
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void; // D-03: reserved for the CLI infra path (Phase 26)
}
```

### `core/emit-advisory-notices.ts` (D-04/D-05/D-06) -- shape only; bodies moved verbatim
```ts
import type { Logger } from './logger';
import type { CoreResult } from './run-typecheck';
import type { SkippedReference } from './walk-references';

export function emitAdvisoryNotices(result: CoreResult, logger: Logger): void {
  warnTemplateCheckAborted(result, logger);
  warnSkippedReferences(result, logger);
  warnSuppressed(result, logger);
  warnNotTypeChecked(result, logger);
  warnBundlerQueryImports(result, logger);
}

// ... the five private helpers + skippedReferenceVerdictNote, MOVED VERBATIM from
// executor.ts (lines 88-264), each gaining only `, logger: Logger`. No string edits.
```
All three imports are type-only and core-internal, so the D-11 boundary permits them.
[VERIFIED: `eslint.config.mjs` bans only `nx`/`@nx/*`/`@angular-devkit/*`/`yargs`.]

### `core/emit-advisory-notices.spec.ts` (D-09) -- mock-Logger pattern
Mirrors the repo's pure-core spec convention (call the pure function directly; no
`vi.mock`). Build the mock as a plain object of `vi.fn()`s:
```ts
import { describe, expect, it, vi } from 'vitest';

import { emitAdvisoryNotices } from './emit-advisory-notices';
import type { Logger } from './logger';
import type { CoreResult } from './run-typecheck';

function mockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}

// Reuse the required-vs-optional field shape (the four suppressed* fields are
// always present; the other four advisory fields are omitted when clean).
function cleanResult(): CoreResult {
  return {
    tsConfigPath: '/ws/tsconfig.lib.json',
    rootNamesCount: 1,
    diagnostics: [],
    errorCount: 0,
    warningCount: 0,
    suppressedThirdParty: 0,
    suppressedInGraphErrorCount: 0,
    suppressedInGraphWarningCount: 0,
    suppressedInGraphFiles: [],
    durationMs: 1,
  };
}

describe('emitAdvisoryNotices (CLI-04)', () => {
  it('stays silent on a clean CoreResult', () => {
    const logger = mockLogger();
    emitAdvisoryNotices(cleanResult(), logger);
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('routes the node_modules-suppressed count via info, coverage-incomplete via warn', () => {
    const logger = mockLogger();
    emitAdvisoryNotices(
      { ...cleanResult(), suppressedThirdParty: 3,
        suppressedInGraphErrorCount: 1,
        suppressedInGraphFiles: ['/ws/libs/dep/src/broken.ts'] },
      logger,
    );
    expect(logger.info).toHaveBeenCalledWith(
      // EXACT string (D-09) -- copy the byte-for-byte message from the moved helper
      'angular-typechecker: 3 node_modules diagnostic(s) suppressed (expected; pass includeDeps to include them).',
    );
    expect(logger.warn).toHaveBeenCalledTimes(1); // in-graph coverage-incomplete
  });
});
```
Because D-09 asks for EXACT message text (stronger than `executor.spec.ts`'s
substring checks), this spec is the true byte-exact anchor. Copy each expected
string straight from the moved helper body.
[Pattern source: `core/detect-bundler-query-imports.spec.ts`, `core/evaluate-result.spec.ts`.]

## State of the Art

Not applicable -- no library/version landscape to survey. This is an internal
refactor against a locked, already-shipped stack (`angular-typechecker@0.2.1`). The
"current approach" for cross-adapter reuse in this repo IS the detection(core)/
rendering(adapter) split already documented in `run-typecheck.ts` and
`walk-references.ts`; this phase extends it by making the rendering pure-but-injected.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The line numbers cited (executor `53-57`, `88-264`, `75-85`; imports `6`, `11`) match the working tree at plan time. | Executor swap / Common Pitfalls | Low -- read this session from HEAD. If the file changed between research and execution, re-locate by symbol name (`warnTemplateCheckAborted`, etc.), which is stable. |

**Everything else is VERIFIED against repo source read this session** (executor.ts,
run-typecheck.ts, walk-references.ts, eslint.config.mjs, project.json,
vitest.config.mts, executor.spec.ts, builder.ts, and the nx logger type def in
node_modules). No web/registry claims were made.

## Open Questions

None. The phase is fully specified by CONTEXT.md (D-01..D-10) and the source is
unambiguous. The single soft choice (straight-sequence vs internal-list dispatch in
`emitAdvisoryNotices`) is explicitly Claude's discretion and observably identical
either way.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x via `@nx/vitest:test` |
| Config file | `packages/angular-typechecker/vitest.config.mts` (unit `test` tier; excludes `**/*.integration.spec.ts`) |
| Quick run command | `npx nx test angular-typechecker` (rebuilds first -- `dependsOn: build`) |
| Full suite command | `npx nx test angular-typechecker && npx nx run angular-typechecker:integration && npx nx lint angular-typechecker && npx nx typecheck angular-typechecker` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-04 | `emitAdvisoryNotices` renders each notice's EXACT text + correct stream (info vs warn) against a mock Logger, and stays silent on a clean result | unit | `npx nx test angular-typechecker` (new `core/emit-advisory-notices.spec.ts`) | Wave 0 |
| CLI-04 | Executor emits byte-identical notices through the injected logger; all existing notice assertions + call-count + stream-routing stay green | unit (regression guard, D-10) | `npx nx test angular-typechecker` (existing `executors/typecheck/executor.spec.ts`) | Exists |
| CLI-04 | Builder still IS the executor (`convertNxExecutor(typecheckExecutor)`, no forked engine) -- structural parity guard | unit + integration | `npx nx test angular-typechecker` + `:integration` (`builders/typecheck/builder.spec.ts`, `builder.integration.spec.ts`) | Exists |
| CLI-03 boundary | The two new `core/` files import no nx/console/process | lint | `npx nx lint angular-typechecker` (existing `src/core/**` D-11 block) | Exists (rule) |
| ADD-01 | No public-API/barrel change | typecheck + existing drift/barrel guards (`dual-identity-tripwire.spec.ts`, `package-manifest.spec.ts`) | `npx nx typecheck` + `npx nx test` | Exists |

**The regression guard, precisely:** `executor.spec.ts` mocks `run-typecheck`,
`render-report`, `evaluate-result`, `normalize-options`, and `@nx/devkit` (supplying
`logger` = `{ error, info, warn }` as `vi.fn()`s), then drives the executor's default
export. It asserts, per advisory: the correct `loggerWarn`/`loggerInfo` calls,
call counts (e.g. one warn per skipped reference; exactly-once for single-notice
cases), stream routing (info for node_modules; warn for coverage-incomplete), key
message substrings (`INCOMPLETE`, `NG3004`, `SUPPRESSED`, `vite/client`, `ADVISORY`,
`may not be fully type-checked`, `coverage-incomplete`, etc.), the no-false-positive
silent paths, and `loggerError NOT called` for advisories. After the extraction the
executor calls `emitAdvisoryNotices(result, logger)` (NOT mocked), so the real
helpers run against the mock logger and every one of these assertions still fires --
that is the "no behavioral diff" proof for criterion 2. (Caveat: these are substring
assertions, so `executor.spec.ts` alone does not catch a byte-diff *elsewhere* in a
message. The new `emit-advisory-notices.spec.ts` with EXACT-string assertions (D-09)
is the byte-exact anchor; combined with the verbatim-move discipline, byte identity
holds.)

### Sampling Rate
- **Per task commit:** `npx nx test angular-typechecker` (fast unit tier; runs both
  the new spec and the executor/builder regression guard).
- **Per wave merge:** add `npx nx run angular-typechecker:integration` +
  `npx nx lint angular-typechecker` + `npx nx typecheck angular-typechecker`.
- **Phase gate:** full suite green (unit + integration + lint + typecheck) before
  `/gsd:verify-work`. Lint at `maxWarnings:0` is a hard gate (catches the unused
  import in Pitfall 4 and any accidental banned import in the new core files).

### Wave 0 Gaps
- [ ] `packages/angular-typechecker/src/core/logger.ts` -- the `Logger` interface (D-01).
- [ ] `packages/angular-typechecker/src/core/emit-advisory-notices.ts` -- covers CLI-04.
- [ ] `packages/angular-typechecker/src/core/emit-advisory-notices.spec.ts` -- covers CLI-04 (D-09).
- No framework install needed (Vitest + `@nx/vitest` already configured). No shared
  fixture/conftest needed -- fixtures are inline `CoreResult` factories (copy the
  `coreResult()` shape from `executor.spec.ts`).

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled),
but this phase introduces **no new trust boundary**. The advisory strings interpolate
only values already present on `CoreResult` -- file paths derived from the consumer's
own tsconfig/project graph and integer counts -- which the existing helpers already
render. Content-isolation (never emitting a dependency's diagnostic *message* text;
naming only the consumer's own files) is a property of the CURRENT helper bodies and
is preserved verbatim by the move.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation / Output Encoding | marginally | The sink is a logger (stderr/stdout), not a web/SQL/shell sink; no encoding needed. Interpolated data is trusted (consumer's own paths/counts). No change vs 0.2.1. |
| V2/V3/V4/V6 (auth/session/access/crypto) | no | This phase touches none of these -- it moves log-rendering functions between files. |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Log injection via a malicious path in a notice | Tampering / Repudiation | Out of scope and unchanged: paths come from the consumer's own resolved tsconfig; the logger is not a structured/parsed sink. No new exposure introduced by the move. |

## Sources

### Primary (HIGH confidence -- read this session)
- `packages/angular-typechecker/src/executors/typecheck/executor.ts` -- the five helpers (lines 88-264), `skippedReferenceVerdictNote` (152-171), call site (53-57), infra `catch` (75-85), type imports (6, 11).
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `CoreResult` shape + advisory field types/optionality (lines 54-140).
- `packages/angular-typechecker/src/core/walk-references.ts` -- `SkippedReference['reason']` union (lines 85-101).
- `packages/angular-typechecker/eslint.config.mjs` -- the `**/src/core/**/*.ts` D-11 boundary (no nx/@nx/@angular-devkit/yargs, no-console, no process.exit; type-only imports also banned).
- `packages/angular-typechecker/src/executors/typecheck/executor.spec.ts` -- the byte-identical regression guard (mock structure + all notice assertions).
- `packages/angular-typechecker/src/builders/typecheck/builder.ts` + `builder.spec.ts` -- `convertNxExecutor(typecheckExecutor)` re-export + structural parity guard.
- `packages/angular-typechecker/project.json` -- `test` (`dependsOn: build`) + `integration` targets.
- `packages/angular-typechecker/vitest.config.mts` -- unit tier include/exclude (excludes `*.integration.spec.ts`).
- `packages/angular-typechecker/src/index.ts` -- public barrel (confirms no change needed).
- `packages/angular-typechecker/src/core/detect-bundler-query-imports.spec.ts`, `core/evaluate-result.spec.ts` -- pure-core spec convention (direct call, no `vi.mock`).
- `node_modules/nx/dist/src/utils/logger.d.ts` -- `logger` shape proving structural assignability to `Logger`.
- `.planning/phases/25-extract-the-advisory-notice-seam/25-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/config.json`.

### Secondary / Tertiary
- None. No web or registry lookups were required or performed.

## Metadata

**Confidence breakdown:**
- Standard stack (no new deps): HIGH -- zero packages added; existing stack verified in project.json/vitest config.
- Architecture (verbatim move + injected Logger): HIGH -- helpers read this session; move is mechanical; structural assignability proven against node_modules type def.
- Pitfalls (byte-diff risks): HIGH -- derived directly from the concatenation/loop/routing structure in the actual helper bodies and the executor.spec assertions.
- Validation: HIGH -- the guard spec and its mock structure were read in full; the new-spec pattern mirrors two existing pure-core specs.

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (stable internal refactor; only invalidated if `executor.ts`/`CoreResult`/the lint boundary changes before execution -- re-locate helpers by symbol name if line numbers drift).
