# Phase 30: Reporter seam + JSON reporter + `--format` threading + observability - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended design defaults auto-locked)

<domain>
## Phase Boundary

Widen the EXISTING `core/render-report.ts` `renderReport` seam with a `format`
discriminator, add the zero-dependency JSON reporter (`core/json-report.ts`),
thread ONE `--format <human|json|sarif>` enum (+ `--quiet`, `--color`/`--no-color`)
identically through all three adapters (standalone CLI `parse-args`/`main`, Nx
executor `schema.json`/`schema.d.ts`/`normalize-options`, Angular CLI builder
`schema.json`, plus both `schema-parity` specs), and capture the OPTIONAL
`CoreResult.totalFilesCount` surfaced in the JSON summary.

**In this phase:** the widened seam, the JSON reporter, the full three-adapter
`--format`/`--quiet`/`--color` plumbing, `totalFilesCount`, and the Unit-tier
specs (VER-01 JSON slice: shape/snapshot, severity mapping, exit-code parity,
no-ANSI-under-`FORCE_COLOR`, `--quiet`-gates-stderr-only).

**NOT in this phase (Phase 31/32):** the SARIF reporter + `node-sarif-builder`
dependency + require-graph guard + CJS interop test (Phase 31); integration/
shipped-tarball e2e, SARIF schema validation, cross-OS determinism, the
additive-only git-diff audit, and README/CHANGELOG (Phase 32). The `'sarif'`
enum member is threaded here as a valid value; its RENDERER lands in Phase 31.

**Additive-only charter (carried, non-negotiable):** with `--format` omitted,
human output is byte-identical to `angular-typechecker@0.2.2`; `builder.ts` is
unchanged; `renderReport` is NOT in the public barrel (its widening is internal);
`CoreResult`/`CoreOptions` gain only the new `format` option + optional
`totalFilesCount`. Patch bump `0.2.2 -> 0.2.3`.

</domain>

<decisions>
## Implementation Decisions

All Phase-30 gray areas were pre-scoped by REQUIREMENTS.md as "Design defaults,
adjustable at plan time" and by the HIGH-confidence research SUMMARY's "Gaps to
Address". Per the `--auto` trap-quadrant rule, each was rated on IMPACT x
CONFIDENCE before auto-locking (see the audit table at the end of this section).
NONE fell in the HIGH-impact + NOT-HIGH-confidence trap quadrant, so all were
auto-locked to the researched recommended default. Each remains a legitimate
plan-time re-open if the planner surfaces new evidence.

### JSON payload shape (REP-01)
- **D-01:** Carry BOTH the humanized `code` string (`TS####` / `NG8xxx` /
  `ATC9000x`, via the shipped `ngCodeOf`) AND the raw `rawCode` int per
  diagnostic. Agents get a grep-able/stable code; `rawCode` preserves the exact
  TS/ng discriminator without lossy round-tripping.
- **D-02:** Flat top-level `diagnostics[]` (NOT ESLint-style per-file nesting) +
  a `summary` object. Each diagnostic: `file` (repo-relative path or `null` for
  file-less), 1-based `line`/`column`/`endLine`/`endColumn`, `code`, `rawCode`,
  `severity`, `message`. `summary` carries the discriminated `outcome`
  (`clean`/`type-error`/`coverage-incomplete`/`warnings-exceeded`), category
  counts, `totalFilesCount`, and the structured suppression/advisory fields
  (`suppressedInGraph*`, `templateCheckAborted`, `skippedReferences`,
  `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`) as DATA.
- **D-03:** Emit a `formatVersion` integer marker (start at **1**) + the tool
  `version`; drift-lock the payload key set with a spec that mirrors the shipped
  `schema-parity` / `EXPECTED_KEYS` tripwire pattern.
- **D-04:** Do NOT publish a hosted `$schema` URL this milestone (deferred to
  REP-04). `formatVersion` + the drift-lock is the stability contract for now.
- **D-05:** Do NOT surface a non-deterministic `durationMs` in the JSON payload
  (keeps snapshots byte-stable; observability timing is deferred). If any
  volatile field is ever added, it must be snapshot-redacted.
- **D-06:** Serialize with Node `JSON.stringify` ONLY -- ZERO new dependency for
  JSON. Build every message from `ts.flattenDiagnosticMessageText`, NEVER the
  human colorizing `formatReport`/`formatDiagnostics`, so ANSI is structurally
  impossible in the payload.

### Verdict / exit-code purity (FMT-02)
- **D-07:** The reporters are PURE functions over `CoreResult` and NEVER
  re-derive `success` from counts. `evaluateResult` / `toExitCode`
  (`core/evaluate-result.ts`) stay the SOLE verdict owners. The exit code is
  IDENTICAL across `human` / `json` / (later) `sarif` for the same input --
  including the coverage-incomplete case (`errorCount === 0` but
  `success === false`), the cardinal anti-false-pass. A reporter crash
  propagates as infra (exit 2), never a swallowed silent pass.

### stdout/stderr split + color/quiet (FMT-03, CLIX-02)
- **D-08:** The machine payload (JSON now, SARIF later) goes to **stdout ONLY**;
  every advisory notice / warning / error goes to **stderr** via the injected
  `Logger` (`core/logger.ts` + `emit-advisory-notices.ts`). No Nx chrome or
  stray `console.log` on stdout.
- **D-09:** `--quiet` silences the stderr advisory chatter ONLY -- never the
  payload, never the verdict (the never-silent charter). It gates
  `emitAdvisoryNotices`, nothing else.
- **D-10:** `--color` / `--no-color` are explicit overrides layered ABOVE the
  shipped `NO_COLOR` > `FORCE_COLOR` > TTY precedence and affect the HUMAN path
  ONLY. Machine formats (`json`/`sarif`) are unconditionally plain regardless of
  `--color` / `FORCE_COLOR=1` / TTY. Assert no `\x1b` byte in the payload under
  `FORCE_COLOR=1`.

### Observability -- totalFilesCount (OBS-01)
- **D-11:** `CoreResult.totalFilesCount` counts **non-declaration** source files
  (the meaningful "files checked" number for agents), NOT raw `@nx/js`-parity
  all-files. Captured from the live `Program` on the single-leaf/direct path and
  a deduped `Set<string>` of source-file names across walked leaves (dedupe the
  shared `lib.d.ts`). It is OPTIONAL and additive via the existing
  `presentIfNonEmpty` / conditional-spread idiom; **`evaluateResult` must NEVER
  read it** (verdict-neutral).

### Seam widening (FMT-01)
- **D-12:** Widen `renderReport`: add `format` to `RenderOptions`, widen the
  `result` param from `Pick<CoreResult,'diagnostics'>` to full `CoreResult`,
  branch on `format`, and move `loadCompilerCli()` INTO the human branch so the
  JSON (and later SARIF) paths never load the heavy ESM `@angular/compiler-cli`
  peer. Reach SARIF (Phase 31) only via `await import('./sarif-report')`.
- **D-13:** REP-01 produces a shared internal "diagnostic -> normalized record"
  projection (1-based positions via ONE shared off-by-one helper, code
  humanization, repo-relative path). Phase 31's SARIF reporter REUSES this exact
  projection so JSON and SARIF cannot drift on positions/codes/paths. Build the
  helper here with that reuse in mind.

### Claude's Discretion (planner-owned, no user preference expressed)
- Exact internal key names / nesting of the `summary.advisories` block, the
  precise `presentIfNonEmpty` call sites, the exact drift-lock spec filename, and
  the internal signature of the shared normalized-record projection are left to
  the planner, provided the observable payload matches D-01..D-06 and the
  additive-only charter holds.

### Auto-lock audit (IMPACT x CONFIDENCE per the `--auto` trap-quadrant rule)
| Decision | Impact | Confidence | Trap quadrant? | Basis |
|---|---|---|---|---|
| D-01/D-02/D-03 JSON shape + formatVersion | HIGH (public payload) | HIGH | No | HIGH-conf research (ESLint/Biome conventions + shipped `CoreResult`); locked in REP-01; risk hedged by `formatVersion` + deferred `$schema` + drift-lock |
| D-04 defer `$schema` URL | LOW (conservative) | HIGH | No | Out-of-Scope + REP-04 defer |
| D-05 omit `durationMs` | LOW (additive later) | HIGH | No | REP-01 default; avoids non-determinism |
| D-07 verdict purity | HIGH (correctness) | HIGH | No | FMT-02 is a hard charter invariant, already the shipped design |
| D-08/D-09/D-10 stdout/color/quiet | MEDIUM | HIGH | No | FMT-03 + CLIX-02; builds on shipped `colorFromEnv` precedence + `Logger` seam |
| D-11 totalFilesCount scope | LOW-MED (optional, verdict-neutral) | HIGH | No | OBS-01 default (non-declaration); trivially adjustable |

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or
implementing.**

### Milestone contract (locked requirements + goal)
- `.planning/REQUIREMENTS.md` -- FMT-01/02/03, REP-01, OBS-01, CLIX-02, VER-01
  (this phase); the "Design defaults, adjustable at plan time" annotations are
  the source of D-01..D-11. Also the Out-of-Scope table (no `--watch`,
  `--output`, other formats, `$schema` URL, new JSON/color dep, off-stack Ng).
- `.planning/ROADMAP.md` -> "Phase 30" -- goal, the 4 success criteria, and the
  3 plan sketches (30-01/02/03) that pre-decompose the work.

### v0.2.3 research (HIGH confidence; grounded in the shipped v0.2.2 source)
- `.planning/research/v0.2.3-reporters/SUMMARY.md` -- executive summary + "Gaps
  to Address" (the design choices this CONTEXT resolves) + phase-ordering.
- `.planning/research/v0.2.3-reporters/ARCHITECTURE.md` -- the `renderReport`
  seam + per-adapter threading with cited line numbers, `totalFilesCount`
  placement, the lazy-SARIF import boundary.
- `.planning/research/v0.2.3-reporters/FEATURES.md` -- table-stakes vs
  differentiators, `ts.DiagnosticCategory` -> severity mapping, concrete JSON
  shape, `--quiet`/`--color` conventions.
- `.planning/research/v0.2.3-reporters/PITFALLS.md` -- 14 pitfalls (stdout
  purity, ANSI, off-by-one, verdict coupling, etc.) with file-level prevention +
  per-pitfall verification. Phase-30-relevant: 1, 2, 3, 6, 10, 13, 14.
- `.planning/research/v0.2.3-reporters/STACK.md` -- `node-sarif-builder@4.1.0`
  (Phase 31, but confirms the JSON path stays dependency-free).

### Additive-only + release charter
- `.planning/PROJECT.md` -- Constraints (stack, additive-only 0.x charter).
- `AGENTS.md` -- Conventional-Commits/release mechanics + the additive-only rule.

### Shipped source this phase MODIFIES or REUSES (see code_context for detail)
- `packages/angular-typechecker/src/core/render-report.ts` -- the seam to widen.
- `packages/angular-typechecker/src/core/run-typecheck.ts` -- `CoreResult` +
  `finalize`/`finalizeUnion` (add `totalFilesCount`).
- `packages/angular-typechecker/src/core/evaluate-result.ts` -- `evaluateResult`
  + `toExitCode` (the SOLE verdict owners; UNTOUCHED).
- `packages/angular-typechecker/src/core/format-report.ts` -- the human reporter
  (do NOT reuse for the machine path).
- `packages/angular-typechecker/src/core/emit-advisory-notices.ts` +
  `core/logger.ts` -- the stderr advisory seam `--quiet` gates.
- `packages/angular-typechecker/src/core/diagnostic-codes.ts` -- `ngCodeOf` code
  humanizer.
- `.claude/skills/spike-findings-angular-typechecker/SKILL.md` -- the shipped
  CJS->ESM `await import()` bridge pattern (informs keeping `loadCompilerCli` in
  the human branch + the Phase-31 lazy SARIF import).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`renderReport` seam** (`core/render-report.ts`): the single async dispatcher
  ALL three adapters already call identically. Today it takes
  `Pick<CoreResult,'diagnostics'>` + `RenderOptions { pathBase?, color, failFast? }`
  and unconditionally loads `loadCompilerCli()` + `loadTypescript()` then
  delegates to `formatReport`. Widening it (add `format`, full `CoreResult`, move
  the compiler-cli load into the human branch) is the pivot of this phase.
- **`ngCodeOf`** (`core/diagnostic-codes.ts`): existing negative-code ->
  `NG8xxx` humanizer -- reuse for the `code` string (never surface the raw
  negative code as the label).
- **`colorFromEnv`** precedence (`NO_COLOR` > `FORCE_COLOR` > TTY): shipped;
  `--color`/`--no-color` layer above it, human-path only.
- **`emitAdvisoryNotices` + `Logger`** (`core/emit-advisory-notices.ts`,
  `core/logger.ts`): the injected-`Logger` stderr seam; `--quiet` gates exactly
  this call, nothing else.
- **`presentIfNonEmpty` / conditional-spread idiom** (`core/run-typecheck.ts`):
  the shipped additive pattern for optional `CoreResult` fields -- reuse for
  `totalFilesCount`.
- **`schema-parity` / `EXPECTED_KEYS` tripwire pattern** (both
  `{executors,builders}/typecheck/schema-parity.spec.ts`): reuse for the JSON
  payload-key drift-lock and to add `'format'` to the adapter schemas.

### Established Patterns
- **Pure detection(core)/rendering(adapter) split:** reporters are pure
  `(CoreResult, ts) => string` -- no `console`, no `process`, no verdict.
- **Three thin adapters over one core:** CLI `main.ts`, Nx executor, Angular CLI
  builder (`convertNxExecutor`) all compose `runTypecheck -> emitAdvisoryNotices
  -> renderReport -> evaluateResult` in the SAME order. `builder.ts` inherits the
  new `format` option via the shared `TypecheckExecutorOptions` and stays
  byte-unchanged.
- **`await import()` CJS->ESM bridge** (spike-findings skill): the shipped
  pattern for reaching ESM-only `@angular/compiler-cli`; the Phase-31 SARIF
  reporter reuses the shape for `node-sarif-builder`.

### Integration Points
- CLI: `src/cli/parse-args.ts` (`util.parseArgs` -> discriminated `ParseResult`)
  gains `--format`/`--quiet`/`--color`/`--no-color`; `src/cli/main.ts` threads it
  into `renderReport`. HELP_TEXT drift-lock updated.
- Executor: `src/executors/typecheck/schema.json` + `schema.d.ts` +
  `normalize-options.ts` gain the `format` enum (default `human`).
- Builder: `src/builders/typecheck/schema.json` gains the enum; `builder.ts`
  UNCHANGED.
- Both `schema-parity.spec.ts` gain `'format'`.
- `totalFilesCount`: `finalize` (single-leaf live `Program`) + `finalizeUnion`
  (walk `Set`-dedupe) in `core/run-typecheck.ts`.

</code_context>

<specifics>
## Specific Ideas

- The JSON container mirrors ESLint `-f json` / Biome at the FIELD-NAME level
  (`line`/`column`/`endLine`/`endColumn`/`severity`/`message`) but uses a FLAT
  `diagnostics[]` (simpler for agents than per-file nesting). `tsc` has no
  machine output, so there is no canonical shape to conform to.
- The discriminated `outcome` in `summary` is this tool's signature never-silent
  signal -- richer than pass/fail, and the mechanism that makes the
  coverage-incomplete anti-false-pass legible as data.

</specifics>

<deferred>
## Deferred Ideas

- **SARIF reporter + `node-sarif-builder`** -- Phase 31 (REP-02, VER-04). The
  `'sarif'` enum member is a valid `--format` value here; its RENDERER + the
  lazy-import boundary + require-graph guard + CJS interop test are Phase 31.
- **Integration / shipped-tarball e2e, SARIF schema validation, cross-OS
  determinism, additive-only git-diff audit, README/CHANGELOG** -- Phase 32
  (VER-02, VER-03, ADD-01, DOC-01).
- **`partialFingerprints` hashing recipe + file-less SARIF representation** --
  SARIF-only design choices, resolve in Phase 31.
- **Published hosted `$schema` URL** (REP-04), **`--output <file>`** (CLIX-03,
  shell redirection covers it), **other formats** (codeclimate/compact/GitLab,
  REP-03), **`--watch`** (CLIX-01, needs the deferred `NgtscProgram` engine) --
  future milestones, out of scope.

</deferred>

---

*Phase: 30-reporter-seam-json-reporter-format-threading-observability*
*Context gathered: 2026-07-18*
