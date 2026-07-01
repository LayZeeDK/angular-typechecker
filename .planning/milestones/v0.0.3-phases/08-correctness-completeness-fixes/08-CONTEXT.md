# Phase 8: Correctness & Completeness Fixes - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the EXISTING whole-program no-emit `runTypecheck` engine so it reports the
diagnostics it currently misses and classifies a config-resolution crash as
infrastructure (not a type error) -- closing the under-report / mis-classify
holes so a "clean" verdict is never a false negative and CI/agents can tell a
crash apart from real type errors. Covers COR-01..COR-04.

In scope: the four COR fixes against the existing `api.Program` surface (config
parse, gatherer, boundary filter, exit-code classification policy). NO
`NgtscProgram` migration. NO new executor option or feature surface. Each fix is
test-gated (failing-then-passing).

This is HOW to implement the four scoped COR requirements; it does not add new
capabilities. New surfaces (Angular builder, standalone CLI) remain deferred --
the design here only ensures we do not paint them into a corner.
</domain>

<decisions>
## Implementation Decisions

### COR-01 -- Config-resolution infrastructure-crash detection

- **D-01:** Immediately after `ng.readConfiguration(options.tsConfigPath)` (BEFORE
  the zero-rootNames guard and BEFORE `performCompilation`), scan `parsed.errors`
  for a diagnostic whose `code === ng.UNKNOWN_ERROR_CODE` (500). If found,
  re-throw as `TypecheckInfrastructureError` (flattened `messageText`). This is the
  config-parse crash (a broken `extends` / host) that today is folded verbatim into
  `configDiagnostics` (`run-typecheck.ts:110`) and mis-counted as a type error.
- **D-02:** Detect by CODE (`=== UNKNOWN_ERROR_CODE`) ONLY -- never by `source` or
  message text -- mirroring the existing post-`performCompilation` 500 check
  (`run-typecheck.ts:171`). KEEP BOTH checks: the new `parsed.errors` scan (config
  parse crash) AND the existing `result.diagnostics` scan (`createProgram` / host /
  gatherer-getter crash). Defense-in-depth at two distinct stages.
- **D-03:** ONLY code 500 is infrastructure. Every OTHER `parsed.errors` entry
  (genuine config diagnostics -- bad compiler option, etc.) stays folded into
  `configDiagnostics` and is reported/counted exactly as today. Do NOT broaden the
  infra classification beyond 500 -- the research confirms folding `parsed.errors`
  is "strictly better than @nx/js (throws) and AnalogJS (silent)".

### COR-02 -- Global / location-less TypeScript diagnostics

- **D-04:** Add `program.getTsProgram().getGlobalDiagnostics()` to
  `gatherAllDiagnostics` (`gather-diagnostics.ts`) -- the natural home (all gathering
  lives there; the Angular `api.Program` already exposes `getTsProgram()`, used at
  `run-typecheck.ts:199`). Append to the `all` array; placement is irrelevant because
  `finalize`'s `ts.sortAndDeduplicateDiagnostics` already orders + dedups, making any
  overlap with the per-file `getTsSemanticDiagnostics` safe. Verified: Angular's
  per-file `getTsSemanticDiagnostics` never emits TS global diagnostics (e.g. TS2318);
  `@angular/build` calls `getGlobalDiagnostics()` explicitly.
- **D-05 [informational]:** (cross-phase note, NOT implemented here; not tracked as a Phase-8 plan decision) Phase 10 HARD-01's drift
  getter-set assertion must include `getTsProgram().getGlobalDiagnostics` so this new
  call cannot silently drop out on an Angular upgrade.

### COR-03 -- Present-but-empty `fileName`

- **D-06:** In `filter-diagnostics.ts`, extend the file-less guard from
  `diagnostic.file === undefined` (`:77`) to also treat a present-but-empty
  `fileName` as file-less: `diagnostic.file === undefined || diagnostic.file.fileName === ''`.
  Today an empty `fileName` canonicalizes to `''` and is suppressed by the
  boundary filter (a false negative). File-less diagnostics are always kept.

### COR-04 -- Infra-vs-type classification + exit-code policy (3-surface design)

> Decision made interactively (this run, `--auto` paused for a trap-quadrant call).
> The literal ngc-style 2-vs-1 OS exit code can only live cleanly at a
> process-owning surface; the Nx executor is bound to `{ success }` -> 0/1.

- **D-07:** CORE owns the single source of truth. Add a pure, framework-agnostic
  exit-code policy in core (e.g. `core/exit-codes.ts`:
  `toExitCode(result | TypecheckInfrastructureError) -> 0 | 1 | 2` -- clean `0`,
  type errors (`errorCount > 0`) `1`, infra `2`; ngc-parallel). Fully unit-testable
  with NO process and NO compiler. (Exact filename/signature at planner discretion.)
- **D-08:** The Nx executor surfaces an infra failure DISTINCTLY within Nx's
  `{ success: boolean }` contract: catch `TypecheckInfrastructureError` -> distinct
  `logger.error` operator message (already present, `executor.ts:53`) +
  `return { success: false }` (Nx maps to exit 1). The executor does NOT call
  `process.exit` and does NOT attempt a numeric code.
- **D-09 [informational]:** (deferred CLI surface; not tracked as a Phase-8 plan decision) The literal distinct OS exit code (`2` infra / `1` type / `0` clean) is
  delivered by the STANDALONE CLI surface (DEFERRED feature) -- it owns its process
  (like `ngc`) and consumes the SAME `toExitCode` policy. The Angular CLI builder
  (deferred, `convertNxExecutor` wrap) inherits the executor's `{ success }` -> 0/1
  behavior. This is why the policy lives in core: one definition, three consumers.
- **D-10 [informational]:** (meta-reframe already applied to ROADMAP/REQUIREMENTS; not tracked as a Phase-8 plan decision) SC4 / COR-04 are REFRAMED accordingly. This discussion amends
  `.planning/ROADMAP.md` (Phase 8 SC4 + the phase bullet) and
  `.planning/REQUIREMENTS.md` (COR-04) so the phase verifier checks the reframed
  contract (engine classification + pure policy + distinct executor message), NOT a
  literal executor exit code it cannot deliver.

  **Rationale (verified prior art):** Nx hard-maps executor `{ success }` to 0/1
  (`run.ts:72`); the final `process.exit(0|1)` uses an explicit arg that clobbers any
  `process.exitCode` (`command-object.ts:30`); a failed task -> exactly 1
  (`run-command.ts:475`). The only official `process.exit(custom)` precedents are
  SIGNAL forwarding (>=128) in watch executors (`run-script.impl.ts:106`,
  `tsc.impl.ts:198-199`) -- no app-level "infra=2" prior art. Nx docs document a
  boolean-only contract; `runExecutor` composition + batch mode ("multiple tasks in
  a single process") make `process.exit` from an executor hostile. Verified against
  the `nx` clone at the exact `23.0.1` tag.

### Claude's Discretion

- Exact filenames / signatures (`core/exit-codes.ts`, `toExitCode` name), the
  precise placement of `getGlobalDiagnostics()` within the `gatherAllDiagnostics`
  array, and test-fixture mechanics are left to research/planning.
- Whether `toExitCode` takes a discriminated union or two overloads -- planner's call.

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Grounding research (the source of every COR requirement)

- `.planning/research/prior-art/PRIOR-ART-SUMMARY.md` -- improvements #1/#2/#5 map to
  COR-01/COR-02/COR-03; the "what is already correct -- do NOT change" list.
- `.planning/research/prior-art/ENGINE-REFERENCE.md` -- the `@angular/build` gatherer
  comparison (#2 global diagnostics; #1 per-file isolation context).
- `.planning/research/prior-art/COMPILER-CLI-INTERNALS.md` -- `UNKNOWN_ERROR_CODE`
  (500) / `parsed.errors` behavior (#1).
- `.planning/research/prior-art/SHIM-HARDENING.md` -- the empty-`fileName` edge (#5).

### Requirements / roadmap (as amended by this discussion)

- `.planning/REQUIREMENTS.md` -- COR-01..COR-04 (COR-04 reframed; see D-10).
- `.planning/ROADMAP.md` -- Phase 8 goal + Success Criteria (SC4 reframed; see D-10).

### Engine source (the exact edit points)

- `packages/angular-typechecker/src/core/run-typecheck.ts` -- config parse
  (`:105-110`), existing 500 detection (`:168-179`), `TypecheckInfrastructureError`
  (`:70`), `finalize` + `sortAndDeduplicateDiagnostics` (`:292-338`).
- `packages/angular-typechecker/src/core/gather-diagnostics.ts` -- the single edit
  point for COR-02.
- `packages/angular-typechecker/src/core/filter-diagnostics.ts` -- the file-less
  guard (`:77`), the single edit point for COR-03.
- `packages/angular-typechecker/src/executors/angular-typecheck/executor.ts` -- the
  infra catch block (`:51-61`), the COR-04 D-08 wiring point.
- `packages/angular-typechecker/src/core/evaluate-result.ts` -- the existing
  `{ success }` verdict; `toExitCode` is its exit-code sibling.
- `packages/angular-typechecker/eslint.config.mjs` -- `process.exit` ban is scoped to
  `**/src/core/**/*.ts` ONLY (`:55-63`); "the adapter owns I/O + exit" -- so the core
  exit-code policy must stay PURE (no `process.exit`).

### External prior art (reference only -- NOT in this repo)

- `nx` clone `D:/projects/github/nrwl/nx` @ tag `23.0.1`: `packages/nx/src/command-line/run/run.ts:72`,
  `.../run/command-object.ts:30`, `.../tasks-runner/run-command.ts:475`,
  `packages/nx/src/executors/run-script/run-script.impl.ts:106`,
  `packages/js/src/executors/tsc/tsc.impl.ts:198-199`.

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `TypecheckInfrastructureError` (`run-typecheck.ts:70`) is ALREADY the typed
  infra-vs-type signal -- reuse for COR-01 (re-throw) and COR-04 (`toExitCode`
  discriminator). No new error class needed.
- The existing 500-detection block (`run-typecheck.ts:168-179`) is the exact template
  for the COR-01 `parsed.errors` scan (same `=== UNKNOWN_ERROR_CODE` predicate, same
  `flattenDiagnosticMessageText` re-throw).
- `finalize`'s unconditional `ts.sortAndDeduplicateDiagnostics` (`:320`) already makes
  the COR-02 global/per-file overlap safe -- no manual dedup required.

### Established Patterns

- CORE is framework-agnostic and PURE: eslint bans `@nx/*` / `@angular-devkit/*`
  imports AND `process.exit` in `**/src/core/**` only. The COR-04 exit-code policy
  belongs in core but must NOT touch `process` -- process side effects live in the
  adapters (executor now, CLI later).
- Each correctness fix is test-gated failing-then-passing with a dedicated fixture:
  broken-`extends` config (COR-01), a global TS error e.g. TS2318 (COR-02), an
  empty-`fileName` diagnostic (COR-03), `toExitCode` unit cases + an executor
  infra-path test (COR-04).
- The core/adapter split (Phase 1 D-01) is the seam the 3-surface design rides on:
  one core policy, thin adapters per surface.

### Integration Points

- `run-typecheck.ts` orchestrates COR-01 (new early scan) + COR-02 (via the
  `gatherDiagnostics` callback) + COR-03 (via `filterDiagnostics`).
- `executor.ts` catch block is the COR-04 D-08 wiring point.
- New `core/exit-codes.ts` is consumed by the executor now (classification/messaging)
  and by the standalone CLI later (literal `process.exit`).

</code_context>

<specifics>
## Specific Ideas

- ngc parity is the north star for COR-04: `toExitCode` mirrors ngc's
  `exitCodeFromResult` intent (`0` clean / `1` type errors / `2` infra). The engine
  already models `@angular/build` for diagnostic COMPLETENESS (validated, unchanged).
- The three-surface architecture (Nx executor / Angular CLI builder / standalone CLI)
  is the framing that resolved COR-04: design the policy in core so all three consume
  one definition.

</specifics>

<deferred>
## Deferred Ideas

- **Standalone CLI surface** -- owns its process and calls `process.exit(toExitCode(...))`
  for the literal ngc-style 0/1/2; consumes the COR-04 D-07 policy. Deferred feature
  (PROJECT.md Out of Scope); the COR-04 design exists so this drops in cleanly later.
- **Angular CLI builder** (`convertNxExecutor` re-export) -- inherits the executor's
  `{ success }` -> 0/1. Deferred feature.
- **OBS-01 `totalFilesCount`** -- deferred pending charter-fit (PROJECT.md).
- **Phase 9 (RES) / Phase 10 (HARD)** items -- out of this phase. Cross-phase note:
  HARD-01 must add `getTsProgram().getGlobalDiagnostics` to the drift getter-set
  assertion (because COR-02 adds that call).

</deferred>

---

_Phase: 8-correctness-completeness-fixes_
_Context gathered: 2026-06-29_
