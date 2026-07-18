# Phase 32: Verification + docs + additive audit - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (autonomous single-pass; recommended verification/docs defaults auto-locked)

<domain>
## Phase Boundary

The FINAL phase of milestone v0.2.3 (machine-readable reporters). Both reporters
already ship: the zero-dependency JSON reporter (Phase 30) and the lazy-imported
`node-sarif-builder` SARIF 2.1.0 reporter (Phase 31). This phase PROVES the
shipped surface and DOCUMENTS it -- it adds NO new production behavior.

**In this phase (VER-02, VER-03, ADD-01, DOC-01):**
- **VER-02 (Integration tier):** `run()` (CLI adapter) + the Nx executor exercised
  over COMMITTED real-cold-compiler fixtures emitting `--format json` and
  `--format sarif`; the SARIF validated against the SARIF 2.1.0 JSON schema via a
  **dev-only validator**; volatile fields redacted; both payloads byte-stable
  across the 6-cell OS x Node matrix, including the Windows path -> forward-slash
  `artifactLocation.uri` conversion.
- **VER-03 (Shipped-tarball e2e):** the INSTALLED package emits valid JSON +
  schema-valid SARIF through ALL three adapters (Nx executor, `ng run`, standalone
  CLI `--format`); each asserts stdout-purity (the stdout payload parses cleanly)
  and exit-code PARITY across `human`/`json`/`sarif`.
- **ADD-01 (Additive-only audit):** a git-diff + `index.drift.ts` barrel-drift
  audit vs `angular-typechecker@0.2.2` -> `32-ADDITIVE-AUDIT.md`, proving no
  breaking change to the executor id, the `runTypecheck`/`CoreResult`/`CoreOptions`
  public API, the Angular CLI builder, the CLI flag set, or the generator schemas;
  re-confirm the `node-sarif-builder` dependency classification + the
  `@nx/dependency-checks` visibility (already resolved in Phase 31); the `v0.3.0`
  escape hatch stays untriggered.
- **DOC-01 (Docs):** a README `## Machine-readable output` section (`--format`
  flag, JSON payload schema, SARIF `upload-sarif` recipe, the run-from-repo-root
  caveat) + a curated end-user-language public CHANGELOG entry.

**NOT in this phase:** any new reporter format or runtime behavior; the release
CUT itself (version bump + tag + npm publish) -- docs land UNDATED, `package.json`
stays `0.2.2`, and the patch bump `0.2.2 -> 0.2.3` happens later through the
human-gated Release-PR flow (AGENTS.md). No hosted `$schema` URL (REP-04), no
`--output` (CLIX-03), no other formats (REP-03), no off-stack Angular.

**Additive-only charter (carried, non-negotiable):** with `--format` omitted,
human output is byte-identical to `angular-typechecker@0.2.2`; `builder.ts` stays
byte-unchanged; `renderReport` is NOT in the public barrel; the ONLY new runtime
dependency in the whole milestone is `node-sarif-builder`; `index.drift.ts` /
public barrel unchanged. Every test/validation dependency this phase adds (e.g. a
SARIF schema validator) is a **devDependency ONLY** -- it must never reach the
published `dependencies`, or ADD-01 fails by construction.

</domain>

<decisions>
## Implementation Decisions

Every Phase-32 decision is either LOCKED upstream (by REQUIREMENTS.md's
VER-02/VER-03/ADD-01/DOC-01 + the ROADMAP goal + the shipped v0.2.2 test/e2e
patterns) or a small verification-mechanics detail resolved here against the
HIGH-confidence research SUMMARY/STACK/PITFALLS. Per the `--auto` trap-quadrant
rule, each open detail was rated on IMPACT x CONFIDENCE before auto-locking (see
the audit table at the end of this section). NONE fell in the HIGH-impact +
NOT-HIGH-confidence trap quadrant, so all were auto-locked to the researched
default. Each remains a legitimate plan-time re-open if the planner surfaces new
evidence.

### SARIF 2.1.0 schema validation (VER-02)
- **D-01:** Validate the REAL `formatSarifReport` output (over the committed
  fixtures) against the SARIF 2.1.0 JSON schema with **`ajv`** (add `ajv-formats`
  if the schema's `uri`/`uri-reference` formats need registering) as a
  **devDependency**, driven from a **COMMITTED** SARIF 2.1.0 schema JSON fixture
  (network-free, deterministic across the matrix -- never fetch at test time).
  VER-02 explicitly requires "validated against the 2.1.0 schema (dev-only
  validator)" -- a TRUE schema validator, distinct from Phase 31's golden-snapshot
  shape spec. The validator is a dev-only test harness and never a runtime dep, so
  the additive-only charter is untouched (D-05 re-confirms). If ajv chokes on a
  schema construct (draft mismatch / unknown format), pin the schema draft +
  register formats via `ajv-formats`; do NOT weaken to a shape-only assertion --
  that would not satisfy "validated against the 2.1.0 schema".

### Byte-stability + volatile-field redaction (VER-02)
- **D-02:** Use ONE shared redaction helper reused across the JSON + SARIF
  integration specs, applied BEFORE the byte-stability assertion. It normalizes
  the tool `version` (JSON tool field + SARIF `runs[].tool.driver.version`) and
  any duration field to a fixed placeholder. NOTE: the JSON payload already OMITS
  `durationMs` (Phase-30 D-05) and SARIF carries no duration, so today the ONLY
  live volatile field is the tool version -- but the helper is written to catch
  any future volatile field (never assert a literal version). Byte-stability is
  asserted two ways: (a) two-run same-process determinism, and (b) cross-OS/Node
  via the redacted snapshot riding the 6-cell matrix, explicitly covering the
  Windows path -> forward-slash `artifactLocation.uri` conversion.

### Integration fixtures (VER-02)
- **D-03:** REUSE existing COMMITTED real-cold-compiler fixtures that already yield
  a stable MIXED diagnostic set (a `TS####` + an `NG8xxx` + ideally a
  file-less/global diagnostic), so both the JSON and SARIF payloads carry
  representative content AND exercise the SARIF file-less no-location path
  (Phase-31 D-01) plus the relative-URI conversion. Add a dedicated reporter
  fixture ONLY if no existing fixture yields the needed shape. The integration
  tier drives BOTH `run()` (the CLI adapter) and the Nx executor over the fixtures
  emitting `--format json` and `--format sarif`.

### Shipped-tarball e2e placement (VER-03)
- **D-04:** EXTEND the existing e2e projects rather than add a new one, keeping the
  per-project dynamic CI matrix lean: CLI `--format json|sarif` via
  `angular-typechecker-cli-e2e`, `ng run <project>:typecheck --format ...` via
  `angular-typechecker-ng-cli-e2e`, and the Nx executor `--format ...` via
  `angular-typechecker-install-e2e` (or `-matrix-e2e`). Each adapter asserts
  (a) stdout-purity -- the stdout payload PARSES cleanly with no Nx chrome /
  advisory text leaking onto stdout; (b) the SARIF validates against the 2.1.0
  schema (reuse the D-01 dev-only validator); and (c) the exit code is IDENTICAL
  across `human`/`json`/`sarif` for the same input (the cardinal anti-false-pass).
  Plan-time re-open: the exact project-to-adapter mapping.

### Additive-only audit (ADD-01)
- **D-05:** Mirror the shipped `24-ADDITIVE-AUDIT.md` pattern -> `32-ADDITIVE-AUDIT.md`:
  a `git diff angular-typechecker@0.2.2..HEAD` scoped to the PUBLISHED surface +
  the `index.drift.ts` barrel-drift tsc, proving NO breaking change to the Nx
  executor id (`angular-typechecker:typecheck`), the `runTypecheck` / `CoreResult`
  / `CoreOptions` public API (only the new `format` option + the optional
  `totalFilesCount`), the Angular CLI builder, the CLI flag set, and the generator
  schemas; `renderReport` stays OUT of the public barrel. The
  `node-sarif-builder` classification is ALREADY resolved (Phase-31 31-01: it is a
  runtime `dependency` and `@nx/dependency-checks` SEES the lazy `import()` -> NO
  `ignoredDependencies` needed, A1 confirmed) -- the audit RE-CONFIRMS this against
  the real lint run, it does not re-litigate it. Baseline tag
  `angular-typechecker@0.2.2` exists (verified). The `v0.3.0` escape hatch stays
  untriggered.

### README + CHANGELOG (DOC-01)
- **D-06:** Add a README `## Machine-readable output` section documenting the
  `--format` flag, the JSON payload schema (flat `diagnostics[]`, `summary`,
  `formatVersion`, 1-based positions, code strings, file-less `null`), the SARIF
  `upload-sarif` GitHub Code Scanning recipe, and the "run from the repo root so
  `artifactLocation.uri` stays repo-relative" caveat. Add a curated UNDATED public
  CHANGELOG `0.2.3` entry in END-USER language (no internal ids / board jargon per
  the changelog-readme-end-user-facing rule). Add a docs content tripwire spec
  (mirror `standalone-cli-docs.spec.ts` / `angular-cli-docs.spec.ts`) drift-locking
  the documented flag + claims against `HELP_TEXT` / the payload shape. Docs-only;
  NO release cut, NO `package.json` bump (stays `0.2.2`).

### Claude's Discretion (planner-owned, no user preference expressed)
- The exact fixture selection (D-03), the redaction-helper signature + placeholder
  tokens (D-02), whether `ajv` needs `ajv-formats` (D-01), the docs-spec filename
  (D-06), and the precise project-to-adapter e2e mapping (D-04) are left to the
  planner, provided the observable proofs hold: schema-valid SARIF, byte-stable
  redacted payloads across the matrix, stdout-purity, exit-code parity, the
  additive-only verdict, and end-user-language docs.

### Auto-lock audit (IMPACT x CONFIDENCE per the `--auto` trap-quadrant rule)
| Decision | Impact | Confidence | Trap quadrant? | Basis |
|---|---|---|---|---|
| D-01 ajv dev-only schema validator | MED (verification quality) | HIGH | No | STACK explicitly recommends `ajv` dev-dep + bundled schema; VER-02 mandates a validator; dev-only -> additive-only untouched |
| D-02 volatile-field redaction | MED (snapshot determinism) | HIGH | No | PITFALLS 11/12 + STACK; JSON already omits `durationMs` so surface is tiny; standard redact-before-compare |
| D-03 reuse committed fixtures | MED (coverage of real payloads) | HIGH | No | 30+ committed real-compiler `*.integration.spec.ts` fixtures already exist; pick one with a mixed diagnostic set |
| D-04 extend existing e2e projects | MED (test infra, reversible) | HIGH | No | 5 e2e projects + per-project dynamic matrix + `tarball-audit.e2e.spec.ts` extension pattern all shipped |
| D-05 additive-only audit | HIGH (release correctness) | HIGH | No | `24-ADDITIVE-AUDIT.md` pattern shipped; `@0.2.2` baseline tag exists; dep classification already resolved (31-01) |
| D-06 README + CHANGELOG | MED (docs accuracy) | HIGH | No | Three shipped `*-docs.spec.ts` tripwires + curated-CHANGELOG pattern; end-user-language rule locked |

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or
implementing.**

### Milestone contract (locked requirements + goal)
- `.planning/REQUIREMENTS.md` -- VER-02 (integration + dev-only schema validator +
  redaction + cross-OS byte-stability), VER-03 (shipped-tarball e2e, three
  adapters, stdout-purity, exit-code parity), ADD-01 (additive-only charter +
  `node-sarif-builder` classification + the `v0.3.0` escape hatch), DOC-01 (README
  `## Machine-readable output` + curated CHANGELOG). Also the Out-of-Scope table.
- `.planning/ROADMAP.md` -> "Phase 32: Verification + docs + additive audit" -- the
  goal, the 4 success criteria, and the 4 plan sketches (32-01 integration;
  32-02 tarball e2e; 32-03 additive audit; 32-04 README/CHANGELOG).

### v0.2.3 research (HIGH confidence; grounded in the shipped v0.2.2 source + the real 4.1.0 tarball)
- `.planning/research/v0.2.3-reporters/SUMMARY.md` -- "Implications for Roadmap"
  (Phase 3 = verification/docs), the verification pitfalls list, the additive-only
  audit expectation.
- `.planning/research/v0.2.3-reporters/STACK.md` -- the SARIF-schema-validator
  choice (`ajv` dev-dep + bundled sarif-2.1.0 schema; `@microsoft/sarif-multitool`
  rejected as heavyweight), the "runtime validator = wrong" rule.
- `.planning/research/v0.2.3-reporters/PITFALLS.md` -- 11 (SARIF schema
  validation, dev-only, `$id` `https://json.schemastore.org/sarif-2.1.0.json`),
  12 (non-deterministic fields -> redact before snapshot), 5 (ordering /
  byte-stability), 4/8 (URI normalization / Windows paths).
- `.planning/research/v0.2.3-reporters/FEATURES.md` / `ARCHITECTURE.md` -- the JSON
  shape + SARIF shape being documented in the README.

### Prior phases (the reporters this phase VERIFIES + the shipped test patterns it EXTENDS)
- `.planning/phases/30-reporter-seam-json-reporter-format-threading-observability/30-CONTEXT.md`
  -- JSON payload shape (D-01..D-06), `durationMs` omission (D-05), verdict purity
  (D-07), the shared `diagnostic-record.ts` projection (D-13).
- `.planning/phases/31-sarif-reporter/31-CONTEXT.md` -- SARIF shape, file-less
  no-location (D-01), `partialFingerprints` (D-02), `node-sarif-builder`
  classification + `@nx/dependency-checks` visibility resolution (D-05, A1
  confirmed -- the ADD-01 re-confirmation baseline).

### Additive-only + release charter
- `.planning/PROJECT.md` -- Constraints (stack, additive-only 0.x charter, the
  `nx`-as-direct-dependency correction).
- `AGENTS.md` -- Conventional-Commits + the human-gated Release-PR flow (why the
  version bump / tag / publish are NOT part of this phase) + the additive-only
  rule + the "curated CHANGELOG, no internal ids" rule.

### External (SARIF schema + GitHub upload-sarif; cited in research)
- SARIF 2.1.0 JSON schema -- `$id` `https://json.schemastore.org/sarif-2.1.0.json`
  (commit a copy into the repo as the dev-only validation fixture; do not fetch at
  test time).
- GitHub Docs "Uploading a SARIF file to GitHub" (`upload-sarif` action) -- the
  README recipe source; the repo-relative-URI / run-from-repo-root caveat.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Integration tier (`*.integration.spec.ts`, real cold `@angular/compiler-cli`):**
  30+ committed real-compiler fixtures already exist (e.g.
  `run-typecheck.integration.spec.ts`, `multi-tsconfig.integration.spec.ts`,
  `global-diagnostics.integration.spec.ts`, `layout-a/b.integration.spec.ts`,
  `main.integration.spec.ts`). Pick one whose fixture yields a stable mixed
  `TS####` + `NG8xxx` (+ file-less/global) diagnostic set for D-03; no new engine.
- **`core/sarif-report.ts` + `__snapshots__/sarif-report.spec.ts.snap`** (Phase 31):
  the shipped SARIF reporter + its golden-snapshot shape spec. VER-02's dev-only
  ajv validator runs against THIS reporter's real output; it complements (does not
  replace) the golden snapshot.
- **`core/json-report.ts` + `core/diagnostic-record.ts`** (Phase 30): the JSON
  reporter + the ONE shared projection. The integration tier drives `--format json`
  through these unchanged.
- **e2e projects (5):** `angular-typechecker-{cli,ng-cli,install,matrix,cache}-e2e`
  + the per-project dynamic CI matrix (fs-reads `e2e/*/project.json`), the shared
  Verdaccio `install-e2e` global-setup, the `runShim` spawnSync helper, and
  `tarball-audit.e2e.spec.ts` (the REQUIRED_FILES + manifest-shape pattern to
  extend for VER-03).
- **`src/index.drift.ts` barrel tripwire** (Phase 24) + the tsconfig.drift tsc:
  the ADD-01 barrel-unchanged proof. `24-ADDITIVE-AUDIT.md` is the doc template.
- **Docs tripwires:** `angular-cli-docs.spec.ts`, `standalone-cli-docs.spec.ts`,
  `storybook-docs.spec.ts` -- the `*-docs.spec.ts` content-lock pattern for DOC-01,
  plus the exported `parseCliArgs(['--help'])` / `HELP_TEXT` drift-lock idiom.
- **`packages/angular-typechecker/README.md`** -- already has an `### Options`
  table (+4 `--format`/`--quiet`/`--color` rows from Phase 30); DOC-01 adds the
  full `## Machine-readable output` prose section.

### Established Patterns
- **Verdict purity (the anti-false-pass):** `evaluateResult` / `toExitCode` are the
  SOLE verdict owners; reporters are pure `(CoreResult, ts) => string`. Exit-code
  parity across formats (VER-03) rests on this -- a coverage-incomplete run
  (`errorCount === 0`, `success === false`) returns exit 1 in every format.
- **Redact-before-compare** for volatile fields (tool version) before any
  cross-cell byte assertion (PITFALLS 12).
- **Dev-only test dependencies never reach `dependencies`** -- `ajv`/`ajv-formats`
  go in workspace/plugin devDependencies; ADD-01 asserts the published `dependencies`
  gained ONLY `node-sarif-builder`.

### Integration Points
- NEW dev-only: `ajv` (+ maybe `ajv-formats`) devDependency + a committed
  SARIF 2.1.0 schema JSON fixture; a shared redaction helper; VER-02 integration
  specs over the reused fixtures.
- EXTEND: the three e2e projects (cli / ng-cli / install|matrix) with `--format`
  assertions (VER-03); `tarball-audit.e2e.spec.ts` shape if needed.
- NEW: `.planning/phases/32-.../32-ADDITIVE-AUDIT.md` (ADD-01); a README
  `## Machine-readable output` section + a docs tripwire spec + a curated CHANGELOG
  `0.2.3` entry (DOC-01).

</code_context>

<specifics>
## Specific Ideas

- The SARIF schema fixture is COMMITTED (network-free) with `$id`
  `https://json.schemastore.org/sarif-2.1.0.json`, matching the research citation;
  the validator asserts the REAL reporter output validates, not a hand-rolled
  object.
- VER-03's exit-code parity is the milestone's signature never-silent proof on the
  SHIPPED artifact: `human`/`json`/`sarif` must return the identical literal exit
  code for the same input, including the coverage-incomplete case.
- This phase cuts NO release. Docs are undated and `package.json` stays `0.2.2`;
  the `0.2.2 -> 0.2.3` bump + tag + npm publish run later through the human-gated
  Release-PR flow (AGENTS.md), never inside a `--chain` execute.

</specifics>

<deferred>
## Deferred Ideas

- **The actual v0.2.3 release cut** (version bump `0.2.2 -> 0.2.3`, tag
  `angular-typechecker@0.2.3`, npm publish) -- the human-gated Release-PR flow
  after this phase verifies, NOT part of Phase 32.
- **Published hosted `$schema` URL** (REP-04), **`--output <file>`** (CLIX-03; shell
  redirection covers it), **other formats** (codeclimate / compact / GitLab,
  REP-03), **SARIF `relatedInformation` -> `relatedLocations`** (REP-05),
  **`--watch`** (CLIX-01, needs the deferred `NgtscProgram` engine) -- future
  milestones, out of scope.
- **Off-stack Angular 20/21 verification** -- dropped since v0.2.1; on-stack
  Angular 22 only.

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 32-verification-docs-additive-audit*
*Context gathered: 2026-07-19*
