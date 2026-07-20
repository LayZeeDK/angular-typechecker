# Project Research Summary

**Project:** angular-typechecker (v0.2.3 milestone -- machine-readable JSON + SARIF reporters)
**Domain:** Additive reporter formats for a multi-adapter Nx / Angular-CLI / standalone-CLI type-check plugin
**Researched:** 2026-07-18
**Confidence:** HIGH

## Executive Summary

v0.2.3 is not a new subsystem -- it is a widening of a seam that already exists. `core/render-report.ts` (`renderReport`) is a single async dispatcher that all three adapters (Nx executor, standalone CLI, Angular CLI builder via `convertNxExecutor`) already call identically. The milestone (1) widens that dispatcher with a `format` discriminator, (2) adds two PURE formatter functions beside the existing human `formatReport` (`formatJsonReport`, `formatSarifReport`), (3) threads one `--format`/`format` enum through the three adapter entry points (CLI arg + executor schema + builder schema, both parity specs), and (4) adds one OPTIONAL `CoreResult.totalFilesCount`. `renderReport` is NOT in the public barrel, so widening it is an internal, additive change that honors the 0.x additive-only charter.

The recommended approach is deliberately lazy and dependency-minimal. The JSON reporter needs ZERO new dependencies -- `JSON.stringify` over a normalized projection of `CoreResult` plus the already-shipped env-color/`formatDiagnostics` plumbing cover it. The ONE new runtime dependency for the whole milestone is `node-sarif-builder` (`^4.1.0`, MIT, plain CommonJS, transitive `@types/sarif` + `fs-extra`), lazy-`import()`ed ONLY on the `--format sarif` path so the human / JSON / `--help` / CLI-flag paths never load it or its `fs-extra`. Because the package is CJS, `await import()` cannot throw `ERR_REQUIRE_ESM`; the lazy import is a startup-leanness win, not an interop necessity (unlike the `@angular/compiler-cli` ESM bridge). The compiler-cli load itself moves INTO the human branch, so machine paths skip the heavy ESM peer entirely.

The dominant risk is regressing correctness invariants the existing design already earns, while bolting on a second output shape. The load-bearing rules: machine payload goes to stdout ONLY, every notice + logger line to stderr; NO ANSI color in JSON/SARIF (build messages from `ts.flattenDiagnosticMessageText`, never the human colorizing renderer); TypeScript's 0-based line/character becomes SARIF/JSON 1-based (`+1` both axes, both start and end); SARIF `artifactLocation.uri` must be repo-relative forward-slash (realpath-normalize base AND file on Windows before `path.relative`, then `\\` -> `/`); `ruleId` is the humanized `NG8xxx`/`TS####`/`ATC9000x` form via the existing `ngCodeOf`, never the raw negative code; `results[]` ordering stays deterministic (inherit `CoreResult`'s sort+dedup, sort any grouping keys) with `partialFingerprints` for GitHub matching stability; file-less diagnostics (synthesized 90001/90002, global TS diagnostics) are REPRESENTED, never dropped; and the verdict/exit code stays owned by `evaluateResult`/`toExitCode` -- `--format` can never change pass/fail. The last is the charter's cardinal trap: a coverage-incomplete run has `errorCount === 0` but `success === false`, so a reporter that re-decides from counts silently false-passes.

## Key Findings

### Recommended Stack

The stack is almost entirely already-present code. The JSON reporter is stdlib-only; SARIF adds exactly one dependency. Everything else (line/column derivation, code classification, path relativization, env-color detection, `Outcome`) reuses shipped helpers.

**Core technologies:**
- `node-sarif-builder@^4.1.0` (runtime `dependency`): builds a SARIF 2.1.0 log in memory and serializes via `buildSarifJsonString({ indent: false })` -- MIT, plain CommonJS, `engines.node >=20` (a strict superset of the locked Node range), bakes `version: "2.1.0"` + `$schema` in by construction, auto-fills artifact/rule indices. Lazy-imported ONLY on the SARIF path.
- Node `JSON.stringify` (stdlib): the entire JSON reporter serialization -- correctly escapes messages; no library.
- Existing `ts.flattenDiagnosticMessageText` + `diagnostic.file.getLineAndCharacterOfPosition` + `diagnostic-codes.ts` `ngCodeOf` + `pathBase` relativization + `colorFromEnv`: message flattening, 1-based positions, humanized codes, repo-relative URIs, color precedence -- all shipped, all reused.

**Reconciliation note (version):** the STACK researcher read the actual npm tarball on 2026-07-18 and confirmed `node-sarif-builder` latest is `4.1.0` (published 2026-04-19). The ARCHITECTURE and PITFALLS files cite "v3.x" from earlier README/npm reads -- treat `^4.1.0` as authoritative; the API (`SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder`, `initSimple`, `buildSarifJsonString`) is stable across both. Also: `@types/sarif` is a TRANSITIVE dependency of node-sarif-builder (not "bundled" as the charter wording said) -- do NOT declare it as our runtime dep; add it as a direct `devDependency` only if the reporter imports `'sarif'` types directly (avoidable by typing via `import type { ... } from 'node-sarif-builder'`, which is erased). `fs-extra` stays transitive and is never imported.

### Expected Features

`tsc` has NO machine-readable output, so there is no canonical "tsc JSON" to conform to -- ESLint `-f json` and Biome set the de-facto field conventions the JSON reporter should mirror (at the FIELD-NAME level: `ruleId`/`severity`/`line`/`column`/`endLine`/`endColumn`/`message`), while using a flat `diagnostics[]` container (simpler for agents than ESLint's per-file nesting).

**Must have (table stakes):**
- `--format` enum (`human` default | `json` | `sarif`) threaded through all three adapters -- the selector.
- Per-diagnostic `file, line, column, endLine, endColumn, code, severity, message`, all 1-based.
- Valid SARIF 2.1.0 for GitHub `upload-sarif` (required: `$schema`/`version`/`runs[]`; per run `tool.driver` + `results[]`; per result `message.text` + `locations[]` + `partialFingerprints`; per location `artifactLocation.uri` + 1-based `region`).
- Consistent `ts.DiagnosticCategory` -> severity mapping (Error/Warning/Suggestion/Message -> SARIF `error`/`warning`/`note`/`note`; count by category, never by code sign).
- `--no-color`/`NO_COLOR` honored (machine formats are unconditionally plain regardless).
- A stable schema/version marker (`formatVersion` integer + tool `version`).

**Should have (competitive differentiators):**
- The discriminated `outcome` (`clean`/`type-error`/`coverage-incomplete`/`warnings-exceeded`) in the JSON summary -- this tool's signature never-silent signal, richer than pass/fail.
- Structured suppression/advisory fields (`suppressedInGraph*`, `templateCheckAborted`, `skippedReferences`, `notTypeCheckedDeclaredFiles`, `bundlerQueryImports`) as data.
- SARIF `rules[]` catalog for the 18 NG8xxx (from `extended-catalog.members.ts`) with `shortDescription`/`fullDescription`/`help` -- passes the strict SARIF validator, first-class GitHub alerts.
- Self-computed stable `partialFingerprints` (removes reliance on GitHub's best-effort auto-populate; mandatory for the `/sarifs` API path).

**Defer (later milestone):**
- Other formats (codeclimate/compact/gitlab), `--output <file>` -- OUT OF SCOPE (shell redirection `> results.sarif` covers file output).
- A published JSON Schema file (`$schema` URL) -- add once the shape stabilizes.
- `relatedInformation` -> SARIF `relatedLocations` -- low-cost extra, add after validation.

### Architecture Approach

A pure detection(core)/rendering(adapter) split, already established. `runTypecheck` -> `CoreResult` (now + optional `totalFilesCount`); `renderReport(result, { format, color, pathBase, failFast })` dispatches on `format` and returns a STRING; the adapter writes it to the same stdout seam the human report uses; `evaluateResult`/`toExitCode` consume the SAME `CoreResult` independently and never see the format. Both new reporters are pure `(CoreResult, ts) => string` -- no `console`, no `process`, no verdict. REP-02 builds SARIF over the SAME per-diagnostic normalized projection REP-01 produces (share one internal "diagnostic -> normalized record" function so the two shapes cannot drift on positions/codes/paths).

**Major components:**
1. `core/render-report.ts` (`renderReport`) -- MODIFY: add `format` to `RenderOptions`, widen the result param from `Pick<CoreResult,'diagnostics'>` to `CoreResult`, branch on format, move `loadCompilerCli()` into the human branch, reach SARIF only via `await import('./sarif-report')`.
2. `core/json-report.ts` (`formatJsonReport`) -- NEW, no dependency; flat `diagnostics[]` + `summary` (with `outcome`), 1-based derived positions, `TS####`/`NG####`/`ATC9000x` code strings, repo-relative paths.
3. `core/sarif-report.ts` (`formatSarifReport`) -- NEW, lazy `node-sarif-builder`; owns the repo-relative forward-slash `fileUri` it feeds the builder; file-less fallback.
4. `core/run-typecheck.ts` (`CoreResult`/`finalize`/`finalizeUnion`) -- MODIFY: capture optional `totalFilesCount` from the live `Program` (single-leaf) and a `Set<string>` of source-file names across walked leaves (dedupe shared `lib.d.ts`), via the existing `presentIfNonEmpty`/conditional-spread idiom; `evaluateResult` must NOT read it.
5. Adapters (executor `schema.json`/`schema.d.ts`/`normalize-options`; CLI `parse-args`/`main`; builder `schema.json`; both schema-parity specs) -- MODIFY: thread the enum; `builder.ts` UNCHANGED (inherits via shared `TypecheckExecutorOptions`).

`evaluate-result.ts`, `exit-codes.ts`, `format-report.ts`, `emit-advisory-notices.ts`, the engine's diagnostic/count behavior, and the barrel public API all stay UNTOUCHED (verdict-neutral; human output byte-identical when `--format` is omitted).

### Critical Pitfalls

1. **stdout contamination** -- any advisory notice, Nx chrome, or stray `console.log` on stdout corrupts the JSON/SARIF. Keep the payload on the raw stdout seam ONLY; every notice/error goes to the injected `Logger` (stderr). `--quiet` gates `emitAdvisoryNotices` (the stderr chatter), never the payload and never the verdict.
2. **ANSI color in the payload** -- `@angular/compiler-cli`'s `formatDiagnostics` always colorizes. Machine reporters must NOT call `formatReport`/`renderReport`/`formatDiagnostics`; build messages from `ts.flattenDiagnosticMessageText` so color is structurally impossible. Assert no `\x1b` byte and payload-stable under `FORCE_COLOR=1`.
3. **0-based -> 1-based off-by-one** -- `ts.getLineAndCharacterOfPosition` is 0-based on BOTH axes; SARIF/JSON are 1-based. `+1` both `line` and `character`, for both start (`start`) and end (`start + length`, guard `length === undefined`), in ONE shared helper. Pin with a hand-counted fixture position, not a round-trip snapshot.
4. **Absolute / backslash SARIF URIs** -- break GitHub file matching and churn duplicate alerts. Realpath-normalize BOTH `pathBase` and `fileName` (drive-letter case + 8.3), `path.relative`, then `.replace(/\\/g,'/')`; no `file:`/`uriBaseId` scheme. angular-typechecker owns the URI; never let the builder guess from `process.cwd()`.
5. **`ruleId` as the raw negative code** -- `-998101` instead of `NG8101` breaks GitHub rule grouping. Map in one helper: `code < 0` -> `NG` + `ngCodeOf(code)`; `code >= 90000` -> `ATC90001`-style; else `TS` + code. Let the builder own `ruleIndex` linkage (add each distinct rule once, set only `ruleId`).
6. **Silent false pass / verdict coupling** -- dropping a file-less diagnostic, or re-deciding success from `errorCount` in the reporter, hides a real failure (coverage-incomplete has `errorCount === 0`, `success === false`). Emit every diagnostic in `CoreResult.diagnostics` one-to-one (file-less -> `file: null` in JSON, no-location result in SARIF); a reporter crash propagates as infra (exit 2), never swallowed; identical exit code across all three `--format` values.

Supporting/verification pitfalls (address in-phase): deterministic `results[]` ordering across the OS x Node matrix; SARIF 2.1.0 schema validation + JSON schema drift-lock in CI (dev-only test dep, e.g. `ajv`, or a golden snapshot); redact non-deterministic fields (`durationMs`, tool version) before snapshotting; `node-sarif-builder` CJS-under-`import()` interop tested with a REAL import (`(mod.default ?? mod)` defensive access) not just a mock; `@nx/dependency-checks` may miss a lazy-only `import()` -- confirm against the real lint run and add to `ignoredDependencies` (with a one-line comment) if flagged; additive-only audit (`index.drift.ts` compiles, git-diff vs `@0.2.2` shows only additions).

## Implications for Roadmap

The three research files converge on the same dependency-ordered decomposition (ARCHITECTURE's Phase 1/2/3 = PITFALLS' OBS+REP-01+WIRE / REP-02 / VER groupings). Reconciled recommended order below. REP-02 depends on REP-01's shared normalized-record projection AND the widened seam/enum, so it cannot precede REP-01.

### Phase 1: Reporter seam + JSON reporter + `--format` threading + `totalFilesCount`

**Rationale:** JSON is the no-dependency reporter, and the `--format`/`--quiet`/`--color` plumbing is identical for all formats -- establishing the widened seam + full three-adapter threading here unblocks SARIF cleanly. `totalFilesCount` (OBS-01) is the only engine-touching item and is small, additive, and surfaced by the JSON summary, so it folds in here rather than standing alone.
**Delivers:** widened `renderReport` (`human`/`json`), pure `core/json-report.ts`, `CoreResult.totalFilesCount` capture (single-leaf + walk Set-dedupe), `--format`/`--quiet`/`--color`(+`--no-color`) through CLI + executor + builder schemas, both schema-parity specs updated with `'format'`, HELP_TEXT drift-lock updated.
**Addresses (FEATURES):** `--format` selector, flat `diagnostics[]` + `summary` with `outcome`, 1-based positions, code strings, `advisories` block, CLIX-02 color/quiet precedence, `totalFilesCount`.
**Avoids (PITFALLS):** 1 (stdout purity), 2 (ANSI), 3 (off-by-one, shared helper), 6 (ruleId string), 10 (file-less represented), 13 (verdict/exit parity), 14 (additive-only).

### Phase 2: SARIF reporter

**Rationale:** depends on Phase 1's widened seam + enum + shared projection; isolates the one new dependency and all the URI/interop logic in a single phase.
**Delivers:** `node-sarif-builder@^4.1.0` as a `dependency`, `core/sarif-report.ts` reached ONLY via `await import()`, repo-relative forward-slash URIs from `pathBase`, `partialFingerprints`, file-less no-location fallback, `rules[]` catalog for the 18 NG8xxx, the `'sarif'` enum member across the three schemas + parity specs, a require-graph guard that human/JSON/CLI-boot never load `node-sarif-builder`.
**Uses (STACK):** `node-sarif-builder` `SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/`SarifRuleBuilder` + `buildSarifJsonString`.
**Implements:** `core/sarif-report.ts` + the lazy-import boundary.
**Avoids (PITFALLS):** 4 (URI normalization), 5 (ordering/fingerprints), 7 (rules/ruleIndex linkage), 8 (Windows paths), 9 (CJS interop, real-import test), 11 (SARIF schema validation).

### Phase 3: Shipped-tarball e2e + docs + additive audit (verification)

**Rationale:** proof + docs land after both reporters work; the repo's standing lesson is "npm ships source in early versions -- test the SHIPPED tarball, not the local dist."
**Delivers:** tarball e2e proving the shipped surfaces emit valid JSON + schema-valid SARIF on all three adapters; cross-OS/Node byte-stability snapshots (redacted volatile fields); additive-only git-diff audit vs `@0.2.2`; README `## Machine-readable output` (JSON schema, SARIF `upload-sarif` recipe, the `pathBase`/CWD "run from repo root" caveat); curated CHANGELOG entry in end-user language.
**Avoids (PITFALLS):** 11 (drift-lock in CI), 12 (determinism), plus the "looks done but isn't" checklist.

### Phase Ordering Rationale

- Dependency-driven: the seam widen + shared normalized projection + enum threading (Phase 1) are prerequisites for SARIF (Phase 2); e2e/docs (Phase 3) prove the finished surfaces.
- `totalFilesCount` folds into Phase 1 because it is the sole engine touch and feeds the JSON summary; splitting it out would add a phase boundary for ~10 lines. A plan-time decision (count scope) remains open.
- Grouping matches the architecture's component boundaries (core seam + JSON in one, the dep-carrying SARIF isolated, verification last) and lets the additive-only audit run once over the whole surface.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (SARIF):** MEDIUM -- the `node-sarif-builder` CJS-under-`await import()` interop shape (`.default` vs namespace) and the `@nx/dependency-checks` lazy-only-import behavior must be confirmed against the REAL package + the actual lint run, not inferred. The file-less-diagnostic SARIF representation and the `partialFingerprints` hashing recipe are open design decisions (see Gaps).

Phases with standard patterns (skip research-phase):
- **Phase 1 (seam + JSON):** the seam, the pure-formatter contract, the `presentIfNonEmpty` additive idiom, the schema-parity `EXPECTED_KEYS` guard, and `colorFromEnv` precedence are all already in the tree and verified -- pure application of shipped patterns.
- **Phase 3 (e2e + docs):** the tarball-e2e tier and drift-lock tripwires are established repo patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Package manifests + API + `.d.ts` read from the actual `node-sarif-builder-4.1.0.tgz`; GitHub SARIF 2.1.0 requirement from GitHub Docs; version reconciled (4.1.0 authoritative over the v3.x mentions elsewhere). |
| Features | HIGH | Grounded in the shipped `CoreResult`/`evaluate-result`/`diagnostic-codes`/`render-report` plus GitHub Code Scanning + ESLint formatter docs; only NO_COLOR-vs-FORCE_COLOR precedence is MEDIUM (ecosystem disagreement) and the repo already commits to NO_COLOR-wins. |
| Architecture | HIGH | Verified line-by-line against `packages/angular-typechecker/src/` as shipped through v0.2.2; the seam, adapters, and parity specs are real code with cited line numbers. |
| Pitfalls | HIGH | Codebase read directly; SARIF/GitHub requirements from official Docs; every pitfall maps to a concrete file + a verification. |

**Overall confidence:** HIGH

### Gaps to Address

Resolve these at requirements/plan time (they are design choices, not unknowns):

- **Exact JSON schema field set:** decoded `NG8xxx` label vs raw negative code (recommend carry BOTH `code` string + `rawCode` int); whether to publish a `$schema` URL now or after the shape stabilizes (recommend defer). Handle in Phase 1 REQUIREMENTS + drift-lock the chosen keys.
- **`totalFilesCount` scope:** all source files (raw `@nx/js` parity) vs non-declaration only (more meaningful "files checked"). Recommend non-declaration for agent usefulness; flag for REQUIREMENTS.
- **File-less-diagnostic SARIF representation:** no-location result (spec-valid, won't display as a GitHub alert) vs tsconfig-anchored region at 1:1:1:1 (surfaces as an alert on the tsconfig). Recommend no-location + document that the verdict/exit code (not the SARIF) is the authoritative fail signal for file-less diagnostics; pick one and pin it.
- **`partialFingerprints` hashing recipe:** what to hash (ruleId + relative URI + normalized message + line-hash) and the version tag (`atcDiagnosticHash/v1`). Must be deterministic across OS/Node; decide in Phase 2.
- **Non-deterministic fields in the JSON payload:** whether to surface `durationMs` (observability) at all; if surfaced, it MUST be snapshot-redacted (`expect.any(Number)`), same for tool `version`. Decide the redaction strategy in Phase 1/verification.
- **`@nx/dependency-checks` + lazy-only `import()`:** confirm whether the rule sees `node-sarif-builder`; if not, add to `ignoredDependencies` with a one-line comment. Confirm during Phase 2 execution against the real lint run.

## Sources

### Primary (HIGH confidence)
- `.planning/research/v0.2.3-reporters/STACK.md` -- `node-sarif-builder@4.1.0` tarball (package.json, API `.d.ts`), `@types/sarif@2.1.7`, dependency classification, lazy-import soundness under `module: nodenext` + `type: commonjs`, version compatibility.
- `.planning/research/v0.2.3-reporters/ARCHITECTURE.md` -- the existing `renderReport` seam + per-adapter threading (CLI/executor/builder + parity specs), `totalFilesCount` placement, lazy SARIF import boundary, URI normalization, recommended 3-phase build order (verified against `packages/angular-typechecker/src/` as shipped v0.2.2).
- `.planning/research/v0.2.3-reporters/FEATURES.md` -- table-stakes vs differentiators vs anti-features, severity mapping, concrete JSON + minimal SARIF 2.1.0 shapes, `--quiet`/`--color` conventions, what `CoreResult` does/doesn't expose (grounded in the codebase + GitHub Code Scanning + ESLint formatter docs).
- `.planning/research/v0.2.3-reporters/PITFALLS.md` -- 14 pitfalls with file-level prevention + per-pitfall verification, "looks done but isn't" checklist, pitfall-to-phase mapping (codebase read directly + official GitHub SARIF docs + node-sarif-builder package.json).
- GitHub Docs "SARIF support for code scanning" -- required fields, 1-based regions, URI/fingerprint/ruleId matching rules, GH1001 locationless behavior, size limits.

### Secondary (MEDIUM confidence)
- NO_COLOR / FORCE_COLOR precedence (no-color.org, force-color.org, ecosystem discussion) -- disagreement on NO_COLOR-vs-FORCE_COLOR ordering; repo commits to NO_COLOR-wins (matches the NO_COLOR informal standard).
- node-sarif-builder README/npm/GitHub -- API surface confirmed; the "v3.x" mentions in ARCHITECTURE/PITFALLS superseded by STACK's tarball read of `4.1.0`.

### Tertiary (LOW confidence)
- None. All findings trace to the shipped codebase, the actual npm tarball, or official docs.

---
*Research completed: 2026-07-18*
*Ready for roadmap: yes*
