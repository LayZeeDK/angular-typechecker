---
phase: 32-verification-docs-additive-audit
verified: 2026-07-19T02:44:11Z
status: human_needed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Push this branch (or open the v0.2.3 Release-PR) and let the CI 6-cell OS x Node matrix run `nx test` + `nx integration` for angular-typechecker, confirming the committed redacted snapshots (machine-reporters-{json,sarif}.integration.spec.ts.snap) match byte-for-byte on Linux and macOS, not just this Windows dev machine."
    expected: "All 6 matrix cells (3 OS x 2 Node versions per ci.yml's lean-matrix design) pass nx test + nx integration with no snapshot diff, proving the Windows path -> forward-slash artifactLocation.uri conversion and the rest of the redacted payload are truly cross-OS/Node byte-stable, not just locally reproducible."
    why_human: "This verification ran on a single Windows machine with one local Node version. The branch (gsd/v0.2.3-machine-readable-reporters) is 27 commits ahead of origin and has not been pushed, so CI has not yet executed the OS/Node matrix against this phase's commits -- cross-OS equality is a CI-observable fact, not something a single local machine can confirm."
---

# Phase 32: Verification + docs + additive audit Verification Report

**Phase Goal:** The SHIPPED tarball emits valid JSON + schema-valid SARIF across all three adapters (Nx executor, `ng run`, standalone CLI `--format`), the payloads are byte-stable across the OS/Node matrix, the whole milestone is proven additive-only vs `angular-typechecker@0.2.2`, and the README/CHANGELOG document the feature in end-user language. Proof + docs land after both reporters work.

**Verified:** 2026-07-19T02:44:11Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VER-02: An integration tier runs `run()` + the Nx executor over committed real-cold-compiler fixtures emitting JSON + SARIF; SARIF validates against the 2.1.0 schema (dev-only validator); both payloads byte-stable across OS/Node cells after redacting volatile fields, incl. Windows path -> forward-slash URI | VERIFIED (locally) | `npx nx integration angular-typechecker` -- 24 files / 139 tests pass, including `machine-reporters-json.integration.spec.ts` (10 tests) and `machine-reporters-sarif.integration.spec.ts` (9 tests). `validate-sarif.ts` compiles the committed `sarif-2.1.0.schema.json` (draft-07, 111720 bytes) with real `ajv`+`ajv-formats` and validates the REAL `formatSarifReport` output -- not a shape-only assertion. `redact-volatile.ts` maps the tool version to `[version]` before every snapshot compare. Committed snapshots inspected directly: forward-slash repo-relative `file`/`tsConfigPath` (no backslash), `[version]` placeholder present, file-less `file: null` entries present. See human-verification item below for the cross-OS/Node matrix confirmation, which requires CI. |
| 2 | VER-03: A shipped-tarball e2e proves the installed package emits valid JSON + schema-valid SARIF through ALL three adapters (Nx executor, `ng run`, CLI `--format`), asserting stdout-purity and exit-code parity | VERIFIED | Ran all three e2e projects directly (not trusting SUMMARY): `nx e2e angular-typechecker-cli-e2e` (4 files / 5 tests, incl. `assertMachineFormatParity`), `nx e2e angular-typechecker-ng-cli-e2e` (4 files / 5 tests, incl. the `ng run --format` block), `nx e2e angular-typechecker-install-e2e` (11 files / 40 tests, incl. the `nx run --format` block in `install-smoke.e2e.spec.ts` and the resolved tarball-snapshot-leak fix). All green. `runShimSplit`/`ShimResultSplit` and `extractJsonPayload` exist and are exported from `@workspace/test-util`; read the install-smoke spec's `--format` block directly and confirmed it asserts exit-code parity (human/json/sarif all 0 clean) plus the planted-TS2322 non-zero-parity case, JSON payload shape, and SARIF schema validity with no advisory text inside either payload. |
| 3 | ADD-01: A git-diff / `index.drift.ts` barrel audit proves additive-only vs `angular-typechecker@0.2.2` -- no breaking change to the executor id, the `runTypecheck`/`CoreResult`/`CoreOptions` API, the Angular CLI builder, the CLI flag set, or the generator schemas; `node-sarif-builder` classified as a dependency with lazy-import visibility resolved; `v0.3.0` untriggered | VERIFIED | Independently re-ran the audit commands rather than trusting `32-ADDITIVE-AUDIT.md`'s prose: `git diff angular-typechecker@0.2.2..HEAD -- packages/angular-typechecker/src/index.ts` is empty (barrel byte-unchanged); `-- packages/angular-typechecker/package.json` shows `dependencies` gained exactly `node-sarif-builder@^4.1.0`; `git show HEAD:.../package.json \| rg -q ajv` finds nothing; root `package.json` devDependencies has `ajv@^8.20.0` + `ajv-formats@^3.0.1`; `executors.json`/`builders.json`/`builder.ts` diffs are all empty; `eslint.config.mjs` `ignoredDependencies` is `['nx','@angular-devkit/architect','@angular-devkit/schematics','rxjs']` -- `node-sarif-builder` is NOT there, confirming `@nx/dependency-checks` sees the lazy import. `nx typecheck`/`nx lint`/`nx test`/`nx format:check` for `angular-typechecker` all green. `package.json` version is still `0.2.2`. |
| 4 | DOC-01: A README `## Machine-readable output` section documents `--format`, the JSON payload schema, and the SARIF `upload-sarif` recipe (incl. the repo-root caveat), alongside a curated end-user-language public CHANGELOG entry with no internal ids | VERIFIED | Read the actual README section (lines 583-710): documents `--format <human\|json\|sarif>`, the exact JSON payload shape (verified against `json-report.ts`'s real keys), the `upload-sarif` GitHub Actions recipe, the file-less no-location behavior, and the run-from-repo-root `artifactLocation.uri` caveat, all in clear end-user prose. Confirmed the three stale reporter passages (the `--format` Options row's "lands in a later release" clause, the "deliberate non-goal" paragraph, and the `## Limitations` "non-goals in v0.x" bullet) are gone (`git grep -n -i "non-goal"` and `"lands in a later release"` on the README return zero matches). CHANGELOG's `## 0.2.3` entry read directly: clean end-user prose, programmatically checked for requirement-id/phase-number leaks (`VER-\|DOC-\|ADD-\|FMT-\|REP-\|OBS-\|CLIX-\|phase\s*\d+` regex) -- clean. `packages/angular-typechecker/package.json` version confirmed still `0.2.2`. `machine-readable-docs.spec.ts` (11 tests) ran green as part of `nx test angular-typechecker` (534/534 passing), drift-locking all of the above. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `libs/test-util/src/lib/validate-sarif.ts` | Real ajv-based SARIF 2.1.0 schema validator | VERIFIED | Exists, compiles the committed schema once at module load with `ajv`+`ajv-formats`, returns `{valid, errors}`. Not a shape-only stub. |
| `libs/test-util/src/lib/sarif-2.1.0.schema.json` | Committed SARIF 2.1.0 draft-07 schema | VERIFIED | Exists, 111720 bytes, `$schema` contains draft-07 (per SUMMARY, confirmed the file exists and is consumed by validate-sarif.ts). |
| `libs/test-util/src/lib/redact-volatile.ts` | Shared volatile-field redaction helper | VERIFIED | Exists; handles both SARIF (`runs[].tool.driver.version`) and JSON (`version`) branches. |
| `packages/angular-typechecker/src/core/machine-reporters-json.integration.spec.ts` | JSON integration spec over real fixtures | VERIFIED | Exists; 10 tests, all pass under `nx integration`. |
| `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` | SARIF integration spec over real fixtures | VERIFIED | Exists; 9 tests, all pass under `nx integration`. |
| Committed `.snap` files for both integration specs | Redacted byte-stability snapshots | VERIFIED | Both exist; inspected content directly -- forward-slash paths, `[version]` placeholder, file-less nulls, no-location SARIF entries. |
| `libs/test-util/src/lib/cli-e2e.ts` (`runShimSplit`, `assertMachineFormatParity`) | Stream-split shim + format-parity assertion | VERIFIED | Exported from `@workspace/test-util`; used in `cli-exit-codes.e2e.spec.ts`; test passes. |
| `e2e/angular-typechecker-{cli,ng-cli,install}-e2e/src/*` `--format` blocks | Adapter-level VER-03 proofs | VERIFIED | All three e2e projects extended (not new projects), all green when run directly. |
| `.planning/phases/32-verification-docs-additive-audit/32-ADDITIVE-AUDIT.md` | ADD-01 verdict doc | VERIFIED | Exists, five sections, states ADDITIVE-ONLY HOLDS / v0.3.0 UNTRIGGERED / version 0.2.2. Verdict independently reproduced via git-diff commands, not just trusted. |
| `packages/angular-typechecker/README.md` `## Machine-readable output` | DOC-01 section | VERIFIED | Exists at line 583, ToC anchor at line 43, all sub-content present. |
| `CHANGELOG.md` `## 0.2.3` | Curated undated entry | VERIFIED | Exists above `## 0.2.2`, undated, end-user language, clean of internal ids. |
| `packages/angular-typechecker/src/machine-readable-docs.spec.ts` | Docs tripwire | VERIFIED | Exists, 11 tests, all pass; drift-locks section/anchor/flags/absence-of-stale-claims/CHANGELOG hygiene. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `@workspace/test-util` barrel | `validateSarif`/`redactVolatile` | re-export in `libs/test-util/src/index.ts` | WIRED | Confirmed both symbols re-exported; imported and used in the 32-01 integration specs, the 32-02 e2e specs, and reused across all three e2e adapters. |
| `run()`/executor | `renderReport` (json/sarif dispatch) | integration specs drive both adapters over the same fixtures and assert redacted-payload equality | WIRED | Verified both `machine-reporters-{json,sarif}.integration.spec.ts` exercise `run()` (CLI, `pathBase=process.cwd()`) and `typecheckExecutor` (executor, `pathBase=context.root`) directly, both green. |
| `relativizePath` (diagnostic-record.ts) | repo-relative forward-slash URIs | committed snapshots | WIRED | Confirmed no backslash/drive-letter in any snapshot path; the cross-OS proof mechanism (committed redacted snapshot) is correctly wired, though only locally exercised on Windows this session (see human-verification item). |
| `evaluateResult`/`toExitCode` | exit-code parity across formats | e2e `--format` blocks in all three adapters | WIRED | Directly read the install-smoke.e2e.spec.ts `--format` block: asserts identical exit code across human/json/sarif for both the clean and planted-TS2322 cases. |
| `@nx/dependency-checks` | `node-sarif-builder` correct classification | `eslint.config.mjs` `ignoredDependencies` (does NOT list it) + `nx lint` green | WIRED | Confirmed directly: `node-sarif-builder` absent from the ignore list, `nx lint` at `maxWarnings:0` passes. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|------------|-------------|--------|----------|
| VER-02 | 32-01-PLAN.md | Integration tier proves JSON+SARIF over real fixtures, schema-validated, byte-stable | SATISFIED | `nx integration angular-typechecker` green (24 files/139 tests incl. the two new specs); REQUIREMENTS.md traceability marks VER-02 -> Phase 32 -> Complete. |
| VER-03 | 32-02-PLAN.md | Shipped-tarball e2e proves all 3 adapters emit valid machine payloads with exit-code parity | SATISFIED | All three e2e projects (`cli`, `ng-cli`, `install`) ran green directly; REQUIREMENTS.md traceability marks VER-03 -> Phase 32 -> Complete. |
| ADD-01 | 32-03-PLAN.md | Additive-only audit vs `@0.2.2` | SATISFIED | Independently reproduced the git-diff/dependency/barrel evidence; matches the audit doc's verdict; REQUIREMENTS.md traceability marks ADD-01 -> Phase 32 -> Complete. |
| DOC-01 | 32-04-PLAN.md | README + CHANGELOG document the feature in end-user language | SATISFIED | Read README/CHANGELOG directly, confirmed content + absence of stale claims + absence of internal-id leaks; REQUIREMENTS.md traceability marks DOC-01 -> Phase 32 -> Complete. |

No orphaned requirements: REQUIREMENTS.md's traceability table maps exactly VER-02/VER-03/ADD-01/DOC-01 to Phase 32, and all four appear in exactly one plan's frontmatter `requirements` field each (32-01/32-02/32-03/32-04 respectively).

### Anti-Patterns Found

None. Scanned every file this phase created/modified for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` debt markers -- zero hits (the one `PLACEHOLDER` match, `VERSION_PLACEHOLDER`, is a legitimate named constant for the redaction sentinel value, not an unfinished-work marker). No stub return patterns (`return null`/`return {}`/empty arrow bodies) found in the new reporters/helpers/specs. No hardcoded-empty-data patterns found flowing to rendered output.

### Behavioral Spot-Checks / Full Test Runs

Rather than sampling with a single named test, this verification ran every affected gate directly (all green, evidence captured above):

| Gate | Command | Result | Status |
|------|---------|--------|--------|
| Integration tier (VER-02) | `npx nx integration angular-typechecker` | 24 files / 139 tests pass (incl. 10 + 9 new) | PASS |
| Unit tier + docs tripwire | `npx nx test angular-typechecker` | 51 files / 534 tests pass (incl. 11 new docs tests) | PASS |
| Typecheck (barrel drift) | `npx nx typecheck angular-typechecker` | 3 tsc commands pass | PASS |
| Lint (dependency-checks) | `npx nx lint angular-typechecker` | green, `maxWarnings:0` | PASS |
| Format | `npx nx format:check` | clean | PASS |
| test-util lib | `npx nx lint test-util && npx nx typecheck test-util` | green | PASS |
| CLI e2e (VER-03) | `npx nx e2e angular-typechecker-cli-e2e` | 4 files / 5 tests pass | PASS |
| ng-cli e2e (VER-03) | `npx nx e2e angular-typechecker-ng-cli-e2e` | 4 files / 5 tests pass | PASS |
| install e2e (VER-03 + tarball audit) | `npx nx e2e angular-typechecker-install-e2e` | 11 files / 40 tests pass | PASS |

All results match the SUMMARY.md claims exactly (test counts, file counts) -- no discrepancy found between claimed and actual outcomes.

### Human Verification Required

### 1. Cross-OS/Node byte-stability confirmation (VER-02, part of Success Criterion 1)

**Test:** Push the `gsd/v0.2.3-machine-readable-reporters` branch (currently 27 commits ahead of `origin`, not yet pushed) or open the v0.2.3 Release-PR, and let `ci.yml`'s lean 6-cell OS x Node matrix run `nx test` + `nx integration` for `angular-typechecker`.

**Expected:** All 6 matrix cells pass with no snapshot diff against the committed `machine-reporters-{json,sarif}.integration.spec.ts.snap` files, proving the redacted JSON/SARIF payloads -- including the Windows path -> forward-slash `artifactLocation.uri` conversion -- are truly byte-stable across every OS/Node combination, not just reproducible on this one Windows dev machine.

**Why human:** This verification session has access to only one machine (Windows) and one local Node version. The integration/unit test suites were run directly and passed here, and the snapshot mechanism (dev-only ajv schema validator + shared redaction helper + committed redacted snapshot) is correctly wired and designed to prove cross-OS equality -- but the actual cross-OS confirmation is a CI-observable fact that requires the matrix workflow to execute, which has not happened yet for this branch/commit range.

### Gaps Summary

No gaps found. All four phase requirements (VER-02, VER-03, ADD-01, DOC-01) were independently re-verified against the live codebase -- not merely accepted from SUMMARY.md claims -- by: reading every claimed artifact's actual content, re-running every test suite/e2e project/lint/typecheck/format gate directly, and independently reproducing the ADD-01 git-diff/dependency evidence rather than trusting the audit doc's prose. Every result matched the SUMMARY.md claims exactly (test counts, file lists, dependency diffs, absence of stale doc claims). The single outstanding item is not a code gap but an observability gap: full cross-OS/Node matrix confirmation requires CI, which has not yet run against this unpushed branch.

---

*Verified: 2026-07-19T02:44:11Z*
*Verifier: Claude (gsd-verifier)*
