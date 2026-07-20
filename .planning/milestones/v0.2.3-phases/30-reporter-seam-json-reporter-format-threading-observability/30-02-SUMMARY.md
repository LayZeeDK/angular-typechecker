---
phase: 30-reporter-seam-json-reporter-format-threading-observability
plan: 02
subsystem: core
tags: [json-reporter, render-report, diagnostic-record, format-dispatch, JSON.stringify, ngCodeOf, evaluate-result, drift-lock, nx-plugin]

# Dependency graph
requires:
  - phase: 30-01 (totalFilesCount observability)
    provides: "CoreResult.totalFilesCount? (OPTIONAL) — surfaced as summary.totalFilesCount, tolerated when undefined"
  - phase: v0.1.0 reference-walk engine (archived)
    provides: "CoreResult, renderReport seam, format-report (human), diagnostic-codes (ngCodeOf / synthesizeFilelessError / 90001-90002), evaluate-result (evaluateResult verdict owner)"
provides:
  - "core/diagnostic-record.ts — the ONE shared pure projection (positionsOf file-less-safe off-by-one helper, codeStringOf TS/NG8xxx/ATC9000x via ngCodeOf carrying code+rawCode, category severity, exported relativizePath) that Phase 31's SARIF reporter reuses (D-13)"
  - "core/json-report.ts — formatJsonReport(result, ts_, opts): JSON.stringify-only flat diagnostics[] + rich summary; verdict DELEGATED to evaluateResult; messages via flattenDiagnosticMessageText (no ANSI possible); formatVersion 1 + tool + manifest version"
  - "ReportFormat = 'human'|'json'|'sarif' + widened RenderOptions (optional format default human, maxWarnings?, strict?) on core/render-report.ts; renderReport dispatches on format, loads compiler-cli only for human, throws on sarif (Phase 31)"
  - "JSON payload key drift-locks (top-level / summary / advisories / diagnostic-record) — the D-03 stability tripwire"
affects: [30-03 adapter --format/--quiet/--color threading, 31 SARIF reporter reuses the diagnostic-record projection, 32 additive-only git-diff audit + JSON schema validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ONE shared diagnostic->normalized-record projection reused by JSON now and SARIF later (positions/codes/paths cannot drift)"
    - "Zero-dependency machine reporter: JSON.stringify ONLY over CoreResult; messages from ts.flattenDiagnosticMessageText so ANSI is structurally impossible"
    - "Verdict DELEGATED to evaluateResult in the reporter (never re-derived from counts) — coverage-incomplete stays success:false at errorCount 0"
    - "Optional format discriminator on the render seam (default human) so shipped callers compile unchanged (additive-only)"
    - "Payload key drift-lock (EXPECTED_KEYS + Object.keys().sort()) mirroring the shipped schema-parity tripwire"

key-files:
  created:
    - packages/angular-typechecker/src/core/diagnostic-record.ts
    - packages/angular-typechecker/src/core/json-report.ts
    - packages/angular-typechecker/src/core/json-report.spec.ts
    - packages/angular-typechecker/src/core/__snapshots__/json-report.spec.ts.snap
  modified:
    - packages/angular-typechecker/src/core/render-report.ts
    - packages/angular-typechecker/src/core/render-report.spec.ts
    - packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts

key-decisions:
  - "diagnostic-record.ts is a SEPARATE module (not inlined in json-report.ts) — D-13 mandates a shared projection Phase 31's SARIF reporter reuses verbatim; a standalone pure module is the clean reuse boundary"
  - "Exported ONE relativizePath from diagnostic-record.ts, reused for diagnostic file + tsConfigPath + all path-bearing advisory fields — the single T-30-04 no-absolute-leak mitigation, forward-slashed + cross-OS stable"
  - "advisories file paths (templateCheckAborted.fileName, skippedReferences[].referencePath, suppressedInGraphFiles, notTypeCheckedDeclaredFiles) are relativized too; bundlerQueryImports are module specifiers so they pass through verbatim (Rule 2 — avoid leaking the maintainer's absolute path/username)"
  - "format is OPTIONAL (default human), overriding RESEARCH A2's 'required' recommendation per the plan/D-12 — shipped callers (main.ts, executor.ts) compile unchanged; a default-omitted test proves the default resolves to human"
  - "Four key drift-locks (top-level/summary/advisories/diagnostic-record), beyond the required top-level+summary, since the payload key set is the D-03 stability contract Phase 31 SARIF + Phase 32 additive-audit depend on"

patterns-established:
  - "Shared pure projection (D-13) as a reuse seam across machine formats"
  - "JSON.stringify-only, ANSI-impossible-by-construction machine reporter"
  - "Verdict delegation (never re-derivation) inside a reporter"
  - "Maximal-fixture key drift-lock for a serialized payload"

requirements-completed: [FMT-01, FMT-02, FMT-03, REP-01, VER-01]

coverage:
  - id: D1
    description: "Shared diagnostic->normalized-record projection (D-13/D-01): file-less-safe 0-based->1-based positionsOf, codeStringOf TS/NG8xxx/ATC9000x via ngCodeOf carrying code+rawCode, category severity, repo-relative relativizePath"
    requirement: REP-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#diagnostic-record projection (D-13 / D-01) > positionsOf > projects 0-based positions to 1-based on both axes for start AND end (hand-counted)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#diagnostic-record projection (D-13 / D-01) > toDiagnosticRecord > carries BOTH the humanized code string and the raw code int across all three families"
        status: pass
    human_judgment: false
  - id: D2
    description: "formatJsonReport emits the JSON.stringify-only flat diagnostics[] + rich summary payload with formatVersion 1, tool, manifest version, drift-locked key sets"
    requirement: REP-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#formatJsonReport (REP-01 / D-02..D-07 / FMT-02/FMT-03) > serializes the full payload shape (snapshot, version redacted for release-stability)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#JSON payload key drift-lock (D-03) > locks the top-level payload keys / summary keys / advisories keys / each diagnostic record key set"
        status: pass
    human_judgment: false
  - id: D3
    description: "Verdict DELEGATED to evaluateResult (D-07/FMT-02): coverage-incomplete run keeps summary.success:false at errorCount 0 — reporter never re-derives from counts"
    requirement: FMT-02
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#formatJsonReport (REP-01 / D-02..D-07 / FMT-02/FMT-03) > delegates the verdict to evaluateResult -- coverage-incomplete keeps success:false at errorCount 0 (D-07)"
        status: pass
    human_judgment: false
  - id: D4
    description: "File-less diagnostic (synthesized 90001) never dropped — file:null + null positions, payload diagnostics.length one-to-one with CoreResult.diagnostics (Pitfall 10)"
    requirement: REP-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#formatJsonReport (REP-01 / D-02..D-07 / FMT-02/FMT-03) > never drops a file-less diagnostic -- file:null + null positions, length one-to-one (Pitfall 10)"
        status: pass
    human_judgment: false
  - id: D5
    description: "No ANSI byte in the payload, byte-identical under FORCE_COLOR=1 (FMT-03/D-10) — messages built from flattenDiagnosticMessageText, never the colorizing human renderer"
    requirement: FMT-03
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#formatJsonReport (REP-01 / D-02..D-07 / FMT-02/FMT-03) > emits no ANSI byte and is byte-identical under FORCE_COLOR=1 (FMT-03 / D-10)"
        status: pass
    human_judgment: false
  - id: D6
    description: "renderReport widened (D-12/FMT-01): dispatches on optional format (default human), json->formatJsonReport (loads ts, NOT compiler-cli), sarif throws Phase-31, human loads compiler-cli only in-branch and stays byte-identical"
    requirement: FMT-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/render-report.spec.ts#renderReport (D-02 seam) > dispatches format:json to formatJsonReport (parseable, ANSI-free payload)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/render-report.spec.ts#renderReport (D-02 seam) > throws a Phase-31 error for format:sarif (enum valid here, renderer deferred)"
        status: pass
      - kind: unit
        ref: "packages/angular-typechecker/src/core/render-report.spec.ts#renderReport (D-02 seam) > defaults to the human format when format is omitted (D-12 -- callers compile unchanged)"
        status: pass
    human_judgment: false
  - id: D7
    description: "summary.totalFilesCount surfaced present-if-defined and OMITTED (not null) when undefined — 30-01 tolerance (OBS-01/VER-01)"
    requirement: VER-01
    verification:
      - kind: unit
        ref: "packages/angular-typechecker/src/core/json-report.spec.ts#formatJsonReport (REP-01 / D-02..D-07 / FMT-02/FMT-03) > surfaces totalFilesCount when present and OMITS the key when undefined (30-01 tolerance)"
        status: pass
    human_judgment: false

# Metrics
duration: 26min
completed: 2026-07-18
status: complete
---

# Phase 30 Plan 02: Reporter seam + zero-dependency JSON reporter Summary

**A shared pure `diagnostic-record` projection (positions/codes/paths), a `JSON.stringify`-only `formatJsonReport` that delegates its verdict to `evaluateResult` and cannot emit ANSI, and a widened `renderReport` that dispatches on an optional `format` (loading `@angular/compiler-cli` only for the human branch) — human output byte-identical, barrel byte-unchanged.**

## Performance

- **Duration:** ~26 min
- **Started:** 2026-07-18T03:26:23Z
- **Completed:** 2026-07-18T03:52:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- **`core/diagnostic-record.ts` (D-13):** the ONE shared, pure `ts.Diagnostic -> normalized record` projection Phase 31's SARIF reporter will reuse verbatim — a file-less-safe `positionsOf` off-by-one helper (0-based `+1` on both axes for start AND end; all-`null` when file/start undefined), `codeStringOf` classifying `TS####` / `NG8xxx` (via the shipped `ngCodeOf`) / `ATC9000x` and carrying BOTH `code` and `rawCode` (D-01), category-based `severity` (never the code sign), and an exported `relativizePath` (repo-relative forward-slash — the T-30-04 no-absolute-leak mitigation). No `@angular/compiler-cli` import.
- **`core/json-report.ts` (REP-01):** `formatJsonReport(result, ts_, opts)` — a flat `diagnostics[]` + rich `summary` payload built ENTIRELY with `JSON.stringify` (zero new dependency), messages from `ts.flattenDiagnosticMessageText` so an ANSI byte is structurally impossible (byte-identical under `FORCE_COLOR=1`). `summary.outcome`/`success` are DELEGATED to `evaluateResult` (D-07) — the coverage-incomplete case (`errorCount === 0` but `success === false`) is preserved as data. `formatVersion: 1` + `tool` + manifest `version`; `totalFilesCount` present-if-defined; `advisories` present-if-non-empty with all file paths relativized.
- **Widened `core/render-report.ts` seam (D-12/FMT-01):** `ReportFormat` + optional `format` / `maxWarnings` / `strict` on `RenderOptions`; the `result` param widened to the full `CoreResult`; `switch (format ?? 'human')` routes `json -> formatJsonReport` (loads `typescript` only), `sarif -> throw` "Phase 31", `human -> loadCompilerCli()` moved INSIDE the branch. Human output is byte-identical to v0.2.2; shipped callers compile unchanged.
- **Drift-locks (D-03):** top-level, `summary`, `advisories`, and per-diagnostic key sets are pinned against a maximal fixture (the payload stability contract Phase 31 + Phase 32 rely on).
- **Additive-only held:** `index.ts` barrel, `index.drift.ts`, and `evaluate-result.ts` byte-unchanged; the new symbols are NOT in the public barrel.

## Task Commits

1. **Task 1: shared diagnostic-record projection (D-13/D-01)** — `6bfe04d` (test, RED) -> `896b69c` (feat, GREEN)
2. **Task 2: formatJsonReport over the projection + JSON key drift-lock** — `84e68d6` (test, RED) -> `9c4f83c` (feat, GREEN)
3. **Task 3: widen the renderReport seam to dispatch on format (D-12/FMT-01)** — `fe49c1d` (feat)

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md — final `docs` commit.

_TDD tasks 1 & 2 used separate RED (`test(...)`) -> GREEN (`feat(...)`) commits — the repo has no pre-commit test gate, so the failing-test RED commit is unblocked._

## Files Created/Modified
- `packages/angular-typechecker/src/core/diagnostic-record.ts` — NEW shared projection (positionsOf / codeStringOf / severity / relativizePath / toDiagnosticRecord); pure, no compiler-cli import.
- `packages/angular-typechecker/src/core/json-report.ts` — NEW `formatJsonReport`; JSON.stringify-only, verdict delegated, ANSI-impossible.
- `packages/angular-typechecker/src/core/json-report.spec.ts` — NEW projection + payload specs (shape/snapshot/severity/file-less/no-ANSI/drift-lock/totalFilesCount-tolerance).
- `packages/angular-typechecker/src/core/__snapshots__/json-report.spec.ts.snap` — NEW full-shape snapshot (version redacted for release-stability).
- `packages/angular-typechecker/src/core/render-report.ts` — MODIFIED: `ReportFormat`, optional `format`/`maxWarnings`/`strict`, full-`CoreResult` param, format dispatch, compiler-cli moved into the human branch.
- `packages/angular-typechecker/src/core/render-report.spec.ts` — MODIFIED: full-`CoreResult` factory; 6 human calls widened; new default/json/sarif dispatch tests.
- `packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts` — MODIFIED (Rule 3): passes the full `result` to the widened seam.

## Decisions Made
- **Separate `diagnostic-record.ts` module** rather than inlining in `json-report.ts` — D-13 wants a shared projection Phase 31 reuses; a standalone pure module is the clean reuse boundary.
- **ONE exported `relativizePath`** used for the diagnostic `file`, `tsConfigPath`, and every path-bearing advisory field — a single, consistent no-absolute-leak mitigation (T-30-04).
- **Advisory file paths relativized too** (Rule 2 — a committed/uploaded machine payload must not leak the maintainer's absolute path/username); `bundlerQueryImports` (module specifiers) pass through unchanged.
- **`format` OPTIONAL (default `human`)** per the plan/D-12, overriding RESEARCH A2's "required" suggestion — shipped callers compile unchanged; a dedicated default-omitted test proves the default resolves to human.
- **Four key drift-locks** (not just the required two) — the payload key set is the D-03 stability contract Phase 31 (SARIF reuse) and Phase 32 (additive audit) depend on.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `ts99-leak.integration.spec.ts` passed a partial `{ diagnostics }` to the widened `renderReport`**
- **Found during:** Task 3 (widening `renderReport`'s `result` param to the full `CoreResult`)
- **Issue:** A second in-tree caller (beyond the 6 in `render-report.spec.ts` the plan named) passed `{ diagnostics: result.diagnostics }`, which is not assignable to `CoreResult`. `nx test` (esbuild) passed regardless; `nx typecheck` (tsc) caught it (Pitfall 8 — the exact "specs don't type-check under the test runner" class).
- **Fix:** The local `result` is already a full `CoreResult` from `runTypecheck`, so the call now passes `result` directly (the human branch reads only `.diagnostics`; `format` defaults to human).
- **Files modified:** `packages/angular-typechecker/src/core/ts99-leak.integration.spec.ts`
- **Verification:** `nx typecheck` green; the ts99-leak integration spec passes against the real compiler.
- **Committed in:** `fe49c1d` (Task 3 commit)

**2. [Rule 3 - Blocking] Prettier line-wrap on `json-report.spec.ts`**
- **Found during:** Task 3 (`nx format:check` is a Task-3 gate; Tasks 1-2 verified only `nx test`/`nx typecheck`)
- **Issue:** A `skippedReferences` object literal in the Task-2 spec exceeded the print width; `nx format:check` (maxWarnings-equivalent strict gate) flagged it.
- **Fix:** `npx prettier --write` — whitespace-only line-wrap, no behavior change.
- **Files modified:** `packages/angular-typechecker/src/core/json-report.spec.ts`
- **Verification:** `nx format:check` exit 0; the spec still passes.
- **Committed in:** `fe49c1d` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — a widened-signature caller fix and a formatting fix, both direct consequences of this plan's changes). No scope creep; no production-code deviation.
**Impact on plan:** Necessary for `nx typecheck` and `nx format:check` to pass. The `renderReport` signature widening naturally required updating every in-tree caller that constructed a partial.

## Issues Encountered
- The GSD `state.*` helpers mis-fired on this multi-plan phase: `state advance-plan` read the phase number (30) as the plan index, declared "last_plan", and mangled STATE.md (`milestone_name` -> `-- Machine-readable reporters)`, `status: verifying`, `percent: 0`). Discarded via `git checkout -- .planning/STATE.md` and updated STATE.md directly (matching the hand-formatted 30-01 style). This matches the prompt's forewarning about the `milestone_name` mangling.

## Known Stubs
None that block the plan goal. The `renderReport` `sarif` case throws "the SARIF reporter lands in Phase 31" BY DESIGN (D-12 / RESEARCH Open Question 2): the `'sarif'` enum member is a valid `--format` value threaded here so the adapters can carry it in 30-03, but its renderer is deliberately deferred to Phase 31. The JSON reporter is wired end-to-end and consumed by the widened seam.

## Threat Flags
None. This plan introduces no new network endpoint, auth path, file-access pattern, or trust-boundary schema change beyond the `CoreResult.diagnostics -> stdout` boundary the plan's `<threat_model>` already covers. The T-30-03 (JSON.stringify only), T-30-04 (relativized paths, no absolute leak), and T-30-06 (verdict delegated to evaluateResult) mitigations are all implemented and spec-asserted.

## Next Phase Readiness
- **30-03 (adapter `--format`/`--quiet`/`--color` threading):** the widened `renderReport(result, { format, maxWarnings, strict, ... })` seam is ready; `format` is optional (default human) so `main.ts` / `executor.ts` compile unchanged until 30-03 threads real values. FMT-01's three-adapter threading, FMT-03's stdout/stderr split, and VER-01's exit-code-parity / `--quiet` slices complete there.
- **Phase 31 (SARIF):** `core/diagnostic-record.ts` is the shared projection to reuse verbatim; reach the renderer via `await import('./sarif-report')` and replace the `sarif` throw.
- Requirements FMT-01/FMT-02/FMT-03/REP-01/VER-01 left Pending in REQUIREMENTS.md — closed at phase verification (the project's documented convention; 30-01 likewise left OBS-01/VER-01 Pending).
- All gates green: `nx test` 489, `nx integration` 120, `nx typecheck`, `nx lint` (maxWarnings:0), `nx format:check`.

## Self-Check: PASSED

---
*Phase: 30-reporter-seam-json-reporter-format-threading-observability*
*Completed: 2026-07-18*
