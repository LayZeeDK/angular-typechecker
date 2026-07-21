# Phase 35 -- Deferred / Out-of-Scope Items

Out-of-scope discoveries during plan 35-01 execution. NOT fixed here (SCOPE BOUNDARY +
D-04: this plan touches no `packages/angular-typechecker/**` production code).

## 1. Pre-existing fallow health findings on `sarif-report.ts` (Phase 33 code)

- **Discovered during:** Task 2 (`npx fallow audit --format human --base origin/main`).
- **What:** `fallow audit` exits 1 on this milestone branch because of two health-tier
  findings on `packages/angular-typechecker/src/core/sarif-report.ts`:
  - `formatSarifReport` -- large function (111 lines, exceeds the 60-line unit-size threshold).
  - `buildRuleMeta` -- high complexity (11 cyclomatic / CRAP 37.1).
- **Why it is out of scope:** `sarif-report.ts` was last modified by `029b45d`
  (Phase 33, "fix(core): rebuild SARIF rule metadata..."), NOT by any Phase 35 commit.
  Under fallow's `new-only` gate these are attributed as "new" only because Phase 31/33
  are ahead of `origin/main` on the milestone branch. D-04 forbids touching production
  `packages/angular-typechecker/**` code in this plan, and the finding is unrelated to
  the SARIF proof fixture.
- **Confirmed NOT the fixture:** no fallow FINDING (stdout) names `tools/sarif-proof-fixture/*`;
  the fixture is fully scoped by the new `.fallowrc.jsonc` overrides entry (Task 2). The
  only fixture mention anywhere is a benign stderr `WARN tsconfig chain not fully loaded`
  about the by-design-missing `tsconfig.missing.json` (which synthesizes ATC90002).
- **Owner / next step:** milestone-level fallow hygiene (Phase 33/36 or the milestone PR).
  Either refactor `formatSarifReport`/`buildRuleMeta` under thresholds, or add a reviewed
  `health.ignore` entry for `sarif-report.ts` (mirroring the existing `run-typecheck.ts` /
  `walk-references.ts` essential-complexity entries). Left untouched here by charter.
