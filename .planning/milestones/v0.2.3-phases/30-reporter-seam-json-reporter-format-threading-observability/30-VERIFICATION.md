---
phase: 30-reporter-seam-json-reporter-format-threading-observability
verified: 2026-07-18T04:27:49Z
status: passed
score: 8/8 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 30: Reporter seam + JSON reporter + `--format` threading + observability Verification Report

**Phase Goal:** A user selects machine-readable JSON (or the default human) output via one `--format` flag threaded identically through all three adapters (Nx executor, Angular CLI builder, standalone CLI), and gets a stable, documented, agent-parseable JSON payload on stdout — while the verdict and exit code stay owned by the engine (`evaluateResult`/`toExitCode`), never re-derived by the reporter. Establishes the widened `renderReport` seam + full three-adapter plumbing the Phase-31 SARIF reporter reuses. Additive-only patch bump (0.2.2 -> 0.2.3): `--format` omitted -> human output byte-identical to v0.2.2; `builder.ts` unchanged.

**Verified:** 2026-07-18T04:27:49Z
**Status:** passed
**Re-verification:** No — initial verification

**Method:** Read the actual source (not SUMMARY prose) for every file the three plans claim to have created/modified; cross-referenced every `must_haves` truth/artifact/key_link/prohibition against that source; diffed the additive-only-charter files against the `angular-typechecker@0.2.2` release tag; and directly EXECUTED (not just read) the single named tests that prove each behavior-dependent truth — `npx vitest run -t "<name>"` for the unit-tier claims and a live cold-compiler run for the integration-tier dedupe proof — plus independent `tsc --noEmit`, `eslint --max-warnings=0`, and `prettier --check` passes over the phase's touched files.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **FMT-01** — `--format <human\|json\|sarif>` (default human) is threaded identically through the standalone CLI, the Nx executor, and the Angular CLI builder; both schema-parity specs include `'format'`; an out-of-enum value is a usage error | VERIFIED | `cli/parse-args.ts:137,189-199` validates the enum and returns `usageError`; `executors/typecheck/schema.json:36-41` + `builders/typecheck/schema.json:33-38` declare an identical `enum:["human","json","sarif"]` / `default:"human"` property; `executors/typecheck/schema-parity.spec.ts:41-48,78-81` and `builders/typecheck/schema-parity.spec.ts:51-58,105-108` both assert `'format'` in `EXPECTED_KEYS` plus the enum/default. Live-executed `parse-args.spec.ts` ("--format / --quiet / --color / --no-color" block, incl. "rejects an out-of-enum --format") and both schema-parity specs pass (see Behavioral Spot-Checks). |
| 2 | **FMT-02** — reporters are pure functions over `CoreResult`; `evaluateResult`/`toExitCode` stay the sole verdict owners; exit code is IDENTICAL across `human`/`json`, incl. the coverage-incomplete `errorCount===0`/`success===false` case | VERIFIED | `json-report.ts:70-73` obtains `{success, outcome}` only via `evaluateResult(result, {...})` — no `errorCount`/count read to decide success anywhere in the file (confirmed by full read). `cli/main.ts:179-184` and `executors/typecheck/executor.ts:76` both compute the 0/1 split from `evaluateResult(...).success` only; git diff vs `angular-typechecker@0.2.2` shows those exit-compose lines UNCHANGED. **Directly executed** `main.spec.ts`'s "FMT-02 / D-07: exit-code parity across --format human and --format json" describe block — 3/3 tests pass, including the coverage-incomplete case under both formats. |
| 3 | **FMT-03** — the machine payload has no ANSI byte (even under `FORCE_COLOR=1`) and goes to stdout only; advisories go to stderr; the json/sarif paths never colorize | VERIFIED | `diagnostic-record.ts` builds every message via `ts_.flattenDiagnosticMessageText` (never `formatReport`/`formatDiagnostics`); `json-report.ts` never reads `color`. `cli/main.ts:160-173` writes `emitAdvisoryNotices` before/separately from the `renderReport` payload, and the payload is returned as `stdout` while notices accumulate in the `BufferingLogger` (-> `stderr`). **Directly executed** `json-report.spec.ts`'s "emits no ANSI byte and is byte-identical under FORCE_COLOR=1" test and `main.spec.ts`'s CLI-03 stdout/stderr routing block — both pass. |
| 4 | **REP-01** — `--format json` emits a stable, agent-parseable payload: flat `diagnostics[]` (repo-relative `file`\|null, 1-based positions, `code`+`rawCode`, `severity`, `message`) + `summary` (outcome/success, category counts, `totalFilesCount`, present-if-non-empty `advisories`), `formatVersion`+`tool`+`version`, `JSON.stringify`-only, drift-locked keys | VERIFIED | `json-report.ts:65-108` builds exactly this payload shape; `diagnostic-record.ts` is the shared projection (`positionsOf`/`codeStringOf`/`relativizePath`/`toDiagnosticRecord`). **Directly executed** `json-report.spec.ts`'s full describe blocks (`diagnostic-record projection`, `formatJsonReport`, `JSON payload key drift-lock`) via the full-file live run (see Behavioral Spot-Checks) — all pass, including the 4 key-drift-lock assertions (top-level/summary/advisories/diagnostic keys) and the file-less-never-dropped assertion. |
| 5 | **OBS-01** — an OPTIONAL `CoreResult.totalFilesCount` (non-declaration source-file count) is captured on the direct live-Program path and via a name-deduped `Set<string>` across walked leaves; `evaluateResult` NEVER reads it | VERIFIED | `run-typecheck.ts:140-153` declares `totalFilesCount?: number` (the ONLY new `CoreResult` field vs `0.2.2`, confirmed by `git diff angular-typechecker@0.2.2..HEAD`); direct-path capture at `run-typecheck.ts:523-526` filters `!sf.isDeclarationFile`; `walk-references.ts:116-129,181-187` accumulates a name-deduped `Set<string>`; `evaluate-result.ts`'s `EvaluateInput` Pick (unchanged since 0.2.2, confirmed by empty `git diff`) omits the field entirely. **Directly executed** `run-typecheck.spec.ts`'s verdict-neutrality negative test (byte-identical verdict with/without the field across 4 counts, on both a clean and a failing base) AND the real-cold-compiler `total-files-count.integration.spec.ts` — both pass, the latter asserting the exact deduped literal `2` for the doubly-compiled `shared.component.ts` + its generated shim (a dedupe regression would yield 4). |
| 6 | **CLIX-02** — `--quiet` gates `emitAdvisoryNotices` (stderr) ONLY, never the payload or verdict; `--color`/`--no-color` win over `NO_COLOR`>`FORCE_COLOR`>TTY, human path only | VERIFIED | `cli/main.ts:151,160` — `parsed.color ?? colorFromEnv(env)` and `if (!parsed.quiet) { emitAdvisoryNotices(...) }`; `parse-args.ts` registers `color`/`quiet` with `allowNegative:true` for `--no-color`. **Directly executed** `main.spec.ts`'s "CLIX-02 / D-09: --quiet silences the stderr advisory ONLY" test and the ARGS-05 color-precedence block (incl. `--no-color wins over FORCE_COLOR=1` / `--color wins over NO_COLOR`) — all pass. |
| 7 | **VER-01 (Unit)** — pure-reporter unit + snapshot specs exist and pass: JSON shape, severity mapping, exit-code parity, no-ANSI-under-FORCE_COLOR, `--quiet` gating | VERIFIED | All of the above tests are real, executable Vitest specs (`json-report.spec.ts`, `render-report.spec.ts`, `main.spec.ts`, `parse-args.spec.ts`, both `schema-parity.spec.ts`, `total-files-count.integration.spec.ts`) — not placeholders. **Directly executed** every cited test via `npx vitest run -t "<name>"` / full-file runs; all pass (see Behavioral Spot-Checks for the full list and exit codes). |
| 8 | **Additive-only charter** (ROADMAP SC4) — with `--format` omitted, human output is byte-identical to `0.2.2`; the widened seam + new field + schema enum are all additive; `builder.ts` is unchanged | VERIFIED | `git diff angular-typechecker@0.2.2 HEAD --` on `src/index.ts`, `src/index.drift.ts`, `src/core/evaluate-result.ts`, and `src/builders/typecheck/builder.ts` is EMPTY (byte-unchanged) for all four. `render-report.ts`'s diff shows only additive fields (`format?`, `maxWarnings?`, `strict?` — all optional) and the `result` param widened from `Pick<CoreResult,'diagnostics'>` to full `CoreResult` (backward-compatible: every real caller already passed a full `CoreResult`). `render-report.spec.ts`'s "defaults to the human format when format is omitted" test passes live. `index.drift.ts` (the additive-only barrel tripwire) independently re-compiled clean via `tsc --noEmit -p tsconfig.drift.json` (exit 0). |

**Score:** 8/8 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `core/run-typecheck.ts` | `totalFilesCount?` + direct-path capture + `finalizeUnion` threading | VERIFIED | Read in full; `CoreResult.totalFilesCount?: number` (:152), direct capture (:523-526), `finalizeUnion` param + spread (:292-333). |
| `core/walk-references.ts` | `LeafAccumulator.sourceFileNames: Set<string>` + `gatherLeafInto` population | VERIFIED | `LeafAccumulator` (:116-129), `gatherLeafInto` populates the Set (:181-187), `WalkResult.totalFilesCount` (:78, :372-375). |
| `core/total-files-count.integration.spec.ts` | Real-compiler exact-literal dedupe proof | VERIFIED | Exists, asserts `toBe(2)` against the `solution-style-overlap` fixture. Executed live against a real cold compiler — passes (2455ms). |
| `core/diagnostic-record.ts` | Shared pure projection (`positionsOf`, `codeStringOf`, `relativizePath`, `toDiagnosticRecord`) | VERIFIED | Read in full; pure module, no `@angular/compiler-cli` import; exports all four. |
| `core/json-report.ts` | `formatJsonReport(result, ts_, opts)` | VERIFIED | Read in full; delegates verdict to `evaluateResult`, builds payload via `JSON.stringify` only. |
| `core/render-report.ts` | Widened seam (`format?`, dispatch, compiler-cli only in human branch) | VERIFIED | Read in full; `switch (options.format ?? 'human')`, `loadCompilerCli()` only inside the `human`/`default` case. |
| `core/json-report.spec.ts` | Shape/snapshot/severity/code/file-less/off-by-one/no-ANSI + key drift-lock | VERIFIED | Read in full (479 lines); every claimed assertion present. Executed live — all targeted describe blocks pass. |
| `cli/parse-args.ts` | `--format`/`--quiet`/`--color`/`--no-color` + `HELP_TEXT` | VERIFIED | Read in full; enum guard (:189-199), `allowNegative:true` (:127), 4 new `HELP_TEXT` rows (:87-93). |
| `cli/main.ts` | Thread `format`+`maxWarnings`+`strict`; color override; quiet gate | VERIFIED | Read in full; `color` (:151), `quiet` gate (:160), `renderReport` call (:164-173). |
| `executors/typecheck/{schema.json,schema.d.ts,normalize-options.ts,executor.ts}` | `format` enum + forward | VERIFIED | All four read; enum property, `TypecheckExecutorOptions.format?`, `NormalizedOptions.format` default, `executor.ts` destructure+forward (:45,60-66). |
| `builders/typecheck/schema.json` | `format` enum; `builder.ts` UNCHANGED | VERIFIED | Enum property identical to executor's; `git diff angular-typechecker@0.2.2 HEAD -- builder.ts` is empty. |
| Both `schema-parity.spec.ts`, `cli/main.spec.ts`, `cli/parse-args.spec.ts`, `README.md` `### Options` rows | VER-01 parity/quiet/color + docs | VERIFIED | All read + executed live; README rows for `--format`/`--quiet`/`--color`/`--no-color` present (`README.md:529-532`) and self-enforced by the live-passing `standalone-cli-docs.spec.ts`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `run-typecheck.ts` `finalizeUnion` | `CoreResult.totalFilesCount` | value-presence spread of the walked Set size | WIRED | `finalizeUnion` takes `totalFilesCount: number` as its final param and spreads it (:327-332); both callers (`handleSolutionWalk`, `handleMultiTsConfig`) pass `walk.totalFilesCount` / `acc.sourceFileNames.size`. |
| `walk-references.ts` `gatherLeafInto` | `LeafAccumulator.sourceFileNames` | shared per-leaf gather helper | WIRED | Used identically by `walkReferences` (:358) and `run-typecheck.ts`'s `handleMultiTsConfig` (:727) — one accumulation path for both multi-tsconfig entry points. |
| `render-report.ts` json branch | `json-report.ts` `formatJsonReport` | direct call in the `switch` | WIRED | `render-report.ts:65-71`; confirmed by the live-passing "dispatches format:json to formatJsonReport" spec. |
| `json-report.ts` | `diagnostic-record.ts` projection + `evaluate-result.ts` `evaluateResult` | import + call | WIRED | `json-report.ts:1-2,70-73,102-104`; confirmed live via the "delegates the verdict to evaluateResult" spec (uses the REAL `evaluateResult`, not a stub). |
| `executors/typecheck/executor.ts` | `render-report.ts` `renderReport` | `format`/`maxWarnings`/`strict` forwarded | WIRED | `executor.ts:45,56-66` destructures `format` from `normalizeOptions` and forwards it; `builder.ts` inherits via `convertNxExecutor(typecheckExecutor)` (byte-unchanged, confirmed by empty git diff). |
| `cli/main.ts` `run()` | `render-report.ts` `renderReport` + `emitAdvisoryNotices` | `parsed.format`/`!parsed.quiet` gate | WIRED | `main.ts:160,168-172`; confirmed live via `lastFormat()` wiring-guard test (`--format json` -> `lastFormat()==='json'`; omitted -> `'human'`). |

### Data-Flow Trace (Level 4)

Not a UI/dashboard phase (no fetched-and-rendered dynamic data), so the standard component-prop trace does not apply. The equivalent trace here is engine-count -> reporter payload -> stdout:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `json-report.ts` `summary.totalFilesCount` | `result.totalFilesCount` | Live `ts.Program.getSourceFiles()` count (direct) / name-deduped `Set` (walk) | Yes — the real-cold-compiler `total-files-count.integration.spec.ts` asserts the exact non-hardcoded literal `2` (computed from a real 2-leaf solution-tsconfig walk, not a stub) | FLOWING |
| `json-report.ts` `diagnostics[]` | `result.diagnostics` mapped through `toDiagnosticRecord` | Every element of the real `CoreResult.diagnostics` (never filtered, never a hardcoded `[]`) | Yes — `Pitfall 10` test proves `payload.diagnostics.length === result.diagnostics.length` including a file-less entry | FLOWING |
| `json-report.ts` `summary.outcome`/`success` | `evaluateResult(result, opts)` | The real, unstubbed verdict function (not re-derived from local counts) | Yes — the coverage-incomplete test proves `success:false` survives even at `errorCount:0` | FLOWING |

### Behavioral Spot-Checks

All commands run from `packages/angular-typechecker/` (or repo root where noted). Each is a targeted single-named-test or single-spec-file run, not a full-suite run.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| FMT-02 exit-code parity (human vs json, incl. coverage-incomplete) | `npx vitest run -t "exit-code parity"` | 3/3 passed | PASS |
| D-11 verdict-neutrality negative test | `npx vitest run -t "verdict-neutral"` | 1/1 passed | PASS |
| CLIX-02 `--quiet`/color-override gating | `npx vitest run -t "quiet"` | 8/8 passed | PASS |
| FMT-03 no-ANSI-under-FORCE_COLOR | `npx vitest run -t "emits no ANSI byte and is byte-identical under FORCE_COLOR"` | 1/1 passed | PASS |
| D-03 JSON key drift-lock (top-level/summary/advisories/diagnostic) | `npx vitest run -t "locks the top-level payload keys\|locks the summary keys\|locks the advisories keys\|locks each diagnostic record key set"` | 4/4 passed | PASS |
| OBS-01/VER-01 real-compiler exact-literal dedupe proof | `npx vitest run --config vitest.integration.config.mts -t "counts the doubly-compiled shared"` | 1/1 passed (2455ms, real cold compiler) | PASS |
| Standalone-cli-docs self-enforcing flag/README drift-lock | `npx vitest run src/standalone-cli-docs.spec.ts` | 9/9 passed | PASS |
| Additive-only barrel tripwire re-compiles | `npx tsc --noEmit -p tsconfig.drift.json` | exit 0 | PASS |
| Spec tier type-checks (catches what esbuild/vitest misses) | `npx tsc --noEmit -p tsconfig.spec.json` | exit 0 | PASS |
| Lib (production) tier type-checks | `npx tsc --noEmit -p tsconfig.lib.json` | exit 0 | PASS |
| Lint on all phase-30-touched production files | `npx eslint --max-warnings=0 <10 files>` | exit 0 | PASS |
| Format-check on all phase-30-touched files | `npx prettier --check <10 files>` | "All matched files use Prettier code style!" | PASS |
| `builder.ts` byte-unchanged vs 0.2.2 | `git diff --exit-code angular-typechecker@0.2.2 HEAD -- .../builder.ts` | exit 0 | PASS |
| `index.ts`/`index.drift.ts`/`evaluate-result.ts` byte-unchanged vs 0.2.2 | `git diff --stat angular-typechecker@0.2.2 HEAD -- <4 files>` | empty output | PASS |

### Probe Execution

N/A — no `scripts/*/tests/probe-*.sh` convention in this repo and none declared in the phase's PLAN/SUMMARY files. Skipped.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| FMT-01 | 30-02, 30-03 | `--format` selector threaded through all 3 adapters, default human | SATISFIED | Truth #1 above; live-passing schema-parity + parse-args specs. |
| FMT-02 | 30-02, 30-03 | Reporters pure over `CoreResult`; verdict/exit-code never re-derived | SATISFIED | Truth #2 above; live-passing exit-code-parity spec. |
| FMT-03 | 30-02, 30-03 | Machine payload stdout-only, no ANSI ever; advisories to stderr | SATISFIED | Truth #3 above; live-passing no-ANSI + stdout/stderr routing specs. |
| REP-01 | 30-02 | Stable, documented-shape, agent-parseable JSON payload | SATISFIED | Truth #4 above; live-passing shape/snapshot/drift-lock specs. |
| OBS-01 | 30-01 | Optional, verdict-neutral `totalFilesCount`, real dedupe | SATISFIED | Truth #5 above; live-passing negative test + real-compiler integration spec. |
| CLIX-02 | 30-03 | `--quiet` stderr-only gate; `--color`/`--no-color` override | SATISFIED | Truth #6 above; live-passing specs. |
| VER-01 | 30-01, 30-02, 30-03 | Unit-tier pure-reporter specs (this phase's slice; VER-02/03 integration/e2e tier is Phase 32 per REQUIREMENTS.md) | SATISFIED | Truth #7 above; every cited spec exists and executes green. |

No orphaned requirements: cross-referencing `.planning/REQUIREMENTS.md`'s Traceability table, exactly these 7 IDs map to Phase 30, and the union of the three plans' `requirements:` frontmatter fields (`[OBS-01,VER-01]` + `[FMT-01,FMT-02,FMT-03,REP-01,VER-01]` + `[FMT-01,FMT-03,CLIX-02,VER-01]`) covers all 7 with no gaps and no extras.

### Anti-Patterns Found

None. Scanned every phase-30-modified production file (`core/{json-report,diagnostic-record,render-report,run-typecheck,walk-references}.ts`, `cli/{parse-args,main}.ts`, `executors/typecheck/{executor,normalize-options,schema.json,schema.d.ts}`, `builders/typecheck/schema.json`) for `TODO|FIXME|HACK|PLACEHOLDER|TBD|XXX` — zero matches. No stub returns, no hardcoded empty payloads backing a "real" field, no console-only implementations. The one intentional `throw` (the `sarif` case in `render-report.ts`) is a documented, tested, in-scope deferral to Phase 31 (not a debt marker) — it is asserted by a passing spec (`render-report.spec.ts`: "throws a Phase-31 error for format:sarif").

### Human Verification Required

None. Every truth in this phase is either a structural/type-level invariant (confirmed by `tsc --noEmit` + source read + `git diff` against the last release tag) or a behavior-dependent claim with a real, executable test that was directly run in this verification pass (not merely read or trusted from SUMMARY.md).

### Deferred Items

Not gaps — explicitly scoped to later phases per `.planning/REQUIREMENTS.md`'s own Traceability table and this phase's `30-CONTEXT.md` "NOT in this phase" section:

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | `--format sarif` renderer (the enum member is already accepted/threaded here; only its output is unimplemented) | Phase 31 | ROADMAP Phase 31 goal: "The lazy-`import()`ed `node-sarif-builder` SARIF 2.1.0 reporter..."; REP-02/VER-04 map to Phase 31 in REQUIREMENTS.md. |
| 2 | Real-cold-compiler integration/e2e proof of `--format json` end-to-end through the packed CLI/executor/builder (VER-02/VER-03) | Phase 32 | ROADMAP Phase 32 goal: "Integration + shipped-tarball e2e across all three adapters..."; VER-02/VER-03 map to Phase 32. This phase's own `30-CONTEXT.md` states VER-01 (Unit) is Phase 30's slice; the Unit-tier wiring is proven end-to-end at the function-call level (`render-report.spec.ts`'s dispatch test + `main.spec.ts`'s `lastFormat()` guard + `bin.ts`, unmodified since Phase 27, already proven to write `run()`'s `stdout` to the real stream). |
| 3 | Full README `## Machine-readable output` prose documenting the JSON payload schema + SARIF recipe (DOC-01) — only the `### Options` flag rows landed this phase | Phase 32 | `30-03-PLAN.md` explicitly states "the full `## Machine-readable output` prose is DEFERRED to Phase 32 (DOC-01)"; ROADMAP Phase 32 goal includes "the README/CHANGELOG"; DOC-01 maps to Phase 32 in REQUIREMENTS.md. |
| 4 | Additive-only git-diff AUDIT as a formal artifact (ADD-01) | Phase 32 | ADD-01 maps to Phase 32 in REQUIREMENTS.md. (This verification independently re-confirmed the specific additive-only invariants the audit will formalize — see Truth #8 — but the formal audit artifact itself is Phase 32's deliverable.) |

### Gaps Summary

No gaps. All 8 observable truths (mapping the 4 ROADMAP success criteria plus the 7 requirement IDs, deduplicated) are VERIFIED with direct source evidence, `git diff`-confirmed additive-only invariants against the `angular-typechecker@0.2.2` release tag, and live-executed tests for every behavior-dependent claim (exit-code parity, verdict-neutrality, `--quiet` gating, no-ANSI-under-FORCE_COLOR, the real-compiler dedupe count, and the docs self-enforcement spec). Independent `tsc --noEmit` (drift/spec/lib tiers), `eslint --max-warnings=0`, and `prettier --check` re-runs on every phase-touched file all pass cleanly, corroborating the orchestrator's reported gate results rather than merely trusting them. Phase goal achieved; ready to proceed.

---

*Verified: 2026-07-18T04:27:49Z*
*Verifier: Claude (gsd-verifier)*
