# Requirements: angular-typechecker -- Milestone v0.2.3 (Machine-readable reporters)

**Defined:** 2026-07-18
**Core Value:** Deliver the complete Angular type-check (TypeScript + template type-check + extended NG8xxx) for any project type without building the app or running the tests -- faster, in isolation, and more completely than the build's coupled check or a bare `ngc --noEmit`.

**Milestone goal:** Add machine-readable output -- JSON (agent-parseable) and SARIF 2.1.0 (GitHub Code Scanning `upload-sarif`) -- across all three adapters (Nx executor, Angular CLI builder, standalone CLI) over the one shared `runTypecheck` core, so AI coding agents and CI can consume the complete diagnostic set as data. **Additive-only patch bump (`0.2.2 -> 0.2.3`).**

## Milestone v0.2.3 Requirements

### FMT (format selector + reporter seam)

- [ ] **FMT-01**: A user selects the output format via `--format <human|json|sarif>` on the standalone CLI and a matching `format` option on the Nx executor + Angular CLI builder, default `human`. Implemented by widening the EXISTING `core/render-report.ts` `renderReport` seam with a `format` discriminator and threading the enum through all three adapter entry points (CLI `parse-args`, executor `schema.json` + `schema.d.ts` + `normalize-options`, builder `schema.json`; both `schema-parity` specs gain `'format'`). With `--format` omitted, behavior is byte-identical to v0.2.2 (`builder.ts` unchanged).
- [ ] **FMT-02**: The reporters are PURE functions over `CoreResult` and NEVER change the verdict or exit code -- `evaluateResult` / `toExitCode` remain the sole owners, and the same input yields the IDENTICAL exit code across `human` / `json` / `sarif`. (Anti-false-pass: a coverage-incomplete run has `errorCount === 0` but `success === false`; a reporter must never re-derive success from counts.)
- [ ] **FMT-03**: The machine payload (JSON/SARIF) is written to **stdout only**; every advisory notice, warning, and error goes to **stderr** via the injected `Logger`. No ANSI color ever appears in a machine payload, regardless of TTY / `FORCE_COLOR` (messages built from `ts.flattenDiagnosticMessageText`, never the human colorizing renderer).

### REP (reporters)

- [ ] **REP-01**: `--format json` emits a stable, documented, agent-parseable payload -- a flat `diagnostics[]` (each: `file` [repo-relative path or `null` for file-less], **1-based** `line`/`column`/`endLine`/`endColumn`, a humanized `code` string [`TS####` / `NG8xxx` / `ATC9000x`] AND the raw `rawCode` int, `severity`, `message`) plus a `summary` carrying the discriminated `outcome`, category counts, `totalFilesCount`, and the structured suppression/advisory fields (`suppressedInGraph*`, `templateCheckAborted`, `skippedReferences`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`). No new dependency (`JSON.stringify`). A `formatVersion` marker + tool version; the payload keys are drift-locked. (Design defaults, adjustable at plan time: carry BOTH the decoded label and the raw code; do NOT surface a non-deterministic `durationMs`; do NOT publish a hosted `$schema` URL this milestone.)
- [x] **REP-02**: `--format sarif` emits valid SARIF 2.1.0 for GitHub Code Scanning `upload-sarif` -- `runs[].tool.driver` (name / version / informationUri + a `rules[]` catalog for the 18 NG8xxx extended diagnostics) and `results[]` (humanized `ruleId`, mapped `level`, `message.text`, `locations[]` with **repo-relative forward-slash** `artifactLocation.uri` + **1-based** `region`, and self-computed `partialFingerprints`), with deterministic `results[]` ordering. Built with `node-sarif-builder` (`^4.1.0`, MIT, CommonJS) **lazy-`import()`ed ONLY on the SARIF path**. File-less diagnostics (synthesized 90001/90002, global TS) are represented, never dropped. (Design default, adjustable at plan time: file-less diagnostics emit a **no-location result** and rely on the verdict/exit code as the authoritative fail signal, rather than anchoring a synthetic region on the tsconfig.)

### OBS (observability)

- [ ] **OBS-01**: An OPTIONAL `CoreResult.totalFilesCount` field (additive; `evaluateResult` never reads it), captured from the live `Program` on the direct path and a deduped `Set` of source-file names across walked leaves, surfaced in the JSON `summary`. (Design default, adjustable at plan time: count **non-declaration** source files -- the meaningful "files checked" number -- rather than raw `@nx/js`-parity all-files.)

### CLIX (CLI ergonomics)

- [ ] **CLIX-02**: `--quiet` suppresses advisory/notice chatter on stderr (NEVER the machine payload, NEVER the verdict -- the never-silent charter); `--color` / `--no-color` are explicit overrides layered above the shipped `NO_COLOR` > `FORCE_COLOR` > TTY precedence (machine formats stay unconditionally plain either way).

### VER (verification -- the repo's Vitest pyramid + CI matrix)

Test tiers mirror the shipped strategy: **Unit** = `*.spec.ts` (`test` target, `dependsOn: build`); **Integration** = `*.integration.spec.ts` (real cold `@angular/compiler-cli`); both ride the LEAN 6-cell OS x Node matrix. **e2e** = the packed tarball + Verdaccio + real installs, per-project dynamic CI matrix.

- [ ] **VER-01 (Unit)**: Pure-reporter unit + snapshot specs -- JSON shape (flat `diagnostics[]`, 1-based positions, code strings, file-less `null`, `summary`/`outcome`); SARIF shape; the `ts.DiagnosticCategory` -> SARIF `level` / JSON `severity` mapping; exit-code PARITY across `human`/`json`/`sarif` (stubbed core, incl. the coverage-incomplete `errorCount === 0`/`success === false` case); no-ANSI-in-payload under `FORCE_COLOR=1`; `--quiet` gates stderr chatter only.
- [ ] **VER-02 (Integration)**: `run()` + the executor exercised over committed real-cold-compiler fixtures emitting JSON + SARIF; the SARIF validated against the 2.1.0 schema (dev-only validator); volatile fields (`durationMs`, tool version) redacted; byte-stable across the OS/Node cells (incl. Windows path -> forward-slash URI).
- [ ] **VER-03 (Shipped-tarball e2e)**: The SHIPPED tarball emits valid JSON + schema-valid SARIF via all three adapters (Nx executor, `ng run`, CLI `--format`); asserts stdout-purity (payload parses) and exit-code parity across formats.
- [ ] **VER-04 (nx-free + interop guard)**: A require-graph guard proves the human / JSON / CLI-boot paths never load `node-sarif-builder`; a REAL-import (not mock) integration test proves the `node-sarif-builder` CJS-under-`await import()` interop (`(mod.default ?? mod)`).

### ADD (additive-only charter)

- [ ] **ADD-01**: Additive-only vs `angular-typechecker@0.2.2` -- NO breaking change to the Nx executor id (`angular-typechecker:typecheck`), the `runTypecheck` / `CoreResult` / `CoreOptions` public API (a new `format` option + an OPTIONAL `totalFilesCount` field only), the Angular CLI builder, the CLI flag set, or the generator schemas. `renderReport` is not in the public barrel (its widening is internal). The `index.drift.ts` barrel tripwire stays green; a git-diff audit runs before release. `node-sarif-builder` is classified as a `dependency` and the `@nx/dependency-checks` lazy-only-`import()` visibility watch-item is resolved (scoped `ignoredDependencies` with a one-line comment if the rule cannot see it). The `v0.3.0` escape hatch triggers only if a breaking change proves unavoidable.

### DOC (docs)

- [ ] **DOC-01**: A README `## Machine-readable output` section documents the `--format` flag, the JSON payload schema, and the SARIF `upload-sarif` recipe -- including the "run from the repo root so `artifactLocation.uri` stays repo-relative" caveat -- plus a curated public CHANGELOG entry in end-user language (no internal ids).

## Future Requirements

Deferred to a later milestone. Tracked, not in this roadmap.

### Reporters

- **REP-03**: Additional reporter formats (`codeclimate`, `compact`, GitLab Code Quality).
- **REP-04**: A published, versioned JSON Schema (`$schema` URL) for the JSON payload, once the shape has stabilized in the wild.
- **REP-05**: SARIF `relatedInformation` -> `relatedLocations` enrichment.

### CLI ergonomics

- **CLIX-01**: `--watch` mode (needs the deferred `NgtscProgram` incremental engine, WALK-FUT-02).
- **CLIX-03**: `--output <file>` (shell redirection `> results.sarif` covers this today).

## Out of Scope

Explicitly excluded this milestone. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `--watch` mode | Needs the deferred `NgtscProgram` incremental engine (WALK-FUT-02) -- the natural future `v0.3.0` trigger. |
| `--output <file>` flag | Shell redirection (`> out.sarif`) already covers file output; no need to own file I/O this milestone. |
| Other reporter formats (codeclimate / compact / GitLab) | JSON (agents) + SARIF (GitHub Code Scanning) cover the core value; more formats are additive later (REP-03). |
| A published hosted `$schema` URL for the JSON payload | Defer until the payload shape has stabilized (REP-04); a `formatVersion` marker + drift-lock is enough now. |
| New runtime dep for JSON or color | Node `JSON.stringify` + the shipped `formatDiagnostics` / `colorFromEnv` cover it; the ONE new dep is `node-sarif-builder` (SARIF only). |
| Config-file discovery / implicit tsconfig / glob input | Conflicts with the whole-program "explicit tsconfig path" engine contract (carried from v0.2.2). |
| Off-stack Angular 20/21 verification | On-stack Angular 22 only (dropped from all gates since v0.2.1). |

## Traceability

Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FMT-01 | Phase 30 | Pending |
| FMT-02 | Phase 30 | Pending |
| FMT-03 | Phase 30 | Pending |
| REP-01 | Phase 30 | Pending |
| REP-02 | Phase 31 | Complete |
| OBS-01 | Phase 30 | Pending |
| CLIX-02 | Phase 30 | Pending |
| VER-01 | Phase 30 | Complete |
| VER-02 | Phase 32 | Complete |
| VER-03 | Phase 32 | Pending |
| VER-04 | Phase 31 | Complete |
| ADD-01 | Phase 32 | Pending |
| DOC-01 | Phase 32 | Pending |

**Coverage:**

- Milestone requirements: 13 total
- Mapped to phases: 13 (Phase 30: 7 -- FMT-01/02/03, REP-01, OBS-01, CLIX-02, VER-01; Phase 31: 2 -- REP-02, VER-04; Phase 32: 4 -- VER-02, VER-03, ADD-01, DOC-01)
- Unmapped: 0

**Note on VER-01:** anchored to Phase 30 (the Unit tier -- the pure-reporter test harness, the JSON shape, the exit-code-parity mechanism, the no-ANSI check, and `--quiet` gating are established there alongside the JSON reporter). The SARIF-shape unit specs ride along in Phase 31 as part of REP-02's own work, and full cross-format exit-code parity is exercised once SARIF exists; the requirement is fully closed at phase verification.

---
*Requirements defined: 2026-07-18*
*Last updated: 2026-07-18 -- roadmap created (Phases 30-32), traceability populated (13/13 mapped, 0 unmapped)*
