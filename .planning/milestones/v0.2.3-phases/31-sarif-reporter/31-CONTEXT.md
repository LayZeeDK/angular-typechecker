# Phase 31: SARIF reporter - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended design defaults auto-locked)

<domain>
## Phase Boundary

Add the `--format sarif` renderer: a NEW pure `core/sarif-report.ts`
(`formatSarifReport`) reached ONLY via `await import('./sarif-report')` from the
`sarif` branch of Phase 30's widened `renderReport` seam. It builds valid SARIF
2.1.0 (ready for GitHub Code Scanning `upload-sarif`) with the ONE deliberate new
runtime dependency, `node-sarif-builder@^4.1.0`, itself lazy-`import()`ed so the
human / JSON / `--help` / CLI-boot paths never load it (nor its transitive
`fs-extra`). The reporter REUSES Phase 30's shared normalized-record projection
(`core/diagnostic-record.ts`) so JSON and SARIF cannot drift on
positions/codes/paths, and drives its `rules[]` catalog from the 18-member
NG8xxx enum.

**In this phase (REP-02, VER-04):**
- `core/sarif-report.ts` — `runs[].tool.driver` (name / version / informationUri
  + `rules[]` catalog for the 18 NG8xxx), `results[]` (humanized `ruleId`, mapped
  `level`, `message.text`, `locations[]` with repo-relative forward-slash
  `artifactLocation.uri` + 1-based `region` + self-computed `partialFingerprints`),
  deterministic `results[]` ordering, file-less no-location fallback.
- Thread the `'sarif'` enum MEMBER's renderer through all three adapters + both
  schema-parity specs (the enum VALUE was already threaded in Phase 30; Phase 30's
  seam THROWS `'Phase 31'` on `sarif` — this phase replaces that throw with the
  real renderer).
- `node-sarif-builder@^4.1.0` declared as a `dependency`.
- VER-04 guards: a require-graph guard proving human / JSON / `--help` / CLI-boot
  never load `node-sarif-builder`; a REAL-import (not mocked) integration test of
  the CJS-under-`await import()` interop via `(mod.default ?? mod)`; confirm/resolve
  `@nx/dependency-checks` visibility of the lazy-only import.
- The SARIF-shape Unit specs (VER-01 rides along here per REQUIREMENTS' VER-01 note).

**NOT in this phase (Phase 32 — VER-02/VER-03/ADD-01/DOC-01):** full SARIF 2.1.0
schema validation in CI (ajv/golden-schema drift-lock), cross-OS/Node byte-stability
matrix, the shipped-tarball e2e across all three adapters, the additive-only
git-diff audit vs `@0.2.2`, and README `## Machine-readable output` + curated
CHANGELOG. Phase 31 ships a deterministic golden-snapshot + shape unit specs; the
CI schema-validation harness is Phase 32 (see D-07).

**Additive-only charter (carried, non-negotiable):** with `--format` omitted, human
output is byte-identical to `angular-typechecker@0.2.2`; `builder.ts` stays
byte-unchanged; `renderReport` is NOT in the public barrel; the ONLY new runtime
dependency in the whole milestone is `node-sarif-builder`; `index.drift.ts` /
public barrel unchanged. Patch bump `0.2.2 -> 0.2.3`.

</domain>

<decisions>
## Implementation Decisions

Every Phase-31 decision is either LOCKED upstream (by REQUIREMENTS.md's REP-02/VER-04
design defaults + the ROADMAP goal) or a small SARIF-specific design detail resolved
here against the HIGH-confidence research SUMMARY's "Gaps to Address". Per the `--auto`
trap-quadrant rule, each open detail was rated on IMPACT x CONFIDENCE before auto-locking
(see the audit table at the end of this section). NONE fell in the HIGH-impact +
NOT-HIGH-confidence trap quadrant, so all were auto-locked to the researched default.
Each remains a legitimate plan-time re-open if the planner surfaces new evidence.

### File-less diagnostic representation (REP-02 — LOCKED upstream)
- **D-01:** File-less diagnostics (synthesized 90001/90002, global TS) become
  **no-location results** in `results[]` and are NEVER dropped. The verdict / exit
  code — NOT the SARIF — is the authoritative fail signal for them, and the exit
  code stays IDENTICAL to the human/JSON runs for the same input. (Locked by
  REQUIREMENTS.md REP-02 design default + ROADMAP success criterion 2; carried, not
  re-opened. Rejected alternative: anchoring a synthetic 1:1:1:1 region on the
  tsconfig — surfaces a misleading GitHub alert on the config file.)

### partialFingerprints recipe (REP-02 — open design choice, resolved here)
- **D-02:** Self-compute `partialFingerprints` as a `sha256` hex digest (Node
  stdlib `crypto` — ZERO new dep) over a stable, OS-invariant tuple:
  humanized `ruleId` + repo-relative forward-slash URI + flattened (ANSI-free)
  message + 1-based `startLine` + 1-based `startColumn`. Store it under a VERSIONED property key
  `atcFingerprint/v1`. Hash inputs contain NO absolute path, NO `cwd`, NO volatile
  field (tool version, duration), so the fingerprint is deterministic across the
  OS x Node matrix. File-less diagnostics (D-01) still get a fingerprint (empty-URI
  sentinel in the tuple). The `/v1` key makes the recipe re-tunable later without a
  breaking churn (GitHub matches on any fingerprint version). Removes reliance on
  GitHub's best-effort auto-populate and is mandatory for the `/sarifs` API path.

### node-sarif-builder integration + CJS interop (REP-02, VER-04)
- **D-03:** `renderReport`'s `sarif` branch reaches the reporter ONLY via
  `await import('./sarif-report')`; `sarif-report.ts` in turn does
  `await import('node-sarif-builder')` and accesses the API via defensive
  `(mod.default ?? mod)` (the package is plain CJS — `await import()` cannot throw
  `ERR_REQUIRE_ESM`, so the lazy import is a startup-leanness win, proven by a
  REAL-import integration test, VER-04). Human / JSON / `--help` / CLI-boot never
  load it (require-graph guard, VER-04).
- **D-04:** Type the builder API via `import type { ... } from 'node-sarif-builder'`
  (erased at compile). Do NOT add `@types/sarif` as a devDependency and do NOT
  `import ... from 'sarif'` — that keeps the transitive `@types/sarif` + `fs-extra`
  out of our declared deps. (STACK reconciliation: `@types/sarif` is node-sarif-builder's
  TRANSITIVE dep, not bundled; `fs-extra` stays transitive and is never imported.)
- **D-05:** Declare `node-sarif-builder@^4.1.0` (MIT, CommonJS, `engines.node >=20`
  — strict superset of the locked Node range) as a runtime `dependency`. If
  `@nx/dependency-checks` cannot see the lazy-only `import()`, add
  `node-sarif-builder` to `ignoredDependencies` with a one-line comment — resolve
  against the REAL lint run during execution (do NOT infer; VER-04). Use
  `buildSarifJsonString({ indent: false })`; the builder bakes
  `version: "2.1.0"` + `$schema` in by construction and auto-fills artifact/rule
  indices.

### rules[] catalog (REP-02)
- **D-06:** Catalog EXACTLY the 18 NG8xxx extended diagnostics, driven from
  `core/extended-catalog.members.ts` (the enum truth — never a hand-maintained
  list; a drift tripwire already guards that file). Each catalog rule carries
  `id` = humanized `NG8xxx`, `name`, `shortDescription`, and a `helpUri` to the
  Angular extended-diagnostics docs. TS#### / ATC9000x results reference their rule
  by `ruleId` WITHOUT a `driver.rules[]` catalog entry (SARIF permits results to
  name rules absent from the catalog; only the NG8xxx set gets first-class catalog
  treatment for GitHub rule grouping). Let the builder own `ruleIndex` linkage —
  add each distinct rule once, set only `ruleId` on the result.

### Verdict / exit-code purity (carried from Phase 30 — LOCKED)
- **D-07 (validation strategy for THIS phase):** Phase 31 ships the SARIF Unit tier
  ONLY — deterministic golden-snapshot + shape unit specs (driver / rules / results /
  locations / 1-based region / `partialFingerprints`; no `\x1b` byte under
  `FORCE_COLOR=1`; file-less no-location; and exit-code PARITY with the human/JSON
  runs for the same input, including coverage-incomplete `errorCount === 0` /
  `success === false`). The reporter is a PURE `(CoreResult, ts) => string` and
  NEVER re-derives `success` from counts — `evaluateResult` / `toExitCode` stay the
  SOLE verdict owners; a reporter crash propagates as infra (exit 2), never a
  swallowed pass. Full SARIF 2.1.0 schema validation (ajv / golden-schema drift-lock
  in CI), cross-OS/Node byte-determinism, and the shipped-tarball e2e are Phase 32
  (VER-02/VER-03) — do NOT pull them forward.

### Additive-only charter (carried — LOCKED)
- **D-08:** `--format sarif` is purely additive: `--format` omitted => human output
  byte-identical to `@0.2.2`; `renderReport` stays out of the public barrel;
  `builder.ts` byte-unchanged (inherits `format` via the shared
  `TypecheckExecutorOptions`); `node-sarif-builder` is the only new runtime dep;
  `index.drift.ts` / public barrel unchanged. Patch bump `0.2.2 -> 0.2.3`.

### Claude's Discretion (planner-owned, no user preference expressed)
- The exact `partialFingerprints` tuple field order / separator and the hash-input
  serialization, the internal signature of the shared-projection reuse in
  `sarif-report.ts`, the precise NG8xxx `shortDescription` / `helpUri` strings, and
  the golden-snapshot fixture layout are left to the planner, provided the observable
  SARIF matches D-01..D-07 and the additive-only charter (D-08) holds.

### Auto-lock audit (IMPACT x CONFIDENCE per the `--auto` trap-quadrant rule)
| Decision | Impact | Confidence | Trap quadrant? | Basis |
|---|---|---|---|---|
| D-01 file-less no-location | HIGH (never-silent) | HIGH | No | Locked upstream (REQUIREMENTS REP-02 default + ROADMAP SC-2); verdict remains the fail signal |
| D-02 partialFingerprints recipe | MED (versioned `/v1`, re-tunable; no installed alert base yet) | HIGH | No | Standard SARIF fingerprinting practice; research-backed; deterministic-by-construction (no cwd/abs-path in hash) |
| D-03/D-04/D-05 dep + CJS interop | MED (correctness of the lazy boundary) | HIGH | No | STACK read the real 4.1.0 tarball; CJS-under-`await import()` proven pattern; VER-04 guards it empirically |
| D-06 rules[] catalog (18 NG8xxx) | MED (GitHub alert quality) | HIGH | No | 18-member enum truth in `extended-catalog.members.ts` (drift-guarded); ROADMAP goal + FEATURES |
| D-07 Phase-31 validation scope | LOW-MED (verification placement) | HIGH | No | ROADMAP already splits full schema-validation/e2e into Phase 32; verdict purity is the shipped charter |
| D-08 additive-only | HIGH (release correctness) | HIGH | No | Milestone charter; already the shipped design through v0.2.2 |

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or
implementing.**

### Milestone contract (locked requirements + goal)
- `.planning/REQUIREMENTS.md` — REP-02 (SARIF shape + the file-less no-location
  design default) and VER-04 (require-graph guard + REAL-import CJS interop test);
  plus the VER-01 note that the SARIF-shape Unit specs close here. Also the
  Out-of-Scope table (no `--output`, no `$schema` URL, no other formats, no
  off-stack Ng).
- `.planning/ROADMAP.md` -> "Phase 31: SARIF reporter" — the goal, the 4 success
  criteria, and the two plan sketches (31-01 renderer + enum threading; 31-02 the
  VER-04 guards) that pre-decompose the work.

### v0.2.3 research (HIGH confidence; grounded in the shipped v0.2.2 source + the real 4.1.0 tarball)
- `.planning/research/v0.2.3-reporters/SUMMARY.md` — executive summary + "Gaps to
  Address" (D-02 fingerprint recipe, D-01 file-less rep, D-04/D-05 dep classification
  all trace here) + phase ordering (Phase 2 = SARIF).
- `.planning/research/v0.2.3-reporters/STACK.md` — `node-sarif-builder@4.1.0` tarball
  read (package.json, API `.d.ts`: `SarifBuilder`/`SarifRunBuilder`/`SarifResultBuilder`/
  `SarifRuleBuilder`, `initSimple`, `buildSarifJsonString`), dependency classification
  (transitive `@types/sarif`/`fs-extra`), lazy-import soundness under
  `module: nodenext` + `type: commonjs`.
- `.planning/research/v0.2.3-reporters/ARCHITECTURE.md` — the lazy SARIF import
  boundary, URI normalization, `renderReport` seam wiring (note: cites "v3.x" —
  superseded by STACK's `4.1.0`; API stable across both).
- `.planning/research/v0.2.3-reporters/PITFALLS.md` — Phase-31-relevant: 4 (URI
  normalization), 5 (ordering / fingerprints), 7 (rules/ruleIndex linkage), 8
  (Windows paths), 9 (CJS interop real-import test), 11 (SARIF schema validation).
- `.planning/research/v0.2.3-reporters/FEATURES.md` — minimal SARIF 2.1.0 shape,
  `ts.DiagnosticCategory` -> SARIF `level` mapping (Error/Warning/Suggestion/Message
  -> `error`/`warning`/`note`/`note`), the `rules[]` catalog rationale.

### Prior phase (the seam + projection this phase consumes)
- `.planning/phases/30-reporter-seam-json-reporter-format-threading-observability/30-CONTEXT.md`
  — D-12 (widened `renderReport`, `loadCompilerCli` in the human branch, reach SARIF
  via `await import('./sarif-report')`) and D-13 (the shared normalized-record
  projection SARIF REUSES). Phase-30 STATE decisions 30-02/30-03 record the
  `renderReport` `sarif`-throws-`'Phase 31'` placeholder this phase replaces.

### Additive-only + release charter
- `.planning/PROJECT.md` — Constraints (stack, additive-only 0.x charter, the
  `nx`-as-direct-dependency correction).
- `AGENTS.md` — Conventional-Commits / release mechanics + the additive-only rule.

### GitHub SARIF requirement (external, cited in research; re-read if in doubt)
- GitHub Docs "SARIF support for code scanning" — required fields, 1-based regions,
  URI / fingerprint / ruleId matching rules, locationless (GH1001) behavior, size
  limits. (Captured in FEATURES.md / PITFALLS.md; no local copy.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`core/diagnostic-record.ts`** (shipped 30-02): the ONE shared pure projection
  (`positionsOf` single off-by-one helper 0-based+1 both axes, `codeStringOf`
  `TS####`/`NG8xxx`/`ATC9000x` carrying `code`+`rawCode`, `severity` from
  `ts.DiagnosticCategory`, exported `relativizePath` repo-relative forward-slash).
  SARIF MUST reuse this — the D-13 anti-drift contract. NO `@angular/compiler-cli`
  import (the SARIF path must never load the ESM peer).
- **`core/render-report.ts`** (widened 30-02): `renderReport(result, { format, ... })`
  already branches on `format`; the `sarif` case currently THROWS `'Phase 31'` and
  `loadCompilerCli()` already lives inside the `human` branch. This phase replaces
  the throw with `await import('./sarif-report')`.
- **`core/extended-catalog.members.ts`**: `EXTENDED_DIAGNOSTIC_MEMBERS` — the
  18-member NG8xxx enum truth (dependency-free exported-const idiom), drift-guarded
  by `extended-catalog.drift.ts` + `.members.spec.ts`. Drives the `rules[]` catalog
  (D-06).
- **`core/evaluate-result.ts`** (`evaluateResult` / `toExitCode`): the SOLE verdict
  owners — UNTOUCHED. Exit-code parity across formats depends on the reporter never
  reading these for its own verdict.
- **`core/logger.ts` + `emit-advisory-notices.ts`**: the injected-`Logger` stderr
  seam; the SARIF payload goes to stdout ONLY, advisories/errors to stderr.
- **`{executors,builders}/typecheck/schema-parity.spec.ts`**: the `EXPECTED_KEYS`
  drift-lock pattern; the `'sarif'` enum value was threaded through both in Phase 30.

### Established Patterns
- **Pure detection(core)/rendering(adapter) split:** reporters are pure
  `(CoreResult, ts) => string` — no `console`, no `process`, no verdict.
- **Three thin adapters over one core:** CLI `src/cli/main.ts`, Nx executor, Angular
  CLI builder (`convertNxExecutor`) all compose `runTypecheck -> emitAdvisoryNotices
  -> renderReport -> evaluateResult` in the SAME order and already pass `format`.
  `builder.ts` stays byte-unchanged.
- **`await import()` CJS/ESM bridge** (`spike-findings-angular-typechecker` skill):
  the shipped pattern reused for the `node-sarif-builder` lazy import + the require-
  graph guard's static walk (mirrors `bin-static.spec.ts` from 27-02).
- **`presentIfNonEmpty` / conditional-spread additive idiom** (`core/run-typecheck.ts`):
  the shipped pattern for optional fields; reuse if any SARIF field is conditional.

### Integration Points
- NEW `packages/angular-typechecker/src/core/sarif-report.ts` (`formatSarifReport`),
  reached only from `render-report.ts`'s `sarif` branch via `await import`.
- `package.json` gains `node-sarif-builder@^4.1.0` under `dependencies`
  (+ possibly `ignoredDependencies` in the ESLint `@nx/dependency-checks` config).
- VER-04 guards: a require-graph guard spec (static walk from the human/JSON/CLI-boot
  entry points, mirroring `bin-static.spec.ts`) + a REAL-import interop spec.

</code_context>

<specifics>
## Specific Ideas

- The `rules[]` catalog is driven from the 18-member NG8xxx enum
  (`extended-catalog.members.ts`), matching the repo's standing "drive the
  catalog/tripwire from the enum" rule (docs=16 / factory=16 / enum=18; all 18
  promotable, NG8011 included). Never a hand-maintained rule list.
- `partialFingerprints` is versioned (`atcFingerprint/v1`) precisely so the recipe
  can evolve without churning GitHub alerts — GitHub matches on any fingerprint
  version, so a later `/v2` is non-breaking.
- The lazy `node-sarif-builder` import is a startup-leanness win, NOT an interop
  necessity: the package is CJS, so `await import()` cannot throw `ERR_REQUIRE_ESM`
  (unlike the `@angular/compiler-cli` ESM bridge). The `(mod.default ?? mod)` access
  is defensive, proven by a REAL (not mocked) import test.

</specifics>

<deferred>
## Deferred Ideas

- **Full SARIF 2.1.0 schema validation in CI (ajv / golden-schema drift-lock),
  cross-OS/Node byte-determinism, shipped-tarball e2e across all three adapters,
  the additive-only git-diff audit vs `@0.2.2`, README `## Machine-readable output`
  + curated CHANGELOG** — Phase 32 (VER-02, VER-03, ADD-01, DOC-01). Phase 31 ships
  only the deterministic golden-snapshot + shape unit specs (D-07).
- **Published hosted `$schema` URL** (REP-04), **`--output <file>`** (CLIX-03; shell
  redirection `> results.sarif` covers it), **other formats** (codeclimate / compact
  / GitLab, REP-03), **`relatedInformation` -> SARIF `relatedLocations`** (low-cost
  extra, add after validation) — future milestones, out of scope.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-sarif-reporter*
*Context gathered: 2026-07-18*
