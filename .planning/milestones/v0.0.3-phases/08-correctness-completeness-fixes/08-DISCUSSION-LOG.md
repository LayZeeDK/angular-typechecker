# Phase 8: Correctness & Completeness Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 8-correctness-completeness-fixes
**Mode:** `--analyze --auto --chain` (auto-locked COR-01/02/03; ONE trap-quadrant gray area, COR-04, escalated to an interactive decision because a human was in the loop)
**Areas discussed:** COR-04 infra-vs-type exit code (interactive); COR-01 config-crash detection, COR-02 global TS diagnostics, COR-03 empty-`fileName` (auto-locked, high-confidence)

---

## COR-04 -- Infra-vs-type exit code (interactive; trap-quadrant escalation)

Escalated rather than auto-locked: HIGH-IMPACT (public CI/agent contract; cross-surface
architecture; reframes a success criterion) + initially LOW-CONFIDENCE on mechanism.
Two prior-art research streams were run first (user-requested): the official `nx` source
at tag `23.0.1` and the nx.dev docs.

**Verified prior art that shaped the options:**
- Nx hard-maps executor `{ success }` to `success ? 0 : 1` (`run.ts:72`); final
  `process.exit(0|1)` with explicit arg clobbers `process.exitCode` (`command-object.ts:30`);
  failed task -> exactly 1 (`run-command.ts:475`).
- Only `process.exit(custom)` precedents are SIGNAL forwarding (>=128) in watch executors
  (`run-script.impl.ts:106`, `tsc.impl.ts:198-199`) -- no app-level "infra=2" prior art.
- Nx docs: boolean-only executor contract; no custom-code API; `process.exit` hostile to
  `runExecutor` composition + batch mode.
- User constraint: the codebase must support 3 surfaces (Nx executor / Angular CLI builder /
  standalone CLI). The CLI is the only process-owning surface.

| Option | Description | Selected |
|--------|-------------|----------|
| Core exit-code policy now; CLI wires literal code later (reframe SC4) | Pure `toExitCode(result\|error)->0\|1\|2` in core (single source of truth); executor surfaces infra as typed error + distinct message within `{success}` (exit 1); literal OS code delivered by the deferred standalone CLI consuming the same policy. Requires amending SC4/COR-04. | OK |
| `process.exit(2)` in the Nx executor now (keep SC4 literal) | Literally satisfies SC4 today but breaks in-process `runExecutor` / run-many / daemon / batch, fights the documented contract, and puts exit-code logic in the wrong layer for the future builder/CLI. | |
| Hybrid: core policy + guarded `process.exit` only when top-level | Core policy + fragile "am I top-level?" detection in the executor. Over-engineered; the CLI will own this properly anyway. | |

**User's choice:** Option A -- "Core exit-code policy now; CLI wires literal code later (reframe SC4)."
**Notes:** Confirmed the 3-surface architecture (Nx executor, Angular CLI builder wrapping
the executor, standalone CLI) as the framing. Option A puts the single source of truth in
core (`toExitCode`), keeps the executor within Nx's `{success}` contract, and lets the
deferred CLI deliver the literal `0/1/2`. Pre-authorizes amending ROADMAP SC4 + REQUIREMENTS
COR-04 (done this session).

---

## COR-01 -- Config-resolution infrastructure-crash detection (auto-locked)

**Trade-off analysis:** Detect a 500 (`UNKNOWN_ERROR_CODE`) in `parsed.errors` right after
`readConfiguration` and re-throw as `TypecheckInfrastructureError` vs. continue folding
`parsed.errors` verbatim (status quo -- mis-counts a broken `extends`/host as a type error).
Scope of "infra": code 500 ONLY vs. any `parsed.errors` entry.

**Auto-selected (recommended, high-confidence):** Detect by `code === UNKNOWN_ERROR_CODE`
ONLY, before the zero-rootNames guard / `performCompilation`; keep BOTH the new
`parsed.errors` scan and the existing post-`performCompilation` scan; only 500 is infra,
all other config errors stay reported. Grounded in PRIOR-ART-SUMMARY #1 + the existing
500-detection pattern at `run-typecheck.ts:171`.

## COR-02 -- Global / location-less TypeScript diagnostics (auto-locked)

**Trade-off analysis:** Add `getTsProgram().getGlobalDiagnostics()` in `gatherAllDiagnostics`
vs. in `run-typecheck` after `performCompilation`. Overlap/dedup with per-file
`getTsSemanticDiagnostics`.

**Auto-selected (recommended, high-confidence):** Add to `gatherAllDiagnostics` (single
gathering home; Program exposes `getTsProgram()`); `finalize`'s `sortAndDeduplicateDiagnostics`
handles any overlap. Grounded in PRIOR-ART-SUMMARY #2 / ENGINE-REFERENCE.

## COR-03 -- Present-but-empty `fileName` (auto-locked)

**Trade-off analysis:** Extend the file-less guard to include empty `fileName` vs. leave it
(status quo suppresses empty-`fileName` diagnostics as a false negative).

**Auto-selected (recommended, high-confidence):** `diagnostic.file === undefined || diagnostic.file.fileName === ''`
in `filter-diagnostics.ts:77`. Grounded in PRIOR-ART-SUMMARY #5 / SHIM-HARDENING.

---

## Claude's Discretion

- Exact filenames/signatures (`core/exit-codes.ts`, `toExitCode`), placement of
  `getGlobalDiagnostics()` within the gather array, and test-fixture mechanics -- deferred to
  research/planning.

## Deferred Ideas

- Standalone CLI surface (literal `process.exit(toExitCode(...))`) -- deferred feature.
- Angular CLI builder (`convertNxExecutor` wrap) -- deferred feature.
- OBS-01 `totalFilesCount` -- deferred pending charter-fit.
- Phase 10 HARD-01 must add `getTsProgram().getGlobalDiagnostics` to the drift getter-set
  assertion (cross-phase consequence of COR-02).
