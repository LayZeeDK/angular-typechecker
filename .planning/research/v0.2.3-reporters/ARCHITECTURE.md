# Architecture Research -- Machine-readable reporters (JSON + SARIF)

**Domain:** Nx plugin / Angular type-check tool -- adding reporter formats to an existing shared core
**Researched:** 2026-07-18
**Confidence:** HIGH (verified against `packages/angular-typechecker/src/` as shipped through v0.2.2)

## Headline finding (read first)

**The reporter seam already exists.** `core/render-report.ts` exposes
`renderReport(result, options): Promise<string>` -- a single async dispatcher every
adapter already calls identically:

- Nx executor: `executor.ts:56` -> `renderReport(result, { pathBase, color, failFast })`
- Standalone CLI: `cli/main.ts:157` -> `renderReport(result, { pathBase, color, failFast })`
- Angular CLI builder: `builders/typecheck/builder.ts` is `convertNxExecutor(typecheckExecutor)` -- it re-exports the executor verbatim, so it inherits the seam with **zero** builder-local code.

So v0.2.3 is NOT "build a reporter subsystem." It is: **(1) widen the existing
`renderReport` dispatcher with a `format` discriminator, (2) add two pure formatter
functions beside the existing human `formatReport`, (3) thread one `--format`/`format`
enum through the three adapter entry points (CLI arg + two schemas), (4) add one
optional `totalFilesCount` field to `CoreResult`.** Everything mirrors patterns already
in the tree (`formatReport`, `emit-advisory-notices`, the `Logger` seam, the
`presentIfNonEmpty` idiom). No architectural invention required.

## Standard Architecture

### System Overview (as it exists + the additive seam)

```
+---------------------------------------------------------------+
|                         Adapters                              |
|  (own I/O: stdout/stderr, process.exit, path base, --format)  |
|                                                               |
|  +---------------+   +---------------+   +----------------+    |
|  | Nx executor   |   | CLI run()     |   | Angular builder|    |
|  | executor.ts   |   | cli/main.ts   |   | convertNx-     |    |
|  |               |   |               |   | Executor(exec) |    |
|  +-------+-------+   +-------+-------+   +--------+-------+    |
|          |                   |                    |            |
|          |  normalizeOptions |  parse-args        | (inherits) |
+----------|-------------------|--------------------|------------+
           |                   |                    |
           v                   v                    v
+---------------------------------------------------------------+
|                     Pure core (no I/O)                        |
|                                                               |
|   runTypecheck(CoreOptions) --> CoreResult                    |
|          (+ NEW optional totalFilesCount, verdict-neutral)    |
|                                                               |
|   renderReport(result, { format, color, pathBase, failFast }) |
|          |  dispatch on format                                |
|          +-- 'human'  -> formatReport(dx, ng, ts)   (exists)  |
|          +-- 'json'   -> formatJsonReport(result,ts) (NEW,    |
|          |                                   no dep)          |
|          +-- 'sarif'  -> await import('./sarif-report')  (NEW,|
|                          lazy node-sarif-builder)             |
|                                                               |
|   evaluateResult(result, opts) --> { success, outcome }       |
|          (UNTOUCHED -- verdict never sees the format)         |
|   toExitCode(...)  (UNTOUCHED -- exit codes never see format) |
|   emitAdvisoryNotices(result, Logger) (UNTOUCHED; --quiet     |
|          gates whether an adapter CALLS it)                   |
+---------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | v0.2.3 change |
|-----------|----------------|---------------|
| `core/render-report.ts` (`renderReport`) | THE dispatch seam; loads compiler-cli/ts, delegates to a formatter | MODIFY: add `format` to `RenderOptions`; widen result param `Pick<CoreResult,'diagnostics'>` -> `CoreResult`; branch on format; load `compiler-cli` only in the `human` branch |
| `core/format-report.ts` (`formatReport`) | Pure human formatter over injected `ng`/`ts` | UNCHANGED (the `human` branch calls it verbatim) |
| `core/json-report.ts` (`formatJsonReport`) | Pure JSON serializer over `CoreResult` | NEW (no dependency) |
| `core/sarif-report.ts` (`formatSarifReport`) | Pure SARIF 2.1.0 serializer; owns the repo-relative URIs | NEW (lazy `node-sarif-builder`) |
| `core/run-typecheck.ts` (`CoreResult`, `finalize`) | Engine + result assembly | MODIFY: add optional `totalFilesCount` (additive, verdict-neutral) |
| `core/evaluate-result.ts` | Pure pass/fail verdict | UNTOUCHED |
| `core/exit-codes.ts` (`toExitCode`) | 0/1/2 mapping | UNTOUCHED |
| `core/emit-advisory-notices.ts` | Advisory `warn*` over injected `Logger` | UNTOUCHED (`--quiet` is an adapter gate, not a seam change) |
| Adapters (executor / CLI / builder) | Own stdout, exit, path base, and now `--format`/`format` selection | MODIFY: thread the format enum in |

## Reporter seam design (Question 1)

### Confirmed: reporters stay PURE over `CoreResult`

The existing `formatReport` (format-report.ts) is the exact template: no `console`, no
`process.exit`, no compiler import at module scope, injected `ng`/`ts`, returns a
`string`. The new JSON + SARIF reporters follow the same contract:

- **Input:** a `CoreResult` (already sorted + deduped diagnostics per D-09; already
  boundary-filtered per D-06). Reporters NEVER re-sort, re-filter, or re-count.
- **Output:** a `string`. The adapter writes it to stdout (executor `process.stdout.write`;
  CLI returns it as `RunResult.stdout`).
- **No verdict, no I/O, no exit.** The verdict comes from `evaluateResult` on the SAME
  `CoreResult`, independently of which string was rendered. Changing `--format` can never
  change pass/fail or the exit code.

This matches the `detection(core) vs rendering(adapter)` split already documented across
`emit-advisory-notices.ts` and the `TemplateCheckAborted`/`skippedReferences` fields.

### The dispatcher signature (MODIFY `render-report.ts`)

```typescript
export type ReportFormat = 'human' | 'json' | 'sarif';

export interface RenderOptions {
  format: ReportFormat;        // NEW (adapters default to 'human')
  pathBase?: string;           // existing -- ALSO the SARIF repo-relative URI base
  color: boolean;              // existing (human only; ignored by json/sarif)
  failFast?: boolean;          // existing (human/json truncation is a display choice)
}

export async function renderReport(
  result: CoreResult,          // WIDENED from Pick<CoreResult, 'diagnostics'>
  options: RenderOptions,
): Promise<string> {
  const ts_ = await loadTypescript();       // already warm (runTypecheck loaded it)

  switch (options.format) {
    case 'json':
      return formatJsonReport(result, ts_);        // no compiler-cli, no dep
    case 'sarif': {
      const { formatSarifReport } = await import('./sarif-report'); // lazy
      return formatSarifReport(result, ts_, options.pathBase);
    }
    case 'human':
    default: {
      const ng = await loadCompilerCli();          // load ONLY for human
      return formatReport(result.diagnostics, ng, ts_, {
        pathBase: options.pathBase,
        color: options.color,
        failFast: options.failFast,
      });
    }
  }
}
```

Two deliberate lazinesses baked in above:

1. `loadCompilerCli()` moves INTO the `human` branch. The JSON/SARIF machine paths do not
   need `@angular/compiler-cli` (a heavy ESM peer), so they skip it -- cleaner for CI/agent
   loops. `ts` is still loaded (needed for `flattenDiagnosticMessageText`), but it is
   already memoized-warm from `runTypecheck`.
2. `node-sarif-builder` is reached ONLY through `await import('./sarif-report')` -- see
   Question 4.

`renderReport` is NOT exported from the barrel (`index.ts` exports only `runTypecheck`
+ types), so widening its signature is an internal change -- no public-API break, honoring
the additive-only charter. The spec `render-report.spec.ts` passes `{ diagnostics: [...] }`
literals and will need `format: 'human'` added + a widened stub; that is a test update, not
a contract break.

### JSON reporter shape (`core/json-report.ts`, REP-01)

Pure `formatJsonReport(result: CoreResult, ts: typeof import('typescript')): string`.
Needs `ts` only for `flattenDiagnosticMessageText` (to flatten a
`DiagnosticMessageChain`); line/column come from `diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)`
(a method on the source file, no namespace needed); severity is the numeric
`diagnostic.category`. The exact JSON schema (field names, whether to emit the NG-decoded
code label vs the raw negative `ts.Diagnostic.code`, 0- vs 1-based line/col) is a REP-01
requirements decision -- but the DATA it draws from is entirely present on `CoreResult`
today (`diagnostics`, `errorCount`, `warningCount`, `tsConfigPath`, the suppressed
counters, and the NEW `totalFilesCount`). Recommend `JSON.stringify(payload, null, 2)`
with a top-level `{ version, tsConfigPath, summary: { errorCount, warningCount,
totalFilesCount, ... }, diagnostics: [...] }` -- a stable, documented, agent-parseable
shape. No dependency.

## `--format` threading through each adapter (Question 2)

All three adapters must default to `human` so today's behavior is byte-identical when
`--format` is omitted (additive charter).

### CLI (`src/cli/`) -- MODIFY 2 files

- `parse-args.ts`:
  - add `format: { type: 'string' }` to the `parseArgs` options;
  - validate it against the enum (`human`/`json`/`sarif`), else `usageError` (mirror the
    `--max-warnings` non-integer guard at parse-args.ts:151);
  - add `format: ReportFormat` to `ParsedOptions` (default `'human'` when the flag is
    absent);
  - CLIX-02: add `quiet: { type: 'boolean' }`, `color: { type: 'boolean' }`, and the
    `--no-color` negation (`util.parseArgs` supports `--no-color` when `color` is a boolean
    option) -> carry `quiet` + an explicit `color?: boolean` on `ParsedOptions`;
  - update `HELP_TEXT` (a drift-locked string; `standalone-cli-docs.spec.ts` /
    `parse-args.spec.ts` assert it).
- `main.ts` (`run()`):
  - pass `format: parsed.format` into `renderReport`;
  - CLIX-02 color precedence: `colorFromEnv` (main.ts:58) gains an explicit override --
    `parsed.color ?? colorFromEnv(env)` (explicit `--color`/`--no-color` WINS over
    NO_COLOR/FORCE_COLOR/TTY);
  - CLIX-02 `--quiet`: skip `emitAdvisoryNotices(result, logger)` (main.ts:155) when
    `parsed.quiet` (or route it to a null logger) so machine output on stderr stays clean.

### Nx executor (`src/executors/typecheck/`) -- MODIFY 3 files

- `schema.json`: add a `format` property (`"type": "string"`, `"enum": ["human","json","sarif"]`,
  `"default": "human"`). `additionalProperties: false` means the property MUST be declared.
- `schema.d.ts` (`TypecheckExecutorOptions`): add `format?: 'human' | 'json' | 'sarif'`.
  (Both schema-parity specs bind `EXPECTED_KEYS` to `keyof TypecheckExecutorOptions`, so
  this is the single source of truth -- see below.)
- `normalize-options.ts`: add `format` to `NormalizedOptions` (`options.format ?? 'human'`)
  and forward it to `renderReport` in `executor.ts:56`.
- (Optional) surface `quiet`/`color` on the executor schema too for CI parity; the milestone
  scopes CLIX-02 to the CLI, so this is optional. Do NOT expand scope unless requirements ask.

### Angular CLI builder (`src/builders/typecheck/`) -- MODIFY 2 files, builder.ts UNCHANGED

Verified: the builder has its OWN `schema.json` (an Architect-dialect sanitized copy with no
`cli`/`version`/`$id`) but REUSES the executor's `schema.d.ts` (`TypecheckExecutorOptions`)
-- there is no builder-local `.d.ts`. So:

- `builders/typecheck/schema.json`: add the same `format` enum property.
- `builder.ts`: UNCHANGED -- it is `convertNxExecutor(typecheckExecutor)`; the option flows
  through the shared `TypecheckExecutorOptions` + `normalizeOptions`.

### Parity specs (MODIFY both)

`executors/typecheck/schema-parity.spec.ts` and `builders/typecheck/schema-parity.spec.ts`
each pin `EXPECTED_KEYS` to `keyof TypecheckExecutorOptions` (a compile-time
`satisfies` + reverse-coverage `AssertAssignable`). Adding `format` to the interface
without adding it to both `EXPECTED_KEYS` arrays fails the type-check -- so both specs MUST
gain `'format'` and a default-value assertion. This is the guard that keeps the three
schemas honest; treat updating it as part of the wiring, not an afterthought.

## `totalFilesCount` -- where it is computed + surfaced (Question 3)

### Placement: capture at the program, carry via the additive-field idiom

`CoreResult` already carries `rootNamesCount` (declared input `.ts` count).
`totalFilesCount` is the DISTINCT "@nx/js parity" number: how many source files the
program actually pulled in (transitive imports + libs). It is NOT derivable from
`rootNamesCount`.

- **Direct single-leaf path** (`run-typecheck.ts`): after `runNoEmitCompilation`, the
  program survives -- `result.program.getTsProgram().getSourceFiles()` is in scope
  (gather-diagnostics.ts already iterates exactly this in `gatherAllDiagnostics`). Count it
  there (guard `result.program === undefined`, already handled).
- **Walk + multi-tsconfig paths**: programs are per-leaf and discarded inside
  `gatherLeafInto` (walk-references.ts:145). Add accumulation there. Because leaves SHARE
  `lib.d.ts` + transitive files, a naive sum double-counts -- so accumulate a
  `Set<string>` of source-file names on `LeafAccumulator` and carry `set.size`. (`gatherLeafInto`
  already calls `runNoEmitCompilation`, whose `result.program` exposes `getSourceFiles()`.)

### Carry it without touching the verdict

Attach it the same way the codebase attaches other optional fields -- a conditional spread
onto the `finalize`/`finalizeUnion` result (mirroring
`...presentIfNonEmpty('notTypeCheckedDeclaredFiles', ...)` and the
`...(templateCheckAborted !== undefined ? {...} : {})` idiom at run-typecheck.ts:905):

```typescript
// CoreResult
totalFilesCount?: number;   // OBS-01: additive, verdict-neutral; @nx/js parity

// on the return
...(totalFilesCount !== undefined ? { totalFilesCount } : {}),
```

`evaluateResult` MUST NOT read it (its `EvaluateInput` Pick deliberately omits it -- keep
it omitted). The JSON reporter surfaces `result.totalFilesCount` in its `summary`; human
and SARIF ignore it (SARIF's `invocation` is out of scope -- keep it lazy). A plan-time
decision remains: count all source files (raw @nx/js parity) vs non-declaration only (a more
meaningful "files checked"); recommend non-declaration for agent usefulness, but flag it for
REQUIREMENTS.

## The lazy `node-sarif-builder` import (Question 4)

`node-sarif-builder` (v3.x, MIT, CommonJS; transitive `fs-extra`) must load ONLY when
`--format sarif` is requested. Two-layer laziness, both inside the reporter, never in an
adapter:

1. `renderReport`'s `sarif` branch does `const { formatSarifReport } = await import('./sarif-report')`
   -- a dynamic import of OUR module. Under `module: nodenext` + CJS this defers the
   `require('./sarif-report')` until that branch runs (same bridge GATE A proved for
   compiler-cli; dynamic `import()` is NOT downleveled to `require()`).
2. `core/sarif-report.ts` can then `import { SarifBuilder, SarifRunBuilder, SarifResultBuilder }
   from 'node-sarif-builder'` at its own top -- readable, normal. Because the module is
   only reached via (1), `node-sarif-builder` (and `fs-extra`) is required only on the SARIF
   path. The human, JSON, `--help`/`--version`, and usage-error paths never touch it.

**Reconciliation with the CLI's nx-free / lean-startup posture:** `cli/main.ts` imports
`renderReport` (pure core). The invariant is simply that `render-report.ts`'s STATIC imports
must never include `node-sarif-builder` -- it currently statically imports only
`compiler-loader`, `format-report`, `load-typescript` (all fine); the JSON reporter is a
safe static import (no dep); the SARIF module is reached ONLY dynamically. So CLI startup
(and the `bin-static.spec.ts` require-graph probe) never pulls SARIF or its `fs-extra` into
the boot path. The `src/cli/**` ESLint import-ban is about `@nx/devkit`/`nx`, orthogonal to
this and unaffected.

`@nx/dependency-checks` still sees `node-sarif-builder` imported somewhere in the graph, so
classify it as a `dependency` (per PROJECT.md) -- lazy loading does not change its
dependency classification, only its runtime load timing. Add a `sarif-report.js` require-graph
guard test (modeled on `bin-static.spec.ts`) asserting `render-report.js` does NOT statically
require `node-sarif-builder`, to lock the laziness.

## SARIF `artifactLocation.uri` normalization (Question 5)

GitHub Code Scanning requires each result's
`physicalLocation.artifactLocation.uri` to be **repo-relative, forward-slash**, no `..`.

### The builder API + the trap

`node-sarif-builder`'s `SarifResultBuilder.initSimple({ level, messageText, ruleId, fileUri,
startLine, startColumn, endLine, endColumn })` constructs the underlying
`physicalLocation -> artifactLocation -> uri` (+ `region`) from `fileUri`. **The library's
own example computes `fileUri` from `process.cwd()` (toggled by a `SARIF_URI_ABSOLUTE` env
var). Do NOT use that path.** angular-typechecker owns the URI and passes a pre-computed
repo-relative forward-slash string as `fileUri` -- exactly the PROJECT.md charter line
("angular-typechecker still owns the realpath-normalized, workspace-root-relative
artifactLocation URIs and feeds them to the builder").

### Where the repo root is known per adapter (the `pathBase` already flowing in)

The relativization base is `RenderOptions.pathBase`, which every adapter already computes and
threads into `renderReport`:

- **Nx executor:** `pathBase = context.root` (the workspace root) -- normalize-options.ts:64.
- **Angular CLI builder:** same -- `context.root` via `convertNxExecutor`'s `ExecutorContext`.
- **Standalone CLI:** `pathBase = process.cwd()` -- main.ts:142.

So `formatSarifReport(result, ts, pathBase)` computes, per diagnostic with a `file`:

```typescript
const uri = path.relative(pathBase, diagnostic.file.fileName).replace(/\\/g, '/');
```

This reuses the SAME "realpath-normalized + `\\`->`/`" convention already in the tree
(`filter-diagnostics.ts` `createCanonicalizer`; the CLI's `toAbsoluteTsConfigPath`
`realpathSync.native + .replace(/\\/g,'/')`; the human host's `pathBase`-relative
`getCurrentDirectory`). The diagnostics on `CoreResult` are already realpath-normalized by
the boundary filter, so `path.relative` against `pathBase` yields a clean repo-relative,
forward-slash URI.

### Edge cases (plan decisions)

- **File-less diagnostics** (synthesized 90001/90002 guards, global TS diagnostics): no
  `diagnostic.file` -> no `physicalLocation`. Emit a SARIF result with no location (valid),
  or attach to the tsconfig. Recommend: no-location result, message carries the text.
- **`pathBase` for the CLI is `process.cwd()`**, not guaranteed to be the repo root. In CI
  (the Code Scanning use case) the SARIF is generated from the checkout root, so cwd == repo
  root is the normal case. Document: "run the CLI from the repo/checkout root for correct
  Code Scanning URIs" -- consistent with the existing CLI `pathBase` semantics; no new
  mechanism.
- **`includeDeps: true`** can surface out-of-`pathBase` files -> `path.relative` yields
  `../..`. The DEFAULT boundary filter excludes those, so this is only an `includeDeps` edge;
  document it (Code Scanning URIs assume in-repo files).

## Data flow (Question, end-to-end)

```
adapter parses/normalizes options (format, color, quiet, pathBase)
        |
        v
runTypecheck(CoreOptions) --> CoreResult  (+ totalFilesCount, verdict-neutral)
        |
        +--> emitAdvisoryNotices(result, Logger)   [skipped when --quiet]
        |
        +--> renderReport(result, { format, color, pathBase, failFast })
        |         format = 'human' -> formatReport (compiler-cli + ts)
        |         format = 'json'  -> formatJsonReport (ts only)
        |         format = 'sarif' -> await import('./sarif-report')
        |                              -> node-sarif-builder + repo-relative URIs
        |         returns a STRING
        |
        +--> adapter writes the string to stdout (raw; not through the Logger)
        |
        +--> evaluateResult(result, { maxWarnings, strict }) --> { success }
                  |  (never sees `format`)
                  v
             exit code: executor {success}; CLI toExitCode 0/1/2
```

The verdict path (right side) and the render path (middle) both consume the SAME
`CoreResult` independently. `--format` only ever changes the middle string.

## Recommended build order (Question 6)

Three phases, ordered by dependency (the shared seam first, the dep-carrying reporter second,
proof/docs last):

### Phase 1 -- Reporter seam + JSON reporter + `totalFilesCount` (REP-01 + OBS-01 + CLIX-02)

- Widen `render-report.ts` (`format` enum `human`/`json`; widen result param to `CoreResult`;
  move `loadCompilerCli` into the human branch).
- Add pure `core/json-report.ts` (`formatJsonReport`) -- no dependency.
- Add `CoreResult.totalFilesCount` capture (direct path + `gatherLeafInto` Set-dedupe);
  confirm `evaluateResult` still ignores it.
- Thread `--format` (+ `--quiet`, `--color`/`--no-color`) through ALL THREE adapters:
  CLI `parse-args`/`main`; executor `schema.json`/`schema.d.ts`/`normalize-options`; builder
  `schema.json`; both schema-parity specs (add `'format'` to `EXPECTED_KEYS`).
- Verify: JSON shape snapshot unit test; `--format json` end-to-end on all three adapters;
  human default byte-identical.
- Rationale: JSON is the no-dependency reporter, and the `--format` plumbing is identical for
  all formats, so establishing the widened seam + full threading here unblocks SARIF cleanly.

### Phase 2 -- SARIF reporter (REP-02)

- Add `node-sarif-builder` as a `dependency` (policed by `@nx/dependency-checks`).
- Add `core/sarif-report.ts` (`formatSarifReport`) reached ONLY via `await import()` from the
  seam's sarif branch; compute repo-relative forward-slash URIs from `pathBase`; feed them as
  `fileUri` to `SarifResultBuilder.initSimple`.
- Widen the format enum to add `'sarif'` across the three schemas + parity specs.
- Verify: SARIF unit snapshot validated against the SARIF 2.1.0 schema; a require-graph guard
  asserting the human/JSON/CLI-boot paths never load `node-sarif-builder`.
- Rationale: depends on Phase 1's widened seam + enum; isolates the one new dependency and the
  URI logic in a single phase.

### Phase 3 -- Shipped-tarball e2e + docs (verification + DOC)

- Extend the tarball e2e to prove the SHIPPED surfaces emit valid JSON + SARIF (all three
  adapters).
- README `## Machine-readable output` section (JSON schema, SARIF + `upload-sarif` recipe,
  the `pathBase`/CWD caveat); curated CHANGELOG entry in end-user language.
- Rationale: proof + docs land after both reporters work.

## What stays UNTOUCHED (verified, load-bearing)

| Area | Why it is untouched |
|------|---------------------|
| `evaluate-result.ts` (verdict, `Outcome`) | Reporters never call it; `renderReport` computes no verdict. `--format` cannot change pass/fail. |
| `exit-codes.ts` (`toExitCode`, 0/1/2) | Exit codes derive from `evaluateResult(...).success` / infra errors, never from the chosen format. |
| `format-report.ts` (human) | The `human` branch calls it verbatim; the human report is byte-identical when `--format` is omitted. |
| `run-typecheck` engine behavior (diagnostics, counts, boundary filter, walk) | Only additive `totalFilesCount` capture -- never affects `diagnostics`/`errorCount`/`warningCount`/verdict. |
| `emit-advisory-notices.ts` + the `Logger` seam | Unchanged; `--quiet` is an adapter-level gate on whether the adapter CALLS the seam. |
| `builder.ts` (`convertNxExecutor`) | Inherits `format` through the shared options; no builder-local code. |
| Barrel `index.ts` public API (`runTypecheck`, `CoreOptions`, `CoreResult`) | `CoreResult` gains an OPTIONAL field (additive); `renderReport` is not exported, so widening it is internal. |

## Anti-patterns (avoid during implementation)

### Anti-Pattern 1: A separate reporter subsystem / a `formatted` field on `CoreResult`
**What people do:** invent a `ReporterRegistry`, or have the engine pre-render output onto
`CoreResult`.
**Why it is wrong:** the seam already exists (`renderReport`); a registry is speculative
abstraction for exactly 3 formats, and a `formatted` field re-couples rendering into the pure
engine (the D-02 resolution deliberately avoided this).
**Do this instead:** widen `renderReport`'s `switch`; add two pure functions beside
`formatReport`.

### Anti-Pattern 2: Loading `node-sarif-builder` at module scope
**What people do:** `import { SarifBuilder } from 'node-sarif-builder'` at the top of
`render-report.ts` or an adapter.
**Why it is wrong:** every human/JSON run and every CLI startup then pays the load (+ its
`fs-extra` transitive) -- defeating the lean-startup posture and the milestone charter.
**Do this instead:** reach it ONLY through `await import('./sarif-report')` in the sarif
branch; guard the laziness with a require-graph test.

### Anti-Pattern 3: Deriving the SARIF URI from `process.cwd()` / the library default
**What people do:** rely on `node-sarif-builder`'s `SARIF_URI_ABSOLUTE` example that uses
`path.relative(process.cwd(), ...)`.
**Why it is wrong:** the executor/builder root is `context.root`, not necessarily cwd; using
cwd yields wrong Code Scanning URIs under Nx/ng.
**Do this instead:** compute `path.relative(pathBase, file.fileName).replace(/\\/g,'/')` and
pass it as `fileUri`; `pathBase` is the root each adapter already threads in.

### Anti-Pattern 4: Letting `--format` reach the verdict or exit code
**What people do:** special-case exit codes or verdict for machine formats.
**Why it is wrong:** breaks the invariant that a run's pass/fail is independent of how it is
displayed; a JSON run that exits differently than a human run is a silent-false-pass hazard.
**Do this instead:** keep `renderReport` a pure string producer; `evaluateResult`/`toExitCode`
consume the SAME `CoreResult` regardless of format.

## Internal boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| adapter <-> core | `renderReport(result, options)` returns a string; adapter owns stdout | The ONE seam; identical for all three adapters (builder inherits) |
| `renderReport` <-> `sarif-report.ts` | dynamic `await import()` | The laziness boundary; keeps `node-sarif-builder` off the human/JSON/boot paths |
| `sarif-report.ts` <-> `node-sarif-builder` | `SarifResultBuilder.initSimple({ fileUri, ... })` | angular-typechecker computes the repo-relative URI; the builder assembles physicalLocation |
| core <-> `evaluateResult`/`toExitCode` | reads counts off `CoreResult`, never the format | verdict/exit stay format-agnostic |

## Sources

- In-repo verification (HIGH), `packages/angular-typechecker/src/`, as shipped v0.2.2:
  `core/render-report.ts` (the existing seam + `RenderOptions`), `core/format-report.ts`
  (pure-formatter template), `core/run-typecheck.ts` (`CoreResult`, `finalize`,
  `finalizeUnion`, `presentIfNonEmpty` idiom), `core/gather-diagnostics.ts`
  (`getSourceFiles()` iteration), `core/walk-references.ts` (`LeafAccumulator`,
  `gatherLeafInto`), `core/evaluate-result.ts` (untouched verdict), `core/logger.ts`,
  `core/emit-advisory-notices.ts`, `cli/main.ts` + `cli/parse-args.ts` + `cli/console-logger.ts`,
  `executors/typecheck/{executor,normalize-options,schema.d,schema.json}.ts/json` +
  `schema-parity.spec.ts`, `builders/typecheck/{builder.ts,schema.json,schema-parity.spec.ts}`,
  `index.ts`.
- `.planning/PROJECT.md` (v0.2.3 charter -- REP-01/REP-02/OBS-01/CLIX-02, lazy-`import()`
  requirement, `node-sarif-builder` classification) + `.planning/milestones/v0.2.2-REQUIREMENTS.md`
  (CLI/adapter contracts, `run()` shape) -- HIGH.
- [node-sarif-builder -- npm](https://www.npmjs.com/package/node-sarif-builder) and
  [nvuillam/node-sarif-builder (GitHub)](https://github.com/nvuillam/node-sarif-builder) --
  MEDIUM: v3.x, CommonJS, `SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder`,
  `initSimple({ fileUri, startLine, startColumn, endLine, endColumn, level, messageText, ruleId })`
  maps to `physicalLocation.artifactLocation.uri` + `region`; `buildSarifJsonString({ indent })`.

---
*Architecture research for: machine-readable reporters (JSON + SARIF) in angular-typechecker*
*Researched: 2026-07-18*
