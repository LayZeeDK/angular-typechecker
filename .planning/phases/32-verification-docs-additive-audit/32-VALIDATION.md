---
phase: 32
slug: verification-docs-additive-audit
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-19
validated: 2026-07-19
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Requirements: VER-02 (integration + SARIF schema validation + byte-stability),
> VER-03 (shipped-tarball e2e, three adapters, stdout-purity, exit-code parity),
> ADD-01 (additive-only audit vs `@0.2.2`), DOC-01 (README + CHANGELOG + drift-lock).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `@nx/vitest:test`) |
| **Config file** | `packages/angular-typechecker/vite.config.ts` + `vitest.workspace.ts` |
| **Quick run command** | `npx nx test angular-typechecker` (Unit tier, `dependsOn: build`) |
| **Integration command** | `npx nx integration angular-typechecker` (real cold `@angular/compiler-cli`) |
| **e2e command** | `npx nx run-many -t e2e --parallel=2` (packed tarball + Verdaccio; per-project CI matrix) |
| **Full suite command** | `npx nx test angular-typechecker && npx nx integration angular-typechecker && npx nx lint angular-typechecker && npx nx typecheck angular-typechecker && npx nx format:check` |
| **Estimated runtime** | Unit ~20s · Integration ~60s · e2e ~6min |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test angular-typechecker` (+ `nx integration` when the task touches an integration spec).
- **After every plan wave:** Run the full suite (test + integration + lint + typecheck + format:check); run the affected e2e project for VER-03 tasks.
- **Before `/gsd:verify-work`:** Full suite green, including `nx lint` at `maxWarnings:0` (the ADD-01 `@nx/dependency-checks` re-confirmation) and `nx typecheck` (the `index.drift.ts` barrel + spec tsconfigs — recall `nx test` does NOT type-check specs).
- **Max feedback latency:** ~60 seconds (Unit + Integration); e2e is wave-level.

---

## Per-Task Verification Map

Adversarially re-audited 2026-07-19 (post-execution, FORCE-stance pass; gsd-nyquist-auditor).
Every command below was re-run fresh this pass with `--skip-nx-cache` where applicable (not
sourced from SUMMARY/VERIFICATION prose), and every doc/dependency claim was independently
re-derived from the live files (`git grep`, direct `Read`) rather than trusted from
`32-ADDITIVE-AUDIT.md`. No gap was found; no test file was created.

| Requirement | Observable proof | Test tier | Re-run evidence |
|-------------|------------------|-----------|------------------|
| VER-02 | Real cold `@angular/compiler-cli` fixtures (`layout-b-host`, `global-diagnostics`) drive `run()` AND the Nx executor; SARIF schema-validates via real `ajv`+`ajv-formats` against the committed draft-07 2.1.0 schema (not shape-only); JSON payload asserted key-for-key; both payloads byte-stable two-run and against a committed redacted snapshot; forward-slash `artifactLocation.uri` (no backslash/drive letter) | Integration (`src/core/machine-reporters-{json,sarif}.integration.spec.ts`) | `npx nx integration angular-typechecker --skip-nx-cache` -> 24 files / 139 tests pass, incl. `machine-reporters-json.integration.spec.ts` (10) + `machine-reporters-sarif.integration.spec.ts` (9) confirmed running (not cache-replayed). Read `validate-sarif.ts` directly: compiles the real schema with `Ajv({strict:false,allErrors:true})` + `addFormats`, no stub. |
| VER-03 | Shipped-tarball e2e proves all three adapters (Nx executor via `nx run`, `ng run`, standalone CLI `--format`) emit valid JSON + schema-valid SARIF; stdout-purity (payload parses from stdout alone, no advisory-notice contamination); exit code identical across human/json/sarif for both a clean and a planted-TS2322 fixture | e2e (packed tarball + Verdaccio; `cli-exit-codes.e2e.spec.ts`, `ng-add-ng-run.e2e.spec.ts`, `install-smoke.e2e.spec.ts`) | Confirmed by spec-content review per the audit brief (full Verdaccio tier not re-run locally — CI/wave-level gate). Read `assertMachineFormatParity` (`libs/test-util/src/lib/cli-e2e.ts`): loops all 3 formats, asserts exit 0 clean / 1 planted for each, `JSON.parse` from stdout alone + no `ADVISORY_NOTICE_PREFIX`, `validateSarif` schema check. Confirmed `--format human\|json\|sarif` invoked in all three e2e spec files (`git grep`). Prior verifier session (`32-VERIFICATION.md`) ran all three e2e projects directly and green (5+5+40 tests); not re-run this pass per audit-brief scoping. |
| ADD-01 | `git diff angular-typechecker@0.2.2..HEAD` shows only additions/widenings on the published surface (barrel, executor id, schemas); `index.drift.ts` barrel tsc green; `nx lint` green at `maxWarnings:0` with only `node-sarif-builder` in plugin `dependencies` and NOT in `ignoredDependencies` (so `@nx/dependency-checks` truly sees the lazy import); `ajv`/`ajv-formats` absent from the shipped manifest; `32-ADDITIVE-AUDIT.md` records the verdict | Unit (drift tsc) + audit doc + `nx lint` | `npx nx typecheck angular-typechecker --skip-nx-cache` -> 3 tsc commands green incl. `tsconfig.drift.json` (`src/index.drift.ts` in its `files`). `npx nx lint angular-typechecker --skip-nx-cache` -> `maxWarnings:0` clean. Independently confirmed: `packages/angular-typechecker/package.json` `dependencies` has `node-sarif-builder` and NO `ajv`; `eslint.config.mjs` `ignoredDependencies: ['nx','@angular-devkit/architect','@angular-devkit/schematics','rxjs']` — `node-sarif-builder` absent, so lint passing proves the checker sees the real import. |
| DOC-01 | README `## Machine-readable output` present (+ ToC anchor); docs content tripwire drift-locks `--format` claims against live `parseCliArgs(['--help'])` output + payload shape; keeps the reconciled stale "lands in a later release" claim absent from README, CLI help, AND both executor/builder schema descriptions; curated undated CHANGELOG `0.2.3` entry with an internal-id/board-jargon regex guard; `package.json` stays `0.2.2` | Unit (`src/machine-readable-docs.spec.ts`) | `npx nx test angular-typechecker --skip-nx-cache` -> 51 files / 534 tests pass, incl. `machine-readable-docs.spec.ts` (11). Read the spec directly: real `readFileSync` of the actual README/CHANGELOG + a live `parseCliArgs(['--help'])` call, not string literals re-asserting themselves. Independently confirmed with `git grep`: README line 583 has `## Machine-readable output`; `CHANGELOG.md` line 5 has `## 0.2.3`; `package.json` `"version": "0.2.2"`. |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — all four rows: ✅ green.*

### Independent Audit Evidence (adversarial re-run, 2026-07-19)

| Command | Result |
|---------|--------|
| `npx nx test angular-typechecker` then `--skip-nx-cache` | 51 files / 534 tests pass both times (incl. `machine-readable-docs.spec.ts`, 11 tests) |
| `npx nx integration angular-typechecker` then `--skip-nx-cache` | 24 files / 139 tests pass both times (incl. `machine-reporters-{json,sarif}.integration.spec.ts`, 10 + 9 tests, confirmed by name in the fresh run's output) |
| `npx nx typecheck angular-typechecker` then `--skip-nx-cache` | 3 tsc commands green both times (`tsconfig.spec.json`, `tsconfig.drift.json`, `tsconfig.tools.json`) |
| `npx nx lint angular-typechecker` then `--skip-nx-cache` | `maxWarnings:0` clean both times |
| `git grep -n "node-sarif-builder"` (package.json) / `rg -n "ajv"` (package.json, no match) | Confirms ADD-01's dependency classification claim |
| `git grep -n -A6 "ignoredDependencies"` (eslint.config.mjs) | Confirms `node-sarif-builder` is NOT ignored -- lint green proves real visibility, not a suppressed check |
| `git grep -n "## Machine-readable output"` / `"## 0.2.3"` / `"version"` | Confirms DOC-01's presence claims independent of the tripwire spec |
| Read `validate-sarif.ts`, `machine-reporters-sarif.integration.spec.ts`, `machine-readable-docs.spec.ts`, `cli-e2e.ts`'s `assertMachineFormatParity` in full | Confirms none of the four requirement's tests are shape-only/tautological stubs -- all assert against real compiler output, real ajv validation, or real file reads |

No gap found. No test file created this pass (the phase's own deliverable already covers
every requirement with real, passing, behaviorally-load-bearing tests).

---

## Wave 0 Requirements

- [x] `ajv` + `ajv-formats` installed as **workspace-root devDependencies** (never plugin `dependencies` — ADD-01) + a committed SARIF 2.1.0 schema JSON fixture. Confirmed: root `package.json` devDependencies (`ajv@^8.20.0`, `ajv-formats@^3.0.1`), absent from the plugin manifest; `libs/test-util/src/lib/sarif-2.1.0.schema.json` committed.
- [x] A shared `validate-sarif` / `redactVolatile` / `runShimSplit` test-util home (per RESEARCH). Confirmed: `libs/test-util/src/lib/{validate-sarif,redact-volatile,cli-e2e}.ts`, re-exported from `@workspace/test-util`.

*Existing Vitest/integration/e2e infrastructure covers all phase requirements — reconfirmed this audit.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-OS/Node byte-stability | VER-02 | The redacted-payload byte match is asserted per-cell in the automated matrix; the CROSS-cell equality is observed by CI running the same spec on all 6 cells | Confirm the 6-cell CI matrix is green on the same redacted snapshot |

**Confirmed legitimate this audit (2026-07-19):** this is a genuine CI-observability gap, not
an escapable local-test gap. The automated spec (`machine-reporters-{json,sarif}.integration.spec.ts`)
already asserts byte-stability against a committed redacted snapshot on THIS machine (Windows);
no local mechanism can additionally prove Linux/macOS produce the identical redacted bytes --
that fact only exists once `ci.yml`'s 6-cell OS x Node matrix runs the same spec against the
same commit. `32-VERIFICATION.md` independently reached the same conclusion
(`status: human_needed`, one item, identical rationale). No fill possible or warranted.

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** validated 2026-07-19 (adversarial FORCE-stance audit) — 0 gaps found across
VER-02/VER-03/ADD-01/DOC-01; all four requirements already had real, passing,
behaviorally-load-bearing tests independently re-run this pass. The one Manual-Only item
(cross-OS/Node byte-stability, VER-02) is confirmed legitimate (a CI-observable fact, not a
local-test escape). No implementation touched; no test file created (none was needed).
