---
phase: 33-diagnostic-family-sarif-rule-metadata
verified: 2026-07-21T08:53:58Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 33: Diagnostic-family SARIF rule metadata Verification Report

**Phase Goal:** Every GitHub Code Scanning alert from angular-typechecker shows a rich,
filterable rule -- a diagnostic-family tag, the correct default severity, and inline help
text -- across ALL diagnostic families (TypeScript `TSxxxx`, template type-check, extended
`NG8xxx`, tool `ATC900x`), shipped as an additive patch bump. This is the SOLE
release-bearing change in the milestone.

**Verified:** 2026-07-21T08:53:58Z
**Status:** passed
**Re-verification:** No -- initial verification

## Method note

This is goal-backward verification against the actual codebase, not a re-reading of
SUMMARY.md. Every claim below was independently re-derived: source files were read in full,
`git diff` was run directly against the `angular-typechecker@0.2.3` tag (not copied from
`33-ADDITIVE-AUDIT.md`), and the unit + integration test tiers were re-executed FRESH via
direct `vitest run` invocations (bypassing the Nx cache) rather than trusted from cached Nx
output or SUMMARY.md narration. `npx nx release --dry-run` was also re-run live to confirm
the version-bump claim independently.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A SARIF report from a run firing a TypeScript, an external-template, an NG8xxx, and a tool (ATC) diagnostic catalogs one rule per distinct fired `ruleId`; a clean run yields an empty rules array (RULE-01) | VERIFIED | `sarif-report.ts` PASS-1 `Map<string, RuleMeta>` fold (lines 143-168) builds one entry per distinct `record.code`; PASS-2 emits one result per diagnostic unchanged. Unit test `'renders a clean CoreResult as an EMPTY results array AND an empty on-demand rule catalog...'` re-run fresh: PASS. `'catalogs one rule per DISTINCT fired ruleId...'` (TS2322 + ATC90001 in one `CoreResult`) re-run fresh: PASS, snapshot shows `rules[]` = `[TS2322, ATC90001]` each with a correct `ruleIndex` (0, 1). Integration: `layout-b-host` real fixture catalogs exactly `[NG8002, TS2322]`; `global-diagnostics` catalogs exactly `[TS2318]` for 10 results; `extended-content-projection` catalogs `[NG8011]`; `solution-style-all-missing` catalogs `[ATC90002]` -- all 4 `Family` literals proven, all re-run fresh (21/21 integration tests pass). See "Methodology note" below on fixture composition. |
| 2 | Each rule carries `properties.tags` with exactly one of the four fixed family literals (RULE-02) | VERIFIED | `diagnostic-family.ts` `familyOf()` implements the exact D-02 order (rawCode<0 -> catalog-membership check; rawCode>=90000 -> tool; `.html` file -> template-type-check; else typescript), matching `CONTEXT.md` D-02 verbatim. `sarif-report.ts:180` sets `ruleBuilder.rule.properties = { tags: [meta.family] }` (single-element array, no cast). Unit spec `diagnostic-family.spec.ts` (9/9 re-run fresh) proves all four literals + the `.html`-before-order proof + the D-03 accepted-imprecision case. The D-04 any-`.html`-wins reducer proven in BOTH orders (re-run fresh, both pass). Integration proves the tag for real `NG8002`(template-type-check)/`TS2322`(typescript)/`NG8011`(extended-diagnostics)/`ATC90002`(tool) diagnostics. |
| 3 | Each rule carries `defaultConfiguration.level` matching the observed diagnostic severity (RULE-03) | VERIFIED | `buildRuleMeta()` computes `level = toSarifLevel(record.severity)` (the pre-existing, REUSED mapping, not a second one) for every family branch. Unit test `'keeps the FIRST observed severity level for a ruleId seen at mixed severities...'` (D-06 tie-break) re-run fresh: PASS -- rule level stays `warning` even though a later occurrence of the same `ruleId` is `error`. Integration snapshots show `defaultConfiguration.level: "error"` for `TS2322`/`NG8002`/`TS2318`, and the live `extended-content-projection` assertion confirms `warning` for the real `NG8011` fixture. |
| 4 | Each rule carries SARIF `help.text` (not only `helpUri`) (RULE-04) | VERIFIED | `ruleBuilder.rule.help = { text: meta.helpText }` set unconditionally for every catalog entry (no cast). Per-family text: NG seeded from the existing `EXTENDED_DIAGNOSTIC_CATALOG[].shortDescription` (D-10 unchanged); `tool` curated per ATC code; `typescript`/`template-type-check` generic per-family strings. Snapshot for `TS2322` shows non-empty `help.text`; every integration describe block asserts `(rule.help?.text ?? '').length > 0` and this was re-run fresh across all four fixtures -- all pass. |
| 5 | JSON and human reporter outputs, `DiagnosticRecord`, and the public barrel are byte-unchanged; the additive-only audit vs `angular-typechecker@0.2.3` passes -- patch bump `0.2.3 -> 0.2.4`, `v0.3.0` escape hatch untriggered | VERIFIED | Independently re-ran (not copied from `33-ADDITIVE-AUDIT.md`): `git diff --stat angular-typechecker@0.2.3..HEAD -- packages/angular-typechecker/` (and the whole-repo equivalent scoped to Phase 33's own commit range `ce42e99~1..HEAD`) both list EXACTLY the 7 claimed files. `git diff` against the tag for `json-report.ts`, `format-report.ts`, `diagnostic-record.ts`, `extended-catalog.ts`, `src/index.ts`, `src/index.drift.ts`, `json-report.spec.ts` + its snapshot, and `format-report.spec.ts` + its snapshot are ALL empty. `git grep` confirms `familyOf`/`Family`/`diagnostic-family` appear nowhere in `src/index.ts` or `src/index.drift.ts`. `package.json` diff vs the tag is empty (dependency set unchanged: `@nx/devkit`, `node-sarif-builder`, `nx`, `tslib`). `git log angular-typechecker@0.2.3..HEAD` has no `!`-before-colon subject and no `BREAKING CHANGE:` footer. `npx nx release --dry-run` (live re-run) resolved current version `0.2.3` from the tag and proposed new version `0.2.4` (patch); `package.json` version confirmed still `0.2.3` on disk afterward (dry-run made no persistent change). |

**Score:** 5/5 truths verified (0 present-but-behavior-unverified)

### Decision Coverage (PLAN frontmatter must_haves, D-01..D-12, both plans)

Every `must_haves.truths` entry in `33-01-PLAN.md` and `33-02-PLAN.md` frontmatter, checked
individually against source:

| ID | Truth (paraphrased) | Status | Evidence |
|----|---------------------|--------|----------|
| D-01 | `familyOf` lives in new pure `src/core/diagnostic-family.ts`, reads ONLY `rawCode`+`file`, adds no field to `DiagnosticRecord`, boundary-clean | VERIFIED | Module imports only `ngCodeOf`, `EXTENDED_DIAGNOSTIC_CATALOG`, and the `DiagnosticRecord` type (type-only). No `console`/`process`/`@angular/compiler-cli`. `diagnostic-record.ts` diff vs tag is empty (no field added). |
| D-02 | rawCode sign/range checked BEFORE the `.html` heuristic | VERIFIED | Code order: `rawCode<0` check first, then `>=90000`, then `.html`, then default. Order-proof test (`.html`-attributed catalog NG code stays `extended-diagnostics`) re-run fresh: PASS. |
| D-03 | Inline-template TS error on a component `.ts` resolves to `typescript` (accepted imprecision, RULE-FUT-01 deferred) | VERIFIED | Test `'classifies an inline-template TypeScript error in a component .ts as typescript...'` re-run fresh: PASS. Comment in source explicitly documents the deferral. |
| D-04 | Same `ruleId` seen in both `.html` and `.ts` resolves to `template-type-check`, any order | VERIFIED | Reducer code (`sarif-report.ts:157-167`) only upgrades toward `template-type-check`, never away from it. Both-order test re-run fresh: PASS (both orders assert `template-type-check`). |
| D-05 | Catalog exactly one rule per DISTINCT fired `ruleId`; empty on clean run | VERIFIED | PASS-1 `Map` fold; clean-run test re-run fresh: PASS (`rules` length 0). |
| D-06 | `level` = `toSarifLevel(severity)`; first-observed wins on mixed severities | VERIFIED | `buildRuleMeta` computes level once per first sighting; never overwritten on repeat sighting (code comment + test, re-run fresh: PASS). |
| D-07 | `help.text` present per family, sourced per the documented rule table | VERIFIED | Four `buildRuleMeta` branches each set `helpText`; NG seeds from catalog `shortDescription`, tool is curated, TS/template-type-check are per-family generic strings. |
| D-08 | `shortDescription.text` describes the RULE, never a single occurrence | VERIFIED | All four branches build `shortDescription` from the code/family, never from `record.message`. |
| D-09 | Fields set by mutating `SarifRuleBuilder.rule` directly, no cast, no new dependency | VERIFIED | Three assignments (`properties`/`defaultConfiguration`/`help`) contain no `as` cast; `npx nx typecheck angular-typechecker` (re-run fresh, skip-cache) exits 0, which would fail if a cast were needed and absent. `npx nx lint angular-typechecker` (re-run fresh, skip-cache, `@nx/dependency-checks` active) exits 0; `package.json` diff vs tag is empty. |
| D-10 | `extended-catalog.ts` byte-unchanged; family code-derived, level result-derived, NG help seeded from `shortDescription` | VERIFIED | `git diff` vs tag empty. `sarif-report.ts` reads `entry.shortDescription` for both the NG `shortDescription` and `helpText`. |
| D-11 | Module header + inline comment describe on-demand cataloging and that `completeRunFields` sets `ruleIndex` | VERIFIED | `sarif-report.ts` header (lines 34-46) states rules are "cataloged ON-DEMAND" and that `completeRunFields()` "sets `result.ruleIndex` for every result whose `ruleId` matches a cataloged rule -- which, with on-demand cataloging, is every result." No stale "no ruleIndex" claim remains. |
| D-12 (code slice) | `json-report.ts`, `format-report.ts`, `diagnostic-record.ts` byte-unchanged; `FORMAT_VERSION` stays 1; barrel + drift tripwire byte-unchanged | VERIFIED | All confirmed empty-diff independently (see Truth 5 evidence); `json-report.ts:31` `FORMAT_VERSION = 1` unchanged (file untouched). |
| D-12 (additive audit) | Whole-package diff vs `@0.2.3` lists ONLY the 7 SARIF-path files | VERIFIED | Independently re-run `git diff --stat`, confirmed exactly 7 files, both scoped to the package and to Phase 33's own commit range across the WHOLE repo. |
| D-12 (release shape) | Unified `nx release --dry-run` proposes patch `0.2.3 -> 0.2.4`; no breaking-change marker in the commit log | VERIFIED | Independently re-run live; proposed `0.2.4`; commit-log grep for `!:` subjects and `BREAKING CHANGE:` footers found none. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/angular-typechecker/src/core/diagnostic-family.ts` | New pure classifier module, `familyOf` + `Family` | VERIFIED | Exists, 67 lines, exports both; imports only `ngCodeOf`, `EXTENDED_DIAGNOSTIC_CATALOG`, type-only `DiagnosticRecord`. |
| `packages/angular-typechecker/src/core/diagnostic-family.spec.ts` | Direct-call boundary matrix | VERIFIED | 9 tests, one per classifier branch + order proof + desync guard + D-03 case. Re-run fresh: 9/9 pass. |
| `packages/angular-typechecker/src/core/sarif-report.ts` | Rewritten on-demand catalog + tags/level/help + corrected header | VERIFIED | PASS-1 fold, `buildRuleMeta`, `.rule` mutation escape hatch, corrected header, all present and match the plan's design exactly. |
| `packages/angular-typechecker/src/core/sarif-report.spec.ts` | Re-aimed catalog-length assertions + new tag/level/help/D-04/D-06 assertions | VERIFIED | 15 tests (up from the pre-phase count); re-run fresh: 15/15 pass. |
| `packages/angular-typechecker/src/core/__snapshots__/sarif-report.spec.ts.snap` | Regenerated: 2-entry rules array with tags/level/help/ruleIndex | VERIFIED | Snapshot shows `[TS2322, ATC90001]`, each with `properties.tags`, `defaultConfiguration`, `help`; both results carry correct `ruleIndex` (0, 1). |
| `packages/angular-typechecker/src/core/machine-reporters-sarif.integration.spec.ts` | Extended with 4-family real-fixture assertions | VERIFIED | 21 tests (up from 9 pre-phase: 4 describe blocks, 2 new). Re-run fresh: 21/21 pass. |
| `packages/angular-typechecker/src/core/__snapshots__/machine-reporters-sarif.integration.spec.ts.snap` | Regenerated: fired-ruleId-only rules with tags/level/help/ruleIndex | VERIFIED | `layout-b-host` -> `[NG8002, TS2322]`; `global-diagnostics` -> `[TS2318]` x10 results at `ruleIndex` 0. Both snapshots eyeballed; forward-slash `artifactLocation.uri`, no drive letters. |
| `.planning/phases/33-diagnostic-family-sarif-rule-metadata/33-ADDITIVE-AUDIT.md` | Audit record vs `@0.2.3` | VERIFIED | Exists; every claim in it independently re-derived and confirmed accurate (not merely trusted). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `sarif-report.ts` | `diagnostic-family.ts` | `import { familyOf, type Family } from './diagnostic-family'` (line 7) | WIRED | Confirmed by direct read; `git grep` confirms `diagnostic-family` is imported ONLY by `sarif-report.ts` (production) and its own spec -- never re-exported from `src/index.ts` or `src/index.drift.ts`. |
| PASS-1 fold | PASS-2 result-emit loop | Both loops iterate `result.diagnostics` independently via the SAME `toDiagnosticRecord` projection; PASS-2 unchanged in shape (one result per diagnostic, file-less never dropped) | WIRED | Read directly in `sarif-report.ts` lines 145-168 (PASS-1) and 190-213 (PASS-2); `'never drops a file-less diagnostic...'` test re-run fresh: PASS. |
| `node-sarif-builder` `completeRunFields()` | `result.ruleIndex` on every result | Invoked inside `buildSarifJsonString` (library-internal); observed in both snapshots | WIRED | Every result in both regenerated snapshots carries a `ruleIndex` that correctly indexes into the corresponding `rules[]` entry (0/1 in the unit snapshot; 0/1 in `layout-b-host`; 0 x10 in `global-diagnostics`). `expectEveryResultResolvesToItsRule` helper in the integration spec asserts this generically and passed on re-run. |
| `EXTENDED_DIAGNOSTIC_CATALOG` | NG rule `shortDescription`/`help.text`/`helpUri` | `EXTENDED_BY_RULE_ID` map built from the catalog, keyed by `'NG' + ngCode` | WIRED | Read directly; `extended-catalog.ts` byte-unchanged (D-10), single source of truth preserved. |
| `ZERO_ROOT_NAMES_DIAGNOSTIC_CODE` / `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE` | `TOOL_RULE_TEXT` curated table | Object keyed by `'ATC' + <code constant>`, imported from `diagnostic-codes.ts` | WIRED | Confirmed both constants (90001/90002) imported and used as map keys, not re-derived as bare literals. |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (no component/page renders this data); the
equivalent trace here is "does the emitted SARIF rule metadata reflect the ACTUAL fired
diagnostic, not a static/hardcoded stub". Traced and confirmed FLOWING: `familyOf(record)` is
called with the real `DiagnosticRecord` produced by `toDiagnosticRecord(diagnostic, ts_,
pathBase)` for every diagnostic in `result.diagnostics` (not a fixed list); `buildRuleMeta`
derives `level` from the same record's `severity`; the integration tier proves this against
REAL cold-compiler output (`extended-content-projection` and `solution-style-all-missing` are
real fixtures compiled by the actual Angular/TypeScript compilers, not synthesized). No
hardcoded empty/static rule list remains -- confirmed by the removal of the old
"unconditionally loop all 18 NG catalog entries" code (verified via the `git diff` read of
`sarif-report.ts`, which shows the old unconditional unshift replaced by the PASS-1 fold).

### Behavioral Spot-Checks (fresh, cache-bypassed re-execution)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tier: `diagnostic-family.spec.ts` + `sarif-report.spec.ts` (+ `sarif-report.interop.spec.ts`) | `npx vitest run --config vitest.config.mts sarif-report diagnostic-family` (run from `packages/angular-typechecker`, bypassing Nx cache) | 3 files / 25 tests passed | PASS |
| Integration tier: `machine-reporters-sarif.integration.spec.ts` (all 4 family describe blocks) | `npx vitest run --config vitest.integration.config.mts machine-reporters-sarif` | 1 file / 21 tests passed | PASS |
| Lint incl. `@nx/dependency-checks` | `npx nx lint angular-typechecker --skip-nx-cache` | "All files pass linting" | PASS |
| Typecheck (3 tsc projects incl. drift + tools) | `npx nx typecheck angular-typechecker --skip-nx-cache` | exit 0 | PASS |
| Standalone spec type-check | `npx tsc --noEmit -p packages/angular-typechecker/tsconfig.spec.json` | exit 0 | PASS |
| Build | `npx nx build angular-typechecker --skip-nx-cache` | exit 0 | PASS |
| Format check | `npx nx format:check` | no output (clean) | PASS |
| Release dry run | `npx nx release --dry-run` | Resolved 0.2.3 from tag; proposed patch 0.2.4; wrote nothing (dry-run) | PASS |
| Package version unmutated after dry run | `node -e "console.log(require('./packages/angular-typechecker/package.json').version)"` | `0.2.3` | PASS |

### Probe Execution

Not applicable -- this phase has no `scripts/*/tests/probe-*.sh` fixtures and none are
declared in the PLAN/SUMMARY. Skipped: no runnable probe entry points for this phase (the
"proof" mechanism for this milestone is `PROOF-01`/`PROOF-02`, explicitly deferred to Phase
35).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| RULE-01 | 33-01, 33-02 | Every emitted diagnostic references a cataloged SARIF rule across ALL families | SATISFIED | On-demand catalog fold + 4-family real-fixture integration proof (Truths 1). `REQUIREMENTS.md` marks `Complete`. |
| RULE-02 | 33-01, 33-02 | Each rule carries a diagnostic-family tag in `properties.tags` | SATISFIED | `familyOf` classifier + `.rule.properties` mutation + D-04 reducer (Truth 2). `REQUIREMENTS.md` marks `Complete`. |
| RULE-03 | 33-01, 33-02 | Each rule carries `defaultConfiguration.level` consistent with severity | SATISFIED | Reused `toSarifLevel` + D-06 tie-break (Truth 3). `REQUIREMENTS.md` marks `Complete`. |
| RULE-04 | 33-01, 33-02 | Each rule carries SARIF `help` text | SATISFIED | Per-family `help.text`, non-empty across all fixtures (Truth 4). `REQUIREMENTS.md` marks `Complete`. |

No orphaned requirements: `REQUIREMENTS.md`'s traceability table maps ONLY RULE-01..04 to
Phase 33; all other v1 requirements (MULTI-01/02, PROOF-01/02, GATE-01/02, DOC-01) are
explicitly mapped to Phases 34-36, matching both plans' `requirements:` frontmatter
(`[RULE-01, RULE-02, RULE-03, RULE-04]`) exactly.

### Anti-Patterns Found

None. Scanned all 5 phase-modified/created production and spec files for `TBD`/`FIXME`/`XXX`/
`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/"coming soon"/"not available" (case
insensitive) and for empty-implementation patterns (`return null`/`return {}`/`return []`/
`=> {}`). One incidental match surfaced and was confirmed a false positive: the case
insensitive `XXX` pattern matched the substring inside the word `NG8xxx` in a comment
(`sarif-report.ts:73`, "The NG8xxx catalog entries...") -- this is the established codebase
convention for the extended-diagnostics code family name, not a debt marker.

### Human Verification Required

None. Every must-have truth in this phase is either a static data/structure assertion
(directly verifiable by reading source + running tests) or an ordering/tie-break invariant
for which a targeted, pre-existing test was re-run FRESH (bypassing the Nx cache) and
confirmed passing during this verification -- satisfying the bar for a behavior-dependent
truth to count as VERIFIED rather than present-but-unproven. The one live-system behavior
this phase's SARIF shape is designed to drive -- GitHub Code Scanning rendering the rule-help
panel and `tag:`/`severity:` filters -- was already empirically proven live in the closed
spike PR #53 (per `33-CONTEXT.md`'s canonical references) and is the explicit subject of the
Phase 35 automated proof (`PROOF-01`/`PROOF-02` in `REQUIREMENTS.md`), which is out of scope
for Phase 33 by design. No new human-verification need was introduced by this phase.

### Observations (non-blocking, transparency notes)

1. **Integration-tier fixture composition deviates from an idea floated in `33-CONTEXT.md`'s
   "Specific Ideas" section** ("Family derivation must be provable across all four families in
   ONE integration test fixture"). Both plans explicitly and transparently chose to reuse four
   SEPARATE existing real fixtures (one per family) instead of building a bespoke composite
   fixture, citing the phase research's confidence assessment (composite = MEDIUM confidence,
   reuse = HIGH confidence, leaner). This was NOT a locked `D-01..D-12` decision (only an
   unlocked idea), was disclosed in both the PLAN `<action>` block and the SUMMARY's
   key-decisions, and does not weaken the proof: the on-demand multi-ruleId-per-run fold
   mechanism (the part that would differ if 4 families fired in ONE run vs 4 separate runs) is
   already exercised with 2+ distinct families combined in a SINGLE `CoreResult` at the unit
   tier (e.g. TS2322 + ATC90001 in one report; two distinct NG codes in one report), and each
   family's tag/level/help correctness against REAL compiler output is proven per-family at the
   integration tier. The classifier's own control flow (checked directly in
   `diagnostic-family.ts`) guarantees no cross-family interaction is possible except the
   already-tested `.ts`/`.html` same-ruleId case (D-04). Conclusion: not a gap.
2. **`/gsd-secure-phase` and `/gsd-validate-phase` have not yet been run for this phase** --
   `33-VALIDATION.md` is still in its plan-time-seeded `status: draft` /
   `nyquist_compliant: false` / `wave_0_complete: false` state with "Approval: pending", and no
   `33-SECURITY.md` exists yet. This is expected and consistent with this project's own
   documented workflow order (execute -> verify_phase_goal -> secure -> validate ->
   extract-learnings) -- verify_phase_goal runs BEFORE secure/validate by design. Not a
   phase-goal gap; flagged here only so the orchestrator's next steps are visible.

### Gaps Summary

No gaps. All 5 roadmap success criteria and all 12 plan-level decisions (D-01..D-12, both
plans) are independently verified against the actual source, snapshots, and git history --
not merely against SUMMARY.md narration. Every claim in `33-ADDITIVE-AUDIT.md` was
independently reproduced (fresh `git diff`, fresh `nx release --dry-run`) rather than trusted.
The phase goal is achieved: the SARIF reporter now catalogs one rule per distinct fired
`ruleId` across all four diagnostic families, each carrying a family tag, a correct default
severity level, and non-empty help text, with zero collateral change to the JSON/human
reporters, `DiagnosticRecord`, the extended catalog, or the public barrel, and the release
shape is confirmed as an additive patch bump.

---

_Verified: 2026-07-21T08:53:58Z_
_Verifier: Claude (gsd-verifier)_
