# Phase 30: Reporter seam + JSON reporter + `--format` threading + observability - Research

**Researched:** 2026-07-18
**Domain:** Additive machine-readable reporter (JSON) + `--format`/`--quiet`/`--color` threading over a shipped multi-adapter Angular type-check core
**Confidence:** HIGH (grounded line-by-line in the shipped v0.2.2 source; the milestone research at `.planning/research/v0.2.3-reporters/` already covers this phase at HIGH confidence, so this document SYNTHESIZES it and pins every claim to a concrete `packages/angular-typechecker/src/...` file + line)

> This is a "standard patterns / skip deep research" phase (SUMMARY.md line 112-113: "Phase 1 (seam + JSON) ... pure application of shipped patterns"). No ecosystem was re-derived. Web research touched exactly one gap (the `util.parseArgs` `--no-color` negation contract). The planner should be able to write `30-01`/`30-02`/`30-03` PLAN.md directly from the seams cited below without re-reading the codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from `30-CONTEXT.md ## Implementation Decisions`)

**JSON payload shape (REP-01)**
- **D-01:** Carry BOTH the humanized `code` string (`TS####` / `NG8xxx` / `ATC9000x`, via the shipped `ngCodeOf`) AND the raw `rawCode` int per diagnostic.
- **D-02:** Flat top-level `diagnostics[]` (NOT ESLint-style per-file nesting) + a `summary` object. Each diagnostic: `file` (repo-relative path or `null` for file-less), 1-based `line`/`column`/`endLine`/`endColumn`, `code`, `rawCode`, `severity`, `message`. `summary` carries the discriminated `outcome` (`clean`/`type-error`/`coverage-incomplete`/`warnings-exceeded`), category counts, `totalFilesCount`, and the structured suppression/advisory fields (`suppressedInGraph*`, `templateCheckAborted`, `skippedReferences`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`) as DATA.
- **D-03:** Emit a `formatVersion` integer marker (start at **1**) + the tool `version`; drift-lock the payload key set with a spec that mirrors the shipped `schema-parity` / `EXPECTED_KEYS` tripwire pattern.
- **D-04:** Do NOT publish a hosted `$schema` URL this milestone (deferred to REP-04). `formatVersion` + the drift-lock is the stability contract for now.
- **D-05:** Do NOT surface a non-deterministic `durationMs` in the JSON payload (keeps snapshots byte-stable). If any volatile field is ever added, it must be snapshot-redacted.
- **D-06:** Serialize with Node `JSON.stringify` ONLY -- ZERO new dependency for JSON. Build every message from `ts.flattenDiagnosticMessageText`, NEVER the human colorizing `formatReport`/`formatDiagnostics`, so ANSI is structurally impossible in the payload.

**Verdict / exit-code purity (FMT-02)**
- **D-07:** The reporters are PURE functions over `CoreResult` and NEVER re-derive `success` from counts. `evaluateResult` / `toExitCode` (`core/evaluate-result.ts`) stay the SOLE verdict owners. The exit code is IDENTICAL across `human` / `json` / (later) `sarif` for the same input -- including the coverage-incomplete case (`errorCount === 0` but `success === false`), the cardinal anti-false-pass. A reporter crash propagates as infra (exit 2), never a swallowed silent pass.

**stdout/stderr split + color/quiet (FMT-03, CLIX-02)**
- **D-08:** The machine payload (JSON now, SARIF later) goes to **stdout ONLY**; every advisory notice / warning / error goes to **stderr** via the injected `Logger`. No Nx chrome or stray `console.log` on stdout.
- **D-09:** `--quiet` silences the stderr advisory chatter ONLY -- never the payload, never the verdict. It gates `emitAdvisoryNotices`, nothing else.
- **D-10:** `--color` / `--no-color` are explicit overrides layered ABOVE the shipped `NO_COLOR` > `FORCE_COLOR` > TTY precedence and affect the HUMAN path ONLY. Machine formats (`json`/`sarif`) are unconditionally plain regardless of `--color` / `FORCE_COLOR=1` / TTY. Assert no `\x1b` byte in the payload under `FORCE_COLOR=1`.

**Observability -- totalFilesCount (OBS-01)**
- **D-11:** `CoreResult.totalFilesCount` counts **non-declaration** source files, NOT raw `@nx/js`-parity all-files. Captured from the live `Program` on the single-leaf/direct path and a deduped `Set<string>` of source-file names across walked leaves. It is OPTIONAL and additive via the existing `presentIfNonEmpty` / conditional-spread idiom; **`evaluateResult` must NEVER read it** (verdict-neutral).

**Seam widening (FMT-01)**
- **D-12:** Widen `renderReport`: add `format` to `RenderOptions`, widen the `result` param from `Pick<CoreResult,'diagnostics'>` to full `CoreResult`, branch on `format`, and move `loadCompilerCli()` INTO the human branch so the JSON (and later SARIF) paths never load the heavy ESM `@angular/compiler-cli` peer. Reach SARIF (Phase 31) only via `await import('./sarif-report')`.
- **D-13:** REP-01 produces a shared internal "diagnostic -> normalized record" projection (1-based positions via ONE shared off-by-one helper, code humanization, repo-relative path). Phase 31's SARIF reporter REUSES this exact projection so JSON and SARIF cannot drift on positions/codes/paths. Build the helper here with that reuse in mind.

### Claude's Discretion (planner-owned)
- Exact internal key names / nesting of the `summary.advisories` block, the precise `presentIfNonEmpty` call sites, the exact drift-lock spec filename, and the internal signature of the shared normalized-record projection are left to the planner, provided the observable payload matches D-01..D-06 and the additive-only charter holds.

### Deferred Ideas (OUT OF SCOPE for Phase 30)
- **SARIF reporter + `node-sarif-builder`** -- Phase 31 (REP-02, VER-04). The `'sarif'` enum member is a valid `--format` value threaded HERE; its RENDERER + the lazy-import boundary + require-graph guard + CJS interop test are Phase 31.
- **Integration / shipped-tarball e2e, SARIF schema validation, cross-OS determinism, additive-only git-diff audit, README/CHANGELOG** -- Phase 32 (VER-02, VER-03, ADD-01, DOC-01).
- **Published hosted `$schema` URL** (REP-04), **`--output <file>`** (CLIX-03), **other formats** (REP-03), **`--watch`** (CLIX-01) -- future milestones.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support (where the seam already exists) |
|----|-------------|--------------------------------------------------|
| FMT-01 | `--format <human\|json\|sarif>` (default `human`) threaded through all three adapters by widening `renderReport` | Seam `render-report.ts:43-55`; adapters `cli/parse-args.ts:105-122`, `cli/main.ts:157-161`, `executors/typecheck/{schema.json,schema.d.ts,normalize-options.ts}`, `builders/typecheck/schema.json`; parity specs `executors/.../schema-parity.spec.ts:39-45`, `builders/.../schema-parity.spec.ts:49-55` |
| FMT-02 | Reporters PURE over `CoreResult`; identical exit code across formats; never re-derive `success` from counts | `evaluate-result.ts:116-181` is the sole verdict owner; the coverage-incomplete `errorCount===0 / success===false` case is `evaluate-result.ts:120-141`; adapter exit-code compose `cli/main.ts:167-172`, `executor.ts:69-71` |
| FMT-03 | Machine payload -> stdout only; notices -> stderr via `Logger`; no ANSI in payload | stdout seam `executor.ts:64` / `cli/main.ts:172` (returned `stdout`); notices `emit-advisory-notices.ts:23-31` -> `Logger` (`logger.ts:19-23`); messages via `ts.flattenDiagnosticMessageText` (already used at `run-typecheck.ts:192`), NEVER `formatReport` (`format-report.ts:80` colorizes) |
| REP-01 | Stable, drift-locked, agent-parseable JSON payload (flat `diagnostics[]` + rich `summary`) | NEW `core/json-report.ts`; code humanizer `diagnostic-codes.ts:52` (`ngCodeOf`); synthesized file-less codes `diagnostic-codes.ts:108-109` (`90001`/`90002`); all summary source fields present on `CoreResult` (`run-typecheck.ts:54-140`) |
| OBS-01 | Optional `CoreResult.totalFilesCount` (non-declaration source files); `evaluateResult` never reads it | Direct path program live at `run-typecheck.ts:458-486`; non-declaration filter template `gather-diagnostics.ts:152-153`; walk accumulation `walk-references.ts:145-161` (`gatherLeafInto` / `LeafAccumulator:111-116`); `EvaluateInput` Pick omits it `evaluate-result.ts:84-93` |
| CLIX-02 | `--quiet` gates stderr chatter only; `--color`/`--no-color` above `NO_COLOR`>`FORCE_COLOR`>TTY; machine always plain | `--quiet` gates `emitAdvisoryNotices` call (`cli/main.ts:155`); color precedence `cli/main.ts:58-74` (`colorFromEnv`); max-warnings validation template `cli/parse-args.ts:151` |
| VER-01 | Pure-reporter Unit + snapshot specs; exit-code parity incl. coverage-incomplete; no-ANSI-under-`FORCE_COLOR`; `--quiet`-gates-stderr-only | Test harness template `cli/main.spec.ts` (vi.hoisted + `vi.mock(importOriginal)`, coverage-incomplete case at `main.spec.ts:143-153`); drift-lock template `schema-parity.spec.ts` + `standalone-cli-docs.spec.ts:39-60` |
</phase_requirements>

## Summary

v0.2.3 Phase 30 is a seam **widening**, not a new subsystem. `core/render-report.ts` already exposes `renderReport(result, options): Promise<string>` -- the ONE async dispatcher all three adapters call identically (executor `executor.ts:56`, CLI `main.ts:157`, and the Angular CLI builder inherits it verbatim through `convertNxExecutor`). Phase 30 (1) widens that dispatcher with a `format` discriminator and moves `loadCompilerCli()` into the `human` branch (D-12); (2) adds one PURE new formatter `core/json-report.ts` (`formatJsonReport`) beside the existing human `formatReport`, built over a shared "diagnostic -> normalized record" projection (D-13) that Phase 31's SARIF reporter will reuse; (3) threads one `--format` (+ `--quiet`, `--color`/`--no-color`) enum through the CLI arg parser, the executor schema trio, and the builder schema, plus both `schema-parity` specs; and (4) captures one OPTIONAL `CoreResult.totalFilesCount` (non-declaration source files) surfaced in the JSON `summary`. `renderReport` is NOT in the public barrel (`index.ts:14-19`), so widening its signature is an internal, additive change -- the 0.x additive-only charter holds.

The JSON reporter needs ZERO new dependencies: `JSON.stringify` over a normalized projection of `CoreResult`, `ts.flattenDiagnosticMessageText` for messages (already the pattern at `run-typecheck.ts:192`), `diagnostic.file.getLineAndCharacterOfPosition` for 1-based positions, and the shipped `ngCodeOf` (`diagnostic-codes.ts:52`) for the humanized code string. SARIF and its one new dependency (`node-sarif-builder`) are Phase 31 -- the `'sarif'` enum member is threaded here as a valid value but its renderer is not built.

The dominant risk is regressing correctness invariants the shipped design already earns while bolting on a second output shape: stdout purity (payload only, notices to stderr), no ANSI in the payload (build from `flattenDiagnosticMessageText`, never the colorizing human renderer), 0-based -> 1-based off-by-one in ONE shared helper, file-less diagnostics represented not dropped (the `90001`/`90002` synthesized errors have `file`/`start`/`length` undefined by construction at `diagnostic-codes.ts:122-135`), and -- the cardinal trap -- the reporter NEVER re-deciding the verdict (a coverage-incomplete run has `errorCount === 0` but `success === false`).

**Primary recommendation:** Execute the three-plan decomposition already sketched in ROADMAP.md (`30-01` seam+`totalFilesCount`, `30-02` pure `json-report.ts`+specs, `30-03` three-adapter threading+specs). Make `format` REQUIRED on `RenderOptions` (forces every call site explicit -- the drift-safe choice; the 6 `render-report.spec.ts` calls get `format: 'human'` added). Thread `maxWarnings`/`strict` into `RenderOptions` so `formatJsonReport` can obtain `summary.outcome` by DELEGATING to `evaluateResult` (the sole owner), never by re-deriving from counts.

## Architectural Responsibility Map

This is a build-tooling library, not a tiered web app; "tiers" are the shipped core/adapter layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Format dispatch (`human`/`json`/`sarif`) | Pure core (`render-report.ts`) | -- | The one seam; already the single dispatch point every adapter calls |
| JSON serialization | Pure core (`json-report.ts`, NEW) | -- | Pure `(CoreResult, ts, opts) => string`; no `console`/`process`/verdict (mirrors `format-report.ts`) |
| Diagnostic -> normalized record (positions/code/path) | Pure core (shared helper, NEW) | Phase 31 SARIF reuse | D-13: one projection so JSON + SARIF cannot drift |
| `totalFilesCount` capture | Pure core (`run-typecheck.ts` + `walk-references.ts`) | -- | Program is live only in the engine; captured there, additive-optional on `CoreResult` |
| Verdict + exit code | Pure core (`evaluate-result.ts`) | Adapter maps to exit | UNTOUCHED; sole owner of pass/fail (D-07) |
| `--format`/`--quiet`/`--color` parse + default | Adapters (CLI `parse-args`, executor/builder schemas) | -- | Adapter owns I/O + option surface; core stays `process`-free |
| stdout payload / stderr notices split | Adapters (executor `process.stdout.write`; CLI returns `{stdout,stderr}`) | `Logger` seam | Established stream split; reporters return a string, adapters write it |
| Color precedence (env + flag) | Adapter (`cli/main.ts` `colorFromEnv`) | -- | `--color`/`--no-color` layer above `NO_COLOR`>`FORCE_COLOR`>TTY; human path only |

## Standard Stack

### Core (all already in the tree; ZERO new runtime dependency this phase)

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Node `JSON.stringify` | stdlib | Entire JSON serialization; escapes messages/quotes/newlines correctly | D-06: zero-dependency, injection-safe (never hand-concatenate JSON) |
| `ts.flattenDiagnosticMessageText(d.messageText, '\n')` | typescript (peer, injected via `loadTypescript()`) | Flatten `string \| DiagnosticMessageChain` to a plain string | Already the pattern at `run-typecheck.ts:192`; NEVER colorizes (unlike `formatDiagnostics`) |
| `diagnostic.file.getLineAndCharacterOfPosition(pos)` | typescript | 0-based `{line, character}` -> `+1` both axes for 1-based positions | Method on the live `SourceFile` already attached to each diagnostic; no re-read |
| `ngCodeOf` | `core/diagnostic-codes.ts:52` | `-998109` -> `8109` for the `NG8xxx` label | Shipped, dependency-free; reuse -- never surface the raw negative code |
| `node:util` `parseArgs` | Node stdlib (>= 22.4.0 for `allowNegative`) | Parse `--format`/`--quiet`/`--color`/`--no-color` | Already the CLI parser (`cli/parse-args.ts:1,105`) |
| `colorFromEnv` precedence | `cli/main.ts:58-74` | `NO_COLOR`>`FORCE_COLOR`>TTY; extend with an explicit-flag tier | Shipped; extend, do not replace |
| `presentIfNonEmpty` / conditional-spread | `run-typecheck.ts:256-263` (arrays) / `:905` (value) | Additive-optional `CoreResult` fields | The shipped idiom for optional result fields |

### Supporting (dev-only; already present)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Vitest (`@nx/vitest:test`) | shipped | Unit + snapshot specs (VER-01) | The `test` target (`project.json:101-108`, `dependsOn: build`) |
| `tsc --noEmit -p tsconfig.spec.json` | typescript 6 | Type-checks the specs (the `test` runner does NOT) | The `typecheck` target (`project.json:92-96`) -- run BEFORE the Release PR (see Pitfall 8) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `JSON.stringify` | a JSON serializer lib | Pointless new dep; `JSON.stringify` escapes correctly (D-06) |
| ONE shared normalized-record helper | separate JSON + SARIF projections | Drift risk on positions/codes/paths; D-13 mandates sharing |
| `allowNegative: true` for `--no-color` | a separate `no-color` boolean flag, or `tokens: true` reprocessing | `allowNegative` is the cleanest on the shipped Node floor; see Pitfall 9 |

**Installation:** None. No `npm install` this phase. (`node-sarif-builder` is Phase 31 only.)

## Package Legitimacy Audit

**N/A -- Phase 30 installs NO external packages.** The JSON reporter is `JSON.stringify` (Node stdlib); `--format`/`--quiet`/`--color` reuse `node:util` `parseArgs` and the shipped `colorFromEnv`. The one new runtime dependency of the milestone, `node-sarif-builder`, is scoped to Phase 31 (see `.planning/research/v0.2.3-reporters/STACK.md`), where the legitimacy gate must run. No package-legitimacy verdict is required here.

## Architecture Patterns

### System Architecture Diagram (data flow; the middle string is all `--format` changes)

```
adapter parses/normalizes options (format, color, quiet, pathBase, maxWarnings, strict)
        |
        v
runTypecheck(CoreOptions) --> CoreResult   (+ NEW optional totalFilesCount, verdict-neutral)
        |
        +--> emitAdvisoryNotices(result, Logger)      [SKIPPED when --quiet]  --> stderr
        |
        +--> renderReport(result, { format, color, pathBase, failFast, maxWarnings, strict })
        |          format = 'human' -> loadCompilerCli() + formatReport   (ANSI honored by `color`)
        |          format = 'json'  -> formatJsonReport(result, ts, {pathBase, maxWarnings, strict})
        |          format = 'sarif' -> await import('./sarif-report')      [Phase 31 -- renderer NYI]
        |          returns a STRING
        |
        +--> adapter writes the string to stdout ONLY (executor process.stdout.write; CLI RunResult.stdout)
        |
        +--> evaluateResult(result, { maxWarnings, strict }) --> { success, outcome }
                  |  (NEVER sees `format`; sole owner of pass/fail)
                  v
             exit code: executor { success }; CLI toExitCode 0/1/2
```

The verdict path (bottom) and the render path (middle) both consume the SAME `CoreResult` independently. `--format` only ever changes the middle string. This mirrors the shipped compose exactly (`cli/main.ts:151-172`, `executor.ts:49-71`).

### Recommended file layout (all under `packages/angular-typechecker/src/`)

```
core/
├── render-report.ts        # MODIFY: widen RenderOptions + result param; branch on format; move loadCompilerCli into human branch
├── json-report.ts          # NEW: formatJsonReport (pure, no dep)
├── diagnostic-record.ts    # NEW (or inline+export in json-report.ts): shared diagnostic->normalized record + the ONE off-by-one helper (D-13)
├── run-typecheck.ts        # MODIFY: CoreResult.totalFilesCount?; capture on direct path; thread through finalizeUnion
├── walk-references.ts      # MODIFY: LeafAccumulator gains a source-file Set; gatherLeafInto populates it
├── evaluate-result.ts      # UNTOUCHED (EvaluateInput Pick keeps omitting totalFilesCount)
├── format-report.ts        # UNTOUCHED (the human branch calls it verbatim)
└── emit-advisory-notices.ts# UNTOUCHED (--quiet is an adapter gate on the CALL, not a seam change)
cli/
├── parse-args.ts           # MODIFY: add format/quiet/color(+--no-color); validate the enum; update HELP_TEXT
└── main.ts                 # MODIFY: thread format + explicit-color override into renderReport; gate emitAdvisoryNotices on --quiet
executors/typecheck/
├── schema.json             # MODIFY: add format enum (default "human")
├── schema.d.ts             # MODIFY: add format?: 'human'|'json'|'sarif'
├── normalize-options.ts    # MODIFY: forward format to renderReport
└── schema-parity.spec.ts   # MODIFY: add 'format' to EXPECTED_KEYS + a default assertion
builders/typecheck/
├── schema.json             # MODIFY: add format enum ; builder.ts UNCHANGED
└── schema-parity.spec.ts   # MODIFY: add 'format' to EXPECTED_KEYS (compile-bound via satisfies)
```

### Pattern 1: The widened `renderReport` seam (D-12)

**What:** Add `format` to `RenderOptions`, widen the result param to full `CoreResult`, branch on format, and move the heavy ESM compiler-cli load into the `human` branch only.

**Current shipped shape** (`core/render-report.ts:18-55`):
```typescript
export interface RenderOptions {
  pathBase?: string;
  color: boolean;
  failFast?: boolean;
}

export async function renderReport(
  result: Pick<CoreResult, 'diagnostics'>,   // WIDEN to CoreResult
  options: RenderOptions,
): Promise<string> {
  const ng = await loadCompilerCli();          // MOVE into the human branch
  const ts_ = await loadTypescript();
  return formatReport(result.diagnostics, ng, ts_, { ... });
}
```

**Recommended widened shape:**
```typescript
export type ReportFormat = 'human' | 'json' | 'sarif';

export interface RenderOptions {
  format: ReportFormat;        // NEW, REQUIRED (adapters set it, defaulting to 'human')
  pathBase?: string;
  color: boolean;              // human-only; json/sarif ignore it
  failFast?: boolean;
  maxWarnings?: number;        // NEW: passed through so json summary.outcome delegates to evaluateResult
  strict?: boolean;            // NEW: same
}

export async function renderReport(result: CoreResult, options: RenderOptions): Promise<string> {
  const ts_ = await loadTypescript();          // already warm from runTypecheck
  switch (options.format) {
    case 'json':
      return formatJsonReport(result, ts_, {
        pathBase: options.pathBase,
        maxWarnings: options.maxWarnings,
        strict: options.strict,
      });
    case 'sarif': {
      // Phase 31: const { formatSarifReport } = await import('./sarif-report');
      // Phase 30: throw a clear "sarif renderer lands in Phase 31" error OR fall through.
      // (Planner decision -- see Open Question 2. The ENUM is valid here; the RENDERER is not.)
    }
    case 'human':
    default: {
      const ng = await loadCompilerCli();      // load ONLY for human (D-12)
      return formatReport(result.diagnostics, ng, ts_, {
        pathBase: options.pathBase, color: options.color, failFast: options.failFast,
      });
    }
  }
}
```
**Why `maxWarnings`/`strict` on `RenderOptions`:** `summary.outcome` (D-02) comes from `evaluateResult(result, { maxWarnings, strict })` (`evaluate-result.ts:116-181`). Having `formatJsonReport` DELEGATE to `evaluateResult` (the sole owner) satisfies D-07 -- it is NOT "re-deriving `success` from counts", it is calling the one function that owns the verdict. The adapter also calls `evaluateResult` for the exit code; both calls are pure with identical inputs, so they cannot diverge. (Alternative: adapter computes the verdict once and passes `{success, outcome}` in -- see Open Question 1.)

### Pattern 2: The shared diagnostic -> normalized record projection (D-13)

**What:** One pure helper both JSON (Phase 30) and SARIF (Phase 31) call, so positions/codes/paths cannot drift.

**The ONE off-by-one helper** (file-less-safe; the classic reporter bug -- Pitfall 3):
```typescript
// Source pattern: FEATURES.md "What CoreResult does NOT expose" #1; file-less shape from
// diagnostic-codes.ts:122-135 (synthesizeFilelessError sets file/start/length undefined).
function positionsOf(d: ts.Diagnostic): {
  line: number | null; column: number | null; endLine: number | null; endColumn: number | null;
} {
  if (d.file === undefined || d.start === undefined) {
    return { line: null, column: null, endLine: null, endColumn: null };   // file-less (90001/90002/global)
  }
  const s = d.file.getLineAndCharacterOfPosition(d.start);                  // 0-based both axes
  const endPos = d.start + (d.length ?? 0);
  const e = d.file.getLineAndCharacterOfPosition(endPos);
  return { line: s.line + 1, column: s.character + 1, endLine: e.line + 1, endColumn: e.character + 1 };
}
```

**The code-string classifier** (never surface the raw negative code -- Pitfall 6):
```typescript
// Source: diagnostic-codes.ts:52 (ngCodeOf), :108-109 (ZERO_ROOT_NAMES=90001, REFERENCE_NOT_FOUND=90002).
function codeStringOf(rawCode: number): string {
  if (rawCode < 0) { return 'NG' + ngCodeOf(rawCode); }        // -998109 -> "NG8109"
  if (rawCode >= 90000) { return 'ATC' + rawCode; }            // 90001 -> "ATC90001"
  return 'TS' + rawCode;                                        // 2322 -> "TS2322"
}
```
Note: infra code `500` (`UNKNOWN_ERROR_CODE`) is re-thrown as `TypecheckInfrastructureError` BEFORE any reporter runs (`run-typecheck.ts:181-195,381,444`), so it never reaches this classifier -- no `TS500` case in practice.

**severity** from `diagnostic.category` (count by CATEGORY, never code sign -- `evaluate-result.ts:17-22`):
`Error(1) -> "error"`, `Warning(0) -> "warning"`, `Suggestion(2) -> "suggestion"`, `Message(3) -> "message"` (FEATURES.md severity table).

**message:** `ts.flattenDiagnosticMessageText(d.messageText, '\n')` -- NEVER `formatReport`/`ng.formatDiagnostics` (which colorizes at `format-report.ts:80`).

**path:** repo-relative forward-slash via `pathBase` (the SAME base the human host uses, `format-report.ts:99-101`): `path.relative(pathBase, d.file.fileName).replace(/\\/g, '/')` (JSON), `null` when file-less. (The full realpath/backslash normalization matters most for SARIF URIs -- Phase 31; JSON's `file` uses the same relativization.)

### Pattern 3: `totalFilesCount` capture (OBS-01 / D-11) -- two paths, both additive-optional

**Direct single-leaf path** (`run-typecheck.ts:439-503`): the live program is in scope right after the program-undefined guard (`run-typecheck.ts:458-465`). Count non-declaration source files there, mirroring the exact iteration `gather-diagnostics.ts:152-153` already uses:
```typescript
// after directResult (run-typecheck.ts:473-486), before the return at :497-503:
const totalFilesCount = result.program.getTsProgram()
  .getSourceFiles()
  .filter((sf) => !sf.isDeclarationFile).length;   // non-declaration => lib.d.ts excluded (D-11)

return {
  ...directResult,
  ...presentIfNonEmpty('notTypeCheckedDeclaredFiles', notTypeCheckedDeclaredFiles),
  ...(totalFilesCount !== undefined ? { totalFilesCount } : {}),   // value-presence spread (like :905)
};
```

**Walk + multi-tsconfig path**: no per-leaf program survives `finalizeUnion` (`run-typecheck.ts:270-276`), so accumulate during `gatherLeafInto` (`walk-references.ts:145-161`) where each leaf's program IS live. Add a `Set<string>` of non-declaration source-file names to `LeafAccumulator` (`walk-references.ts:111-116`), populate it in `gatherLeafInto`, carry `set.size` on `WalkResult` (`walk-references.ts:41-74`) and `handleMultiTsConfig`'s `acc` (`run-typecheck.ts:650-655`), and thread it into `finalizeUnion` (`run-typecheck.ts:278-313`) as a new param spread onto the returned result. The Set dedupes NON-declaration source files shared across leaves (e.g. a shared component both leaves import).

**Precision note (correct the "dedupe lib.d.ts" wording):** because D-11 counts NON-declaration files, `lib.d.ts` (a `.d.ts`) is excluded by the `!sf.isDeclarationFile` filter on BOTH paths -- it never enters the Set. The Set dedupes shared *non-declaration* source files, not `lib.d.ts`.

**Verdict-neutrality (load-bearing):** `evaluateResult`'s `EvaluateInput` Pick (`evaluate-result.ts:84-93`) deliberately omits `totalFilesCount`. Keep it omitted -- a negative test should lock that `evaluateResult` never reads it.

### Pattern 4: `--format`/`--quiet`/`--color` threading (FMT-01 / CLIX-02)

- **CLI (`cli/parse-args.ts`)**: add to the `parseArgs` options object (`:105-122`): `format: { type: 'string' }`, `quiet: { type: 'boolean' }`, `color: { type: 'boolean' }`, and set `allowNegative: true` so `--no-color` sets `color: false` (see Pitfall 9). Validate `format` against the enum, mirroring the `--max-warnings` guard idiom at `:151` (an out-of-enum value -> `usageError`). Add `format`/`quiet`/`color?` to `ParsedOptions` (`:22-32`), defaulting `format` to `'human'`. Update `HELP_TEXT` (`:65-84`) -- it is drift-locked (see Pitfall 7).
- **CLI (`cli/main.ts`)**: pass `format: parsed.format` into `renderReport` (`:157-161`); apply the explicit color override -- `parsed.color ?? colorFromEnv(env)` (`:148`) so `--color`/`--no-color` WIN over env; gate `emitAdvisoryNotices` (`:155`) on `!parsed.quiet`. Machine formats stay plain because `formatJsonReport` never colorizes -- color is only consumed by the `human` branch.
- **Executor (`executors/typecheck/`)**: add `format` to `schema.json` (`:9-38`, `enum: ["human","json","sarif"]`, `default: "human"`; `additionalProperties: false` at `:38` REQUIRES declaring it), `schema.d.ts` (`:1-10`, `format?: 'human'|'json'|'sarif'`), and `normalize-options.ts` (`NormalizedOptions:20-26` + forward into the `renderReport` call at `executor.ts:56-60`). Also forward `maxWarnings`/`strict` (already on `NormalizedOptions`) into `renderReport` for the JSON summary.
- **Builder (`builders/typecheck/schema.json`)**: add the same `format` enum (`:6-33`). `builder.ts` is UNCHANGED -- it is `convertNxExecutor(typecheckExecutor)` and inherits `format` via the shared `TypecheckExecutorOptions`.
- **Both parity specs**: add `'format'` to `EXPECTED_KEYS` (executor `schema-parity.spec.ts:39-45`; builder `schema-parity.spec.ts:49-55` where it is compile-bound via `satisfies` + the `AssertAssignable` reverse-coverage probe at `:57-68`). Adding `format` to `TypecheckExecutorOptions` WITHOUT updating both arrays fails the type-check -- treat this as part of the wiring, not an afterthought.

### Anti-Patterns to Avoid

- **A reporter registry / a `formatted` field on `CoreResult`:** the seam already exists; a registry is speculative abstraction for 3 formats, and pre-rendering onto `CoreResult` re-couples rendering into the pure engine. Widen the `switch`; add pure functions. (ARCHITECTURE.md Anti-Pattern 1.)
- **Building JSON messages via `formatReport`/`ng.formatDiagnostics`:** inherits ANSI + codeframe coupling (`format-report.ts:80` always colorizes). Build from `flattenDiagnosticMessageText` (Pitfall 2).
- **Reading `errorCount` in the reporter to decide anything about success:** coverage-incomplete has `errorCount === 0` / `success === false` (`evaluate-result.ts:120-141`). Delegate to `evaluateResult` (Pitfall 13 / D-07).
- **Loading `node-sarif-builder` at module scope / building the SARIF renderer now:** out of scope for Phase 30 (Deferred).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON string escaping | manual string concatenation | `JSON.stringify` | Escapes quotes/newlines/control chars; injection-safe (D-06 / Pitfalls "Security") |
| NG code humanization | re-derive `-99xxxx` math | `ngCodeOf` (`diagnostic-codes.ts:52`) | Shipped, tested inverse of the negative encoding (Pitfall 6) |
| Message flattening | walk `DiagnosticMessageChain` | `ts.flattenDiagnosticMessageText` | Already used at `run-typecheck.ts:192`; never colorizes (Pitfall 2) |
| 1-based positions | ad-hoc `+1` per call site | ONE shared `positionsOf` helper (D-13) | Off-by-one is invisible to a round-trip snapshot; centralize it (Pitfall 3) |
| Color precedence | a color lib / new env logic | extend `colorFromEnv` (`cli/main.ts:58-74`) | Shipped `NO_COLOR`>`FORCE_COLOR`>TTY; add only the flag tier |
| `--no-color` negation | custom `no-` string handling | `parseArgs({ allowNegative: true })` | Native since Node 22.4.0; Node floor is 22.22.3+ (Pitfall 9) |
| Optional `CoreResult` fields | reshape/require fields | `presentIfNonEmpty` (arrays) / value-spread (`run-typecheck.ts:256-263,905`) | The shipped additive idiom; keeps 0.x additive-only (Pitfall 14) |
| Schema<->type<->keys drift | trust manual sync | the `EXPECTED_KEYS` + `satisfies`/`AssertAssignable` tripwire | Shipped in both `schema-parity.spec.ts`; reuse for `'format'` and for the JSON payload-key drift-lock (D-03) |

**Key insight:** every derivation the JSON reporter needs (positions, code label, message, path relativization, outcome) already has a shipped, tested source in the tree. Phase 30 is composition, not invention.

## Runtime State Inventory

Not applicable -- Phase 30 is a greenfield-additive reporter phase (new `json-report.ts`, widened internal seam, optional field, threaded enum). It renames nothing, migrates no stored data, and touches no OS-registered state, secrets, or build artifacts beyond the normal `nx build` output. (Verified: no rename/migration in scope per CONTEXT.md `## Phase Boundary`.)

## Common Pitfalls

Only the Phase-30-relevant subset of the 14 milestone pitfalls (`.planning/research/v0.2.3-reporters/PITFALLS.md`) plus two repo-specific gotchas grounded in the shipped specs.

### Pitfall 1: Non-payload output leaks onto stdout (corrupts the JSON)
**What goes wrong:** an advisory notice / Nx chrome / stray `console.log` lands on stdout ahead of the JSON, so `jq`/`JSON.parse` fails.
**How to avoid:** the payload goes to the RAW stdout seam ONLY (executor `process.stdout.write` `executor.ts:64`; CLI `RunResult.stdout` `main.ts:172`); every notice goes through `emitAdvisoryNotices` -> `Logger` -> stderr (`emit-advisory-notices.ts:23-31`). Do NOT route notices to stdout for machine formats. `--quiet` gates the notice CALL (`main.ts:155`), never the payload.
**Warning signs:** a payload snapshot line starting with `angular-typechecker:`; `| jq .` fails.

### Pitfall 2: ANSI color embedded in the JSON message
**What goes wrong:** `message` contains SGR escapes because the reporter reused the human codeframe.
**How to avoid:** build `message` from `ts.flattenDiagnosticMessageText`, never `formatReport`/`ng.formatDiagnostics` (`format-report.ts:80` calls `formatDiagnostics` which ALWAYS colorizes; the human path strips ANSI as a separate step at `:82`). Machine formats are unconditionally plain regardless of `--color`/`FORCE_COLOR` (D-10).
**Warning signs:** an `ESC` (`\x1b`) byte in the payload; the payload differs under `FORCE_COLOR=1`.

### Pitfall 3: 0-based ts positions emitted as 1-based (off-by-one)
**What goes wrong:** every JSON `line`/`column` is off by one.
**How to avoid:** ONE shared `positionsOf` helper does `+1` on BOTH axes for BOTH start and end (Pattern 2). Pin it with a HAND-COUNTED fixture position, not a round-trip snapshot (an off-by-one is invisible to a snapshot).
**Warning signs:** `column: 0` anywhere; agents jump one line above the real error.

### Pitfall 6: `code` as the raw negative NG number
**What goes wrong:** `code: "-998109"` instead of `"NG8109"`.
**How to avoid:** `codeStringOf` classifier (Pattern 2) using `ngCodeOf` (`diagnostic-codes.ts:52`). Carry BOTH the string `code` and the raw `rawCode` int (D-01) so agents that want the exact discriminator have it.
**Warning signs:** a `-99` substring in any `code`; a bare negative int as a code label.

### Pitfall 10: File-less diagnostics dropped or crash the reporter (SILENT FALSE PASS)
**What goes wrong:** `Cannot read properties of undefined (reading 'fileName')`, or the diagnostic is silently omitted -- a false clean while the verdict fails.
**How to avoid:** the synthesized `90001`/`90002` guards and global TS diagnostics have `file`/`start`/`length` undefined BY CONSTRUCTION (`diagnostic-codes.ts:122-135`). Guard position extraction (`positionsOf` returns `null` positions) and set `file: null`; NEVER filter a diagnostic out for lacking a file. The payload must contain every entry in `CoreResult.diagnostics` one-to-one.
**Warning signs:** the payload has fewer entries than `CoreResult.diagnostics.length`; a crash on a references-only / empty-project fixture (which synthesizes a `90001` at `run-typecheck.ts:419,759-779`).

### Pitfall 13: Machine output changes the verdict / exit code (charter break)
**What goes wrong:** `--format json` exits differently than `--format human`, or a reporter crash flips a clean run to exit 2 / a coverage-incomplete run to a pass.
**How to avoid:** `evaluateResult(...).success` stays the SOLE owner of 0-vs-1 (`main.ts:167-172`, `executor.ts:69-71`); `toExitCode`/`TypecheckInfrastructureError` the sole owner of 2. The reporter returns a string only. A reporter that throws propagates to the existing catch (`main.ts:173-185`) -> infra exit 2, never swallowed.
**Warning signs:** exit code differs across `--format` on the same input; a coverage-incomplete fixture passes under `--format json`.

### Pitfall 14: Breaking `CoreResult`/`CoreOptions` instead of adding optional fields
**What goes wrong:** `totalFilesCount` added as REQUIRED, or `format` as a required core option -- a breaking change under a patch bump.
**How to avoid:** `totalFilesCount?: number` OPTIONAL (value-presence spread); `format` defaults to `'human'` on every adapter; `renderReport` stays out of the barrel (`index.ts:14-19`). `index.drift.ts` must still compile (it pins the 5 barrel exports); the `typecheck` target runs `tsc --noEmit -p tsconfig.drift.json` (`project.json:94`).
**Warning signs:** `index.drift.ts` fails `tsc`; the additive git-diff audit (Phase 32) shows a changed (not added) signature.

### Pitfall 7 (repo-specific): the HELP_TEXT drift-lock forces a README touch when you add a flag
**What goes wrong:** `standalone-cli-docs.spec.ts:87-93` derives EVERY long-form flag the live `--help` prints (`--[a-zA-Z][\w-]*`) and asserts each appears in the README (`:60,90-92`). Adding `--format`/`--quiet`/`--color`/`--no-color` to `HELP_TEXT` (`parse-args.ts:65-84`) will make this spec FAIL because the README `## Machine-readable output` section is Phase 32 (DOC-01).
**How to avoid (planner decision -- see Open Question 3):** EITHER (a) add a minimal README flag mention in Phase 30 (a partial DOC touch just for the new flags, leaving the full `## Machine-readable output` section to Phase 32), OR (b) add the new flags to the README's existing `## Standalone CLI` flag table in `30-03` (the least-surprising option -- the table already lists the 7 shipped flags), OR (c) adjust the drift-lock's derivation to exempt Phase-30 flags until Phase 32. Recommend (b): extend the existing flag table now, expand the schema/recipe prose in Phase 32. `FLAG_TOKENS` (`:45-53`) is a separate removal/rename lock and is unaffected by additions.
**Warning signs:** `nx test` red on `standalone-cli-docs.spec.ts` after touching `HELP_TEXT`.

### Pitfall 8 (repo-specific): `nx test` does NOT type-check specs
**What goes wrong:** a type error in a new `*.spec.ts` (e.g. a mistyped `renderReport` mock args tuple) passes under Vitest/esbuild but fails `tsc --noEmit -p tsconfig.spec.json`. This exact class escaped Phase 26 (a `renderReport` mock `TS2493`/`TS2532`) and surfaced only in Phase 27 (STATE.md; memory `verify-format-and-lint-before-release`).
**How to avoid:** run the `typecheck` target (`project.json:92-96`) AND `nx lint` (maxWarnings:0) AND `nx format:check` before declaring the phase done -- not just `nx test`. The existing `main.spec.ts` shows the fix: bare `vi.fn()` mocks so `.mock.calls` args are `any[]` (`main.spec.ts:33-38`).

### Pitfall 9 (repo-specific): `--no-color` under the strict `parseArgs` needs `allowNegative: true`
**What goes wrong:** the shipped parser is `strict: true` (`parse-args.ts:106`). Under strict mode an unregistered `--no-color` throws `ERR_PARSE_ARGS_UNKNOWN_OPTION` -> `usageError`. The upstream ARCHITECTURE.md claim ("`util.parseArgs` supports `--no-color` when color is a boolean option") is only true with `allowNegative: true` set explicitly (default is `false`).
**How to avoid:** register `color: { type: 'boolean' }` AND set `allowNegative: true` on the `parseArgs` call. `--no-color` then sets `color: false` (explicitly, not "inverse of default"); `['--color','--no-color']` is last-one-wins. `allowNegative` was added in Node **v22.4.0** [VERIFIED: nodejs/node PR #53107] and the package `engines.node` floor is `^22.22.3 || ^24.15.0 || ^26.0.0` (`package.json:76-78`), so it is available on every supported Node. `@types/node` must be recent enough to type `allowNegative` (the repo is on Nx 23 / TS 6, so this is not a concern, but the planner should confirm the type surfaces).

## Code Examples

### JSON payload shape (concrete, keyed to real `CoreResult` fields; D-01/D-02/D-03)
```jsonc
// Source: FEATURES.md "Recommended JSON schema"; every field maps to run-typecheck.ts:54-140 + evaluate-result.ts Outcome.
{
  "formatVersion": 1,                         // D-03 integer marker; bump only on a breaking shape change
  "tool": "angular-typechecker",
  "version": "0.2.3",                         // package.json version (drift-lock reads the manifest, like parse-args.ts:20)
  "tsConfigPath": "libs/x/tsconfig.lib.json", // CoreResult.tsConfigPath, relativized to pathBase
  "summary": {
    "outcome": "coverage-incomplete",         // evaluateResult(result,{maxWarnings,strict}).outcome
    "success": false,                         // evaluateResult(...).success (verdict owner stays evaluate-result)
    "errorCount": 0,                          // CoreResult.errorCount   (NOTE: 0 but success:false -- the anti-false-pass)
    "warningCount": 0,                         // CoreResult.warningCount
    "diagnosticCount": 0,                     // CoreResult.diagnostics.length
    "rootNamesCount": 42,                     // CoreResult.rootNamesCount
    "totalFilesCount": 318,                   // OBS-01 (OPTIONAL; omitted when absent)
    "suppressedThirdParty": 12,               // CoreResult.suppressedThirdParty (never affects verdict)
    "suppressedInGraphErrorCount": 1,         // first-party dropped errors (drives coverage-incomplete)
    "suppressedInGraphWarningCount": 0,
    "advisories": {                           // present-if-non-empty, mirroring the CoreResult presence idiom
      "suppressedInGraphFiles": ["libs/x/src/lib/y.ts"],
      "templateCheckAborted": { "fileName": "libs/x/src/broken.component.ts" },
      "skippedReferences": [{ "referencePath": "../other/tsconfig.json", "reason": "out-of-project" }],
      "notTypeCheckedDeclaredFiles": ["libs/x/src/doc.mdx"],
      "bundlerQueryImports": ["./logo.svg?raw"]
    }
  },
  "diagnostics": [
    {
      "file": "libs/x/src/lib/y.component.ts", // repo-relative; null when file-less
      "line": 12, "column": 5, "endLine": 12, "endColumn": 20,  // 1-based; null when file-less
      "code": "NG8109",                        // codeStringOf(rawCode)
      "rawCode": -998109,                      // the exact ts.Diagnostic.code (D-01)
      "severity": "error",                     // from ts.DiagnosticCategory
      "message": "Interpolated signal ... should be invoked"  // flattenDiagnosticMessageText, no ANSI
    }
  ]
}
```
Field names mirror ESLint/Biome (`line`/`column`/`endLine`/`endColumn`/`severity`/`message`) but the container is a FLAT `diagnostics[]` (simpler for agents; `tsc` has no canonical JSON to conform to). Exact `advisories` nesting is Claude's Discretion (CONTEXT).

### `summary.outcome` via delegation (D-07-safe)
```typescript
// core/json-report.ts -- calling evaluateResult is DELEGATION to the sole owner, NOT re-deriving from counts.
import { evaluateResult } from './evaluate-result';
export function formatJsonReport(
  result: CoreResult, ts_: typeof import('typescript'),
  opts: { pathBase?: string; maxWarnings?: number; strict?: boolean },
): string {
  const { success, outcome } = evaluateResult(result, { maxWarnings: opts.maxWarnings, strict: opts.strict });
  // ...build the payload object (diagnostics via the shared projection; summary from CoreResult + {success, outcome})...
  return JSON.stringify(payload, null, 2);   // pretty is fine for JSON (small; agents parse it)
}
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Human-only codeframe report | additive `--format json` (SARIF Phase 31) | Agents/CI consume the complete diagnostic set as data |
| `renderReport` unconditionally loads `@angular/compiler-cli` (`render-report.ts:47`) | `loadCompilerCli()` moves into the human branch (D-12) | Machine paths skip the heavy ESM peer -- leaner CI/agent loop |
| CLI has no `--format`/`--quiet`/`--color` | one enum + two flags threaded through all three adapters | Uniform machine output across executor / builder / CLI |

**Deprecated/outdated:** none. `tsc` still has NO machine-readable output (`--pretty false` is human text) -- ESLint `-f json` / Biome set the de-facto field conventions (FEATURES.md), which this JSON payload mirrors at the field-name level only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `formatJsonReport` delegating to `evaluateResult` for `summary.outcome` satisfies D-07 (delegation != re-derivation) | Pattern 1 / Code Examples | LOW -- if the planner prefers the adapter to pre-compute `{success,outcome}` and pass it in (Open Question 1), the reporter takes it as data; either way `evaluate-result.ts` stays the sole owner. Not a correctness risk, an API-shape choice. |
| A2 | Making `format` REQUIRED on `RenderOptions` is preferable to optional-with-default | Pattern 1 | LOW -- required forces every call site explicit (6 spec calls + 3 adapters). If the planner makes it optional (`?? 'human'`), the 6 `render-report.spec.ts` calls need no edit, but a wiring omission would silently default to human. Required is the drift-safe choice; reversible. |
| A3 | The walk/multi-path `totalFilesCount` Set should hold non-declaration source-file NAMES (`fileName` strings) | Pattern 3 | LOW -- `getSourceFiles()` returns `SourceFile[]`; dedupe by `.fileName`. If two leaves' programs return distinct `SourceFile` objects for the same path, name-dedupe is correct; object-dedupe would double-count. Name is the right key. |

**Note:** all three assumptions are internal-signature choices explicitly within Claude's Discretion (CONTEXT `## Claude's Discretion`). No assumed *external facts* -- the one external claim (`allowNegative` version) was VERIFIED. The JSON shape, verdict purity, stdout split, and color precedence are all LOCKED decisions (D-01..D-13) or grounded in shipped source.

## Open Questions

1. **Where does the JSON `summary` verdict come from -- reporter-delegates or adapter-passes?**
   - What we know: `summary.outcome`/`success` must come from `evaluateResult(result,{maxWarnings,strict})` (`evaluate-result.ts:116-181`); the adapter ALSO calls it for the exit code.
   - Options: (a) `formatJsonReport` calls `evaluateResult` itself (RenderOptions carries `maxWarnings`/`strict`; two pure calls, identical inputs, cannot diverge -- RECOMMENDED, least adapter churn); (b) the adapter calls `evaluateResult` ONCE before `renderReport` and passes `{success,outcome}` into `RenderOptions` (single call, but reorders the compose so evaluate precedes render in `main.ts`/`executor.ts` -- safe since `evaluateResult` is pure, but a bigger touch).
   - Recommendation: (a). Flag for `30-02`.

2. **What does the `'sarif'` branch do in Phase 30?**
   - What we know: the `'sarif'` enum member must be a VALID `--format` value here (FMT-01), but its renderer is Phase 31.
   - Options: (a) `renderReport`'s `sarif` case throws a clear "SARIF lands in v0.2.3 Phase 31" error (explicit, testable); (b) it is accepted by the schema/parser but the renderer stub returns a placeholder. (a) is cleaner and avoids emitting an invalid payload. Recommendation: (a) -- and assert the enum is ACCEPTED by parse/schema but the renderer throws-not-yet, so exit-code parity tests exclude `sarif` until Phase 31.
   - Flag for `30-01`/`30-03`.

3. **How to satisfy the `standalone-cli-docs.spec.ts` flag drift-lock when README docs are Phase 32?** (Pitfall 7)
   - Recommendation: extend the existing `## Standalone CLI` README flag table with `--format`/`--quiet`/`--color`/`--no-color` in `30-03` (a minimal, accurate table row each), leaving the full `## Machine-readable output` schema+recipe prose to Phase 32 (DOC-01). Confirm the derived-flags assertion (`:87-93`) passes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node `util.parseArgs` `allowNegative` | `--no-color` (CLIX-02) | Yes | >= 22.4.0; floor is 22.22.3 (`package.json:76`) | none needed |
| `JSON.stringify` | JSON reporter (REP-01) | Yes | Node stdlib | -- |
| typescript (peer, `loadTypescript()`) | positions + `flattenDiagnosticMessageText` | Yes | `>=6.0.0 <6.1.0` peer | -- |
| Vitest (`@nx/vitest:test`) | VER-01 specs | Yes | shipped | -- |

**Missing dependencies with no fallback:** none. **No external package is installed this phase.**

## Validation Architecture

> `workflow.nyquist_validation: true` (`.planning/config.json:19`) -- section REQUIRED. VER-01 is the Unit-tier slice for THIS phase; VER-02 (integration) and VER-03 (e2e) are Phase 32.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest via `@nx/vitest:test` (`project.json:101-108`) |
| Config file | `packages/angular-typechecker/vitest.config.mts` (referenced by `project.json:68`) |
| Quick run command | `nx test angular-typechecker` (unit `*.spec.ts`; `dependsOn: build`) |
| Full suite command | `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker && nx format:check` |
| Spec type-check (load-bearing) | `tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` (via `nx typecheck`, `project.json:93`) -- `nx test` does NOT type-check specs (Pitfall 8) |

### Phase Requirements -> Test Map (VER-01 slices)

| Req | Behavior (observable proof) | Test Type | Automated Command | File |
|-----|-----------------------------|-----------|-------------------|------|
| REP-01 | JSON payload shape: flat `diagnostics[]`, 1-based positions, `code`+`rawCode`, `severity`, `summary` with `outcome`, `formatVersion:1`, tool `version` | unit + snapshot | `nx test angular-typechecker` | NEW `core/json-report.spec.ts` |
| REP-01 | File-less diagnostic (synthesized `90001`) appears with `file:null` + null positions, NOT dropped (`diagnostics.length` matches `CoreResult`) | unit | same | `core/json-report.spec.ts` |
| REP-01 | HAND-COUNTED position fixture: a diagnostic at a known line/col asserts exact 1-based `line`/`column`/`endLine`/`endColumn` (off-by-one guard, Pitfall 3) | unit | same | `core/json-report.spec.ts` |
| REP-01/FMT-03 | severity mapping `ts.DiagnosticCategory` -> `error`/`warning`/`suggestion`/`message`; code classifier `TS####`/`NG8xxx`/`ATC9000x` over all three families | unit (data-driven) | same | `core/json-report.spec.ts` |
| FMT-03/D-06 | NO `\x1b` byte in the payload, and payload byte-identical under `FORCE_COLOR=1` vs plain | unit | same | `core/json-report.spec.ts` |
| D-03 | JSON payload TOP-LEVEL + `summary` KEY SET drift-lock (mirror `EXPECTED_KEYS`/`schema-parity` pattern) | unit | same | NEW `core/json-report.drift.spec.ts` (or in `json-report.spec.ts`) |
| FMT-02 | Exit-code PARITY: same stubbed `CoreResult` yields the IDENTICAL exit code under `--format human` and `--format json`, INCLUDING the coverage-incomplete `errorCount===0`/`success===false` case | unit (stubbed core) | same | `cli/main.spec.ts` (extend; template at `main.spec.ts:106-203`, coverage-incomplete at `:143-153`) |
| CLIX-02 | `--quiet` skips `emitAdvisoryNotices` (stderr chatter gone) but stdout payload + exit code UNCHANGED | unit (stubbed core) | same | `cli/main.spec.ts` (extend the CLI-03 routing block `:225-258`) |
| CLIX-02 | `--color`/`--no-color` override precedence (flag WINS over `NO_COLOR`/`FORCE_COLOR`/TTY); machine format stays plain regardless | unit | same | `cli/main.spec.ts` (extend the ARGS-05 block `:299-326`); `cli/parse-args.spec.ts` for the enum + `allowNegative` parse |
| FMT-01 | `format` enum threaded: both `schema-parity.spec.ts` gain `'format'` in `EXPECTED_KEYS`; `parse-args` accepts `human`/`json`/`sarif` and rejects an out-of-enum value as `usageError` | unit | same | `executors/.../schema-parity.spec.ts`, `builders/.../schema-parity.spec.ts`, `cli/parse-args.spec.ts` |
| FMT-01 | HELP_TEXT + README flag drift-lock stays green after adding the new flags (Pitfall 7) | unit (fs read) | same | `standalone-cli-docs.spec.ts` (`:39-93`) |
| OBS-01 | `totalFilesCount` captured on the direct path (non-declaration count) and surfaced in JSON `summary`; a negative test locks that `evaluateResult` NEVER reads it | unit + integration | `nx test` + `nx integration angular-typechecker` | `core/run-typecheck.spec.ts` (unit stub) + a real-compiler `*.integration.spec.ts` for the actual count |
| FMT-01/ADD-01 | Human output byte-identical with `--format` omitted; `render-report.spec.ts` still green after `format: 'human'` added to its 6 calls | unit | `nx test` | `core/render-report.spec.ts` (`:51-128`) |

### Sampling Rate
- **Per task commit:** `nx test angular-typechecker` (fast Vitest loop).
- **Per wave / plan merge:** `nx test angular-typechecker && nx typecheck angular-typechecker && nx lint angular-typechecker` (Pitfall 8: the spec type-check + lint are separate gates).
- **Phase gate (before `/gsd-verify-work`):** the full suite above plus `nx format:check` green; `index.drift.ts` compiles (additive-only proxy for the Phase-32 audit).

### Wave 0 Gaps (tests/scaffolding needed before implementation)
- [ ] `core/json-report.spec.ts` -- REP-01 shape/snapshot/severity/code/file-less/off-by-one/no-ANSI (the primary VER-01 deliverable).
- [ ] JSON payload-key drift-lock -- either a `core/json-report.drift.spec.ts` or a describe block reusing the `EXPECTED_KEYS` pattern (D-03).
- [ ] `cli/main.spec.ts` EXTENSION -- exit-code parity across `human`/`json` (incl. coverage-incomplete), `--quiet`-gates-stderr-only, `--color`/`--no-color` override. Reuse the shipped `vi.hoisted` + `vi.mock(importOriginal)` harness (`main.spec.ts:29-50`) and the `coreResult(errorCount)` factory (`:69-82`).
- [ ] `cli/parse-args.spec.ts` EXTENSION -- `--format` enum accept/reject; `--no-color` parses to `color:false` under `allowNegative`.
- [ ] Both `schema-parity.spec.ts` -- add `'format'` to `EXPECTED_KEYS` + a default-value assertion (executor `:39-45,66-69`; builder `:49-55,93-99`).
- [ ] `core/run-typecheck.spec.ts` + a `totalFilesCount` real-compiler `*.integration.spec.ts` -- OBS-01 capture + the verdict-neutrality negative test.
- [ ] `core/render-report.spec.ts` -- add `format: 'human'` to the 6 existing calls (`:53-122`); optionally add a `format: 'json'` dispatch assertion.
- No framework install needed (Vitest is present).

## Security Domain

> `security_enforcement` is absent in `.planning/config.json` (= enabled). Phase 30 is a pure reporter over already-filtered data; the surface is small.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation / Output Encoding | yes | JSON via `JSON.stringify` ONLY -- never hand-concatenate; it escapes quotes/newlines/control chars in diagnostic messages (Pitfall "Security", PITFALLS.md) |
| V5 (path/info disclosure) | yes | `file` paths are repo-relative via `pathBase` (`format-report.ts:99-101` convention) -- never leak the maintainer's absolute local path (`D:\Users\...`) into a payload that may be committed/uploaded |
| V6 Cryptography | no | none in scope (no `partialFingerprints` hashing -- that is Phase 31 SARIF) |
| V2/V3/V4 (auth/session/access) | no | build-tooling library; no auth surface |

### Known threat patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Content-isolation break (emitting a dependency's diagnostic TEXT) | Information disclosure | Reporter emits ONLY what is in `CoreResult.diagnostics` (already boundary-filtered at `run-typecheck.ts:839-853`); node_modules suppressions are COUNTS only, never text (`emit-advisory-notices.ts:134-140`) |
| Malformed JSON from an unescaped message | Tampering (breaks downstream parse) | `JSON.stringify` (D-06); never hand-build JSON |
| Absolute local path leak in the payload | Information disclosure | repo-relative forward-slash `file` via `pathBase` |
| Reporter crash swallowed into a clean verdict | Repudiation / false-pass | reporter throw propagates to the infra catch -> exit 2 (Pitfall 13); never `try/catch`-to-success |

## Sources

### Primary (HIGH confidence -- shipped source, read directly this session)
- `packages/angular-typechecker/src/core/render-report.ts` (the seam, `RenderOptions:18-22`, `renderReport:43-55`) -- the widen target.
- `.../core/run-typecheck.ts` (`CoreOptions:20-45`, `CoreResult:54-140`, `presentIfNonEmpty:256-263`, `finalizeUnion:278-313`, direct path `328-504`, `handleMultiTsConfig:635-730`, `finalize:825-908`).
- `.../core/evaluate-result.ts` (`Outcome:54-58`, `EvaluateInput:84-93`, `evaluateResult:116-181`, coverage-incomplete `120-141`).
- `.../core/format-report.ts` (`ANSI_PATTERN:11`, `formatReport:57-83` always-colorizes at `:80`).
- `.../core/diagnostic-codes.ts` (`NG:41`, `ngCodeOf:52`, synthesized `90001`/`90002` `108-109`, `synthesizeFilelessError:122-135`).
- `.../core/emit-advisory-notices.ts` (`emitAdvisoryNotices:23-31`) + `.../core/logger.ts` (`Logger:19-23`).
- `.../core/gather-diagnostics.ts` (`runNoEmitCompilation:114-127`, non-declaration source-file iteration `152-153`).
- `.../core/walk-references.ts` (`LeafAccumulator:111-116`, `gatherLeafInto:145-161`, `WalkResult:41-74`).
- `.../cli/parse-args.ts` (`ParsedOptions:22-32`, `HELP_TEXT:65-84`, `parseArgs options:105-122`, max-warnings guard `:151`) + `.../cli/main.ts` (`colorFromEnv:58-74`, compose `115-186`, `renderReport` call `157-161`).
- `.../executors/typecheck/{schema.json,schema.d.ts,normalize-options.ts,executor.ts,schema-parity.spec.ts}` + `.../builders/typecheck/{schema.json,schema-parity.spec.ts}`.
- `.../index.ts` (barrel `14-19`) + `.../index.drift.ts` (additive tripwire).
- `.../core/render-report.spec.ts` (6 calls needing `format:'human'`), `.../cli/main.spec.ts` (VER-01 harness + coverage-incomplete `143-153`), `.../standalone-cli-docs.spec.ts` (HELP_TEXT/README drift-lock `39-93`).
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` (the CJS->ESM `await import()` bridge -- informs the Phase-31 lazy SARIF import; here it justifies moving `loadCompilerCli` into the human branch).
- `.planning/config.json` (`nyquist_validation:true`), `project.json` (targets), `package.json` (version 0.2.2, Node floor).

### Secondary (HIGH confidence -- existing milestone research, synthesized not duplicated)
- `.planning/research/v0.2.3-reporters/SUMMARY.md`, `ARCHITECTURE.md`, `FEATURES.md`, `PITFALLS.md` -- the seam, the JSON shape, the severity table, the 14 pitfalls (Phase-30 subset: 1,2,3,6,10,13,14). STACK.md (`node-sarif-builder`, Phase 31).
- `.planning/phases/30-.../30-CONTEXT.md` (D-01..D-13, locked), `.planning/REQUIREMENTS.md` (FMT/REP/OBS/CLIX/VER), `.planning/ROADMAP.md` (Phase 30 goal + 30-01/02/03 sketches).

### Tertiary (verified this session)
- Node `util.parseArgs` `allowNegative` (`--no-color` negation) -- added v22.4.0 [VERIFIED: nodejs/node PR #53107; Node docs]. Corrects the upstream ARCHITECTURE.md claim that omitted the `allowNegative` caveat.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new deps; every API is shipped and cited with line numbers.
- Architecture (seam widen, shared projection, threading, totalFilesCount): HIGH -- verified line-by-line against the shipped v0.2.2 source; matches the HIGH-confidence milestone research.
- Pitfalls: HIGH -- the Phase-30 subset maps to concrete shipped files; two repo-specific gotchas (HELP_TEXT drift-lock, spec-not-type-checked) grounded in the actual specs.
- Validation Architecture: HIGH -- VER-01 slices map to the shipped Vitest harness (`main.spec.ts`) and drift-lock patterns.

**Research date:** 2026-07-18
**Valid until:** ~30 days (stable internal codebase; the only external fact, `allowNegative`, is a settled Node feature).
