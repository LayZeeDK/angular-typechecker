---
phase: 31-sarif-reporter
verified: 2026-07-18T23:35:00Z
status: passed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 31: SARIF reporter Verification Report

**Phase Goal:** A user selects `--format sarif` and gets valid SARIF 2.1.0 ready for
GitHub Code Scanning `upload-sarif`, built with the one deliberate new dependency
(`node-sarif-builder`) lazy-`import()`ed ONLY on the SARIF path (human / JSON /
`--help` / CLI-boot never load it). The reporter reuses Phase 30's shared
normalized-record projection so JSON and SARIF cannot drift on positions/codes/paths.

**Verified:** 2026-07-18T23:35:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `core/sarif-report.ts` exists, is pure, reached only via `await import('./sarif-report.js')` from `render-report.ts`'s `sarif` branch (old `throw 'Phase 31'` gone) | ✓ VERIFIED | `render-report.ts:78-86` — `case 'sarif'` does `const { formatSarifReport } = await import('./sarif-report.js'); return formatSarifReport(result, ts_, options.pathBase);`. No static `import ... from './sarif-report'` anywhere (`git grep` confirms `sarif-report` is only reached via the dynamic `import(` call). |
| 2 | Reuses `core/diagnostic-record.ts` (`toDiagnosticRecord`) — never re-implements positions/codes/paths (D-13) | ✓ VERIFIED | `sarif-report.ts:3,91` imports and calls `toDiagnosticRecord(diagnostic, ts_, pathBase)`; `git grep` for `path.relative\|ngCodeOf\|getLineAndCharacterOfPosition\|flattenDiagnosticMessageText` in `sarif-report.ts` finds ONLY the doc-comment prose forbidding them (lines 15-16) — zero actual calls. |
| 3 | 18-NG8xxx `rules[]` catalog driven from the enum-backed `core/extended-catalog.ts`; file-less diagnostics → no-location results (D-01); `partialFingerprints` under `atcFingerprint/v1` includes start line AND start column (post-MJ-01) | ✓ VERIFIED | `extended-catalog.ts` exports 18 entries keyed off `EXTENDED_DIAGNOSTIC_MEMBERS` (order-matched, confirmed against `extended-catalog.members.ts`). `extended-catalog.spec.ts` asserts declaration-order completeness + positive + **unique** ngCodes (MN-01 fix present). `sarif-report.ts:152-162` `fingerprintOf` tuple is `[code, file ?? '', message, line ?? '', column ?? '']` — column included (MJ-01 fix present, matches REVIEW resolution). Golden snapshot shows the file-less `ATC90001` result has NO `locations` key while the located `TS2322` result does. |
| 4 | VER-04: `sarif-require-graph.spec.ts` proves human/JSON/`--help`/CLI-boot never reach `node-sarif-builder`/`fs-extra`; `sarif-report.interop.spec.ts` is a REAL (not mocked) `await import()` interop test; `@nx/dependency-checks` passes with `node-sarif-builder` a declared dependency and no `ignoredDependencies` entry | ✓ VERIFIED | `sarif-require-graph.spec.ts` walks the BUILT `render-report.js` + `bin.js` (test run: 3/3 pass, incl. positive control asserting `import('./sarif-report.js')` is present in the built source). `sarif-report.interop.spec.ts` does a genuine `await import('node-sarif-builder')` (no `vi.mock`), destructures via `(mod.default ?? mod)`, asserts `version === '2.1.0'` (1/1 pass). `nx lint angular-typechecker` (maxWarnings:0) green; `eslint.config.mjs` `ignoredDependencies` list contains only `nx`/`@angular-devkit/architect`/`@angular-devkit/schematics`/`rxjs` — `node-sarif-builder` is absent (A1 resolved: no entry needed). |
| 5 | Additive-only (D-08): `index.ts` barrel, `index.drift.ts`, `builder.ts`, schema-parity specs unchanged; no version bump | ✓ VERIFIED | `git grep` on `index.ts` for `sarif\|renderReport\|formatSarifReport` returns nothing (absent from public barrel). `git diff --stat` across the phase's commit range shows `index.ts`, `index.drift.ts`, and `builder.ts` untouched. `packages/angular-typechecker/package.json` version is still `0.2.2` (patch bump to `0.2.3` is a release-time action, not a phase deliverable) — only the `node-sarif-builder` dependency line was added (1 insertion). |
| 6 | Exit-code parity across human/json/sarif incl. coverage-incomplete (D-07 / VER-01) | ✓ VERIFIED | `cli/main.spec.ts` `FMT-02 / D-07` describe block: both the type-error (`->1`) and coverage-incomplete (`errorCount 0`/`success false` `->1`) legs assert `sarif.exitCode === human.exitCode === json.exitCode`. `sarif-report.spec.ts`'s own `evaluateResult`-independence test confirms the reporter never re-derives the verdict. |
| 7 | `node-sarif-builder@^4.1.0` declared as a runtime dependency (publish manifest + root); `@types/sarif`/`fs-extra` stay transitive | ✓ VERIFIED | `git grep node-sarif-builder` in both `package.json` (root) and `packages/angular-typechecker/package.json` shows `"node-sarif-builder": "^4.1.0"` under `dependencies`. `git grep -c "@types/sarif\|fs-extra"` on both manifests returns 0. |
| 8 | Typed via `import type` only (D-04); no `@types/sarif` devDependency, no `import ... from 'sarif'` | ✓ VERIFIED | `sarif-report.ts:30` — `import type * as NodeSarifBuilder from 'node-sarif-builder';`. No value import of the package or `'sarif'` anywhere in the phase's files. |
| 9 | Code review findings resolved (MJ-01 fingerprint collision, MN-01 unique-ngCode guard) | ✓ VERIFIED | `31-REVIEW.md` records both FIXED with commit evidence; source inspection confirms both fixes are live in `sarif-report.ts` and `extended-catalog.spec.ts` (see truth 3 above). |

**Score:** 9/9 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/core/extended-catalog.ts` | Enum-keyed 18-rule catalog | ✓ VERIFIED | 18 entries, order matches `EXTENDED_DIAGNOSTIC_MEMBERS`; no `@angular/compiler-cli` import (dependency-free). |
| `packages/angular-typechecker/src/core/extended-catalog.spec.ts` | Completeness + uniqueness guard | ✓ VERIFIED | 4 tests: declaration-order completeness, positive ngCode, **unique** ngCode (MN-01), non-empty shortDescription. All pass. |
| `packages/angular-typechecker/src/core/sarif-report.ts` | `formatSarifReport`, `toSarifLevel`, `fingerprintOf` | ✓ VERIFIED | Pure `(CoreResult, ts_, pathBase) => Promise<string>`; lazy `await import('node-sarif-builder')`; reuses `toDiagnosticRecord`. |
| `packages/angular-typechecker/src/core/sarif-report.spec.ts` | Shape/golden/off-by-one/no-ANSI/file-less/exit-parity specs | ✓ VERIFIED | 8 tests, all pass — driver+18 rules, 1-based region off-by-one (matches JSON fixture), file-less no-`locations`, fingerprint format, severity→level mapping, no-ANSI + FORCE_COLOR byte-stability, golden snapshot, verdict-independence. |
| `packages/angular-typechecker/src/core/render-report.ts` | sarif branch replaced with `await import` | ✓ VERIFIED | Confirmed above (truth 1). |
| `node-sarif-builder@^4.1.0` dependency | Declared in publish manifest + root | ✓ VERIFIED | Confirmed above (truth 7). |
| `packages/angular-typechecker/src/core/sarif-require-graph.spec.ts` | Static require-graph guard | ✓ VERIFIED | 3 tests pass (render-report.js walk, bin.js walk, positive control). |
| `packages/angular-typechecker/src/core/sarif-report.interop.spec.ts` | REAL-import CJS interop | ✓ VERIFIED | 1 test pass, genuine `await import`, no mock. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `render-report.ts` sarif branch | `sarif-report.ts` | `await import('./sarif-report.js')` | WIRED | Confirmed at source and via the require-graph guard's positive control against the built dist. |
| `sarif-report.ts` | `node-sarif-builder` | `await import('node-sarif-builder')` + `(mod.default ?? mod)` | WIRED | Confirmed by the real-import interop spec (constructs all four builder classes, serializes `version: '2.1.0'`). |
| `sarif-report.ts` | `diagnostic-record.ts` / `extended-catalog.ts` | `toDiagnosticRecord` / `EXTENDED_DIAGNOSTIC_CATALOG` imports | WIRED | Direct static imports confirmed at `sarif-report.ts:3-4`; no re-implementation of the shared projection. |

### Behavioral Spot-Checks / Automated Gates (run directly, not trusted from SUMMARY)

| Command | Result | Status |
|---------|--------|--------|
| `NX_DAEMON=false npx nx test angular-typechecker --skip-nx-cache` | 50 files / 522 tests passed (incl. `sarif-report.spec.ts` 8, `sarif-require-graph.spec.ts` 3, `sarif-report.interop.spec.ts` 1, `extended-catalog.spec.ts` 4) | ✓ PASS |
| `npx nx run angular-typechecker:integration` | 22 files / 120 tests passed, incl. the rewired `extended-catalog.integration.spec.ts` (all 18 NG-code rows fire against the real `@angular/compiler-cli@22.0.4`, enriched-not-stripped ngCode confirmed live) | ✓ PASS |
| `npx nx typecheck angular-typechecker` | tsc over `tsconfig.spec.json` + `tsconfig.drift.json` + `tsconfig.tools.json` — clean | ✓ PASS |
| `npx nx lint angular-typechecker` | `@nx/dependency-checks` + all rules — "All files pass linting" (maxWarnings:0) | ✓ PASS |
| `npx nx format:check` | exit 0, no diffs | ✓ PASS |
| `git status --short` | clean (no stray/uncommitted files) | ✓ PASS |
| Anti-pattern scan (`TODO\|FIXME\|HACK\|PLACEHOLDER\|TBD\|XXX`) on all phase-touched core files | Only false-positive substring matches on "NG8**xxx**" naming — zero actual debt markers | ✓ CLEAN |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| REP-02 | 31-01 | `--format sarif` emits valid SARIF 2.1.0 with driver/rules/results/locations/partialFingerprints, lazy dep | ✓ SATISFIED | Truths 1-3, 5, 7-8; REQUIREMENTS.md traceability table already marks `REP-02 \| Phase 31 \| Complete` and its own line is checked `[x]`. |
| VER-04 | 31-02 | Require-graph guard + REAL-import interop test + dependency-checks resolution | ✓ SATISFIED | Truth 4; REQUIREMENTS.md traceability table marks `VER-04 \| Phase 31 \| Complete` (note: the requirement's own description-line checkbox at line 36 is still `- [ ]`, same as VER-01's — a pre-existing cosmetic doc-formatting gap in REQUIREMENTS.md, not a code/verification gap; the authoritative traceability table already reads Complete). |
| VER-01 (rider) | 31-01 | SARIF-shape unit specs ride along per REQUIREMENTS' VER-01 note | ✓ SATISFIED | `sarif-report.spec.ts`'s 8 specs cover shape/golden/off-by-one/no-ANSI/file-less/exit-parity; `cli/main.spec.ts`'s FMT-02/D-07 block now has a sarif exit-parity arm. Full VER-01 closure (JSON side) is Phase 30's; the SARIF-shape slice this phase owns is fully verified. |

No orphaned requirements — REQUIREMENTS.md's Phase 31 row set (`REP-02`, `VER-04`) matches exactly what both plans declare in `requirements:` frontmatter (31-01 also lists `VER-01` for the rider, consistent with the REQUIREMENTS.md note).

### Anti-Patterns Found

None. No debt markers, no stub returns, no empty handlers, no hardcoded-empty payloads in any phase-touched file.

### Human Verification Required

None. Every must-have in this phase is mechanically checkable (grep, unit test, integration test, build gate) and was directly re-run rather than trusted from SUMMARY.md. GitHub `upload-sarif` round-trip validation and full SARIF 2.1.0 schema (ajv) validation are explicitly deferred to Phase 32 (VER-02/VER-03) per the CONTEXT.md/RESEARCH.md scope split — not a Phase 31 must-have.

### Gaps Summary

None. All 9 derived truths verified against the real codebase and the real toolchain (tests actually executed by this verifier, not read from SUMMARY claims): 522 unit tests + 120 integration tests pass, typecheck/lint/format all green, the lazy-import firewall is proven both statically (require-graph guard) and by a real (unmocked) interop test, the D-13 anti-drift contract holds (no re-implementation of position/path/code logic), the two code-review findings (MJ-01 fingerprint collision, MN-01 missing-uniqueness guard) are fixed in the shipped code, and the additive-only charter holds (barrel/drift-tripwire/builder.ts untouched, version unchanged, only one new dependency declared). The phase goal — `--format sarif` producing valid, GitHub-ready SARIF 2.1.0 via a lazy-loaded `node-sarif-builder` over the shared diagnostic-record projection — is achieved.

---

*Verified: 2026-07-18T23:35:00Z*
*Verifier: Claude (gsd-verifier)*
