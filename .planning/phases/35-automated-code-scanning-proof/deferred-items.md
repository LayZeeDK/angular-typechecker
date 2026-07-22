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

## 2. Pre-existing cve-lite HIGH: `fast-uri` (GHSA-v2hh-gcrm-f6hx) transitive advisory

- **Discovered during:** plan 35-04 gate battery (`npm run cve-lite`, `--fail-on high`).
- **What:** cve-lite exits 1 on a HIGH transitive advisory -- `fast-uri@3.1.3`
  (GHSA-v2hh-gcrm-f6hx, fixed in 3.1.4), reached via `project -> ajv@6.15.0 -> fast-uri`
  and "4 other known paths". A MEDIUM `@hono/node-server@1.19.14` (GHSA-frvp-7c67-39w9,
  fixed 2.0.5) is also present but below the `high` gate and has no auto-fix (major bump).
- **Why it is out of scope for 35-04:** plan 35-04 is SARIF-source-only and ADDITIVE by
  charter (must_haves: "no dependency added or upgraded", `package.json` version unchanged,
  only the 6 `files_modified`). The additive-only spot check confirms this plan touched NO
  `package.json` / `package-lock.json` -- so the advisory is 100% pre-existing on the
  dependency tree (a newly published OSV advisory surfacing against the unchanged lockfile,
  independent of the SARIF change). cve-lite queries live OSV, so a fresh advisory turns the
  gate red with zero code change. This is the same class of dep-hygiene finding the repo
  clears via DEDICATED quick tasks (svgo HIGH -> quick 260721-wda; fallow complexity ->
  quick 260721-vm1), NOT by folding a `fix(deps)` into a feature/gap plan.
- **Why NOT auto-fixed here:** the cve-lite suggestion is `ajv 6.15.0 -> 8.17.1` -- a
  TWO-major-line bump on a transitive path, plus "4 other paths may still need separate
  parent upgrades". Per CLAUDE.md cve-lite handling this hits the do-not-bump-across-a-major-line
  rule and the npm 10-vs-11 override-portability trap; done wrong it can break `npm ci`.
  That is a focused dep-hygiene task with its own review, not an inline drive-by inside a
  SARIF plan. Fixing it would also violate 35-04's additive-only must_have and the
  files_modified boundary.
- **Owner / next step:** a dedicated dependency-hygiene quick task (mirroring 260721-wda /
  260721-vm1) BEFORE the milestone PR's cve-lite gate: prefer a reviewed `overrides` entry
  pinning `fast-uri` to `>=3.1.4` (a single override covers all 5 paths and avoids the
  ajv major bump), then re-run `npm run cve-lite` + `npm ci` to confirm portability. Use the
  `atc-use-cve-lite-cli` skill. Consider the `@hono/node-server` MEDIUM in the same task.
