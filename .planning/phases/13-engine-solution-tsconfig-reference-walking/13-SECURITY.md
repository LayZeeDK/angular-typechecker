---
phase: 13-engine-solution-tsconfig-reference-walking
audited: 2026-07-01T20:10:00Z
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
threats_total: 6
threats_closed: 6
threats_open: 0
verdict: SECURED
---

# Phase 13: Engine Solution-tsconfig Reference Walking Security Audit

**Phase Goal (security framing):** A single `runTypecheck` on a solution /
references-only `tsconfig.json` walks the in-project referenced leaves, unions +
dedupes their diagnostics, guards the module boundary, and supersedes the D-03a
short-circuit. The security stakes are (1) an out-of-project reference must never
leak an outsider's diagnostics into the reported set (information disclosure), and
(2) no broken / mis-pointed / references-only config may produce a silent
zero-diagnostic PASS (tampering / a "type-checker that lies").

**Audit method:** State B (no prior SECURITY.md), `register_authored_at_plan_time:
true`. Each threat in the consolidated STRIDE register was VERIFIED by its declared
disposition against the shipped implementation, tests, and config -- NOT accepted on
documentation or intent. Implementation files were treated as READ-ONLY. No new
threat scan was performed (the register is complete).

## Threat Register

| Threat ID | Category                            | Disposition | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------- | ----------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-13-01   | Information Disclosure              | mitigate    | CLOSED | `walk-references.ts:144-151` -- `if (!isUnderDir(canonicalLeaf ?? leafPath, canonicalSolutionDir)) { push reason:'out-of-project'; continue; }` -- the outsider is SKIPPED before any `performCompilation`, so its sources never enter the union. `isUnderDir` + `createCanonicalizer` imported (`:10`) from `filter-diagnostics.ts` (`:128`, `:184`) -- the SAME single implementation the boundary filter ships (no duplicate). Unit proof `walk-references.spec.ts:191-219` asserts `performedPaths === []` (outsider NEVER compiled) + `skippedReferences === [{referencePath, reason:'out-of-project'}]`. Integration proof `walk-references.integration.spec.ts:134-165` on the committed `fixtures/solution-style-oop` asserts the outsider's TS2322 is ABSENT from reported `codes` (the leak tripwire), 90001 fires, and `skippedReferences` carries reason `out-of-project`. Adapter advisory render `executor.ts:73-85`.                                                                                                                                                                                                 |
| T-13-02   | Tampering (false PASS)              | mitigate    | CLOSED | `walk-references.ts:78` `REFERENCE_NOT_FOUND_DIAGNOSTIC_CODE = 90002`; `:163-172` detects the not-found leaf by CODE ONLY (`diagnostic.code === ng.UNKNOWN_ERROR_CODE`), pushes a synthesized COUNTED 90002 Error, records reason `not-found`, and CONTINUES walking survivors; `synthesizeReferenceNotFoundDiagnostic` (`:228-241`) is a file-less `DiagnosticCategory.Error` (never boundary-filtered, always counted). Walk branch in `run-typecheck.ts:218-254` RESOLVES (returns a `CoreResult`; does NOT rethrow). The COR-01 DIRECT nonexistent-path 500 rethrow stays byte-unchanged (`run-typecheck.ts:180-191`; pinning test `config-resolution.integration.spec.ts:123` `rejects.toBeInstanceOf(TypecheckInfrastructureError)`). Integration proof `walk-references.integration.spec.ts:213-260` on `fixtures/solution-style-broken-ref` (real `./tsconfig.app.json` + genuinely-ABSENT `./tsconfig.missing.json`, confirmed absent on disk) asserts exactly ONE 90002 + survivor TS2322 + `resolves` (not `rejects`). Unit proofs `walk-references.spec.ts:221-306` (fold-and-count survivor + by-code-only detection). |
| T-13-02b  | Tampering (false PASS)              | mitigate    | CLOSED | `walk-references.ts:176-183` -- `if (parsed.rootNames.length === 0) { push reason:'zero-root-names'; continue; }` -- a resolved leaf with no input files is recorded skip-with-notice and contributes 0 to `rootNamesCount`; it can NEVER become a silent zero-diagnostic PASS. Unit proof `walk-references.spec.ts:342-366` asserts `performedPaths === []`, `rootNamesCount === 0`, and `skippedReferences === [{referencePath, reason:'zero-root-names'}]`; also covered in the `it.each` reason table `:426-473`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T-13-02c  | Tampering (false PASS)              | mitigate    | CLOSED | `run-typecheck.ts:210-285` three-way D-03a split: (1) refs + >=1 in-project leaf -> WALK; (2) refs + 0 in-project leaves (all skipped) -> `synthesizeZeroRootNamesDiagnostic` synthesizes a COUNTED references-present 90001 (`:257-269`, message branch `:419-424`) and attaches the recorded `skippedReferences` -- never an empty zero-diagnostic PASS; (3) no refs -> empty-project 90001 (`:272-285`). Integration proof `walk-references.integration.spec.ts:134-165` (oop) asserts `rootNamesCount === 0`, `errorCount === 1`, `codes` contains 90001; three-way routing table `:168-211` proves all three branches.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-13-03   | Tampering (stale PASS on spec edit) | mitigate    | CLOSED | `nx.json` -- BOTH executor keys (`angular-typechecker:angular-typecheck` `:41-56` and `@angular-typechecker/angular-typechecker:angular-typecheck` `:57-72`) use the `default` named input, NOT `production` (which excludes `*.spec.ts` + `tsconfig.spec.json`), so a spec-only source edit hashes into the coarse single-target cache key. `outputs: []`, the `{projectRoot}/tsconfig*.json` glob, and `^default` are retained on both keys. Manifest assertion `nx-target-defaults.spec.ts:73-102` (it.each over both keys) asserts `toContain('default')` + `not.toContain('production')` + tsconfig glob + `^default` + `outputs === []`. Cache-bust e2e `e2e/.../cache-busts-on-spec-edit.int.spec.ts` proves end-to-end through the real Nx CLI: R1 pre-flight (spec IS an input), then green-run -> cache-HIT -> spec-only edit -> 3-signal cache-MISS (marker absent + `TS2322` present + non-zero exit), plus an anti-lying `--skip-nx-cache` differential.                                                                                                                                                               |
| T-13-SC   | Tampering (supply chain)            | accept      | CLOSED | No package installs this phase -- it reuses the already-shipped `typescript` + `@angular/compiler-cli` peers; all machinery is source / test / config / docs. Recorded in the Accepted Risks log below. Corroborated by `13-05-SUMMARY.md:129-132` ("accepted -- no package installs (test-only additions). No new security-relevant surface introduced").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

**Closed:** 6/6 | **Open:** 0/6

## Accepted Risks Log

| Threat ID | Category                                             | Risk                                                                                                                     | Rationale for Acceptance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-13-SC   | Tampering (supply chain: npm / pip / cargo installs) | A dependency added or upgraded during a phase could introduce a compromised or typo-squatted package into the toolchain. | ACCEPTED for Phase 13. This phase performs NO package installs: the reference-walk engine, three-way split, boundary guard, fold-and-count, fixtures, tests, `nx.json` input swap, and README recipe are all pure source / test / config / docs changes. They reuse the peers already shipped by earlier phases (`typescript >=6.0.0 <6.1.0`, `@angular/compiler-cli ^22.0.0`), governed by the `@nx/dependency-checks` ESLint rule at publish time. The residual supply-chain exposure introduced by THIS phase is nil; the standing peer-range exposure is out of Phase 13 scope and is not re-litigated here. |

## Unregistered Flags

None. The six 13-\*-SUMMARY.md files contain no `## Threat Flags` section. The only
threat-related section is `13-05-SUMMARY.md:118` `## Threat Coverage`, which maps
its additions to EXISTING register IDs (T-13-01, T-13-02, T-13-SC) and explicitly
states "No new security-relevant surface introduced (test-only additions)." No new
attack surface appeared during implementation with an unmapped threat.

## Audit Trail

1. Loaded the auditor role, the consolidated STRIDE register (6 threats), and the
   `<config>` (asvs_level 1, block_on high, register authored at plan time).
2. Verified `mitigate` threats by locating the actual mitigation code in the cited
   files -- not by structure or comment:
   - T-13-01: boundary-guard skip + `isUnderDir` reuse in `walk-references.ts`;
     confirmed `createCanonicalizer`/`isUnderDir` are the single shipped
     implementation in `filter-diagnostics.ts` (no duplicate); confirmed the unit
     spec proves `performCompilation` is NOT invoked for the outsider and the
     integration spec's leak tripwire (`codes not.toContain(TS2322)`).
   - T-13-02: 90002 synth by-code-only + walk RESOLVES + COR-01 direct rethrow
     byte-unchanged (pinning assertion located at
     `config-resolution.integration.spec.ts:123`); confirmed the
     `fixtures/solution-style-broken-ref` target `tsconfig.missing.json` is
     genuinely ABSENT on disk (verified via filesystem check).
   - T-13-02b: zero-root-names skip located and unit-proven.
   - T-13-02c: three-way split located; the references-present-none-in-project 90001
     synth + integration routing table verified.
   - T-13-03: read `nx.json` and confirmed BOTH executor keys use `default` (not
     `production`), retain `outputs:[]` / tsconfig glob / `^default`; located the
     manifest assertion and the cache-bust e2e (3-signal defense-in-depth).
3. Verified the `accept` threat (T-13-SC) by authoring its Accepted Risks log entry
   here and cross-checking against `13-05-SUMMARY.md`.
4. Scanned all six SUMMARY files for a `## Threat Flags` section / unregistered
   attack surface -- none found; the sole `## Threat Coverage` section maps only to
   existing IDs.
5. Cross-checked `13-VERIFICATION.md` (26/26, passed): the four authoritative
   signals (214 unit+integration tests, 9 cache-e2e tests, clean lint, clean build)
   are green -- consistent with the mitigations being present and exercised.
6. No implementation file was modified; only this SECURITY.md was written.

## Verdict

**SECURED.** All 6 threats resolve: 5 `mitigate` threats CLOSED with located code +
test evidence, 1 `accept` threat (T-13-SC) CLOSED via the Accepted Risks log. No
open threats at or above the `high` block threshold, and no unregistered flags. The
phase's declared threat mitigations are present in the shipped code.

---

_Audited: 2026-07-01T20:10:00Z_
_Auditor: Claude (gsd-security-auditor)_
